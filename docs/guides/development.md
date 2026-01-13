# 개발 가이드

> LLM Loadtest 로컬 개발 및 향후 로드맵

## 로컬 개발

### CLI 개발

```bash
pip install -e ".[dev]"
llm-loadtest --help
```

### API 개발

```bash
cd services/api
pip install -e ".[dev]"
PYTHONPATH=../.. uvicorn llm_loadtest_api.main:app --reload --port 8085
```

### Web 개발

```bash
cd services/web
npm install
npm run dev
```

---

## 테스트

```bash
# 전체 테스트 (루트에서 실행)
pytest tests/

# API 테스트
cd services/api && pytest tests/

# Web 린트
cd services/web && npm run lint
```

---

## Docker 빌드

```bash
# 전체 빌드
docker compose build

# API만 빌드
docker compose build api

# Web만 빌드
docker compose build web
```

---

## 향후 개발 방향

### 완료된 기능

#### Phase 5: 인프라 추천 기능 ✅

> **"이 서버가 동시 500명을 버티는가? 버티려면 H100 몇 장이 필요한가?"**

- [x] 워크로드 스펙 기반 추천 알고리즘
- [x] CLI `recommend` 명령어
- [x] API 엔드포인트 (`/api/v1/benchmark/recommend`)
- [x] Web UI `/recommend` 페이지

#### Phase 6: 메트릭 검증 기능 ✅

> **"클라이언트 측정 메트릭이 정확한가? 서버 측 메트릭과 교차 검증"**

- [x] Docker 로그 기반 검증 (vLLM 컨테이너)
- [x] Prometheus 메트릭 검증
- [x] 클라이언트-서버 메트릭 비교
- [x] Web UI 검증 결과 표시
- [x] API validation_config 옵션

---

### 단기 목표

- [ ] Triton 어댑터 완성
- [ ] Redis 캐싱 통합
- [ ] Rate Limiting

### 중기 목표

- [ ] TensorRT-LLM 어댑터
- [ ] 분산 부하 테스트 (다중 클라이언트)
- [ ] Prometheus 메트릭 내보내기 (외부 시스템용)
- [ ] Grafana 대시보드 템플릿

### 장기 목표

- [ ] Kubernetes Operator
- [ ] CI/CD 통합 (GitHub Actions)
- [ ] 성능 회귀 자동 감지
- [ ] A/B 테스트 지원

---

## 기여

버그 리포트, 기능 제안, PR을 환영합니다!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
