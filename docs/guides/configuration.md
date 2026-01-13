# 설정 옵션

> LLM Loadtest 환경변수 및 설정 가이드

## 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `API_KEY` | API 인증 키 (설정 시 인증 활성화) | (없음) |
| `DATABASE_PATH` | SQLite DB 경로 | `/data/benchmarks.db` |
| `LOG_LEVEL` | 로그 레벨 | `INFO` |
| `PORT` | API 서버 포트 | `8085` |

---

## 인증 설정

```bash
# 인증 없이 실행 (기본)
docker compose up -d

# 인증 활성화
API_KEY=your-secret-key docker compose up -d

# API 호출 시 헤더 추가
curl -X POST http://localhost:8085/api/v1/benchmark/run \
  -H "X-API-Key: your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"server_url": "...", "model": "..."}'
```

---

## 로깅 형식

구조화된 JSON 로그 (structlog):

```json
{
  "event": "request_started",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "path": "/api/v1/benchmark/run",
  "client_ip": "172.17.0.1",
  "timestamp": "2026-01-10T12:00:00.123456Z",
  "level": "info"
}
```

---

## Docker Compose 설정

```yaml
# docker-compose.yml 주요 설정
services:
  api:
    environment:
      - API_KEY=${API_KEY:-}
      - DATABASE_PATH=/data/benchmarks.db
      - LOG_LEVEL=INFO
    ports:
      - "8085:8085"
    volumes:
      - ./data:/data

  web:
    ports:
      - "5050:5050"
    depends_on:
      - api
```

---

## 지원 서버 (어댑터)

| 서버 | 어댑터 | 상태 | 비고 |
|------|--------|------|------|
| **vLLM** | openai | ✅ 지원 | OpenAI-compatible API |
| **SGLang** | openai | ✅ 지원 | OpenAI-compatible API |
| **Ollama** | openai | ✅ 지원 | OpenAI-compatible API |
| **LMDeploy** | openai | ✅ 지원 | OpenAI-compatible API |
| **Triton** | triton | 🚧 개발 중 | Triton HTTP API |
| **TensorRT-LLM** | trtllm | 📋 예정 | - |
