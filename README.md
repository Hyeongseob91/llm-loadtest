# LLM Loadtest

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

<p align="center">
  <a href="#english">English</a> •
  <a href="#한국어">한국어</a>
</p>

---

<h2 id="english">English</h2>

> Load testing tool for LLM inference servers with real-time dashboard and AI-powered analysis

Comprehensive benchmarking system for vLLM, SGLang, Ollama, and other OpenAI-compatible API servers. Monitor performance in real-time and visualize results through an interactive web dashboard.

### Key Features

| Feature | Description |
|---------|-------------|
| **Accurate Metrics** | tiktoken-based token counting, LLM-specific metrics (TTFT, TPOT, ITL) |
| **Quality-Based Evaluation** | Goodput - measures the percentage of requests meeting SLO thresholds |
| **Real-time Monitoring** | WebSocket progress updates, GPU metrics (memory, utilization, temperature, power) |
| **Visualization** | Interactive charts, export to CSV/Excel |
| **Extensibility** | Adapter pattern supporting vLLM, SGLang, Ollama, Triton, and more |
| **AI Analysis** | LLM-powered benchmark analysis reports with Thinking model support |

---

### Quick Start

#### Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/Hyeongseob91/llm-loadtest.git
cd llm-loadtest

# Start all services
docker compose up -d

# Access
# - Web UI: http://localhost:5050
# - API Docs: http://localhost:8085/docs
```

#### CLI Installation

```bash
# From project root
pip install -e .

# Basic load test
llm-loadtest run \
  --server http://localhost:8000 \
  --model qwen3-14b \
  --concurrency 1,10,50 \
  --num-prompts 100

# Goodput measurement (SLO-based)
llm-loadtest run \
  --server http://localhost:8000 \
  --model qwen3-14b \
  --concurrency 50 \
  --goodput ttft:500,tpot:50
```

---

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Web Dashboard                          │
│                    (Next.js + React)                        │
└─────────────────────────┬───────────────────────────────────┘
                          │ REST API / WebSocket
┌─────────────────────────▼───────────────────────────────────┐
│                       API Server                            │
│                       (FastAPI)                             │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                      Shared Core                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Load         │  │ Metrics      │  │ GPU          │      │
│  │ Generator    │  │ Calculator   │  │ Monitor      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Adapters     │  │ Database     │  │ Validator    │      │
│  │ (vLLM, etc.) │  │ (SQLite)     │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Project Structure (MSA)

```
llm-loadtest/
├── services/
│   ├── api/              # FastAPI backend server
│   │   └── routers/      # API endpoints (benchmarks, websocket, recommend)
│   ├── cli/              # Typer CLI tool
│   │   └── commands/     # CLI commands (run, recommend, info, gpu)
│   └── web/              # Next.js dashboard
│       ├── app/          # Pages (dashboard, benchmark, history)
│       └── components/   # UI components
├── shared/
│   ├── core/             # Core logic
│   │   ├── load_generator.py   # Load generation engine
│   │   ├── metrics.py          # Metrics calculation
│   │   ├── gpu_monitor.py      # GPU monitoring
│   │   ├── validator.py        # Metrics validation
│   │   └── models.py           # Data models
│   ├── adapters/         # Server adapters
│   │   ├── base.py             # Adapter interface + factory
│   │   └── openai_compat.py    # OpenAI API compatible adapter
│   └── database/         # SQLite storage
├── docs/guides/          # Documentation
└── docker-compose.yml
```

---

### Metrics

#### LLM-Specific Metrics

| Metric | Description | Unit | Calculation |
|--------|-------------|------|-------------|
| **TTFT** | Time To First Token | ms | First token arrival time - request start time |
| **TPOT** | Time Per Output Token | ms | (E2E - TTFT) / output token count |
| **E2E** | End-to-End Latency | ms | Response complete time - request start time |
| **ITL** | Inter-Token Latency | ms | Time interval between consecutive tokens |
| **Throughput** | Processing rate | tok/s | Total output tokens / test duration |
| **Request Rate** | Request processing rate | req/s | Completed requests / test duration |
| **Error Rate** | Error percentage | % | Failed requests / total requests × 100 |

#### Goodput (Quality-Based Throughput)

Percentage of requests meeting all SLO (Service Level Objective) thresholds.

```bash
# Goodput measurement example
llm-loadtest run \
  --server http://localhost:8000 \
  --model qwen3-14b \
  --goodput ttft:500,tpot:50,e2e:5000
