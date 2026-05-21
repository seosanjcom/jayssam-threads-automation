# Threads API Setup For 제이쌤

## 현재 상태

로컬 자동화는 준비됨.

- 매일 오전 7:40: Windows 작업 스케줄러가 초안 생성
- 매일 오전 8:05: Windows 작업 스케줄러가 `approved` 글 게시 시도
- 작업 이름: `JayssamDailyContentDrafts`
- 게시 작업 이름: `JayssamThreadsPublishApproved`
- 실행 파일: `scripts/run_jayssam_daily.ps1`
- 게시 실행 파일: `scripts/run_threads_publish_latest.ps1`
- 초안 저장 위치: `outputs/automation/YYYY-MM-DD`
- 로그 저장 위치: `outputs/automation/logs`

게시 스크립트도 준비됨.

- 파일: `scripts/threads_publish.mjs`
- 최신 승인 글 게시 파일: `scripts/publish_latest_approved.mjs`
- 기본값: `THREADS_AUTO_PUBLISH=false`
- 즉, 토큰이 있어도 기본은 dry-run이다.

## 필요한 값

`.env`에 아래 값이 필요하다.

```env
THREADS_ACCESS_TOKEN=발급받은_Threads_API_토큰
THREADS_USER_ID=me
THREADS_AUTO_PUBLISH=false
```

`THREADS_AUTO_PUBLISH=true`로 바꿔야 실제 게시를 시도한다.

## 안전 규칙

게시 스크립트는 draft JSON의 `status`가 `approved`일 때만 게시한다.

즉, 자동 생성된 `drafted` 콘텐츠는 그대로 올라가지 않는다.

## 실제 게시 흐름

1. `outputs/automation/YYYY-MM-DD/READY-....json` 파일을 확인한다.
2. 내용이 괜찮으면 `status`를 `approved`로 둔다.
3. `.env`에서 `THREADS_AUTO_PUBLISH=true`로 설정한다.
4. 아래 명령을 실행하면 최신 `approved` 글을 찾아 게시한다.

```powershell
node scripts\publish_latest_approved.mjs
```

특정 파일만 게시하려면 아래처럼 실행한다.

```powershell
node scripts\threads_publish.mjs outputs\automation\YYYY-MM-DD\READY-....json
```

## 완전 자동 게시로 바꾸는 시점

초반에는 바로 켜지 않는다.

최소 7일 동안은 아래를 확인한다.

- 제이쌤 말투가 유지되는지
- 댓글 유도 문장이 과하지 않은지
- 교육정보가 얕지 않은지
- 제이컴 홍보가 섞이지 않는지
- 저장할 만한 카드뉴스 주제가 나오는지

7일치가 안정되면, 별도 작업 스케줄러를 추가해서 `approved` 파일만 매일 게시하게 만든다.

## 참고

- Threads API 문서: https://developers.facebook.com/docs/threads/
- Threads API 공개 글: https://developers.facebook.com/blog/post/2024/06/18/the-threads-api-is-finally-here/
