---
name: loadtest-system-context
description: >
  Provides comprehensive project context for llm-loadtest (vLLM load testing tool).
  Use when working with CLI, API, Core modules, Web dashboard, or Adapters.
  Triggers on questions about project structure, code navigation, metrics calculation,
  GPU monitoring, or adapter implementation. Keywords: vLLM, load test, benchmark,
  TTFT, throughput, OpenAI compatible, Triton, GPU monitor, async, aiohttp.
---

# llm-loadtest System Context

## Architecture Identity

| 구분 | 현재 상태 | 설명 |
|------|----------|------|
| **프로젝트 유형** | Monorepo | CLI, API, Core, Web이 하나의 저장소에 |
| **핵심 기능** | LLM 부하테스트 | vLLM 등 LLM 서버 성능 측정 |
| **주요 기술** | Python asyncio | 비동기 HTTP 클라이언트 기반 |
| **어댑터 패턴** | 다중 백엔드 | OpenAI Compatible, Triton 등 |

---

## Quick Reference

| Component | Location | Tech Stack | Entry Point |
|-----------|----------|------------|-------------|
| **CLI** | `cli/` | Click + Rich | `main.py` |
| **API** | `api/` | FastAPI + WebSocket | `main.py` |
| **Core** | `core/` | asyncio + aiohttp | `load_generator.py` |
| **Web** | `web/` | Next.js + TailwindCSS | `src/` |
| **Adapters** | `adapters/` | Protocol implementations | `base.py` |

### Core Modules

```
core/
├── load_generator.py    # 부하 생성 메인 로직
├── metrics.py           # TTFT, Throughput 등 메트릭 계산
├── models.py            # 데이터 모델 정의
├── gpu_monitor.py       # GPU 사용률 모니터링
├── tokenizer.py         # 토큰 카운팅
└── recommend.py         # 인프라 추천 로직
```

### Adapters

```
adapters/
├── base.py              # 추상 어댑터 베이스
├── openai_compat.py     # OpenAI Compatible API (vLLM)
└── triton.py            # Triton Inference Server
```

---

## System Overview

llm-loadtest는 **LLM 서버 성능 측정**을 위한 부하테스트 도구입니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                           │
│         ┌─────────────┐         ┌─────────────┐                │
│         │    CLI      │         │  Web UI     │                │
│         │  (cli/)     │         │  (web/)     │                │
│         └──────┬──────┘         └──────┬──────┘                │
│                │                       │                        │
│                └───────────┬───────────┘                        │
│                            │                                    │
│                            ▼                                    │
│                ┌─────────────────────┐                          │
│                │    FastAPI Server   │                          │
│                │       (api/)        │                          │
│                └──────────┬──────────┘                          │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Core Engine                              │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │LoadGenerator  │  │   Metrics    │  │ GPU Monitor  │         │
│  │ (async)       │──│  Calculator  │──│   (nvml)     │         │
│  └───────┬───────┘  └──────────────┘  └──────────────┘         │
│          │                                                      │
└──────────┼──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Adapters                                 │
│  ┌───────────────────┐    ┌───────────────────┐                │
│  │ OpenAI Compatible │    │   Triton Server   │                │
│  │    (vLLM, etc)    │    │                   │                │
│  └─────────┬─────────┘    └─────────┬─────────┘                │
│            │                        │                          │
└────────────┼────────────────────────┼──────────────────────────┘
             │                        │
             ▼                        ▼
      ┌──────────────┐         ┌──────────────┐
      │   vLLM       │         │   Triton     │
      │   Server     │         │   Server     │
      └──────────────┘         └──────────────┘
```

---

## Key Metrics

| Metric | Description | Unit |
|--------|-------------|------|
| **TTFT** | Time to First Token | ms |
| **TPS** | Tokens Per Second | tokens/s |
| **Throughput** | Requests Per Second | req/s |
| **Latency p50/p95/p99** | Response Time Percentiles | ms |
| **GPU Utilization** | GPU 사용률 | % |
| **GPU Memory** | VRAM 사용량 | GB |

---

## Code Navigation

### Common Patterns

| Pattern | Location | Example |
|---------|----------|---------|
| **Adapter** | `adapters/` | `openai_compat.py`, `triton.py` |
| **CLI Command** | `cli/src/llm_loadtest/commands/` | `run.py`, `gpu.py` |
| **API Route** | `api/src/llm_loadtest_api/routers/` | `benchmarks.py` |
| **Service** | `api/src/llm_loadtest_api/services/` | `benchmark_service.py` |
| **Data Model** | `core/models.py`, `api/.../schemas.py` | `BenchmarkResult` |

### Entry Points by Task

| Task | Start Here |
|------|------------|
| 부하테스트 로직 수정 | `core/load_generator.py` |
| 메트릭 계산 수정 | `core/metrics.py` |
| 새 어댑터 추가 | `adapters/base.py` → 상속 |
| CLI 명령어 추가 | `cli/src/llm_loadtest/commands/` |
| API 엔드포인트 추가 | `api/src/llm_loadtest_api/routers/` |
| GPU 모니터링 수정 | `core/gpu_monitor.py` |

---

## CLI Commands

```bash
# 부하테스트 실행
llm-loadtest run --url http://localhost:8000 --concurrency 10

# GPU 상태 확인
llm-loadtest gpu

# 시스템 정보
llm-loadtest info
```

---

## API Endpoints

```
POST /api/v1/benchmarks      → 벤치마크 시작
GET  /api/v1/benchmarks      → 벤치마크 목록
GET  /api/v1/benchmarks/{id} → 벤치마크 결과
WS   /ws/benchmark/{id}      → 실시간 진행 상황
```

---

## Configuration

### 환경 변수

```env
# vLLM 서버
VLLM_BASE_URL=http://localhost:8000/v1

# 테스트 설정
DEFAULT_CONCURRENCY=10
DEFAULT_DURATION=60
REQUEST_TIMEOUT=120

# GPU 모니터링
GPU_MONITOR_INTERVAL=1.0
```

---

## Frequently Asked Questions

### "새 어댑터 추가하려면?"

1. `adapters/base.py`의 `BaseAdapter` 상속
2. `send_request()` 메서드 구현
3. `adapters/__init__.py`에 등록

### "메트릭 계산 방식 수정하려면?"

1. `core/metrics.py` 수정
2. 해당 메트릭 계산 함수 수정
3. 테스트 케이스 업데이트

### "CLI에 새 옵션 추가하려면?"

1. `cli/src/llm_loadtest/commands/` 해당 명령어 파일 수정
2. Click decorator로 옵션 추가
3. 옵션 값을 Core 모듈에 전달

---

## Memory System Integration

복잡한 멀티스텝 작업 시 `.claude/skills/memory-system/SKILL.md`의 Memory System을 활용하세요.

**핵심 규칙:**
1. **Read Before Decide** - 주요 결정 전 `task_plan.md` 읽기
2. **Log All Errors** - 에러 발생 시 Error Log에 기록
3. **Update Checkpoint** - 세션 종료 시 `checkpoint.md` 업데이트

---

## Related Files

- `.claude/agents/loadtest-debugger.md` - 디버깅 에이전트
- `.claude/agents/loadtest-tester.md` - 테스트 에이전트
- `.claude/agents/loadtest-code-reviewer.md` - 코드 리뷰 에이전트
- `.claude/skills/memory-system/SKILL.md` - 메모리 시스템
- `.claude/skills/clarify/SKILL.md` - 요구사항 명확화