```

**Calculation:**
```
Goodput = (Requests where TTFT ≤ 500ms AND TPOT ≤ 50ms AND E2E ≤ 5000ms) / Total requests × 100
```

#### Statistics

Each metric provides the following statistics:
- **min / max**: Minimum/Maximum values
- **mean**: Average
- **median (p50)**: Median value
- **p95 / p99**: Percentiles
- **std**: Standard deviation

---

### Supported Servers

| Server | Adapter | Status |
|--------|---------|--------|
| vLLM | openai | ✅ Supported |
| SGLang | openai | ✅ Supported |
| Ollama | openai | ✅ Supported |
| LMDeploy | openai | ✅ Supported |
| Triton | triton | 🚧 In Development |

Any server providing OpenAI-compatible API (`/v1/chat/completions`) is generally supported.

---

### CLI Commands

```bash
# Load test
llm-loadtest run \
  --server http://localhost:8000 \
  --model qwen3-14b \
  --concurrency 1,10,50,100 \
  --num-prompts 100 \
  --input-len 256 \
  --output-len 128 \
  --goodput ttft:500,tpot:50 \
  --stream

# Infrastructure recommendation
llm-loadtest recommend \
  --server http://localhost:8000 \
  --model qwen3-14b \
  --peak-concurrency 500 \
  --ttft-target 500 \
  --goodput-target 95

# System info
llm-loadtest info

# GPU status
llm-loadtest gpu
```

---

### API Endpoints

**Base URL:** `http://localhost:8085/api/v1`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/benchmark/run` | Start benchmark |
| `GET` | `/benchmark/{run_id}` | Get details |
| `GET` | `/benchmark` | List benchmarks |
| `DELETE` | `/benchmark/{run_id}` | Delete benchmark |
| `POST` | `/benchmark/{run_id}/cancel` | Cancel benchmark |
| `GET` | `/benchmark/{run_id}/export/csv` | Export to CSV |
| `GET` | `/benchmark/{run_id}/export/excel` | Export to Excel |
| `GET` | `/benchmark/result/{run_id}/analysis` | AI analysis report |
| `WS` | `/benchmark/{run_id}/progress` | Real-time progress |

---

### Web UI

| Page | Path | Features |
|------|------|----------|
| **Dashboard** | `/` | Benchmark list, recent runs |
| **New Benchmark** | `/benchmark/new` | Configure and start benchmarks |
| **Detail Page** | `/benchmark/[id]` | Real-time monitoring, results, AI analysis |
| **History** | `/history` | Past benchmark records |
| **Recommend** | `/recommend` | GPU infrastructure recommendation (Coming Soon) |
| **Compare** | `/compare` | Benchmark comparison (Coming Soon) |

---

### Tech Stack

**Backend:** Python 3.11+, FastAPI, asyncio/aiohttp, WebSocket, SQLite, tiktoken, pynvml, Typer

**Frontend:** Next.js 14, TypeScript, TanStack Query, Recharts, Tailwind CSS

**Infrastructure:** Docker Compose

---

### License

MIT License - See [LICENSE](LICENSE) for details.

---

### Contributing

Bug reports, feature requests, and PRs are welcome!

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

<h2 id="한국어">한국어</h2>

<details>
<summary><b>📖 한국어 문서 펼치기</b></summary>

> vLLM, SGLang, Ollama 등 LLM 서빙 서버의 성능을 측정하고 최적화하기 위한 부하 테스트 시스템

OpenAI-compatible API 서버의 부하 테스트를 수행하고, 결과를 Web 대시보드에서 시각화합니다.

### 핵심 가치

| 가치 | 설명 |
|------|------|
| **정확한 측정** | tiktoken 기반 토큰 카운팅, LLM 특화 메트릭 (TTFT, TPOT, ITL) |
| **품질 기반 평가** | Goodput - SLO를 만족하는 요청 비율 측정 |
| **실시간 모니터링** | WebSocket 진행률, GPU 메트릭 (메모리, 활용률, 온도, 전력) |
| **시각화** | 인터랙티브 차트, 결과 내보내기 (CSV/Excel) |
| **확장성** | 어댑터 패턴으로 vLLM, SGLang, Ollama, Triton 등 지원 |
| **AI 분석** | LLM 기반 벤치마크 분석 보고서, Thinking 모델 지원 |

