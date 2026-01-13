# CLI 사용법

> LLM Loadtest 명령줄 인터페이스 레퍼런스

## 설치

```bash
# 프로젝트 루트에서
pip install -e .
```

---

## llm-loadtest run

부하 테스트 실행

```bash
llm-loadtest run \
  --server http://localhost:8000 \    # 필수: 서버 URL
  --model qwen3-14b \                  # 필수: 모델명
  --concurrency 1,10,50,100 \          # 동시성 레벨 (쉼표 구분)
  --num-prompts 100 \                  # 요청 수 (--duration과 택일)
  --duration 60 \                      # 기간 기반 모드 (초)
  --input-len 256 \                    # 입력 토큰 길이
  --output-len 128 \                   # 최대 출력 토큰
  --stream \                           # 스트리밍 모드 (기본값)
  --no-stream \                        # 비스트리밍 모드
  --warmup 5 \                         # 워밍업 요청 수
  --timeout 120 \                      # 요청 타임아웃 (초)
  --api-key $API_KEY \                 # API 인증 키
  --adapter openai \                   # 어댑터 (openai, triton)
  --goodput ttft:500,tpot:50 \         # Goodput SLO 임계값
  --output result.json                 # 결과 JSON 파일 저장
```

### 옵션 상세

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `--server, -s` | string | (필수) | 서버 URL |
| `--model, -m` | string | (필수) | 모델명 |
| `--concurrency, -c` | string | "1" | 동시성 레벨 (쉼표 구분) |
| `--num-prompts, -n` | int | 100 | 요청 수 |
| `--duration, -d` | int | - | 기간 기반 테스트 (초) |
| `--input-len` | int | 256 | 입력 토큰 길이 |
| `--output-len` | int | 128 | 최대 출력 토큰 |
| `--stream/--no-stream` | bool | True | 스트리밍 모드 |
| `--warmup` | int | 3 | 워밍업 요청 수 |
| `--timeout` | float | 120.0 | 요청 타임아웃 (초) |
| `--api-key` | string | - | API 인증 키 |
| `--adapter` | string | "openai" | 서버 어댑터 |
| `--goodput` | string | - | SLO 임계값 |
| `--output, -o` | path | - | 결과 파일 경로 |

### 사용 예시

```bash
# 기본 부하 테스트
llm-loadtest run \
  --server http://localhost:8000 \
  --model qwen3-14b \
  --concurrency 1,10,50 \
  --num-prompts 100

# Goodput 측정 (SLO 기반)
llm-loadtest run \
  --server http://localhost:8000 \
  --model qwen3-14b \
  --concurrency 50 \
  --goodput ttft:500,tpot:50

# 결과 JSON 저장
llm-loadtest run \
  --server http://localhost:8000 \
  --model qwen3-14b \
  --output result.json
```

---

## llm-loadtest recommend

GPU 인프라 추천

```bash
llm-loadtest recommend \
  --server http://localhost:8000 \    # 필수: 서버 URL
  --model qwen3-14b \                  # 필수: 모델명
  --peak-concurrency 500 \             # 필수: 목표 피크 동시성
  --ttft-target 500 \                  # TTFT 목표 (ms)
  --tpot-target 50 \                   # TPOT 목표 (ms)
  --goodput-target 95 \                # Goodput 목표 (%)
  --headroom 20 \                      # 안전 여유분 (%)
  --concurrency-steps 1,10,50,100,200 \# 테스트할 동시성 레벨
  --num-requests 50 \                  # 레벨당 요청 수
  --output recommendation.json         # 결과 저장
```

### 옵션 상세

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `--server, -s` | string | (필수) | 서버 URL |
| `--model, -m` | string | (필수) | 모델명 |
| `--peak-concurrency, -p` | int | (필수) | 목표 피크 동시 사용자 |
| `--ttft-target` | float | 500 | TTFT 목표 (ms) |
| `--tpot-target` | float | 50 | TPOT 목표 (ms) |
| `--goodput-target` | float | 95 | Goodput 목표 (%) |
| `--headroom` | float | 20 | 안전 여유분 (%) |
| `--concurrency-steps` | string | "1,10,50,100,200" | 테스트할 동시성 레벨 |
| `--num-requests, -n` | int | 50 | 레벨당 요청 수 |
| `--output, -o` | path | - | 결과 파일 경로 |

### 출력 예시

```
╔═════════════════════════════════════════════════════════════╗
║                     RECOMMENDATION                          ║
╠═════════════════════════════════════════════════════════════╣
║                                                             ║
║   NVIDIA H100            x 5장                              ║
║                                                             ║
╚═════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────┐
│ CURRENT INFRASTRUCTURE                                      │
├─────────────────────────────────────────────────────────────┤
│ GPU               : NVIDIA H100                             │
│ Max Concurrency   : 120 (at 95.0% Goodput)                  │
│ Throughput        : 1245.0 tokens/s                         │
│ Saturation Point  : 150 concurrent                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ CALCULATION                                                 │
├─────────────────────────────────────────────────────────────┤
│ Formula: ceil(500 / 120) × 1.2 = 5                          │
│ Reasoning: 현재 H100 1장으로 최대 120명 동시 처리 가능...    │
└─────────────────────────────────────────────────────────────┘
```

---

## llm-loadtest info

시스템 정보 출력

```bash
llm-loadtest info
```

**출력 내용**:
- Python 버전
- llm-loadtest 버전
- 의존성 라이브러리 버전 (httpx, numpy, pydantic)
- NVIDIA 드라이버 버전
- GPU 정보

---

## llm-loadtest gpu

GPU 상태 모니터링

```bash
llm-loadtest gpu
```

**출력 내용**:
- Device Name
- Memory: 사용/총 메모리, 사용률
- GPU Util: GPU 활용률
- Temperature: 온도 (°C)
- Power: 전력 소비 (W)

---

## 어댑터 선택

```bash
# OpenAI-compatible (기본값) - vLLM, SGLang, Ollama
llm-loadtest run --adapter openai --server http://localhost:8000 ...

# Triton Inference Server
llm-loadtest run --adapter triton --server http://localhost:8000 ...
```
