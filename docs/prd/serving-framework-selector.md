# PRD: 오픈소스 공개 전 리팩토링

> **Version**: 1.1
> **Created**: 2026-01-13
> **Updated**: 2026-01-13
> **Status**: Draft

---

## 1. 개요

### 1.1 배경
llm-loadtest를 오픈소스로 공개하기 전 두 가지 주요 리팩토링이 필요하다:

1. **Serving Framework 범용화**: 현재 vLLM 중심 설계를 다양한 프레임워크 지원 구조로 변경
2. **결과 공유 기능**: 로컬 실행 시 서로 다른 사용자 간 벤치마크 결과 공유 불가 문제 해결

### 1.2 목적
- 다양한 Serving Framework (vLLM, SGLang, Ollama, Triton) 선택 지원
- 프레임워크별 고유 설정 패널 제공
- AI 분석 기능의 프레임워크 의존성 명확화
- 벤치마크 결과 URL 공유 기능 제공

### 1.3 범위

| 포함 | 제외 |
|------|------|
| New Benchmark 페이지 UI 리팩토링 | SGLang, Ollama 어댑터 신규 구현 |
| Server Settings 통합 (프레임워크 선택 + 설정) | 기존 OpenAI, Triton 어댑터 수정 |
| AI 분석 프레임워크 제한 안내 | CLI 명령어 변경 |
| BenchmarkConfig 스키마 확장 | 멀티유저 인증 시스템 |
| 벤치마크 결과 공유 링크 기능 | 공유 만료/취소 기능 |

---

## 2. 요구사항

### 2.1 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-1 | Server Settings 상단에 Serving Framework 드롭다운 추가 (vLLM, SGLang, Ollama, Triton) | P0 |
| FR-2 | 선택된 프레임워크에 따라 해당 설정 패널만 표시 (조건부 렌더링) | P0 |
| FR-3 | vLLM Configuration 섹션을 Server Settings 내부로 통합 | P0 |
| FR-4 | 각 프레임워크별 고유 설정 필드 구현 | P1 |
| FR-5 | vLLM 외 프레임워크에서 AI 분석 시 안내 메시지 표시 | P0 |
| FR-6 | 벤치마크 결과에 `framework` 필드 저장 | P1 |
| FR-7 | `vllm_config` → `framework_config`로 스키마 일반화 (하위호환 유지) | P1 |
| FR-8 | 벤치마크 상세 페이지에 '공유' 버튼 추가 | P1 |
| FR-9 | 공유 링크 클릭 시 URL 클립보드 복사 | P1 |
| FR-10 | 공유 링크 접속 시 읽기 전용 뷰 표시 (AI 분석/삭제 버튼 숨김) | P1 |

### 2.2 비기능 요구사항

| ID | 요구사항 | 기준 |
|----|---------|------|
| NFR-1 | 기존 벤치마크 결과 호환성 | vllm_config가 있는 기존 데이터 정상 조회 |
| NFR-2 | UI 반응성 | 프레임워크 전환 시 300ms 이내 패널 교체 |
| NFR-3 | 공유 링크 접근성 | 인증 없이 URL만으로 결과 조회 가능 |

---

## 3. 기술 설계

### 3.1 프레임워크별 설정 필드

```typescript
// vLLM
interface VLLMConfig {
  gpu_memory_utilization?: number;  // 0.9
  tensor_parallel_size?: number;    // 1
  max_num_seqs?: number;            // 256
  quantization?: string;            // awq, gptq, fp8, int8
}

// SGLang
interface SGLangConfig {
  tensor_parallel_size?: number;    // 1
  chunked_prefill?: boolean;        // true
  mem_fraction_static?: number;     // 0.9
}

// Ollama
interface OllamaConfig {
  context_length?: number;          // 4096
  num_gpu?: number;                 // 1
}

// Triton
interface TritonConfig {
  backend?: string;                 // tensorrt_llm, vllm
  instance_count?: number;          // 1
}
```

### 3.2 BenchmarkConfig 스키마 변경

```typescript
interface BenchmarkConfig {
  // 기존 필드
  server_url: string;
  model: string;
  adapter: string;  // "openai" | "triton"

  // 신규 필드
  framework: "vllm" | "sglang" | "ollama" | "triton";
  framework_config?: VLLMConfig | SGLangConfig | OllamaConfig | TritonConfig;

  // 하위호환 (deprecated)
  vllm_config?: VLLMConfig;
}
```

### 3.3 파일 구조