---

### 빠른 시작

#### Docker Compose (권장)

```bash
# 저장소 클론
git clone https://github.com/Hyeongseob91/llm-loadtest.git
cd llm-loadtest

# 전체 서비스 시작
docker compose up -d

# 접속
# - Web UI: http://localhost:5050
# - API Docs: http://localhost:8085/docs
```

#### CLI 설치

```bash
# 프로젝트 루트에서
pip install -e .

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
```

---

### 메트릭

#### LLM 특화 메트릭

| 메트릭 | 설명 | 단위 | 계산 방식 |
|--------|------|------|-----------|
| **TTFT** | Time To First Token | ms | 첫 토큰 도착 시간 - 요청 시작 시간 |
| **TPOT** | Time Per Output Token | ms | (E2E - TTFT) / 출력 토큰 수 |
| **E2E** | End-to-End Latency | ms | 응답 완료 시간 - 요청 시작 시간 |
| **ITL** | Inter-Token Latency | ms | 연속된 토큰 간의 시간 간격 |
| **Throughput** | 처리량 | tok/s | 총 출력 토큰 / 테스트 지속 시간 |
| **Request Rate** | 요청 처리율 | req/s | 완료된 요청 / 테스트 지속 시간 |
| **Error Rate** | 오류율 | % | 실패 요청 / 전체 요청 × 100 |

#### Goodput (품질 기반 처리량)

SLO(Service Level Objective) 임계값을 모두 만족하는 요청의 비율입니다.

```bash
# Goodput 측정 예시
llm-loadtest run \
  --server http://localhost:8000 \
  --model qwen3-14b \
  --goodput ttft:500,tpot:50,e2e:5000
```

**계산 방식:**
```
Goodput = (TTFT ≤ 500ms AND TPOT ≤ 50ms AND E2E ≤ 5000ms인 요청 수) / 전체 요청 수 × 100
```

---

### CLI 명령어

```bash
# 부하 테스트
llm-loadtest run \
  --server http://localhost:8000 \
  --model qwen3-14b \
  --concurrency 1,10,50,100 \
  --num-prompts 100 \
  --input-len 256 \
  --output-len 128 \
  --goodput ttft:500,tpot:50 \
  --stream

# 인프라 추천
llm-loadtest recommend \
  --server http://localhost:8000 \
  --model qwen3-14b \
  --peak-concurrency 500 \
  --ttft-target 500 \
  --goodput-target 95

# 시스템 정보
llm-loadtest info

# GPU 상태
llm-loadtest gpu
```

---

### API 엔드포인트

**Base URL:** `http://localhost:8085/api/v1`

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/benchmark/run` | 벤치마크 시작 |
| `GET` | `/benchmark/{run_id}` | 상세 조회 |
| `GET` | `/benchmark` | 목록 조회 |
| `DELETE` | `/benchmark/{run_id}` | 삭제 |
| `POST` | `/benchmark/{run_id}/cancel` | 취소 |
| `GET` | `/benchmark/{run_id}/export/csv` | CSV 다운로드 |
| `GET` | `/benchmark/{run_id}/export/excel` | Excel 다운로드 |
| `GET` | `/benchmark/result/{run_id}/analysis` | AI 분석 보고서 |
| `WS` | `/benchmark/{run_id}/progress` | 실시간 진행률 |

---

### Web UI

| 페이지 | 경로 | 기능 |
|--------|------|------|
| **대시보드** | `/` | 벤치마크 목록, 최근 실행 상태 |
| **새 벤치마크** | `/benchmark/new` | 벤치마크 설정 및 시작 |
| **상세 페이지** | `/benchmark/[id]` | 실시간 모니터링, 결과 분석, AI 분석 보고서 |
| **히스토리** | `/history` | 과거 벤치마크 조회 |
| **인프라 추천** | `/recommend` | GPU 규모 추천 (준비중) |
| **비교** | `/compare` | 벤치마크 비교 (준비중) |

---

### 기술 스택

**Backend:** Python 3.11+, FastAPI, asyncio/aiohttp, WebSocket, SQLite, tiktoken, pynvml, Typer

**Frontend:** Next.js 14, TypeScript, TanStack Query, Recharts, Tailwind CSS

**Infrastructure:** Docker Compose

---

### 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE)를 참조하세요.

---

### 기여

버그 리포트, 기능 제안, PR을 환영합니다!

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

</details>
