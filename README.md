# notification-front

Spring Boot 알림 서비스([notificationService](https://github.com/SON1205/notificationService))의 크로스플랫폼 프론트엔드.
Expo (React Native)로 iOS, Android, Web을 하나의 코드베이스로 지원한다.

## 기술 스택

- **Expo SDK 54** / React Native 0.81 / TypeScript
- **Expo Router** — 파일 기반 라우팅 (tabs + auth 그룹)
- **Zustand** — 전역 상태 관리 (인증, 알림)
- **React Query** — API 캐싱 및 서버 상태 관리
- **Axios** — REST API 클라이언트 (JWT Interceptor)
- **expo-secure-store** — 모바일 JWT 토큰 보안 저장
- **expo-notifications** — 모바일 푸시 알림 (FCM/APNs)

## 알림 아키텍처

| 앱 상태 | 전송 채널 | 구현 |
|---|---|---|
| Foreground | SSE (Server-Sent Events) | `services/sse/sseClient.ts` |
| Background / 종료 | FCM (Android), APNs (iOS) | `services/push/pushService.ts` |
| 웹 | SSE (EventSource API) | `services/sse/sseClient.ts` |

## 프로젝트 구조

```
app/                    # 화면 (Expo Router)
  (auth)/               # 로그인
  (tabs)/               # 알림 목록, 설정
services/               # 외부 연동
  api/                  # Axios 인스턴스, REST API
  auth/                 # JWT 토큰 저장 (SecureStore / localStorage)
  sse/                  # SSE 실시간 연결
  push/                 # 푸시 알림 등록
store/                  # Zustand 스토어 (auth, notification)
types/                  # TypeScript 타입 정의
constants/              # 환경 설정, 색상
```

## 실행

```bash
npm install              # 의존성 설치
npm run web              # 웹 개발 서버 (localhost:8081)
npm run ios              # iOS 시뮬레이터
npm run android          # Android 에뮬레이터
```

## 백엔드 연동

`constants/config.ts`에서 API 베이스 URL을 설정한다.

```typescript
const ENV = {
  dev: { API_BASE_URL: 'http://localhost:8080' },
  prod: { API_BASE_URL: 'https://api.example.com' },
};
```

백엔드 API 엔드포인트:
- `POST /api/auth/login` — 로그인 (JWT 발급)
- `POST /api/auth/signup` — 회원가입
- `GET /api/notifications` — 알림 목록 조회
- `GET /api/notifications/stream` — SSE 실시간 알림
- `PATCH /api/notifications/{id}/read` — 알림 읽음 처리
- `POST /api/devices/push-token` — 푸시 토큰 등록

## 브랜치 전략

- `main` — 운영 배포용
- `develop` — 개발 통합
- `feature/*` — 기능 개발
- `hotfix/*` — 긴급 수정

## 커밋 컨벤션

```
type: 제목 (50자 이내)

- what/why 설명
```
type: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
