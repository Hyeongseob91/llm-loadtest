# PRD: AI 분석 보고서 다운로드

> **Version**: 1.0
> **Created**: 2026-01-12
> **Status**: Draft

---

## 1. 개요

### 1.1 배경
현재 AI 분석 보고서는 화면에 렌더링만 되고 저장 기능이 없음.
사용자가 분석 결과를 문서로 보관하거나 공유하려면 수동 복사가 필요함.

### 1.2 목적
- AI 분석 보고서를 Markdown 파일로 다운로드
- 원클릭으로 보고서 저장 가능

### 1.3 범위
| 포함 | 제외 |
|------|------|
| Markdown 다운로드 | PDF 변환 |
| 브라우저 다운로드 | 서버 저장 |
| 분석 내용만 포함 | 원본 벤치마크 데이터 |

---

## 2. 요구사항

### 2.1 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-1 | 분석 완료 후 "다운로드" 버튼 표시 | P0 |
| FR-2 | 버튼 클릭 시 Markdown 파일 다운로드 | P0 |
| FR-3 | 파일명: `analysis_{model}_{date}.md` | P0 |
| FR-4 | 버튼은 헤더 영역에 고정 | P1 |
| FR-5 | 스트리밍 중에는 버튼 비활성화 (또는 숨김) | P1 |

### 2.2 비기능 요구사항

| ID | 요구사항 | 기준 |
|----|---------|------|
| NFR-1 | 다운로드 지연 | < 100ms |
| NFR-2 | 브라우저 호환 | Chrome, Firefox, Safari, Edge |

---

## 3. 기술 설계

### 3.1 구현 방식

```
[분석 완료] → [상태 변경: isComplete=true] → [다운로드 버튼 활성화]
                                                      ↓
                                            [클릭 시 Blob 생성]
                                                      ↓
                                            [브라우저 다운로드 트리거]
```

### 3.2 핵심 코드 (개념)

```typescript
// 다운로드 함수
const downloadAnalysis = () => {
  const content = analysisContent; // 스트리밍으로 누적된 텍스트
  const filename = `analysis_${model}_${formatDate(new Date())}.md`;

  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
};
```

### 3.3 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `services/web/src/app/benchmark/[id]/analysis/page.tsx` | 다운로드 버튼 추가, 핸들러 구현 |

---

## 4. 구현 계획

| Phase | 작업 | 복잡도 |
|-------|-----|--------|
| 1 | 다운로드 버튼 UI 추가 (헤더 영역) | 하 |
| 2 | downloadAnalysis 함수 구현 | 하 |
| 3 | 스트리밍 상태에 따른 버튼 활성화/비활성화 | 하 |

**예상 소요**: 30분 이내

---

## 5. 성공 기준

- [ ] 분석 완료 후 "다운로드" 버튼이 표시됨
- [ ] 버튼 클릭 시 `analysis_qwen3-30b_2026-01-12.md` 형식으로 다운로드됨
- [ ] 다운로드된 파일 내용이 화면에 표시된 분석과 동일함
- [ ] 스트리밍 중에는 버튼이 비활성화됨

---

## 6. UI 목업

```
┌──────────────────────────────────────────────────────────────┐
│  AI Analysis Report                     [📥 Download] [Back] │  ← 헤더
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  # 1. 환경 요약                                               │
│  GPU: 2x RTX PRO 6000 Blackwell (95GB VRAM)                  │
│  CPU: AMD EPYC 7453 28-Core                                  │
│  ...                                                         │
│                                                              │
│  # 2. 성능 개요                                               │
│  ...                                                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**버튼 상태:**
- 스트리밍 중: `[📥 Download]` 비활성화 (회색) 또는 숨김
- 완료 후: `[📥 Download]` 활성화 (파란색)

---

## 7. 향후 확장 가능성

구현 후 추가 고려 사항:
- PDF 내보내기 (별도 라이브러리 필요)
- 서버 저장 + 히스토리 조회
- 이메일/슬랙 공유 기능
