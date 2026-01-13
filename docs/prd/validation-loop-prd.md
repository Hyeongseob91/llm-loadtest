# PRD: vLLM 부하테스트 결과 검증 시스템

> **Version**: 1.1
> **Created**: 2026-01-11
> **Updated**: 2026-01-12
> **Status**: Draft

### 변경 이력
| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0 | 2026-01-11 | 초안 작성 (Prometheus 메트릭 검증) |
| 1.1 | 2026-01-12 | Docker 로그 기반 검증 추가 (FR-5) |

---

## 1. 개요

### 1.1 배경
llm-loadtest 도구로 vLLM 서버 부하테스트를 수행할 때, 클라이언트 측에서 측정한 결과가 실제 서버에서 처리된 요청과 일치하는지 검증할 방법이 필요하다.

### 1.2 목적
- 부하테스트 결과의 **신뢰성 확보**
- 클라이언트-서버 간 **메트릭 교차 검증**
- 네트워크 손실, 측정 오류 등 **잠재적 문제 조기 발견**

### 1.3 범위
| 포함 | 제외 |
|------|------|
| vLLM `/metrics` 엔드포인트 수집 | Triton, 기타 백엔드 지원 |
| Docker 로그 기반 검증 | 로그 파일 직접 접근 |
| 핵심 메트릭 검증 (Prometheus + Docker 로그) | 전체 Prometheus 메트릭 수집 |
| 자동 검증 (테스트 완료 후) | 별도 CLI 명령어 |

---

## 2. 요구사항

### 2.1 기능 요구사항

#### FR-1: 메트릭 수집
| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-1.1 | 테스트 시작 전 vLLM `/metrics` 스냅샷 수집 | P0 |
| FR-1.2 | 테스트 종료 후 vLLM `/metrics` 스냅샷 수집 | P0 |
| FR-1.3 | 두 스냅샷의 차이 계산 (Counter 메트릭) | P0 |

#### FR-2: 교차 검증
| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-2.1 | 요청 수 비교: 클라이언트 vs `vllm:request_success_total` | P0 |
| FR-2.2 | TTFT 비교: 클라이언트 평균 vs `vllm:time_to_first_token_seconds` | P0 |
| FR-2.3 | 토큰 수 비교: 클라이언트 합계 vs `vllm:generation_tokens_total` | P0 |

#### FR-3: 결과 처리
| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-3.1 | ±5% 허용 오차 내 = PASS | P0 |
| FR-3.2 | 오차 초과 시 WARNING 표시 (테스트는 성공 처리) | P0 |
| FR-3.3 | 검증 결과를 BenchmarkResult에 포함하여 저장 | P0 |

#### FR-4: 예외 처리
| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-4.1 | `/metrics` 접근 불가 시 검증 스킵 (경고만 표시) | P1 |
| FR-4.2 | 메트릭 파싱 실패 시 해당 항목 스킵 | P1 |

#### FR-5: Docker 로그 수집 (v1.1 추가)
| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-5.1 | 테스트 시작 전 `docker logs --tail 100` 스냅샷 수집 | P0 |
| FR-5.2 | 테스트 종료 후 `docker logs --since [시작시간]` 스냅샷 수집 | P0 |
| FR-5.3 | HTTP 요청 로그 파싱 (`POST /v1/chat/completions` 200 OK 카운트) | P0 |
| FR-5.4 | Engine 통계 파싱 (prompt/generation throughput, KV cache usage) | P1 |
| FR-5.5 | ERROR/WARNING 로그 감지 및 경고 표시 | P1 |
| FR-5.6 | Docker 로그 수집 실패 시 경고 후 스킵 (테스트 계속) | P1 |

#### FR-6: Docker 로그 기반 교차 검증 (v1.1 추가)
| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-6.1 | 클라이언트 요청 수 vs Docker HTTP 200 OK 카운트 비교 | P0 |
| FR-6.2 | 클라이언트 throughput vs Engine generation throughput 비교 (±10% 허용) | P1 |
| FR-6.3 | ERROR 로그 존재 시 WARNING 플래그 설정 | P1 |

