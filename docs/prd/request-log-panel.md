# PRD: Benchmark Running Page - Network 디버깅 패널

> **Version**: 1.0
> **Created**: 2026-01-12
> **Status**: Draft

---

## 1. 개요

### 1.1 배경
벤치마크 실행 중 개별 요청의 상태와 메트릭을 실시간으로 확인할 수 없어 디버깅이 어려움. 브라우저 개발자 도구 스타일의 Network 패널을 추가하여 각 요청의 진행 상황을 투명하게 모니터링.

### 1.2 목적
- 실시간으로 각 요청의 상태와 성능 메트릭 확인
- 실패한 요청 즉시 식별
- 디버깅 및 성능 분석 효율성 향상

### 1.3 범위

| 포함 | 제외 |
|------|------|
| 요청별 로그 테이블 | vLLM 서버 측 로그 직접 수집 |
| 실시간 WebSocket 업데이트 | 요청 본문/응답 상세 내용 |
| 토글 패널 UI | 로그 파일 내보내기 |
| 실패 요청 하이라이트 | 요청 재시도 기능 |

---

## 2. 요구사항

### 2.1 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-1 | 하단 토글 패널로 접힘/펼침 가능 | P0 |
| FR-2 | 요청별 로그 테이블 표시 (ID, Status, TTFT, E2E, Tokens, Success) | P0 |
| FR-3 | WebSocket으로 각 요청 완료 시 실시간 추가 | P0 |
| FR-4 | 최근 50개 요청만 유지 (rolling window) | P0 |
| FR-5 | 실패한 요청 빨간색 하이라이트 | P0 |
| FR-6 | 자동 스크롤 (새 요청 시 하단으로) | P1 |
| FR-7 | 패널 상태 (열림/닫힘) 로컬 저장 | P2 |

### 2.2 비기능 요구사항

| ID | 요구사항 | 기준 |
|----|---------|------|
| NFR-1 | 렌더링 성능 | 50개 행 표시 시 60fps 유지 |
| NFR-2 | 메모리 사용 | 50개 초과 시 오래된 항목 자동 제거 |
| NFR-3 | 다크모드 지원 | 기존 테마 시스템과 일관성 |

---

## 3. 기술 설계

### 3.1 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│ Benchmark Running Page                                  │
├─────────────────────────────────────────────────────────┤
│ [기존 컴포넌트들]                                       │
│ - 이중 진행률 바                                        │
│ - 실시간 메트릭 카드                                    │
│ - 시계열 차트                                           │
├─────────────────────────────────────────────────────────┤
│ [NEW] RequestLogPanel (토글 패널)                       │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 헤더: "Request Log" [▼ 접기/펼치기]  [50 requests]  │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ Table                                               │ │
│ │ ┌────┬────────┬───────┬───────┬────────┬─────────┐ │ │
│ │ │ #  │ Status │ TTFT  │ E2E   │ Tokens │ Result  │ │ │
│ │ ├────┼────────┼───────┼───────┼────────┼─────────┤ │ │
│ │ │ 1  │ ●      │ 45ms  │ 1.2s  │ 128    │ ✓       │ │ │
│ │ │ 2  │ ●      │ 52ms  │ 1.4s  │ 156    │ ✗ (red) │ │ │
│ │ │... │        │       │       │        │         │ │ │
│ │ └────┴────────┴───────┴───────┴────────┴─────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 3.2 데이터 모델

**백엔드 (WebSocket 메시지 확장)**

```python
# 기존 progress 메시지에 request_log 필드 추가
{
    "type": "progress",
    "run_id": "...",
    # ... 기존 필드들 ...
    "request_log": {  # NEW
        "request_id": 1,
        "status": "completed",  # "pending" | "running" | "completed" | "failed"
        "ttft_ms": 45.2,
        "e2e_ms": 1234.5,
        "output_tokens": 128,
        "success": true,
        "error_type": null,  # "timeout" | "connection" | "server_error" | null
        "timestamp": 1705123456.789
    }
}
```

**프론트엔드 (TypeScript)**

```typescript
interface RequestLogEntry {
  requestId: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  ttftMs: number | null;
  e2eMs: number | null;
  outputTokens: number | null;
  success: boolean;
  errorType: string | null;
  timestamp: number;
}

interface RequestLogPanelProps {
  logs: RequestLogEntry[];
  isExpanded: boolean;
  onToggle: () => void;
}
```

### 3.3 파일 구조

**수정 파일:**

| 파일 | 변경 내용 |
|------|----------|
| `shared/core/load_generator.py` | progress_callback에 request_log 포함 |
| `services/api/.../websocket.py` | WebSocket 메시지에 request_log 추가 |
| `services/web/.../useBenchmarkProgress.ts` | RequestLogEntry 파싱 추가 |
| `services/web/.../benchmark/[id]/page.tsx` | RequestLogPanel 통합 |

**신규 파일:**

