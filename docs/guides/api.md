# API 레퍼런스

> LLM Loadtest REST API 레퍼런스

**Base URL**: `http://localhost:8085`

---

## 엔드포인트 목록

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| GET | `/health` | 헬스 체크 | - |
| GET | `/api/v1/benchmark/health` | 상세 헬스 체크 | - |
| POST | `/api/v1/benchmark/run` | 벤치마크 시작 | 필요* |
| GET | `/api/v1/benchmark/run/{run_id}` | 상태 조회 | - |
| GET | `/api/v1/benchmark/result/{run_id}` | 결과 조회 | - |
| GET | `/api/v1/benchmark/result/{run_id}/export` | 내보내기 (CSV/Excel) | - |
| GET | `/api/v1/benchmark/history` | 히스토리 목록 | - |
| POST | `/api/v1/benchmark/compare` | 결과 비교 | - |
| DELETE | `/api/v1/benchmark/run/{run_id}` | 결과 삭제 | 필요* |
| WS | `/api/v1/benchmark/ws/run/{run_id}` | 실시간 진행률 | - |
| GET | `/api/v1/benchmark/ws/stats` | WebSocket 통계 | - |
| POST | `/api/v1/benchmark/recommend` | 인프라 추천 시작 | 필요* |
| GET | `/api/v1/benchmark/recommend/{run_id}` | 추천 상태 조회 | - |
| GET | `/api/v1/benchmark/recommend/{run_id}/result` | 추천 결과 조회 | - |
| DELETE | `/api/v1/benchmark/recommend/{run_id}` | 추천 삭제 | 필요* |
| GET | `/api/v1/benchmark/result/{run_id}/analysis` | AI 분석 보고서 (SSE) | - |

**\* 인증 필요**: `API_KEY` 환경변수 설정 시에만 활성화

---

## POST /api/v1/benchmark/run

벤치마크 시작

**요청 본문**:
```json
{
  "server_url": "http://localhost:8000",
  "model": "qwen3-14b",
  "adapter": "openai",
  "concurrency": [1, 10, 50],
  "num_prompts": 100,
  "input_len": 256,
  "output_len": 128,
  "stream": true,
  "warmup": 3,
  "timeout": 120.0,
  "api_key": "optional-key",
  "goodput_thresholds": {
    "ttft_ms": 500,
    "tpot_ms": 50,
    "e2e_ms": 3000
  },
  "validation_config": {
    "enabled": true,
    "container_name": "vllm-qwen3-30b",
    "tolerance": 0.05
  }
}
```

**응답**:
```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "started"
}
```

### validation_config 옵션

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `enabled` | bool | false | 검증 기능 활성화 |
| `container_name` | string | (자동감지) | vLLM Docker 컨테이너 이름 |
| `tolerance` | float | 0.05 | 허용 오차 비율 (0.0~1.0) |

---

## GET /api/v1/benchmark/result/{run_id}/export

결과 내보내기

**파라미터**:
- `format`: `csv` (기본) 또는 `xlsx`

**응답**: 파일 다운로드
- Content-Type: `text/csv` 또는 `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

---

## POST /api/v1/benchmark/recommend

인프라 추천 시작

**요청 본문**:
```json
{
  "server_url": "http://localhost:8000",
  "model": "qwen3-14b",
  "adapter": "openai",
  "workload": {
    "peak_concurrency": 500,
    "avg_input_tokens": 256,
    "avg_output_tokens": 512,
    "ttft_target_ms": 500,
    "tpot_target_ms": 50,
    "goodput_target_percent": 95
  },
  "headroom_percent": 20,
  "test_config": {
    "concurrency_steps": [1, 10, 50, 100, 200],
    "num_requests_per_step": 50
  }
}
```

**응답**:
```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "started"
}
```

---

## GET /api/v1/benchmark/recommend/{run_id}/result

추천 결과 조회

**응답**:
```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "recommendation": {
    "model_name": "qwen3-14b",
    "recommended_gpu": "NVIDIA H100",
    "recommended_count": 5,
    "tensor_parallelism": 1,
    "estimated_max_concurrency": 600,
    "estimated_goodput": 97.2,
    "estimated_throughput": 6225.0,
    "headroom_percent": 20,
    "calculation_formula": "ceil(500 / 120) × 1.2 = 5",
    "reasoning": "현재 H100 1장으로 최대 120명 동시 처리 가능..."
  },
  "current_infra": {
    "gpu_model": "NVIDIA H100",
    "gpu_count": 1,
    "max_concurrency_at_slo": 120,
    "throughput_tokens_per_sec": 1245.0
  },
  "test_results": [...]
}
```

---

## WebSocket /api/v1/benchmark/ws/run/{run_id}

실시간 진행률 업데이트

**메시지 형식**:
```json
{
  "type": "progress",
  "run_id": "...",
  "status": "running",
  "progress": {
    "current": 50,
    "total": 100,
    "percent": 50.0
  },
  "concurrency": {
    "level": 10,
    "index": 1,
    "total": 4
  },
  "metrics": {
    "ttft_avg": 45.2,
    "throughput_current": 234.5
  }
}
```
