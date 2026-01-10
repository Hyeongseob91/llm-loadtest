---
name: memory-system
description: >
  3-File Memory System for preventing Goal Drift in long-running tasks.
  Automatically activated for complex multi-step implementations.
  Core principle: "Before any major decision, read the plan file."
  Keywords: memory, plan, checkpoint, notes, task, goal drift, context
---

# Memory System Protocol

> **Purpose**: Context Window 한계를 우회하여 Goal Drift(목표 표류) 방지

---

## CRITICAL RULES

### Rule 1: READ BEFORE DECIDE

```
┌─────────────────────────────────────────────────────────────────┐
│  BEFORE ANY MAJOR DECISION, READ .claude/memory/task_plan.md   │
└─────────────────────────────────────────────────────────────────┘
```

**왜 중요한가?**
- LLM Attention은 최근 입력에 강하게 반응
- 결정 직전 task_plan.md 읽기 = 원래 목표가 최신 컨텍스트로 복원
- 50회 이상 도구 호출 시 Goal Drift 거의 필연적 발생

**적용 시점:**
- 새로운 파일 생성 전
- 아키텍처 결정 전
- 구현 방향 변경 전
- 에러 해결 방식 결정 전

---

### Rule 2: LOG ALL ERRORS

```
┌─────────────────────────────────────────────────────────────────┐
│  에러 발생 시 task_plan.md의 Error Log에 반드시 기록            │
└─────────────────────────────────────────────────────────────────┘
```

**왜 중요한가?**
- 무한 재시도 루프 차단
- AI가 실패를 명시적으로 인정 → 계획 수정 유도
- 디버깅 로그 자동 축적

**기록 형식:**
```markdown
| Date | Phase | Error Description | Attempted Solution | Result |
|------|-------|-------------------|-------------------|--------|
| 2025-01-06 | 2 | Docker build fail | 누락된 의존성 추가 | RESOLVED |
```

**3회 반복 규칙:**
- 동일 에러 3회 반복 시 접근 방식 변경 필수
- Error Patterns 섹션에 기록

---

### Rule 3: UPDATE CHECKPOINT

```
┌─────────────────────────────────────────────────────────────────┐
│  세션 종료 전 .claude/memory/checkpoint.md 업데이트 필수        │
└─────────────────────────────────────────────────────────────────┘
```

**왜 중요한가?**
- 다음 세션 시작 시 컨텍스트 복원
- 진행 상황 추적
- 다음 단계 명확화

**업데이트 내용:**
- What Was Accomplished
- What's In Progress
- Files Modified
- Immediate Next Steps

---

## File System Structure

```
.claude/memory/
├── task_plan.md          # Master Plan (MOST IMPORTANT)
│   ├── Objective         # 한 문장 목표 정의
│   ├── Success Criteria  # 완료 기준
│   ├── Phases            # 단계별 체크리스트
│   ├── Current Status    # 현재 위치
│   ├── Error Log         # 실패 기록 (CRITICAL)
│   └── Decisions Log     # 결정 기록
│
├── notes.md              # Research Notes
│   ├── Key Findings      # 발견 사항
│   ├── Code References   # 코드 위치
│   └── Ideas             # 대안, 아이디어
│
└── checkpoint.md         # Session State
    ├── Progress Overview # 진행률 시각화
    ├── Files Modified    # 변경 파일 목록
    └── Next Steps        # 다음 단계
```

---

## Workflow

### 1. Task Start (새 작업 시작)

```bash
# 템플릿으로 memory 파일 초기화
./scripts/init_task.sh "TaskName"
```

또는 수동으로:
1. `.claude/memory/task_plan.md` 생성
2. Objective 정의
3. Phases와 Steps 작성
4. Success Criteria 명시

### 2. During Work (작업 중)

```
┌─────────────────┐
│   작업 수행     │
└────────┬────────┘
         │
         ▼
    ┌─────────┐     YES    ┌──────────────────┐
    │ 주요    │───────────▶│ task_plan.md     │
    │ 결정?   │            │ READ             │
    └────┬────┘            └──────────────────┘
         │ NO
         ▼
    ┌─────────┐     YES    ┌──────────────────┐
    │ 에러    │───────────▶│ Error Log        │
    │ 발생?   │            │ WRITE            │
    └────┬────┘            └──────────────────┘
         │ NO
         ▼
    ┌─────────┐     YES    ┌──────────────────┐
    │ 리서치  │───────────▶│ notes.md         │
    │ 결과?   │            │ APPEND           │
    └────┬────┘            └──────────────────┘
         │ NO
         ▼
    ┌─────────────────┐
    │   계속 작업     │
    └─────────────────┘
```

### 3. Phase Complete (단계 완료)

1. task_plan.md에서 체크박스 업데이트 `- [x]`
2. Current Status 섹션 업데이트
3. Decisions Log에 주요 결정 기록

### 4. Session End (세션 종료)

1. checkpoint.md 업데이트
   - What Was Accomplished
   - Files Modified
   - Immediate Next Steps