| 파일 | 설명 |
|------|------|
| `services/web/src/components/RequestLogPanel.tsx` | 토글 패널 컴포넌트 |

---

## 4. 구현 계획

| Phase | 작업 | 복잡도 |
|-------|-----|--------|
| 1 | 백엔드: load_generator에서 요청별 로그 콜백 추가 | 중 |
| 2 | 백엔드: WebSocket 메시지에 request_log 필드 추가 | 하 |
| 3 | 프론트엔드: useBenchmarkProgress 훅에 로그 파싱 추가 | 하 |
| 4 | 프론트엔드: RequestLogPanel 컴포넌트 구현 | 중 |
| 5 | 프론트엔드: 메인 페이지에 패널 통합 | 하 |
| 6 | 테스트 및 다크모드 확인 | 하 |

---

## 5. 성공 기준

- [ ] Running 상태에서 하단에 토글 패널 표시
- [ ] 패널 클릭 시 접힘/펼침 동작
- [ ] 각 요청 완료 시 테이블에 실시간 추가
- [ ] 50개 초과 시 오래된 항목 자동 제거
- [ ] 실패 요청 빨간색 배경으로 하이라이트
- [ ] 다크모드에서 정상 표시

---

## 6. UI 상세 명세

### 6.1 패널 헤더

```
┌─────────────────────────────────────────────────────────┐
│ [▼] Request Log                           50 requests  │
└─────────────────────────────────────────────────────────┘
```

- 좌측: 토글 아이콘 (▼ 펼침, ▶ 접힘) + 제목
- 우측: 현재 로그 개수

### 6.2 테이블 컬럼

| 컬럼 | 너비 | 설명 |
|------|------|------|
| # | 60px | Request ID |
| Status | 80px | 상태 아이콘 (● pending, ● running, ● completed, ● failed) |
| TTFT | 80px | Time to First Token (ms) |
| E2E | 80px | End-to-End latency (ms → s 변환 표시) |
| Tokens | 80px | Output 토큰 수 |
| Result | 60px | ✓ 성공 / ✗ 실패 |

### 6.3 색상 테마

| 상태 | Light Mode | Dark Mode |
|------|------------|-----------|
| Pending | gray-400 | gray-500 |
| Running | blue-500 | blue-400 |
| Completed | green-500 | green-400 |
| Failed (row bg) | red-50 | red-900/20 |
| Failed (icon) | red-500 | red-400 |

---

## 7. 주요 코드 변경 포인트

### 7.1 load_generator.py 변경

```python
# _run_single_request() 완료 시점에 콜백 호출
async def _run_single_request(self, ...):
    result = await self.adapter.send_request(...)

    # 요청 완료 시 로그 콜백 (NEW)
    if self.request_log_callback:
        self.request_log_callback({
            "request_id": request_id,
            "status": "completed" if result.success else "failed",
            "ttft_ms": result.ttft_ms,
            "e2e_ms": result.e2e_latency_ms,
            "output_tokens": result.output_tokens,
            "success": result.success,
            "error_type": result.error_type,
            "timestamp": time.time()
        })

    return result
```

### 7.2 WebSocket 메시지 확장

```python
# 기존 progress 메시지에 request_log 추가
message = {
    "type": "progress",
    # ... 기존 필드 ...
    "request_log": request_log_entry  # 있을 때만 포함
}
```

### 7.3 RequestLogPanel 컴포넌트

```typescript
// 핵심 구조
export function RequestLogPanel({ logs, isExpanded, onToggle }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 자동 스크롤
  useEffect(() => {
    if (containerRef.current && isExpanded) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs.length, isExpanded]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border ...">
      {/* 헤더 (클릭 시 토글) */}
      <div onClick={onToggle} className="cursor-pointer p-4 flex justify-between">
        <span>{isExpanded ? '▼' : '▶'} Request Log</span>
        <span>{logs.length} requests</span>
      </div>

      {/* 테이블 (펼침 상태에서만) */}
      {isExpanded && (
        <div ref={containerRef} className="max-h-64 overflow-y-auto">
          <table>...</table>
        </div>
      )}
    </div>
  );
}
```

---

## 8. 검증 방법

### 8.1 수동 테스트

1. 벤치마크 실행 시작
2. Running 상태에서 하단 패널 표시 확인
3. 패널 헤더 클릭하여 토글 동작 확인
4. 요청 완료 시 테이블에 실시간 추가 확인
5. 50개 초과 시 오래된 항목 제거 확인
6. 의도적 실패 유도 후 빨간색 하이라이트 확인
7. 다크모드 전환하여 색상 확인

### 8.2 개발 서버 실행

```bash
# API 서버
cd services/api && uvicorn llm_loadtest_api.main:app --reload --port 8085

# Web 서버
cd services/web && npm run dev
```

---

## 9. PRD 저장 위치

**저장 경로**: `docs/prd/request-log-panel.md`

구현 시작 시 이 파일을 해당 경로로 복사합니다.
