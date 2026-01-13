# PRD: Server Validation 개선 - Docker/Bare Metal 지원

> **Version**: 1.0
> **Created**: 2025-01-13
> **Status**: Draft

---

## 1. 개요

### 1.1 배경

현재 Server Validation 기능은 Docker 환경을 전제로 설계되어 있습니다:
- Docker 컨테이너 자동 감지 (포트 기반)
- `docker logs` 명령어로 로그 수집
- Prometheus `/metrics` 엔드포인트 검증

그러나 많은 사용자가 Docker 없이 직접 vLLM 서버를 실행합니다:
```bash
python -m vllm.entrypoints.openai.api_server --model ... --port 8000
```

이 경우 Docker 로그 검증이 불가능하며, 현재 UI에서 이를 구분하는 방법이 없습니다.

### 1.2 목적

- Docker 배포 여부를 선택할 수 있는 UI 제공
- Bare Metal (Non-Docker) 환경에서도 Prometheus 기반 검증 지원
- 배포 환경에 따른 적절한 필드 표시/숨김

### 1.3 범위

| 포함 | 제외 |
|------|------|
| Docker 체크박스 UI 추가 | Kubernetes 환경 지원 |
| 체크박스 상태에 따른 필드 제어 | PID 기반 로그 수집 |
| Prometheus-only 검증 모드 | 로그 파일 경로 직접 지정 |
| API 스키마 확장 | 새로운 검증 메트릭 추가 |

---

## 2. 요구사항

### 2.1 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-1 | Server Validation 섹션에 "Docker 배포" 체크박스 추가 | P0 |
| FR-2 | 체크박스 ON: Container Name 필드 활성화, Docker 로그 + Prometheus 검증 | P0 |
| FR-3 | 체크박스 OFF: Container Name 필드 비활성화, Prometheus만 검증 | P0 |
| FR-4 | Prometheus 접근 실패 시 경고 표시, 벤치마크는 계속 진행 | P1 |
| FR-5 | 검증 결과에 사용된 검증 소스 표시 (Docker/Prometheus/Both) | P2 |

### 2.2 비기능 요구사항

| ID | 요구사항 | 기준 |
|----|---------|------|
| NFR-1 | 기존 데이터 호환성 | validation_config에 docker_enabled 미지정 시 true로 처리 |
| NFR-2 | UI 반응성 | 체크박스 토글 시 즉시 필드 상태 변경 |

---

## 3. 기술 설계

### 3.1 UI 변경 (New Benchmark 페이지)

```
┌─────────────────────────────────────────────────────────────┐
│  Server Validation                               선택사항    │
├─────────────────────────────────────────────────────────────┤
│  [x] 서버 메트릭 검증 활성화                                  │
│                                                             │
│  [x] Docker 배포          ← 새로 추가                        │
│                                                             │
│  Docker Container Name    [vllm-server        ]  ← 활성화   │
│  Tolerance (%)            [0.05               ]             │
├─────────────────────────────────────────────────────────────┤
│  Docker OFF일 때:                                           │
│                                                             │
│  [ ] Docker 배포                                            │
│                                                             │
│  Docker Container Name    [비활성화됨         ]  ← 비활성화  │
│  Tolerance (%)            [0.05               ]             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 데이터 모델 변경

#### API 스키마 (schemas.py)
```python
class ValidationConfig(BaseModel):
    enabled: bool = Field(default=False)
    docker_enabled: bool = Field(
        default=True,
        description="Docker 배포 여부 (False면 Prometheus만 검증)"
    )
    container_name: Optional[str] = Field(default=None)
    tolerance: float = Field(default=0.05)
```

#### Web 타입 (api.ts)
```typescript
export interface ValidationConfig {
  enabled: boolean;
  docker_enabled?: boolean;  // 신규 추가, 기본값 true
  container_name?: string;
  tolerance?: number;
}
```

### 3.3 검증 로직 변경 (validator.py)

```python
class MetricsValidator:
    def __init__(
        self,
        server_url: str,
        docker_enabled: bool = True,  # 신규 파라미터
        container_name: Optional[str] = None,
        ...
    ):
        self.docker_enabled = docker_enabled

    async def initialize(self) -> None:
        # Prometheus는 항상 시도
        # Docker는 docker_enabled=True일 때만 시도
        if self.docker_enabled:
            # 기존 Docker 컨테이너 감지 로직
            ...
        else:
            self._docker_available = False
            logger.info("Docker validation disabled by user")
```

### 3.4 파일 변경 목록

| 파일 | 변경 내용 |
|------|----------|
| `services/api/src/.../schemas.py` | `docker_enabled` 필드 추가 |
| `services/web/src/lib/api.ts` | `docker_enabled` 타입 추가 |
| `services/web/src/app/benchmark/new/page.tsx` | Docker 체크박스 UI 추가 |
| `shared/core/validator.py` | `docker_enabled` 파라미터 처리 |
| `services/api/src/.../benchmark_service.py` | validator 초기화 시 파라미터 전달 |

---

## 4. 구현 계획

| Phase | 작업 | 복잡도 |
|-------|-----|--------|
| 1 | API 스키마 확장 (`docker_enabled`) | 하 |
| 2 | Web 타입 정의 추가 | 하 |
| 3 | New Benchmark UI - Docker 체크박스 추가 | 중 |
| 4 | validator.py - docker_enabled 분기 처리 | 중 |
| 5 | benchmark_service.py - 파라미터 전달 | 하 |
| 6 | 기존 데이터 호환성 테스트 | 하 |

---

## 5. 성공 기준

- [ ] Docker 체크박스 ON: Container Name 입력 가능, Docker + Prometheus 검증
- [ ] Docker 체크박스 OFF: Container Name 비활성화, Prometheus만 검증
- [ ] Prometheus 실패 시 경고 표시, 벤치마크 정상 완료
- [ ] 기존 validation_config (docker_enabled 없음) 정상 동작 (true로 처리)
- [ ] TypeScript 빌드 성공

---

## 6. UI 목업

### 6.1 Docker ON 상태 (기본값)
```
┌─ Server Validation ─────────────────────────────────────────┐
│                                                             │
│  [x] 서버 메트릭 검증 활성화                                  │
│                                                             │
│  [x] Docker 배포                                            │
│      vLLM이 Docker 컨테이너로 실행 중인 경우 체크            │
│                                                             │
│  Docker Container Name                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 자동 감지 (비워두면 포트 기반 감지)                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Tolerance (%)                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 0.05                                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Docker OFF 상태
```
┌─ Server Validation ─────────────────────────────────────────┐
│                                                             │
│  [x] 서버 메트릭 검증 활성화                                  │
│                                                             │
│  [ ] Docker 배포                                            │
│      vLLM이 Docker 컨테이너로 실행 중인 경우 체크            │
│                                                             │
│  Docker Container Name                    [비활성화]        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ (Docker 배포 시에만 사용)                  [disabled] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Tolerance (%)                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 0.05                                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ⚠ Prometheus (/metrics) 검증만 수행됩니다                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