2. Session History에 기록 추가

### 5. Session Resume (세션 재개)

1. checkpoint.md READ (Quick Resume Checklist)
2. task_plan.md READ (Current Status)
3. notes.md SCAN (관련 정보)

---

## Pre-Decision Checklist

> **주요 결정 전 반드시 확인**

```markdown
- [ ] task_plan.md의 Objective와 일치하는가?
- [ ] Error Log에서 관련 실패 사례를 확인했는가?
- [ ] notes.md에 관련 리서치 결과가 있는가?
- [ ] 이 결정이 다른 Phase에 영향을 주는가?
- [ ] Success Criteria를 만족하는 방향인가?
```

---

## Post-Error Protocol

> **에러 발생 시 프로토콜**

```markdown
1. [ ] Error Log에 즉시 기록
2. [ ] 동일 에러 이력 확인 (3회 규칙)
3. [ ] 3회 이상 반복 시:
       - Error Patterns에 기록
       - 접근 방식 변경 검토
       - notes.md에 대안 기록
4. [ ] 해결 후 Result 컬럼 업데이트
```

---

## Quick Commands

```bash
# Task 초기화
./scripts/init_task.sh "My-Task-Name"

# Checkpoint 요약 보기
./scripts/checkpoint.sh

# 현재 상태 빠른 확인
cat .claude/memory/task_plan.md | grep -A5 "Current Status"

# Error Log 확인
cat .claude/memory/task_plan.md | grep -A20 "Error Log"
```

---

## Integration with Other Skills

이 Memory System은 다른 Skills과 함께 사용됩니다:

- **soundmind-system**: 프로젝트 컨텍스트 참조
- **code-reviewer**: 코드 리뷰 시 task_plan.md 목표 확인
- **rag-analyzer**: RAG 문제 진단 시 Error Log 활용

---

## Example Usage

### Good Practice

```
Claude: task_plan.md를 읽어 현재 목표 확인...
        → Objective: "RAG-Naive Docker 배포"
        → Current: Phase 1, Step 1.2

Claude: Dockerfile 생성 시작. 이것은 주요 결정이므로
        task_plan.md의 Review Checklist 확인...
        ✓ Objective와 일치
        ✓ 관련 에러 없음
        ✓ notes.md에 관련 정보 있음

Claude: [에러 발생] ModuleNotFoundError
        → Error Log에 기록
        → 이전 유사 에러 없음
        → 해결 시도...

Claude: Step 1.2 완료. task_plan.md 업데이트.
        → [x] Step 1.2: Dockerfile 생성
        → Current Status: Phase 1, Step 1.3
```

### Bad Practice (AVOID)

```
Claude: 바로 Dockerfile 작성 시작...
        (task_plan.md 확인 안 함)

Claude: [에러 발생] 같은 방법으로 재시도...
        (Error Log 기록 안 함)

Claude: [또 에러] 같은 방법으로 재시도...
        (3회 반복해도 방식 변경 안 함)

Claude: 세션 종료
        (checkpoint.md 업데이트 안 함)
```

---

## Templates

> **Memory 파일 생성 시 아래 템플릿 사용**

### task_plan.md Template

```markdown
# [TASK_NAME] - Task Plan

> **Created**: [DATE]
> **Status**: In Progress

---

## Objective

<!-- 한 문장으로 목표 정의 -->
[GOAL_STATEMENT]

---

## Success Criteria

- [ ] [CRITERION_1]
- [ ] [CRITERION_2]
- [ ] [CRITERION_3]

---

## Phases

### Phase 1: [PHASE_NAME]

- [ ] Step 1.1: [DESCRIPTION]
- [ ] Step 1.2: [DESCRIPTION]
- [ ] Step 1.3: [DESCRIPTION]

### Phase 2: [PHASE_NAME]

- [ ] Step 2.1: [DESCRIPTION]
- [ ] Step 2.2: [DESCRIPTION]

### Phase 3: [PHASE_NAME]

- [ ] Step 3.1: [DESCRIPTION]
- [ ] Step 3.2: [DESCRIPTION]

---

## Current Status

| Field | Value |
|-------|-------|
| **Phase** | 1 |
| **Step** | 1.1 |
| **State** | Not Started |
| **Last Updated** | [DATE] |

---

## Error Log

| Date | Phase | Error Description | Attempted Solution | Result |
|------|-------|-------------------|-------------------|--------|
| | | | | |

---

## Error Patterns

> 3회 이상 반복된 에러 기록

| Pattern | Count | Root Cause | Resolution |
|---------|-------|------------|------------|
| | | | |

---

## Decisions Log

| Date | Decision | Rationale | Impact |
|------|----------|-----------|--------|
| | | | |

---

## Blockers

- [ ] [BLOCKER_DESCRIPTION]

---

## Dependencies

- [DEPENDENCY_1]
- [DEPENDENCY_2]

---

## Quick Reference

### Key Files
- `[FILE_PATH_1]`
- `[FILE_PATH_2]`

### Key Commands
\`\`\`bash
[COMMAND_1]
[COMMAND_2]
\`\`\`

---

## Review Checklist

> 주요 결정 전 확인

- [ ] Objective와 일치하는가?
- [ ] Error Log에서 관련 실패 사례 확인했는가?
- [ ] notes.md에 관련 리서치 결과가 있는가?
- [ ] 다른 Phase에 영향을 주는가?
- [ ] Success Criteria를 만족하는 방향인가?
```

