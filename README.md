# notification-front

Spring Boot 알림 서비스([notificationService](https://github.com/SON1205/notificationService))의 크로스플랫폼 프론트엔드.
Expo (React Native)로 iOS, Web을 하나의 코드베이스로 지원한다.

## 기술 스택

- **Expo SDK 54** / React Native 0.81 / TypeScript
- **Expo Router** — 파일 기반 라우팅 (tabs + auth 그룹)
- **Zustand** — 전역 상태 관리 (인증, 알림)
- **React Query v5** — API 캐싱 및 서버 상태 관리
- **Axios** — REST API 클라이언트 (하이브리드 인증 Interceptor)
- **react-native-sse** — 네이티브 SSE 클라이언트 (커스텀 헤더 지원)
- **expo-secure-store** — 네이티브 JWT 토큰 보안 저장
- **expo-notifications** — 모바일 푸시 알림 (Phase 4 예정)

## 인증 아키텍처 (하이브리드)

| 플랫폼 | 인증 방식 | 토큰 저장 |
|---|---|---|
| 웹 | HttpOnly Cookie (서버 Set-Cookie) | 서버 관리 (XSS 방어) |
| iOS/Android | Authorization 헤더 | expo-secure-store (암호화) |

로그인 시 백엔드가 Cookie + body token을 동시 제공하므로, 각 플랫폼이 자신에게 맞는 방식을 사용한다.

## 알림 아키텍처

| 앱 상태 | 전송 채널 | 구현 |
|---|---|---|
| Foreground (웹) | SSE (EventSource + Cookie) | `services/sse/sseClient.ts` |
| Foreground (iOS) | SSE (react-native-sse + 헤더) | `services/sse/sseClient.ts` |
| Background / 종료 | FCM / APNs (Phase 4 예정) | `services/push/pushService.ts` |

## 프로젝트 구조

```
app/                    # 화면 (Expo Router)
  (auth)/               # 로그인
  (tabs)/               # 알림 목록, 설정
services/               # 외부 연동
  api/                  # Axios 인스턴스, REST API
  auth/                 # 토큰 저장 (웹: Cookie / 네이티브: SecureStore)
  sse/                  # SSE 실시간 연결 (플랫폼별 분기)
  push/                 # 푸시 알림 등록 (Phase 4)
store/                  # Zustand 스토어 (auth, notification)
types/                  # TypeScript 타입 정의
constants/              # 환경 설정, 색상
```

## 실행

```bash
npm install              # 의존성 설치
npm run web              # 웹 개발 서버 (localhost:8081)
npm run ios              # iOS 시뮬레이터
```

## 백엔드 연동

`constants/config.ts`에서 API 베이스 URL을 설정한다.

```typescript
const ENV = {
  dev: { API_BASE_URL: 'http://localhost:8080' },
  prod: { API_BASE_URL: 'https://api.example.com' },
};
```

### API 엔드포인트

| Method | URI | 설명 |
|---|---|---|
| `POST` | `/api/v1/auth/signup` | 회원가입 |
| `POST` | `/api/v1/auth/login` | 로그인 (Cookie + body token) |
| `POST` | `/api/v1/auth/logout` | 로그아웃 (Cookie 삭제) |
| `GET` | `/api/v1/notifications` | 알림 목록 조회 |
| `GET` | `/api/v1/notifications/unread` | 미읽음 알림 목록 |
| `GET` | `/api/v1/notifications/stream` | SSE 실시간 알림 구독 |
| `PATCH` | `/api/v1/notifications/{id}/read` | 알림 읽음 처리 |

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
