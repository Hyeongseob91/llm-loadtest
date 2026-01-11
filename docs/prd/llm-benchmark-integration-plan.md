# llm-benchmark 통합 계획

> **작성일**: 2026-01-10
> **상태**: 승인됨
> **관련 프로젝트**: llm-loadtest, llm-benchmark

---

## 1. 요약

### 1.1 결정 사항

| 항목 | 결정 |
|------|------|
| **llm-benchmark** | 개발 중단, llm-loadtest로 통합 |
| **llm-loadtest** | 주 부하 테스트 도구로 발전 |
| **soundmind benchmark** | 현상 유지 (별도 영역) |

### 1.2 근거

llm-benchmark V2 PRD 분석 결과, 계획된 기능이 llm-loadtest에 **이미 구현**되어 있음:

| 기능 | llm-benchmark V2 계획 | llm-loadtest 현황 |
|------|----------------------|------------------|
| Goodput (SLO) | 추가 예정 | **이미 구현** |
| 어댑터 패턴 | 도입 예정 | **이미 구현** |
| tiktoken 토큰 카운팅 | 추가 예정 | **이미 구현** |
| Offline 벤치마크 | 제거 예정 | 미포함 (불필요) |
| Web UI | 유지 | **이미 구현** |

**결론**: 두 프로젝트 병행 유지는 리소스 낭비

---

## 2. 프로젝트 분석

### 2.1 기능 비교 매트릭스

| 기능 | llm-loadtest | llm-benchmark | 비고 |
|------|:-----------:|:-------------:|------|
| **Online 벤치마크** | O | O | 중복 |
| **Offline 벤치마크** | X | O (제거 예정) | 불필요 |
| **Goodput (SLO)** | O | X | loadtest 우위 |
| **tiktoken 토큰 카운팅** | O | X (근사치) | loadtest 우위 |
| **어댑터 패턴** | O | X | loadtest 우위 |
| **GPU 모니터링** | O (상세) | O (기본) | loadtest 우위 |
| **WebSocket 진행률** | O | X | loadtest 우위 |
| **API 인증** | O | X | loadtest 우위 |
| **Web UI** | O | O | 동등 |
| **다양한 리포트** | X | O | benchmark 우위 |
| **비교 기능** | O | O | 동등 |

### 2.2 코드베이스 크기

| 프로젝트 | 파일 수 | 주요 구성 |
|---------|--------|----------|
| llm-loadtest | 64개 | core, adapters, cli, api, web |
| llm-benchmark | 63개 | cli, api, web, benchmark, report |

### 2.3 완성도

| 프로젝트 | 완성도 | 상태 |
|---------|--------|------|
| llm-loadtest | ~70% | Phase 1-2 구현, 3-4 설계 중 |
| llm-benchmark | V1 완료 | V2는 llm-loadtest와 동일 방향 |

---

## 3. 통합 전략

### 3.1 llm-benchmark 처리 방안

#### 단계 1: 개발 중단 (즉시)

- 신규 기능 개발 중단
- 버그 수정만 최소한 유지

#### 단계 2: README 업데이트 (1일)

```markdown
# llm-benchmark

> **DEPRECATED**: 이 프로젝트는 [llm-loadtest](../llm-loadtest)로 통합되었습니다.
>
> llm-loadtest가 동일한 기능을 더 나은 구현으로 제공합니다:
> - Goodput (SLO 만족률) 측정
> - tiktoken 기반 정확한 토큰 카운팅
> - 다양한 서버 지원 (vLLM, SGLang, Ollama, Triton)

## 마이그레이션 가이드

| llm-benchmark | llm-loadtest |
|---------------|--------------|
| `llm-bench online --server ...` | `llm-loadtest run --server ...` |
| `llm-bench compare ...` | `llm-loadtest compare ...` |
| `llm-bench gpu` | `llm-loadtest gpu` |
| `llm-bench offline ...` | (지원 종료) |
```

#### 단계 3: 유용한 코드 이식 (선택, 2-3일)

llm-benchmark에서 llm-loadtest로 이식할 가치가 있는 코드:

| 소스 파일 | 이식 대상 | 우선순위 |
|----------|----------|----------|
| `report/html_report.py` | Standalone HTML 리포트 | 낮음 |
| `report/markdown_report.py` | Markdown 리포트 | 낮음 |
| `charts/plotly_charts.py` | 차트 스타일 개선 | 낮음 |

**참고**: Web UI가 있어서 별도 리포트 생성 필요성 낮음

#### 단계 4: 아카이브 (선택)

```bash
# llm-benchmark를 archived 상태로 전환
cd /mnt/data1/work/llm-benchmark
git tag -a v1.0-final -m "Final version before deprecation"

# 또는 GitHub에서 Archive 처리
```

---

## 4. llm-loadtest 강화 계획

### 4.1 통합 후 로드맵

| Phase | 작업 | 소요 |
|-------|------|------|
| 1-4 | 기존 PRD (안정화, 기능 개선) | 진행 중 |
| **5** | **인프라 추천 기능** | 5일 |
| 6 | HTML/Markdown 리포트 이식 (선택) | 2일 |

