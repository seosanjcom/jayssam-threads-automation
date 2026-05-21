# 제이쌤 GitHub Actions 자동화 세팅

이 설정은 PC가 꺼져 있어도 GitHub Actions에서 제이쌤 Threads 자동화를 돌리기 위한 것이다.

## 역할

- 매일 오전 10:05 KST: Threads 반응 수집
- 첫 주 점심 1회: 미리보기 2회 후 approved 글 게시
- 2026-05-28부터 점심/저녁 2회: 미리보기 2회 후 approved 글 게시
- Telegram으로 게시 전 미리보기 발송
- Threads 계정이 `jayssam_edu`가 아니면 게시 중단

## GitHub Secrets

GitHub 저장소에서 `Settings > Secrets and variables > Actions > New repository secret`에 아래 값을 넣는다.

필수:

- `THREADS_ACCESS_TOKEN`
- `THREADS_USER_ID`
- `THREADS_APP_ID`
- `THREADS_APP_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

선택:

- `SCHOOLINFO_API_KEY`
- `CAREERNET_API_KEY`

## 현재 한계

GitHub Actions는 스크립트를 실행하는 장소다. Codex 대화창처럼 최신 이슈를 판단해 글을 새로 쓰려면 별도 AI/API 기반 생성기가 필요하다.

현재 워크플로는 안전을 우선해서 다음처럼 동작한다.

- `approved` 큐가 있으면 게시한다.
- `ready_to_review` 또는 `approved` 후보가 있으면 Telegram 미리보기를 보낸다.
- 아무 후보가 없으면 Telegram으로 “게시 후보 없음”을 알려준다.

## 직접 실행

GitHub 저장소의 `Actions > Jayssam Threads Automation > Run workflow`에서 수동 실행할 수 있다.

추천 테스트 순서:

1. `mode=preview`, `slot=lunch`
2. `mode=metrics`, `slot=lunch`
3. `mode=publish`, `slot=lunch`

게시 테스트는 반드시 `approved` 후보가 정확할 때만 실행한다.

## 계정 안전장치

워크플로에는 다음 값이 고정되어 있다.

- `THREADS_VERIFY_PROFILE_BEFORE_PUBLISH=true`
- `THREADS_EXPECTED_USERNAME=jayssam_edu`

따라서 토큰이 다른 Threads 계정으로 바뀌면 게시가 중단된다.