| 파일 | 변경 내용 |
|------|----------|
| `services/web/src/app/benchmark/new/page.tsx` | Framework 드롭다운 추가, 조건부 패널 렌더링, vLLM Configuration 섹션 통합 |
| `services/web/src/lib/api.ts` | `BenchmarkConfig`, `FrameworkConfig` 타입 추가 |
| `services/api/src/llm_loadtest_api/models/schemas.py` | `framework`, `framework_config` 필드 추가 |
| `services/web/src/app/benchmark/[id]/page.tsx` | AI 분석 버튼에 프레임워크 조건 추가 |
| `services/api/src/llm_loadtest_api/routers/benchmarks.py` | 분석 API에서 프레임워크 확인 로직 추가 |

### 3.4 UI 와이어프레임

```
┌─────────────────────────────────────────────────────────┐
│ Server Settings                                          │
├─────────────────────────────────────────────────────────┤
│ Serving Framework: [vLLM ▾]                             │
│                                                          │
│ Server URL: [http://your-server:8000_________________]  │
│ Model: [qwen3-14b________]  API Key: [***************]  │
│                                                          │
│ ─── vLLM Configuration ───                              │
│ GPU Memory Util: [0.9]  Tensor Parallel: [1]           │
│ Max Num Seqs: [256]     Quantization: [None ▾]         │
│                                                          │
│ ℹ️ AI 분석 정확도 향상을 위해 실제 서버 설정값 입력 권장   │
└─────────────────────────────────────────────────────────┘

[SGLang 선택 시]
┌─────────────────────────────────────────────────────────┐
│ ─── SGLang Configuration ───                             │
│ Tensor Parallel: [1]  Chunked Prefill: [✓]              │
│ Memory Fraction: [0.9]                                   │
│                                                          │
│ ⚠️ AI 분석 도구는 현재 vLLM 프레임워크만 지원이 가능합니다. │
└─────────────────────────────────────────────────────────┘
```

### 3.5 AI 분석 처리 흐름

```
[분석 버튼 클릭]
      │
      ▼
┌─────────────┐    NO     ┌────────────────────────────────┐
│ framework   │──────────▶│ 안내 메시지 표시:               │
│ === vllm ?  │           │ "AI 분석 도구는 현재 vLLM       │
└─────────────┘           │  프레임워크만 지원이 가능합니다." │
      │ YES               └────────────────────────────────┘
      ▼
┌─────────────────┐
│ vLLM 서버로     │
│ 분석 요청 전송   │
└─────────────────┘
```

---

## 4. 구현 계획

### Part A: Serving Framework 선택 기능

| Phase | 작업 | 복잡도 |
|-------|-----|--------|
| A-1 | API 스키마 확장 (`framework`, `framework_config` 추가) | 하 |
| A-2 | Web `lib/api.ts` 타입 정의 추가 | 하 |
| A-3 | New Benchmark 페이지 UI 리팩토링 (드롭다운, 조건부 패널) | 중 |
| A-4 | 벤치마크 상세 페이지 AI 분석 버튼 조건 추가 | 하 |
| A-5 | 분석 API에서 프레임워크 확인 로직 추가 | 하 |

### Part B: 결과 공유 기능

| Phase | 작업 | 복잡도 |
|-------|-----|--------|
| B-1 | 벤치마크 상세 페이지에 공유 버튼 추가 | 하 |
| B-2 | `?shared=true` 쿼리 파라미터 처리 (읽기 전용 뷰) | 하 |
| B-3 | 공유 배너 UI 추가 | 하 |

### Part C: 테스트 및 검증

| Phase | 작업 | 복잡도 |
|-------|-----|--------|
| C-1 | 기존 데이터 호환성 테스트 | 중 |
| C-2 | 공유 링크 동작 테스트 | 하 |

---

## 5. 성공 기준

### Part A: Serving Framework 선택 기능
- [ ] New Benchmark 페이지에서 4개 프레임워크 선택 가능
- [ ] 프레임워크 선택 시 해당 설정 패널만 표시됨
- [ ] vLLM Configuration 섹션이 Server Settings에 통합됨
- [ ] SGLang/Ollama/Triton 선택 시 AI 분석 안내 메시지 표시
- [ ] 벤치마크 결과에 `framework` 필드가 저장됨
- [ ] 기존 `vllm_config`가 있는 결과도 정상 조회됨

### Part B: 결과 공유 기능
- [ ] 벤치마크 상세 페이지에 '공유' 버튼 표시됨
- [ ] 공유 버튼 클릭 시 URL이 클립보드에 복사됨
- [ ] `?shared=true` URL 접속 시 읽기 전용 뷰 표시됨
- [ ] 읽기 전용 뷰에서 AI 분석/삭제 버튼이 숨겨짐
- [ ] 공유 배너가 표시됨

---

## 6. 프레임워크별 설정 상세