### 2.2 비기능 요구사항

| ID | 요구사항 | 기준 |
|----|---------|------|
| NFR-1 | 메트릭 수집 지연 | < 500ms |
| NFR-2 | Docker 로그 수집 지연 | < 2000ms |
| NFR-3 | 테스트 흐름 영향 | 기존 로직 최소 변경 |
| NFR-4 | 하위 호환성 | vLLM 미사용 시 정상 동작 |
| NFR-5 | Docker 미설치 환경 | 로그 검증 스킵 + 경고 |

---

## 3. 기술 설계

### 3.1 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                     LoadGenerator                           │
├─────────────────────────────────────────────────────────────┤
│  1. collect_server_metrics(before=True)                     │
│  2. run_benchmark()                                         │
│  3. collect_server_metrics(before=False)                    │
│  4. validate_results()                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   MetricsValidator                          │
├─────────────────────────────────────────────────────────────┤
│  - fetch_prometheus_metrics(url) → Dict                     │
│  - parse_vllm_metrics(raw) → VLLMMetrics                    │
│  - compare_metrics(client, server) → ValidationResult       │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 데이터 모델

```python
@dataclass
class VLLMServerMetrics:
    """vLLM /metrics 엔드포인트에서 수집한 메트릭"""
    request_success_total: int
    generation_tokens_total: int
    time_to_first_token_seconds: HistogramData  # sum, count, buckets
    timestamp: datetime

@dataclass
class ValidationResult:
    """검증 결과"""
    passed: bool
    tolerance: float  # 허용 오차 (기본 0.05)
    comparisons: List[MetricComparison]
    warnings: List[str]

@dataclass
class MetricComparison:
    """개별 메트릭 비교 결과"""
    metric_name: str
    client_value: float
    server_value: float
    difference_percent: float
    passed: bool
```

### 3.3 BenchmarkResult 확장

```python
@dataclass
class BenchmarkResult:
    # 기존 필드들...

    # 새로 추가
    validation: Optional[ValidationResult] = None
```

### 3.4 메트릭 매핑

| 클라이언트 메트릭 | vLLM Prometheus 메트릭 | 비교 방식 |
|-----------------|----------------------|----------|
| `total_requests` | `vllm:request_success_total` | 정수 비교 |
| `avg_ttft_ms` | `vllm:time_to_first_token_seconds` | sum/count로 평균 계산 후 비교 |
| `total_output_tokens` | `vllm:generation_tokens_total` | 정수 비교 |

### 3.5 Docker 로그 파싱 (v1.1 추가)

#### 파싱 대상 로그 패턴

**1. HTTP 요청 로그**
```
INFO: 172.21.0.1:45984 - "POST /v1/chat/completions HTTP/1.1" 200 OK
```
- 정규식: `"POST /v1/chat/completions HTTP/1\.1" (\d+)`
- 추출: HTTP 상태 코드 (200, 400, 500 등)

**2. Engine 통계 로그**
```
INFO 01-11 18:10:10 [loggers.py:248] Engine 000: Avg prompt throughput: 1159.8 tokens/s, Avg generation throughput: 565.9 tokens/s, Running: 25 reqs, Waiting: 0 reqs, GPU KV cache usage: 0.3%, Prefix cache hit rate: 90.1%
```
- 추출 항목:
  - `avg_prompt_throughput`: 프롬프트 처리 속도
  - `avg_generation_throughput`: 생성 처리 속도
  - `running_reqs`: 실행 중 요청 수
  - `waiting_reqs`: 대기 중 요청 수
  - `kv_cache_usage`: GPU KV 캐시 사용률
  - `prefix_cache_hit_rate`: Prefix 캐시 히트율

**3. 에러/경고 로그**
```
ERROR ...
WARNING ...
```
- 레벨 기반 필터링

#### 데이터 모델

