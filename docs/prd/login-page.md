# PRD: Login Page 구현

> **Version**: 1.0
> **Created**: 2026-01-12
> **Status**: Draft

---

## 1. 개요

### 1.1 배경
현재 llm-loadtest 프로젝트는 공인 IP와 포트를 개방할 경우 전 세계 스캐닝 봇들의 접속 시도에 노출됩니다.
인증 없이 누구나 벤치마크를 실행할 수 있어 GPU 리소스 남용 위험이 있습니다.

### 1.2 목적
- Bot 및 미인가 사용자로부터 서비스 보호
- 리소스 사용량 제어 (누가, 어떻게 사용하는지 추적)
- 시니어 개발자 수준의 보안 아키텍처 구현

### 1.3 범위

| 포함 | 제외 |
|------|------|
| Next.js Web 대시보드 로그인 | FastAPI 인증 미들웨어 |
| 하드코딩 ID/PW 인증 | OAuth (Google, GitHub 등) |
| Guest 데모 모드 (3회 제한) | Rate Limiting |
| 세션 상태 관리 | Cloudflare Tunnel 설정 |

---

## 2. 요구사항

### 2.1 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-1 | 로그인 페이지 UI (Wave 애니메이션 + 카드 디자인) | P0 |
| FR-2 | ID/Password 인증 (하드코딩) | P0 |
| FR-3 | Guest 모드 - "Try Demo" 버튼 | P0 |
| FR-4 | Guest 벤치마크 실행 3회 제한 | P0 |
| FR-5 | 로그인 상태 유지 (세션/localStorage) | P1 |
| FR-6 | 로그아웃 기능 | P1 |
| FR-7 | 미인증 사용자 리다이렉트 | P0 |
| FR-8 | 제한 초과 시 안내 팝업 | P1 |

### 2.2 비기능 요구사항

| ID | 요구사항 | 기준 |
|----|---------|------|
| NFR-1 | 로그인 페이지 로딩 시간 | < 1초 |
| NFR-2 | 모바일 반응형 지원 | 480px 이상 |
| NFR-3 | 접근성 | 키보드 네비게이션 지원 |

---

## 3. 기술 설계

### 3.1 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js App                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│   │ LoginPage   │────▶│ AuthContext │────▶│ Dashboard   │       │
│   └─────────────┘     └─────────────┘     └─────────────┘       │
│         │                    │                    │              │
│         │                    │                    │              │
│         ▼                    ▼                    ▼              │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│   │ 하드코딩    │     │ localStorage│     │ Guest 횟수  │       │
│   │ 인증 검증   │     │ 세션 저장   │     │ 제한 체크   │       │
│   └─────────────┘     └─────────────┘     └─────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 데이터 모델

```typescript
// types/auth.ts

interface User {
  id: string;
  role: 'admin' | 'user' | 'guest';
  permissions: UserPermissions;
}

interface UserPermissions {
  canRunBenchmark: boolean;
  canViewHistory: boolean;
  canDeleteBenchmark: boolean;
  maxBenchmarkRuns?: number;  // Guest용 제한
}

interface UserCredential {
  id: string;
  password: string;
  role: User['role'];
  permissions: UserPermissions;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  guestRunCount: number;  // Guest 벤치마크 실행 횟수
}
```

### 3.3 파일 구조

```
services/web/src/
├── app/
│   ├── login/
│   │   └── page.tsx          # 로그인 페이지 (NEW)
│   ├── layout.tsx            # AuthProvider 래핑 (MODIFY)
│   └── ...
├── components/
│   ├── login-page.tsx        # 로그인 UI 컴포넌트 (NEW)
│   └── auth-guard.tsx        # 인증 가드 컴포넌트 (NEW)
├── contexts/
│   └── auth-context.tsx      # 인증 상태 관리 (NEW)
├── types/
│   └── auth.ts               # 인증 관련 타입 (NEW)
└── lib/
    └── auth.ts               # 인증 유틸리티 (NEW)
```

### 3.4 주요 컴포넌트

#### 3.4.1 LoginPage 컴포넌트
- 참조: `sm-web-console/src/components/LoginPage.tsx`
- Wave 애니메이션 배경 (CSS keyframes)
- ID/Password 입력 폼
- "Sign In" 버튼 + "Try Demo" 버튼
- 에러 메시지 표시

#### 3.4.2 AuthContext
- 로그인/로그아웃 함수
- 현재 사용자 상태
- Guest 벤치마크 실행 횟수 추적
- localStorage 연동 (세션 유지)

#### 3.4.3 AuthGuard
- 미인증 사용자 리다이렉트
- 레이아웃에서 페이지 래핑

### 3.5 하드코딩 인증 정보

```typescript
// lib/auth.ts

const VALID_CREDENTIALS: UserCredential[] = [
  {
    id: 'admin',
    password: 'loadtest2026!',  // 변경 필요
    role: 'admin',
    permissions: {
      canRunBenchmark: true,
      canViewHistory: true,
      canDeleteBenchmark: true,
    },
  },
];

const GUEST_PERMISSIONS: UserPermissions = {
  canRunBenchmark: true,
  canViewHistory: true,
  canDeleteBenchmark: false,
  maxBenchmarkRuns: 3,
};
```

---

## 4. 구현 계획

| Phase | 작업 | 복잡도 |
|-------|-----|--------|
| 1 | 타입 정의 (`types/auth.ts`) | 하 |
| 2 | 인증 유틸리티 (`lib/auth.ts`) | 하 |
| 3 | AuthContext 구현 (`contexts/auth-context.tsx`) | 중 |
| 4 | LoginPage UI 구현 (`components/login-page.tsx`) | 중 |
| 5 | 로그인 라우트 생성 (`app/login/page.tsx`) | 하 |
| 6 | AuthGuard 구현 (`components/auth-guard.tsx`) | 중 |
| 7 | Layout에 AuthProvider 적용 | 하 |
| 8 | Guest 벤치마크 실행 제한 적용 | 중 |
| 9 | 제한 초과 팝업 UI | 하 |
| 10 | 테스트 및 디버깅 | 중 |

---

## 5. 성공 기준

- [ ] 로그인 없이 대시보드 접근 시 로그인 페이지로 리다이렉트
- [ ] 올바른 ID/PW 입력 시 대시보드 접근 가능
- [ ] Guest 모드로 로그인 가능
- [ ] Guest가 벤치마크 3회 실행 후 추가 실행 차단
- [ ] 새로고침 후에도 로그인 상태 유지
- [ ] 로그아웃 시 로그인 페이지로 이동
- [ ] Wave 애니메이션이 포함된 시각적으로 완성된 로그인 UI

---

## 6. 참조

- 참조 프로젝트: `/mnt/data1/work/soundmind-ai-system/sm-web-console/src/components/LoginPage.tsx`
- 참조 App: `/mnt/data1/work/soundmind-ai-system/sm-web-console/src/App.tsx`