---

### notes.md Template

```markdown
# [TASK_NAME] - Research Notes

> **Created**: [DATE]
> **Last Updated**: [DATE]

---

## Key Findings

### [TOPIC_1]
- [FINDING]
- [FINDING]

### [TOPIC_2]
- [FINDING]

---

## Code References

| File | Line | Description |
|------|------|-------------|
| `[PATH]` | [LINE] | [DESCRIPTION] |

---

## Architecture Notes

### Current Understanding
[DESCRIPTION]

### Patterns Discovered
- [PATTERN_1]
- [PATTERN_2]

---

## External Resources

- [RESOURCE_NAME](URL) - [DESCRIPTION]

---

## Intermediate Data

### Test Results
[DATA]

### API Responses
[DATA]

### Performance Metrics
[DATA]

---

## Ideas & Alternatives

### Considered Alternatives
- [ALTERNATIVE_1]: [PROS/CONS]
- [ALTERNATIVE_2]: [PROS/CONS]

### Future Improvements
- [IMPROVEMENT_1]
- [IMPROVEMENT_2]

---

## Questions to Resolve

- [ ] [QUESTION_1]
- [ ] [QUESTION_2]

---

## Scratchpad

[TEMPORARY_NOTES]
```

---

### checkpoint.md Template

```markdown
# [TASK_NAME] - Session Checkpoint

> **Last Session**: [DATE]
> **Overall Progress**: [PERCENTAGE]%

---

## Current Session Summary

### What Was Accomplished
- [ACCOMPLISHMENT_1]
- [ACCOMPLISHMENT_2]

### What's In Progress
- [IN_PROGRESS_1]

### What's Blocking
- [BLOCKER_1]

---

## Task Progress Overview

\`\`\`
Phase 1: [██████████] 100%
Phase 2: [████░░░░░░]  40%
Phase 3: [░░░░░░░░░░]   0%
\`\`\`

---

## Detailed Progress

### Phase 1: [NAME]
| Step | Status | Notes |
|------|--------|-------|
| 1.1 | ✅ Done | [NOTE] |
| 1.2 | ✅ Done | [NOTE] |
| 1.3 | ✅ Done | [NOTE] |

### Phase 2: [NAME]
| Step | Status | Notes |
|------|--------|-------|
| 2.1 | 🔄 In Progress | [NOTE] |
| 2.2 | ⏳ Pending | |

---

## Key Decisions Made This Session

| Decision | Rationale |
|----------|-----------|
| [DECISION] | [RATIONALE] |

---

## Files Modified

| File | Change Type | Description |
|------|-------------|-------------|
| `[PATH]` | Created/Modified/Deleted | [DESCRIPTION] |

---

## Context for Next Session

### Immediate Next Steps
1. [STEP_1]
2. [STEP_2]
3. [STEP_3]

### Important Context to Remember
- [CONTEXT_1]
- [CONTEXT_2]

### Commands to Run First
\`\`\`bash
[COMMAND_1]
[COMMAND_2]
\`\`\`

---

## Open Questions / Decisions Needed

- [ ] [QUESTION_1]
- [ ] [QUESTION_2]

---

## Session History

| Date | Session | Key Progress |
|------|---------|--------------|
| [DATE] | 1 | [SUMMARY] |

---

## Quick Resume Checklist

> 새 세션 시작 시 확인

- [ ] checkpoint.md 읽기 (현재 파일)
- [ ] task_plan.md Current Status 확인
- [ ] notes.md 관련 정보 스캔
- [ ] Commands to Run First 실행
```

---

## Usage

### 새 작업 시작 시

1. 프로젝트 루트에 `memory/` 폴더 생성
2. 위 템플릿을 복사하여 각 파일 생성:
   - `memory/task_plan.md`
   - `memory/notes.md`
   - `memory/checkpoint.md`
3. `[PLACEHOLDER]` 부분을 실제 값으로 대체
4. 작업 시작

### 스크립트 사용 (선택)

```bash
#!/bin/bash
# init_memory.sh

TASK_NAME=$1
DATE=$(date +%Y-%m-%d)

mkdir -p memory

# task_plan.md 생성
cat > memory/task_plan.md << 'EOF'
# ${TASK_NAME} - Task Plan
...
EOF

echo "Memory files created for: $TASK_NAME"
```

---

## Related Skills

- [soundmind-system SKILL](../soundmind-system/SKILL.md) - 프로젝트 컨텍스트