```python
@dataclass
class DockerLogMetrics:
    """Docker 로그에서 파싱한 메트릭"""
    # HTTP 요청 통계
    http_200_count: int = 0
    http_error_count: int = 0  # 4xx, 5xx

    # Engine 통계 (마지막 값 또는 평균)
    avg_prompt_throughput: float = 0.0
    avg_generation_throughput: float = 0.0
    peak_kv_cache_usage: float = 0.0
    avg_running_reqs: float = 0.0

    # 에러/경고
    error_messages: List[str] = field(default_factory=list)
    warning_messages: List[str] = field(default_factory=list)

    # 메타데이터
    log_start_time: Optional[datetime] = None
    log_end_time: Optional[datetime] = None
    total_log_lines: int = 0

@dataclass
class DockerLogValidation:
    """Docker 로그 기반 검증 결과"""
    passed: bool
    http_request_match: bool  # 클라이언트 요청 수 vs HTTP 200
    throughput_match: bool    # ±10% 허용
    has_errors: bool          # ERROR 로그 존재 여부
    comparisons: List[MetricComparison]
    warnings: List[str]
```

### 3.6 Docker 로그 메트릭 매핑 (v1.1 추가)

| 클라이언트 메트릭 | Docker 로그 메트릭 | 비교 방식 | 허용 오차 |
|-----------------|------------------|----------|----------|
| `total_requests` | HTTP 200 OK 카운트 | 정수 비교 | ±5% |
| `avg_throughput` | Engine generation throughput | 평균 비교 | ±10% |
| (에러 여부) | ERROR 로그 존재 | 유무 체크 | - |

### 3.7 확장된 아키텍처 (v1.1)

```
┌─────────────────────────────────────────────────────────────────┐
│                       LoadGenerator                              │
├─────────────────────────────────────────────────────────────────┤
│  1. collect_server_metrics(before=True)                          │
│  2. collect_docker_logs(before=True)      ← NEW                  │
│  3. run_benchmark()                                              │
│  4. collect_server_metrics(before=False)                         │
│  5. collect_docker_logs(before=False)     ← NEW                  │
│  6. validate_results()                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│  MetricsValidator   │ │  DockerLogCollector │ │  ValidationResult   │
│  (Prometheus)       │ │  (Docker logs)      │ │  (통합 결과)        │
├─────────────────────┤ ├─────────────────────┤ ├─────────────────────┤
│ fetch_prometheus()  │ │ collect_logs()      │ │ prometheus_valid    │
│ parse_vllm_metrics()│ │ parse_http_logs()   │ │ docker_log_valid    │
│ compare_metrics()   │ │ parse_engine_stats()│ │ overall_passed      │
└─────────────────────┘ │ detect_errors()     │ └─────────────────────┘
                        └─────────────────────┘
```

---

## 4. 구현 계획

### 4.1 파일 구조

```
shared/core/
├── validator.py          # 새로 생성: MetricsValidator 클래스
├── docker_logs.py        # 새로 생성: DockerLogCollector 클래스 (v1.1)
├── load_generator.py     # 수정: 검증 로직 통합
└── models.py             # 수정: ValidationResult, DockerLogMetrics 추가
```

### 4.2 구현 단계

| Phase | 작업 | 예상 복잡도 |
|-------|-----|-----------|
| 1 | `validator.py` - Prometheus 메트릭 파싱 | 중 |
| 2 | `models.py` - ValidationResult 모델 추가 | 하 |
| 3 | `docker_logs.py` - Docker 로그 수집/파싱 (v1.1) | 중 |
| 4 | `models.py` - DockerLogMetrics 모델 추가 (v1.1) | 하 |
| 5 | `load_generator.py` - 검증 로직 통합 | 중 |
| 6 | 테스트 작성 | 중 |
| 7 | Web UI 검증 결과 표시 (선택) | 하 |

---

## 5. 검증 로직 상세

### 5.1 허용 오차 계산

