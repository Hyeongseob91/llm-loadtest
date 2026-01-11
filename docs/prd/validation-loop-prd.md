# PRD: vLLM 부하테스트 결과 검증 시스템

> **Version**: 1.0
> **Created**: 2026-01-11
> **Status**: Draft

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
| 핵심 3개 메트릭 검증 | 전체 Prometheus 메트릭 수집 |
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

### 2.2 비기능 요구사항

| ID | 요구사항 | 기준 |
|----|---------|------|
| NFR-1 | 메트릭 수집 지연 | < 500ms |
| NFR-2 | 테스트 흐름 영향 | 기존 로직 최소 변경 |
| NFR-3 | 하위 호환성 | vLLM 미사용 시 정상 동작 |

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

---

## 4. 구현 계획

### 4.1 파일 구조

```
shared/core/
├── validator.py          # 새로 생성: MetricsValidator 클래스
├── load_generator.py     # 수정: 검증 로직 통합
└── models.py             # 수정: ValidationResult 추가
```

### 4.2 구현 단계

| Phase | 작업 | 예상 복잡도 |
|-------|-----|-----------|
| 1 | `validator.py` - Prometheus 메트릭 파싱 | 중 |
| 2 | `models.py` - ValidationResult 모델 추가 | 하 |
| 3 | `load_generator.py` - 검증 로직 통합 | 중 |
| 4 | 테스트 작성 | 중 |
| 5 | Web UI 검증 결과 표시 (선택) | 하 |

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

### 5.3 예상 출력

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

---

## 6. 리스크 및 완화

| 리스크 | 영향 | 완화 방안 |
|--------|-----|----------|
| vLLM 버전별 메트릭 이름 차이 | 파싱 실패 | 메트릭 이름 fallback 목록 유지 |
| 네트워크 지연으로 타이밍 차이 | 오차 증가 | TTFT는 10% 허용 오차 적용 |
| `/metrics` 비활성화된 서버 | 검증 불가 | 스킵 처리 + 경고 표시 |

---

## 7. 성공 기준

- [ ] 정상 케이스: 3개 메트릭 모두 ±5% 내 PASS
- [ ] vLLM 메트릭 없음: 경고 표시 후 정상 완료
- [ ] 오차 초과: WARNING 표시 + 결과 저장
- [ ] 기존 테스트 통과

---

## 8. 향후 확장 가능성

1. **CLI 옵션 추가**: `--skip-validation`, `--tolerance=0.1`
2. **추가 메트릭**: E2E Latency, Queue Time
3. **Triton 지원**: 어댑터별 검증 로직 분리
4. **Web UI**: 검증 결과 시각화 (통과/실패 뱃지)