### 6.1 vLLM
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| gpu_memory_utilization | float | 0.9 | GPU 메모리 할당 비율 |
| tensor_parallel_size | int | 1 | 텐서 병렬화 GPU 수 |
| max_num_seqs | int | 256 | 최대 동시 시퀀스 수 |
| quantization | string | "" | 양자화 방식 (awq, gptq, fp8, int8) |

### 6.2 SGLang
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| tensor_parallel_size | int | 1 | 텐서 병렬화 GPU 수 |
| chunked_prefill | bool | true | Chunked Prefill 활성화 |
| mem_fraction_static | float | 0.9 | 정적 메모리 비율 |

### 6.3 Ollama
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| context_length | int | 4096 | 컨텍스트 길이 |
| num_gpu | int | 1 | 사용 GPU 수 |

### 6.4 Triton
| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| backend | string | "tensorrt_llm" | 백엔드 타입 |
| instance_count | int | 1 | 인스턴스 수 |

---

## 7. 하위호환성

### 7.1 기존 데이터 처리
- `vllm_config`가 있고 `framework`가 없는 경우: `framework = "vllm"`으로 간주
- `framework_config`와 `vllm_config` 동시 존재 시: `framework_config` 우선

### 7.2 API 호환성
- `vllm_config` 파라미터는 deprecated로 유지 (제거하지 않음)
- 새 요청은 `framework` + `framework_config` 사용 권장

---

## 8. 결과 공유 기능

### 8.1 배경
현재 llm-loadtest는 각 사용자의 로컬에서 실행되며, 벤치마크 결과는 로컬 SQLite DB에 저장된다. 서로 다른 사용자 간 결과 공유가 불가능한 상태이다.

```
[현재 구조]
사용자 A (로컬) → benchmarks.db (A만 접근 가능)
사용자 B (로컬) → benchmarks.db (B만 접근 가능)
Docker 배포    → benchmarks.db (접속자 모두 공유)
```

### 8.2 해결 방안
기존 `/benchmark/{run_id}` URL을 공유 링크로 활용한다. 별도 토큰 없이 run_id를 직접 공유하는 단순한 방식을 채택한다.

### 8.3 공유 링크 동작

```
[공유 버튼 클릭]
      │
      ▼
┌─────────────────────────────────┐
│ URL 클립보드 복사               │
│ https://host/benchmark/{run_id} │
│ "링크가 복사되었습니다" 토스트   │
└─────────────────────────────────┘

[공유 링크로 접속]
      │
      ▼
┌─────────────────────────────────┐
│ 읽기 전용 뷰 표시               │
│ - 차트, 테이블: 정상 표시       │
│ - AI 분석 버튼: 숨김            │
│ - 삭제 버튼: 숨김               │
│ - "공유된 결과입니다" 배너 표시  │
└─────────────────────────────────┘
```

### 8.4 읽기 전용 뷰 판별

공유 링크 접속자와 원본 소유자를 구분하는 방법:

| 방법 | 설명 | 채택 |
|------|------|------|
| URL 쿼리 파라미터 | `/benchmark/{id}?shared=true` | ✅ 채택 |
| 세션 기반 | 로그인 여부로 판별 | ❌ (인증 시스템 필요) |
| Referer 확인 | 외부에서 접속 시 읽기 전용 | ❌ (불안정) |

**구현**: 공유 버튼 클릭 시 `?shared=true` 파라미터가 포함된 URL을 복사한다.

### 8.5 UI 와이어프레임

**공유 버튼 위치** (벤치마크 상세 페이지 상단):
```
┌─────────────────────────────────────────────────────────┐
│ Benchmark Results                          [공유] [삭제] │
│ Model: qwen3-14b | Server: http://...                    │
├─────────────────────────────────────────────────────────┤
│ (차트, 테이블 등)                                        │
└─────────────────────────────────────────────────────────┘
```

**공유 링크 접속 시** (읽기 전용 뷰):
```
┌─────────────────────────────────────────────────────────┐
│ 🔗 공유된 벤치마크 결과입니다                             │
├─────────────────────────────────────────────────────────┤
│ Benchmark Results                                        │
│ Model: qwen3-14b | Server: http://...                    │
├─────────────────────────────────────────────────────────┤
│ (차트, 테이블 등 - AI 분석/삭제 버튼 없음)               │
└─────────────────────────────────────────────────────────┘
```

### 8.6 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `services/web/src/app/benchmark/[id]/page.tsx` | 공유 버튼 추가, `?shared=true` 시 읽기 전용 뷰 |

### 8.7 제한사항 (v1.0)

- 공유 만료 시간 없음 (영구)
- 공유 취소 기능 없음 (삭제로 대체)
- 비밀번호 보호 없음
- 조회 통계 없음

향후 필요 시 `share_links` 테이블을 추가하여 토큰 기반 공유로 확장 가능하다.
