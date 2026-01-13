# 아키텍처

> LLM Loadtest 시스템 아키텍처 및 프로젝트 구조

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        사용자                                │
│              CLI / Web UI (Next.js)                         │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                    API Server (FastAPI)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ REST Routes │  │  WebSocket  │  │ Auth Middleware     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐                           │
│  │  Database   │  │  Structlog  │                           │
│  │  (SQLite)   │  │   Logging   │                           │
│  └─────────────┘  └─────────────┘                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                    Benchmark Engine                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │LoadGenerator │  │MetricsCalc   │  │ TokenCounter     │   │
│  │ (asyncio)    │  │              │  │ (tiktoken)       │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ GPU Monitor  │  │GoodputCalc   │  │   Validator      │   │
│  │ (pynvml)     │  │              │  │ (Docker/Prom)    │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                    Server Adapters                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │OpenAI Compat │  │   Triton     │  │   (확장 가능)    │   │
│  │(vLLM,SGLang, │  │ (TensorRT)   │  │                  │   │
│  │ Ollama)      │  │              │  │                  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                    LLM Serving Server                        │
│           vLLM / SGLang / Ollama / LMDeploy / Triton        │
└─────────────────────────────────────────────────────────────┘
```

---

## 데이터 흐름

1. **요청 시작**: CLI/Web → API Server → Benchmark Engine
2. **부하 생성**: LoadGenerator가 asyncio.Semaphore로 동시성 제어하며 요청 전송
3. **메트릭 수집**: 각 요청의 TTFT, TPOT, ITL, E2E 측정
4. **토큰 카운팅**: tiktoken으로 정확한 토큰 수 계산
5. **집계**: MetricsCalculator가 통계(p50/p95/p99) 및 Goodput 계산
6. **검증**: Validator가 클라이언트-서버 메트릭 교차 검증
7. **저장/반환**: SQLite에 저장, WebSocket으로 실시간 전송

---

## 프로젝트 구조

```
llm-loadtest/
├── services/                  # 서비스 그룹 (MSA 스타일)
│   ├── api/                   # FastAPI 백엔드
│   │   ├── src/llm_loadtest_api/
│   │   │   ├── main.py        # FastAPI 앱
│   │   │   ├── routers/       # REST/WebSocket 라우터
│   │   │   ├── services/      # 비즈니스 로직
│   │   │   ├── database.py    # SQLite 연결
│   │   │   ├── auth.py        # API Key 인증
│   │   │   └── logging_config.py  # structlog 설정
│   │   └── Dockerfile
│   │
│   ├── cli/                   # CLI 도구
│   │   └── src/llm_loadtest/
│   │       ├── main.py        # typer 기반 CLI
│   │       └── commands/      # run, recommend, info, gpu 명령어
│   │
│   └── web/                   # Next.js 대시보드
│       ├── src/
│       │   ├── app/           # App Router 페이지
│       │   ├── components/    # React 컴포넌트
│       │   ├── hooks/         # 커스텀 훅
│       │   └── lib/           # API 클라이언트
│       └── Dockerfile
│
├── shared/                    # 공유 코드
│   ├── core/                  # 핵심 로직
│   │   ├── load_generator.py  # asyncio 기반 부하 생성
│   │   ├── metrics.py         # TTFT, TPOT, Goodput 계산
│   │   ├── models.py          # Pydantic 데이터 모델
│   │   ├── tokenizer.py       # tiktoken 토큰 카운팅
│   │   ├── gpu_monitor.py     # GPU 메트릭 수집
│   │   ├── recommend.py       # 인프라 추천 엔진
│   │   ├── validator.py       # 클라이언트-서버 메트릭 검증
│   │   └── docker_logs.py     # Docker 로그 수집/파싱
│   │
│   ├── adapters/              # 서버 어댑터
│   │   ├── base.py            # 추상 어댑터 인터페이스
│   │   ├── openai_compat.py   # vLLM, SGLang, Ollama
│   │   └── triton.py          # Triton Inference Server
│   │
│   └── database/              # 데이터베이스
│       └── database.py        # SQLite 벤치마크 결과 저장
│
├── tests/                     # 통합 테스트
│   ├── unit/                  # 단위 테스트
│   └── integration/           # 통합 테스트
│
├── docs/                      # 문서
│   ├── guides/                # 사용 가이드
│   └── prd/                   # PRD 문서
│
├── .claude/                   # Claude Code 설정
├── docker-compose.yml         # 오케스트레이션
└── pyproject.toml             # 패키지 설정
```

---

## 핵심 컴포넌트

### LoadGenerator

- asyncio 기반 비동기 부하 생성
- Semaphore를 통한 동시성 제어
- 실시간 진행률 콜백 지원

### MetricsCalculator

- TTFT, TPOT, ITL, E2E 계산
- 백분위수 통계 (p50, p95, p99)
- Goodput 계산 (SLO 기반)

### Validator

- Prometheus 메트릭 수집
- Docker 로그 파싱 (vLLM)
- 클라이언트-서버 메트릭 비교

### ServerAdapter

- 어댑터 패턴으로 다양한 서버 지원
- OpenAI Compatible API (vLLM, SGLang, Ollama)
- Triton Inference Server (개발 중)
