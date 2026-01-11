# PRD: Phase 5 - 인프라 추천 기능

> **버전**: 1.0
> **작성일**: 2026-01-10
> **상태**: Draft
> **선행 조건**: Phase 1-4 완료

---

## 1. 개요

### 1.1 목적

LLM 서빙 워크로드에 맞는 **GPU 인프라를 자동으로 추천**하는 기능을 추가합니다.

**목표 결과물**:
```
"프로젝트 규모(DAU 10,000, 피크 동시성 500명)에 맞춰서
Qwen3-14B-AWQ 모델은 NVIDIA H100 5장이 필요합니다."
```

### 1.2 배경

현재 llm-loadtest는 "서버가 버티는가?"를 측정하지만, **"버티려면 GPU가 몇 장 필요한가?"**는 사용자가 직접 계산해야 합니다.

**Pain Point**:
- 부하 테스트 결과를 보고 수동으로 스케일링 계산
- 프로젝트 규모에 맞는 인프라 산정 어려움
- 영업/PM이 고객에게 인프라 비용 제안 시 근거 부족

### 1.3 성공 지표

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| 추천 정확도 | 실제 필요량 대비 ±20% | 실제 배포 후 비교 |
| 사용자 만족도 | 4/5점 이상 | 피드백 수집 |
| 기능 사용률 | 월 10회 이상 | CLI/API 호출 로그 |

---

## 2. 사용자 스토리

### 2.1 페르소나

| 페르소나 | 설명 | 목표 |
|----------|------|------|
| **영업팀** | 고객에게 인프라 비용 제안 | "H100 5장 필요" 근거 확보 |
| **MLOps** | 프로덕션 인프라 설계 | SLO 기반 용량 산정 |
| **PM** | 프로젝트 비용 추정 | GPU 비용 계획 |

### 2.2 유저 스토리

| ID | 역할 | 원하는 것 | 수용 기준 |
|----|------|----------|----------|
| US-501 | 영업팀으로서 | 프로젝트 규모에 맞는 GPU 추천을 받길 | Given 워크로드 스펙 입력, When recommend 실행, Then "H100 N장 필요" 출력 |
| US-502 | MLOps로서 | SLO 기반 인프라 산정을 원함 | Given SLO 목표(TTFT, Goodput) 입력, When 계산, Then 목표 달성 가능한 인프라 제시 |
| US-503 | PM으로서 | 추천 근거를 문서화하길 | Given 추천 결과, When 내보내기, Then 계산 근거 포함된 리포트 생성 |

---

## 3. 기능 요구사항

### 3.1 데이터 모델

#### 3.1.1 WorkloadSpec (워크로드 스펙)

```python
class WorkloadSpec(BaseModel):
    """사용자가 입력하는 워크로드 스펙"""

    # 트래픽 규모
    daily_active_users: Optional[int] = None     # DAU
    peak_concurrency: int                         # 피크 동시 요청 수 (필수)
    requests_per_user_per_day: int = 10          # 사용자당 일일 요청 수

    # 요청 특성
    avg_input_tokens: int = 256                  # 평균 입력 토큰
    avg_output_tokens: int = 512                 # 평균 출력 토큰

    # SLO 요구사항
    ttft_target_ms: float = 500                  # TTFT 목표 (ms)
    tpot_target_ms: float = 50                   # TPOT 목표 (ms)
    goodput_target_percent: float = 95           # Goodput 목표 (%)
```

#### 3.1.2 InfraProfile (인프라 프로파일)

```python
class InfraProfile(BaseModel):
    """측정된 GPU 성능 프로파일"""

    # GPU 정보
    gpu_model: str                               # "NVIDIA H100", "A100-80GB"
    gpu_count: int                               # 현재 GPU 수량
    gpu_memory_gb: float                         # 총 VRAM

    # 측정된 성능 (부하 테스트 결과)
    max_concurrency_at_slo: int                  # SLO 만족하는 최대 동시성
    throughput_tokens_per_sec: float             # 처리량 (tokens/s)
    goodput_at_max_concurrency: float            # 최대 동시성에서의 Goodput

    # 포화점 분석
    saturation_concurrency: int                  # 성능 저하 시작점
    saturation_goodput: float                    # 포화점에서의 Goodput
```

#### 3.1.3 InfraRecommendation (추천 결과)

```python
class InfraRecommendation(BaseModel):
    """인프라 추천 결과"""

    # 입력 정보
    model_name: str
    workload: WorkloadSpec
    current_infra: InfraProfile

    # 추천 결과
    recommended_gpu: str                         # "NVIDIA H100"
    recommended_count: int                       # 추천 GPU 수량
    tensor_parallelism: int = 1                  # 권장 TP 설정

    # 예상 성능
    estimated_max_concurrency: int
    estimated_goodput: float
    estimated_throughput: float

    # 계산 근거
    headroom_percent: float = 20                 # 여유분 (%)
    calculation_formula: str                     # 계산식 설명
    reasoning: str                               # 상세 근거

    # 비용 (선택)
    estimated_monthly_cost_usd: Optional[float] = None  # 클라우드 비용
```