```python
def is_within_tolerance(client: float, server: float, tolerance: float = 0.05) -> bool:
    if server == 0:
        return client == 0
    diff_percent = abs(client - server) / server
    return diff_percent <= tolerance
```

### 5.2 TTFT 비교 로직

vLLM의 TTFT는 Histogram으로 제공되므로:
```python
# 서버 측 평균 TTFT 계산
server_avg_ttft = histogram_sum / histogram_count

# 클라이언트 측 평균과 비교
client_avg_ttft = sum(ttft_values) / len(ttft_values)
```

### 5.3 예상 출력 (기존)

```
═══════════════════════════════════════════════════════════════
                    Validation Results
═══════════════════════════════════════════════════════════════
Metric               Client      Server      Diff     Status
───────────────────────────────────────────────────────────────
Request Count        1000        1000        0.0%     ✓ PASS
Avg TTFT (ms)        45.2        43.8        3.2%     ✓ PASS
Total Tokens         52340       52412       0.1%     ✓ PASS
═══════════════════════════════════════════════════════════════
Overall: PASSED (tolerance: ±5%)
```

### 5.4 Docker 로그 기반 검증 (v1.1 추가)

#### Docker 로그 수집 흐름

```python
class DockerLogCollector:
    def __init__(self, container_name: str):
        self.container_name = container_name
        self.start_timestamp: Optional[datetime] = None

    async def collect_before(self) -> None:
        """테스트 시작 전 타임스탬프 기록"""
        self.start_timestamp = datetime.utcnow()

    async def collect_after(self) -> DockerLogMetrics:
        """테스트 종료 후 로그 수집 및 파싱"""
        # docker logs --since {start_timestamp} {container_name}
        logs = await self._fetch_logs()
        return self._parse_logs(logs)

    def _parse_logs(self, logs: str) -> DockerLogMetrics:
        metrics = DockerLogMetrics()

        for line in logs.splitlines():
            # HTTP 요청 파싱
            if 'POST /v1/chat/completions' in line:
                if '200 OK' in line:
                    metrics.http_200_count += 1
                elif re.search(r'" [45]\d{2}', line):
                    metrics.http_error_count += 1

            # Engine 통계 파싱
            if 'Engine 000:' in line:
                self._parse_engine_stats(line, metrics)

            # 에러/경고 파싱
            if line.startswith('ERROR'):
                metrics.error_messages.append(line)
            elif line.startswith('WARNING'):
                metrics.warning_messages.append(line)

        return metrics
```

#### Docker 로그 검증 로직

```python
def validate_docker_logs(
    client_requests: int,
    client_throughput: float,
    docker_metrics: DockerLogMetrics,
    tolerance: float = 0.1  # 10% 허용 오차
) -> DockerLogValidation:
    comparisons = []

    # 1. HTTP 요청 수 비교
    http_match = is_within_tolerance(
        client_requests,
        docker_metrics.http_200_count,
        tolerance=0.05  # 5% 허용
    )
    comparisons.append(MetricComparison(
        metric_name="HTTP 200 Count",
        client_value=client_requests,
        server_value=docker_metrics.http_200_count,
        difference_percent=calc_diff_percent(client_requests, docker_metrics.http_200_count),
        passed=http_match
    ))

    # 2. Throughput 비교
    throughput_match = is_within_tolerance(
        client_throughput,
        docker_metrics.avg_generation_throughput,
        tolerance=0.10  # 10% 허용
    )
    comparisons.append(MetricComparison(
        metric_name="Avg Throughput",
        client_value=client_throughput,
        server_value=docker_metrics.avg_generation_throughput,
        difference_percent=calc_diff_percent(client_throughput, docker_metrics.avg_generation_throughput),
        passed=throughput_match
    ))

    # 3. 에러 체크
    has_errors = len(docker_metrics.error_messages) > 0

    return DockerLogValidation(
        passed=http_match and throughput_match and not has_errors,
        http_request_match=http_match,
        throughput_match=throughput_match,
        has_errors=has_errors,
        comparisons=comparisons,
        warnings=docker_metrics.warning_messages
    )
```

