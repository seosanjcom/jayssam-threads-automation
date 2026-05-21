# 제이쌤 Threads/Instagram 계정 안전 기준

## 결론

계정 삭제를 100% 막는 설정은 없다. 그래서 이 프로젝트는 자동화를 하더라도 Meta가 스팸, 비정상 활동, 계정 무결성 문제로 볼 수 있는 행동을 최대한 피하는 방식으로 운영한다.

## 절대 금지

- 자동 팔로우, 자동 언팔로우, 자동 좋아요, 자동 댓글
- 무분별한 자동 DM
- 여러 계정에 같은 글을 동시에 복붙 게시
- 새 계정에서 짧은 시간 안에 반복 게시
- 같은 문장, 같은 CTA, 같은 키워드 반복 남발
- 기사 본문 복붙
- 공포 마케팅, 과장 광고, 수익 보장형 표현
- 출처 없는 교육정보를 사실처럼 단정
- 브라우저 세션 쿠키나 비공식 자동화로 게시

## API 호출 기준

- 공식 Threads API만 사용한다.
- 게시에 필요한 호출만 한다.
- 테스트용 프로필 조회, 토큰 확인, 게시 한도 조회는 필요할 때만 한다.
- 게시 전 기본값은 `THREADS_VERIFY_PROFILE_BEFORE_PUBLISH=false`로 둔다.
- 게시는 `approved` 상태인 파일만 가능하다.
- 로컬 게시 로그에서 24시간 1개 제한을 먼저 검사한 뒤 게시 API로 넘어간다.
- 하루 기본 게시 제한은 1개다.
- 최소 게시 간격은 8시간이다.

## 현재 로컬 안전 설정

```env
THREADS_SAFETY_MODE=true
THREADS_DAILY_POST_LIMIT=1
THREADS_MIN_INTERVAL_HOURS=8
THREADS_VERIFY_PROFILE_BEFORE_PUBLISH=false
THREADS_PUBLISH_LOG=outputs/meta-publish-log.json
```

## 새 계정 운영 기준

- 초반에는 하루 1개 이하로만 게시한다.
- 계정 프로필, 소개, 대표 이미지, 링크를 자연스럽게 채운다.
- 며칠 동안은 수동 접속과 정상적인 읽기/반응 활동도 섞는다.
- 자동 게시가 성공해도 바로 게시량을 늘리지 않는다.
- 계정 상태에 경고가 보이면 자동 게시를 멈추고 원인을 먼저 확인한다.

## 현재 계정 구분

- Threads 자동 게시 계정: `@jayssam_edu`
- Instagram 계정명 기록: `@offnote.kr`
- OAuth 콜백 URL: `https://blog.naver.com/taemomjoo`

`offnote.kr`는 사이트 주소가 아니라 인스타 계정명이므로 Meta OAuth 콜백 URL로 쓰지 않는다.

## 참고할 공식 기준

- Threads API 공식 문서: https://developers.facebook.com/docs/threads/
- Meta 커뮤니티 규정: https://transparency.meta.com/policies/community-standards/
- Meta 스팸 규정: https://transparency.meta.com/policies/community-standards/spam/
- Meta 계정 무결성/진정성 기준: https://transparency.meta.com/policies/community-standards/account-integrity-and-authentic-identity/