### 3.2 추천 알고리즘

#### 3.2.1 기본 공식

```
필요 GPU 수 = ceil(목표 동시성 / 현재 최대 동시성) × (1 + headroom)

예시:
- 목표 동시성: 500명
- 현재 H100 1장 최대 동시성: 120명 (Goodput 95%)
- Headroom: 20%
- 계산: ceil(500 / 120) × 1.2 = 5 × 1.2 = 6장
- 반올림: 5장 (headroom 내에서)
```

#### 3.2.2 포화점 기반 보정

```python
def calculate_recommendation(
    workload: WorkloadSpec,
    profile: InfraProfile,
    headroom: float = 0.2
) -> InfraRecommendation:

    # 1. 현재 인프라의 SLO 만족 최대 동시성 확인
    max_concurrency = profile.max_concurrency_at_slo

    # 2. 목표 동시성 대비 필요 배수 계산
    scaling_factor = workload.peak_concurrency / max_concurrency

    # 3. Headroom 적용
    required_gpus = math.ceil(scaling_factor * (1 + headroom))

    # 4. TP 최적화 고려 (모델 크기에 따라)
    if model_size > 30B:
        recommended_tp = 2
        required_gpus = max(required_gpus, 2)  # 최소 2장

    return InfraRecommendation(
        recommended_gpu=profile.gpu_model,
        recommended_count=required_gpus,
        calculation_formula=f"{workload.peak_concurrency} / {max_concurrency} × {1 + headroom}",
        reasoning=f"현재 {profile.gpu_model} 1장으로 최대 {max_concurrency}명 처리 가능. "
                  f"목표 {workload.peak_concurrency}명 처리를 위해 {required_gpus}장 필요."
    )
```

### 3.3 CLI 명령어

#### 3.3.1 recommend 명령어

```bash
llm-loadtest recommend \
  --server http://localhost:8000 \
  --model qwen3-14b \
  --peak-concurrency 500 \
  --ttft-target 500 \
  --goodput-target 95 \
  --headroom 20 \
  --output recommendation.json
```

#### 3.3.2 옵션 설명

| 옵션 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `--server` | Y | - | 테스트할 서버 URL |
| `--model` | Y | - | 모델 이름 |
| `--peak-concurrency` | Y | - | 목표 피크 동시 요청 수 |
| `--ttft-target` | N | 500 | TTFT 목표 (ms) |
| `--tpot-target` | N | 50 | TPOT 목표 (ms) |
| `--goodput-target` | N | 95 | Goodput 목표 (%) |
| `--headroom` | N | 20 | 여유분 (%) |
| `--concurrency-steps` | N | 1,10,50,100,200 | 테스트할 동시성 레벨 |
| `--num-requests` | N | 50 | 각 레벨당 요청 수 |
| `--output` | N | - | 결과 저장 파일 |

#### 3.3.3 출력 예시

```
╭─────────────────────────────────────────────────────────────╮
│                 Infrastructure Recommendation                │
╠═════════════════════════════════════════════════════════════╣
│ Model: Qwen3-14B-AWQ                                        │
│ Server: http://localhost:8000                               │
╠═════════════════════════════════════════════════════════════╣
│ WORKLOAD REQUIREMENTS                                        │
├─────────────────────────────────────────────────────────────┤
│ Peak Concurrency     : 500 users                            │
│ TTFT Target          : < 500 ms                             │
│ Goodput Target       : > 95%                                │
╠═════════════════════════════════════════════════════════════╣
│ CURRENT INFRASTRUCTURE                                       │
├─────────────────────────────────────────────────────────────┤
│ GPU                  : NVIDIA H100 × 1                      │
│ Max Concurrency      : 120 (at 95% Goodput)                 │
│ Throughput           : 1,245 tokens/s                       │
│ Saturation Point     : 150 concurrent (Goodput drops)       │
╠═════════════════════════════════════════════════════════════╣
│ RECOMMENDATION                                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ╔═══════════════════════════════════════════════════╗     │
│   ║  NVIDIA H100 × 5장                                ║     │
│   ╚═══════════════════════════════════════════════════╝     │
│                                                              │
│ Tensor Parallelism   : 1 (single GPU per replica)           │
│ Est. Max Concurrency : 600 users                            │
│ Est. Goodput         : 97.2%                                │
│ Headroom             : 20%                                  │
╠═════════════════════════════════════════════════════════════╣
│ CALCULATION                                                  │
├─────────────────────────────────────────────────────────────┤
│ Formula: ceil(500 / 120) × 1.2 = 5장                        │
│                                                              │
│ Reasoning:                                                   │
│ - 현재 H100 1장으로 최대 120명 동시 처리 (Goodput 95%)     │
│ - 목표 500명 처리를 위해 약 4.2배 필요                      │
│ - 20% 여유분 적용하여 5장 추천                              │
╰─────────────────────────────────────────────────────────────╯

Recommendation saved to: recommendation.json
```