### 4.2 인프라 추천 기능 (Phase 5)

**새 기능**: `llm-loadtest recommend`

```bash
llm-loadtest recommend \
  --server http://localhost:8000 \
  --model qwen3-14b \
  --peak-concurrency 500 \
  --goodput-target 95

# 출력: "NVIDIA H100 5장 필요합니다"
```

**상세 PRD**: `docs/prd-phase5-infra-recommend.md` 참조

---

## 5. 역할 분담 명확화

### 5.1 도구별 역할

```
┌─────────────────────────────────────────────────────────┐
│ llm-loadtest                                            │
├─────────────────────────────────────────────────────────┤
│ 질문: "이 서버가 동시 500명을 버티는가?"               │
│       "버티려면 H100 몇 장이 필요한가?"                │
│                                                         │
│ 대상: MLOps, DevOps, 영업팀, PM                        │
│ 시점: 프로덕션 배포 전, 인프라 용량 산정               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ soundmind-ai-system benchmark                           │
├─────────────────────────────────────────────────────────┤
│ 질문: "이 RAG가 정확한 답변을 하는가?"                 │
│       "Semantic vs Character 청킹 어느 것이 나은가?"  │
│                                                         │
│ 대상: AI 엔지니어, 연구원, PM                          │
│ 시점: RAG 파이프라인 최적화, A/B 테스트               │
└─────────────────────────────────────────────────────────┘
```

### 5.2 사용 시나리오

| 시나리오 | 도구 | 이유 |
|---------|------|------|
| LLM 서버 성능 측정 | llm-loadtest | TTFT, Throughput, Goodput |
| 동시 사용자 수용량 확인 | llm-loadtest | 동시성별 부하 테스트 |
| GPU 인프라 추천 | llm-loadtest | 스케일링 계산 |
| RAG 답변 품질 비교 | soundmind benchmark | LLM-as-Judge |
| 청킹 전략 비교 | soundmind benchmark | A/B 테스트 |

---

## 6. 마이그레이션 가이드

### 6.1 CLI 명령어 매핑

| llm-benchmark | llm-loadtest | 비고 |
|---------------|--------------|------|
| `llm-bench online` | `llm-loadtest run` | 동일 기능 |
| `llm-bench offline` | - | 지원 종료 |
| `llm-bench compare` | `llm-loadtest compare` | 동일 기능 |
| `llm-bench export` | API `/export` 또는 Web UI | 내보내기 |
| `llm-bench serve` | `uvicorn llm_loadtest_api:app` | API 서버 |
| `llm-bench gpu` | `llm-loadtest gpu` | 동일 기능 |
| `llm-bench info` | `llm-loadtest info` | 동일 기능 |

### 6.2 옵션 매핑

| llm-benchmark | llm-loadtest | 비고 |
|---------------|--------------|------|
| `--server` | `--server` | 동일 |
| `--model` | `--model` | 동일 |
| `--concurrency` | `--concurrency` | 동일 |
| `--num-requests` | `--num-prompts` | 이름 변경 |
| `--stream` | `--stream` | 동일 |
| `--output` | `--output` | 동일 |
| - | `--goodput` | llm-loadtest 전용 |
| - | `--adapter` | llm-loadtest 전용 |

### 6.3 API 엔드포인트 매핑

| llm-benchmark | llm-loadtest | 비고 |
|---------------|--------------|------|
| `POST /run` | `POST /api/v1/benchmark/run` | 경로 변경 |
| `GET /run/:id` | `GET /api/v1/benchmark/run/:id` | 경로 변경 |
| `GET /result/:id` | `GET /api/v1/benchmark/result/:id` | 경로 변경 |
| `GET /history` | `GET /api/v1/benchmark/history` | 경로 변경 |
| `POST /compare` | `POST /api/v1/benchmark/compare` | 경로 변경 |
| - | `WS /ws/run/:id` | WebSocket 추가 |
| - | `GET /export` | 내보내기 추가 |

---

## 7. 타임라인

| 주차 | 작업 | 담당 |
|------|------|------|
| 1주차 | llm-benchmark README 업데이트 (deprecated) | 개발팀 |
| 1주차 | llm-loadtest Phase 1-4 완료 | 개발팀 |
| 2주차 | llm-loadtest Phase 5 (인프라 추천) 시작 | 개발팀 |
| 3주차 | Phase 5 완료 및 테스트 | 개발팀 |
| 4주차 | (선택) 리포트 기능 이식 | 개발팀 |

---

## 8. 결론

### 8.1 핵심 메시지

1. **llm-benchmark 개발 중단**: 리소스를 llm-loadtest에 집중
2. **llm-loadtest 고도화**: 인프라 추천 기능으로 차별화
3. **역할 명확화**: 성능 테스트 vs RAG 품질 평가

### 8.2 기대 효과

| 항목 | 효과 |
|------|------|
| 개발 리소스 | 중복 제거로 50% 절감 |
| 사용자 혼란 | 단일 도구로 명확화 |
| 기능 품질 | 집중 개발로 완성도 향상 |
