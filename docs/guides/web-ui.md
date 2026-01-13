# Web UI 가이드

> LLM Loadtest Web 대시보드 사용 가이드

## UX 흐름 개요

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Dashboard  │────▶│    New      │────▶│   Running   │────▶│   Result    │
│     (/)     │     │  Benchmark  │     │   (실시간)   │     │   (완료)    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                                                            │
       │                    ┌─────────────┐                         │
       └───────────────────▶│   Compare   │◀────────────────────────┘
                            │   Results   │
                            └─────────────┘
```

---

## 1. 대시보드 (/)

> 벤치마크 현황을 한눈에 파악하고 빠르게 액션을 취할 수 있는 메인 화면

### 화면 구성

| 영역 | 설명 |
|------|------|
| **Quick Actions** | 우측 상단의 `New Benchmark`, `Compare Results` 버튼으로 빠른 진입 |
| **Summary Cards** | Total Runs, Completed, Running, Failed 현황을 카드 형태로 표시 |
| **Recent Runs** | 최근 벤치마크 목록 - 모델명, 서버, 상태, 생성일시 표시 |
| **Sidebar** | Dashboard, New Benchmark, Recommend, History, Compare 메뉴 |
| **Dark Mode** | 좌측 하단의 Moon/Sun 토글로 다크모드 전환 |

### 상태 배지

- 🔵 **running**: 진행 중
- 🟢 **completed**: 완료
- 🔴 **failed**: 실패

---

## 2. 새 벤치마크 (/benchmark/new)

> 테스트 설정을 구성하고 벤치마크를 시작하는 페이지

### 화면 구성

| 영역 | 설명 |
|------|------|
| **Presets** | Quick / Standard / Stress 프리셋 선택 시 자동으로 설정값 적용 |
| **Selected Settings** | 선택된 프리셋의 설정값 미리보기 |
| **Server Settings** | vLLM 서버 URL, 모델명, API Key 입력 |
| **Load Parameters** | Concurrency, Prompts, Input/Output Length, Streaming 설정 |
| **Goodput SLO** | TTFT, TPOT, E2E 임계값 설정 (선택사항) |
| **Validation** | 클라이언트-서버 메트릭 교차 검증 설정 (선택사항) |

### 테스트 프리셋

| 프리셋 | 동시성 | 프롬프트 | Input | Output | 용도 |
|--------|--------|---------|-------|--------|------|
| **Quick** | 1, 5, 10 | 50 | 128 | 64 | 빠른 검증 (~1분) |
| **Standard** | 1, 10, 50, 100 | 200 | 256 | 128 | 일반 테스트 (~5분) |
| **Stress** | 10, 50, 100, 200, 500 | 500 | 512 | 256 | 스트레스 테스트 (~15분) |

### Goodput SLO 설명

| 메트릭 | 설명 | 권장값 |
|--------|------|--------|
| **TTFT** | 첫 토큰 응답 시간 - 사용자가 응답 시작을 체감하는 시간 | 500ms |
| **TPOT** | 토큰당 출력 시간 - 각 글자가 생성되는 속도 | 100ms |
| **E2E** | 전체 응답 시간 - 요청부터 응답 완료까지 총 소요 시간 | 10000ms |

---

## 3. 벤치마크 실행 중 (/benchmark/[id])

> 테스트 진행 상황을 실시간으로 모니터링하는 화면

### 화면 구성

| 영역 | 설명 |
|------|------|
| **이중 진행률 바** | 전체 진행률 + 레벨별 진행률 (Concurrency 단위) |
| **실시간 메트릭 카드** | Concurrency, 현재 Throughput, 평균 TTFT, 경과 시간 |
| **실시간 시계열 차트** | X축: 시간, Y축: Throughput/TTFT - 최근 60개 포인트 |

### Running 상태에서만 표시

- 이중 진행률 바 (전체 + 레벨)
- 실시간 메트릭 카드 (현재 Throughput, 평균 TTFT)
- 실시간 시계열 차트 (시간 기반)

### 완료 후에만 표시

- Best 지표 카드 (Best Throughput, Best TTFT, Best Concurrency, Error Rate)
- Throughput & Latency by Concurrency 차트
- 상세 결과 테이블

### 실시간 업데이트

- **WebSocket 연결**: "● 실시간 연결" 표시 - 즉각적인 진행률 업데이트
- **HTTP 폴링**: "○ 폴링 모드" 표시 - 3초 간격 자동 새로고침

### UX 특징

- **이중 진행률**: 전체 진행률과 현재 레벨 진행률을 동시에 표시하여 심리적 안정감 제공
- **실시간 메트릭**: "지금 서버가 버티는가?" 즉각 확인 가능
- **시계열 차트**: 시간에 따른 성능 추이를 실시간으로 모니터링

---

## 4. 벤치마크 결과 (/benchmark/[id])

> 완료된 벤치마크의 상세 결과를 분석하는 화면

### 화면 구성

| 영역 | 설명 |
|------|------|
| **Summary Cards** | Best Throughput, Best TTFT (p50), Best Concurrency, Error Rate |
| **Goodput** | SLO 임계값을 만족하는 평균 요청 비율 (%) |
| **Validation Results** | 클라이언트-서버 메트릭 교차 검증 결과 (활성화 시) |
| **Chart** | Throughput & Latency by Concurrency - 듀얼 Y축 라인 차트 |
| **상세 결과** | Concurrency별 상세 메트릭 테이블 |

### 차트 해석

| 라인 | 색상 | Y축 | 설명 |
|------|------|-----|------|
| **Throughput** | 파랑 | 좌측 | 동시성 증가에 따른 처리량 변화 |
| **TTFT p50** | 초록 | 우측 | 50% 요청의 첫 토큰 응답 시간 |
| **TTFT p99** | 주황 | 우측 | 99% 요청의 첫 토큰 응답 시간 |

### 결과 해석 가이드

```
Throughput ↑ & Latency 안정 → 서버 여유 있음
Throughput ↓ & Latency ↑   → 서버 포화 상태 (병목 발생)
```

### Validation Results (검증 결과)

벤치마크 생성 시 **Validation** 옵션을 활성화하면 클라이언트 측정 메트릭과 서버 측 메트릭을 교차 검증합니다.

| 항목 | 설명 |
|------|------|
| **Overall Status** | PASSED/FAILED 배지로 전체 검증 통과 여부 표시 |
| **Tolerance** | 허용 오차 범위 (기본값: ±5%) |
| **Metric Comparisons** | Client vs Server 메트릭 비교 테이블 |
| **Docker Log Metrics** | vLLM 컨테이너 로그에서 파싱한 메트릭 |
| **Warnings** | 검증 중 발생한 경고 메시지 |

---

## 5. 인프라 추천 (/recommend)

> **"이 서버가 동시 500명을 버티는가? 버티려면 H100 몇 장이 필요한가?"**

### 입력 폼

- **서버 설정**: Server URL, Model Name
- **워크로드 스펙**: Peak Concurrency (목표 동시 사용자)
- **SLO 목표**: TTFT Target, TPOT Target, Goodput Target
- **테스트 설정**: Concurrency Steps, Requests per Step, Headroom

### 결과 표시

- **추천 결과 박스**: `NVIDIA H100 × 5장` 형태로 강조 표시
- **현재 인프라 프로파일**: GPU 모델, 메모리, 최대 동시성, 처리량
- **예상 성능**: 추천 인프라에서의 예상 Max Concurrency, Goodput, Throughput
- **계산 근거**: 스케일링 공식 및 상세 reasoning

### 알고리즘

```
필요 GPU 수 = ceil(목표 동시성 / SLO 만족 최대 동시성) × (1 + headroom)
```

---

## 6. AI 분석 보고서 (/benchmark/[id]/analysis)

> 벤치마크 결과를 AI가 분석하여 전문가 수준의 보고서를 생성

### 주요 기능

| 기능 | 설명 |
|------|------|
| **실시간 스트리밍** | SSE 기반 실시간 보고서 생성 |
| **Thinking 모델 지원** | Qwen3-VL 등 `/think` 모델의 `</think>` 태그 자동 필터링 |
| **전문용어 설명** | TTFT, Throughput, Goodput 등 용어를 일반인도 이해할 수 있게 설명 |
| **구조화된 분석** | 성능 개요, 병목 지점, 권장 동시성, 개선 제안 포함 |
| **Markdown 다운로드** | 분석 완료 후 보고서를 Markdown 파일로 다운로드 |

### 분석 항목

1. **성능 개요**: 전반적인 서버 성능 요약
2. **Concurrency 영향 분석**: 동시성 증가에 따른 성능 변화 패턴
3. **병목 지점 식별**: 성능 저하 시작점과 원인 추정
4. **TTFT vs Throughput 트레이드오프**: 응답 시간과 처리량 균형점 분석
5. **권장 운영 동시성**: 최적 동시성 레벨 제시
6. **개선 제안**: 인프라, 모델, 설정 측면의 실행 가능한 조치

### 사용 방법

1. 벤치마크 결과 페이지에서 "AI 분석" 버튼 클릭
2. vLLM 서버 URL과 분석 모델 선택
3. "분석 시작" 클릭 → 실시간 보고서 생성
4. 분석 완료 후 "Download" 버튼으로 Markdown 파일 저장

---

## 7. 결과 비교 (/compare)

- 최대 **5개** 벤치마크 선택 비교
- **모델 비교 테이블**: 각 벤치마크의 핵심 메트릭
- **동시성별 처리량 비교 차트**: 멀티 라인 그래프

---

## 8. 히스토리 (/history)

- 모든 벤치마크 목록
- **상태 필터링**: Running (파랑), Completed (초록), Failed (빨강)
- **액션**: View (상세보기), Delete (삭제)

---

## UI/UX 특징

| 특징 | 설명 |
|------|------|
| **Skeleton UI** | 로딩 중에도 화면 구조를 미리 보여줘서 UX 개선 |
| **실시간 업데이트** | WebSocket + HTTP 폴링 이중화로 안정적인 실시간 모니터링 |
| **반응형 디자인** | 모바일부터 데스크톱까지 반응형 레이아웃 |
| **다크모드** | 시스템 설정 자동 감지 + 수동 토글 지원 |
| **한국어 지원** | 주요 UI 요소 한국어 라벨 제공 |