### 3.4 API 엔드포인트

#### 3.4.1 POST /api/v1/benchmark/recommend

**Request**:
```json
{
  "server_url": "http://localhost:8000",
  "model": "qwen3-14b",
  "workload": {
    "peak_concurrency": 500,
    "ttft_target_ms": 500,
    "goodput_target_percent": 95
  },
  "headroom_percent": 20,
  "test_config": {
    "concurrency_steps": [1, 10, 50, 100, 200],
    "num_requests_per_step": 50
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "recommendation": {
      "recommended_gpu": "NVIDIA H100",
      "recommended_count": 5,
      "tensor_parallelism": 1,
      "estimated_max_concurrency": 600,
      "estimated_goodput": 97.2,
      "headroom_percent": 20,
      "calculation_formula": "ceil(500 / 120) × 1.2 = 5",
      "reasoning": "..."
    },
    "current_infra": {
      "gpu_model": "NVIDIA H100",
      "gpu_count": 1,
      "max_concurrency_at_slo": 120,
      "throughput_tokens_per_sec": 1245
    },
    "test_results": {
      "concurrency_results": [...],
      "saturation_point": 150
    }
  }
}
```

### 3.5 Web UI

#### 3.5.1 새 페이지: /recommend

**입력 폼**:
- 서버 URL, 모델명
- 워크로드 스펙 (피크 동시성, SLO 목표)
- 테스트 설정 (동시성 단계, 요청 수)

**결과 표시**:
- 추천 GPU 수량 (강조 표시)
- 계산 근거 및 공식
- 동시성별 Goodput 차트 (포화점 표시)
- 스케일링 곡선 시각화

---

## 4. 기술 요구사항

### 4.1 신규 파일

| 파일 | 설명 |
|------|------|
| `core/recommend.py` | 추천 알고리즘 구현 |
| `cli/src/llm_loadtest/commands/recommend.py` | CLI 명령어 |
| `api/src/llm_loadtest_api/routers/recommend.py` | API 엔드포인트 |
| `web/src/app/recommend/page.tsx` | Web UI 페이지 |

### 4.2 수정 파일

| 파일 | 수정 내용 |
|------|----------|
| `core/models.py` | WorkloadSpec, InfraProfile, InfraRecommendation 추가 |
| `cli/src/llm_loadtest/main.py` | recommend 명령어 등록 |
| `api/src/llm_loadtest_api/main.py` | recommend 라우터 등록 |
| `web/src/components/sidebar.tsx` | Recommend 메뉴 추가 |

### 4.3 의존성

- 기존 의존성 사용 (추가 없음)
- `core/load_generator.py` 재사용
- `core/metrics.py`의 GoodputCalculator 재사용

---

## 5. 구현 계획

### 5.1 마일스톤

| 단계 | 작업 | 예상 소요 |
|------|------|----------|
| 5.1 | 데이터 모델 정의 (`core/models.py`) | 0.5일 |
| 5.2 | 추천 알고리즘 구현 (`core/recommend.py`) | 1일 |
| 5.3 | CLI 명령어 구현 | 1일 |
| 5.4 | API 엔드포인트 구현 | 0.5일 |
| 5.5 | Web UI 페이지 구현 | 1일 |
| 5.6 | 테스트 및 문서화 | 1일 |
| **합계** | | **5일** |

### 5.2 검증 방법

1. **단위 테스트**: 추천 알고리즘 계산 정확성
2. **통합 테스트**: CLI → Core → API 흐름
3. **실제 환경 테스트**: 실제 GPU에서 추천 결과 검증

---

## 6. 리스크 및 제약사항

### 6.1 리스크

| 리스크 | 영향 | 완화 방안 |
|--------|------|----------|
| 추천 정확도 낮음 | 사용자 신뢰 하락 | 충분한 테스트 데이터 수집, headroom 조정 |
| 다양한 GPU 모델 대응 | 범용성 저하 | 프로파일 DB 확장, 사용자 입력 허용 |

### 6.2 제약사항

- 현재 서버에서 부하 테스트를 실행해야 추천 가능
- Tensor Parallelism 최적화는 단순 휴리스틱 사용
- 클라우드 비용 추정은 선택 기능 (외부 API 필요)

---

## 7. 향후 확장

### 7.1 Phase 5+ 후속 기능

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| GPU 프로파일 DB | 사전 측정된 GPU 성능 데이터베이스 | 높음 |
| 비용 계산기 | AWS/GCP/Azure GPU 비용 연동 | 중간 |
| 자동 스케일링 권장 | K8s HPA 설정 추천 | 낮음 |
| 히스토리 추적 | 추천 결과 저장 및 비교 | 낮음 |