### 5.5 통합 예상 출력 (v1.1)

```
═══════════════════════════════════════════════════════════════
                    Validation Results
═══════════════════════════════════════════════════════════════
                   Prometheus Metrics
───────────────────────────────────────────────────────────────
Metric               Client      Server      Diff     Status
───────────────────────────────────────────────────────────────
Request Count        1000        1000        0.0%     ✓ PASS
Avg TTFT (ms)        45.2        43.8        3.2%     ✓ PASS
Total Tokens         52340       52412       0.1%     ✓ PASS
───────────────────────────────────────────────────────────────
                   Docker Log Validation
───────────────────────────────────────────────────────────────
HTTP 200 Count       1000        1000        0.0%     ✓ PASS
Avg Throughput       917.3       920.1       0.3%     ✓ PASS
HTTP Errors          0           0           -        ✓ PASS
Server Errors        0           -           -        ✓ PASS
───────────────────────────────────────────────────────────────
                   Additional Info
───────────────────────────────────────────────────────────────
Peak KV Cache Usage: 2.3%
Prefix Cache Hit:    90.1%
Warnings:            0
═══════════════════════════════════════════════════════════════
Overall: PASSED (Prometheus ✓, Docker Log ✓)
```

---

## 6. 리스크 및 완화

| 리스크 | 영향 | 완화 방안 |
|--------|-----|----------|
| vLLM 버전별 메트릭 이름 차이 | 파싱 실패 | 메트릭 이름 fallback 목록 유지 |
| 네트워크 지연으로 타이밍 차이 | 오차 증가 | TTFT는 10% 허용 오차 적용 |
| `/metrics` 비활성화된 서버 | 검증 불가 | 스킵 처리 + 경고 표시 |
| Docker 미설치/권한 없음 (v1.1) | 로그 수집 실패 | 경고 후 스킵, Prometheus만 사용 |
| 컨테이너 이름 불일치 (v1.1) | 로그 수집 실패 | 컨테이너 이름 자동 감지 또는 CLI 옵션 |
| vLLM 로그 포맷 변경 (v1.1) | 파싱 실패 | 정규식 패턴 버전별 관리 |
| 대용량 로그 (v1.1) | 수집 지연 | `--since` 옵션으로 범위 제한 |

---

## 7. 성공 기준

### 7.1 Prometheus 메트릭 검증
- [ ] 정상 케이스: 3개 메트릭 모두 ±5% 내 PASS
- [ ] vLLM 메트릭 없음: 경고 표시 후 정상 완료
- [ ] 오차 초과: WARNING 표시 + 결과 저장

### 7.2 Docker 로그 검증 (v1.1)
- [ ] 정상 케이스: HTTP 200 카운트 일치 (±5%)
- [ ] 정상 케이스: Throughput 일치 (±10%)
- [ ] Docker 없음: 경고 표시 후 Prometheus 검증만 수행
- [ ] ERROR 로그 감지: WARNING 플래그 + 메시지 표시
- [ ] 컨테이너 미실행: 경고 표시 후 스킵

### 7.3 통합
- [ ] 기존 테스트 통과
- [ ] BenchmarkResult에 검증 결과 포함

---

## 8. 향후 확장 가능성

1. **CLI 옵션 추가**: `--skip-validation`, `--tolerance=0.1`, `--container-name`
2. **추가 메트릭**: E2E Latency, Queue Time
3. **Triton 지원**: 어댑터별 검증 로직 분리
4. **Web UI**: 검증 결과 시각화 (통과/실패 뱃지)
5. **로그 레벨 설정 (v1.1)**: `VLLM_LOGGING_LEVEL=DEBUG` 자동 권장
6. **컨테이너 자동 감지 (v1.1)**: 포트 기반으로 vLLM 컨테이너 자동 탐지
7. **로그 파일 내보내기 (v1.1)**: 테스트별 로그 스냅샷 저장 옵션
