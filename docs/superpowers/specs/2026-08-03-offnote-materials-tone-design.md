# Offnote Materials Tone Design

## Goal

오프노트 Threads 자동화가 `offnote.kr` 계정을 블로그/유튜브/쇼츠/제휴/체험단/수익화 자료를 하나씩 풀어주는 계정처럼 보이게 한다. 글은 짧고 일상적으로 시작하되, 자료 주제가 구체적이어야 하며, Threads에서 Instagram 댓글과 KakaoTalk 공지방으로 자연스럽게 이어져야 한다.

## Brand Position

오프노트는 “나를 따라해”라고 말하는 계정이 아니다. 콘텐츠 수익화가 궁금한 사람이 처음에 봐야 할 자료를 정리해두고, 필요한 사람을 Instagram 댓글과 KakaoTalk 방으로 모으는 계정이다.

말투는 가볍지만 허술하면 안 된다. “기준”보다 “자료”, “알려줄게”보다 “풀고 있어 / 정리해둘게”, “따라해봐”보다 “필요하면 봐봐”를 쓴다.

## Canonical Tone Sample

```text
요즘 블로그 수익화 물어보는 분들 많은데
처음엔 뭘 배워야 하는지도 헷갈릴 수밖에 없어.
글감 잡는 법, 제목 잡는 법,
검색어 보는 법, 제휴글 쓰는 법
이런 자료들 하나씩 풀고 있으니, 팔로우하고 정보 줍줍하기!
필요한 사람은 인스타 같은 글에 댓글 남겨줘
+카톡방에서만 자료랑 챌린지 공지하고 있으니 필요하면 프로필 링크타고 들어와 :)
```

## Content Requirements

- Threads 본문은 짧게 쓴다. 긴 강의식 글이나 3개 이상의 반복 댓글 확장 패턴을 쓰지 않는다.
- 매 글은 하나의 자료 주제만 중심에 둔다.
- 가능한 자료 주제는 블로그 시작 전 체크리스트, 블로그 제목/검색어 예시, 체험단/협찬 신청, 쿠팡파트너스/제휴글, 유튜브 쇼츠 주제/대본, 인스타/쓰레드 글감, 부업 초보 로드맵, 수익화 구조 정리다.
- Threads CTA는 Instagram 같은 글 댓글로 넘긴다.
- KakaoTalk 방은 자료, 챌린지, 강의 공지를 하는 곳으로 언급한다.
- “기준”, “나처럼 해”, “성공담”, “망한 것/배운 것/수정한 것” 흐름을 피한다.
- 자동화가 생성한 오프노트 글은 바로 발행하지 않고 승인 대기로 둔다.

## Architecture

`scripts/generate_offnote_daily_post.mjs`에 오프노트용 자료 주제 카탈로그와 짧은 글 생성기를 둔다. 기존 깨진 문자열 기반 topic pool은 오프노트 자동 초안에서 사용하지 않는다. 초안 상태는 `pending_approval`로 생성해서 Telegram preview/approval 흐름을 거치게 한다.

`.github/workflows/offnote-threads-automation.yml`의 scheduled auto-publish route는 preview 생성과 approval check 중심으로 바꾼다. manual publish는 유지하되, 자동 schedule에서 새 글을 즉시 `approved`로 만들고 발행하는 경로를 제거한다.

`scripts/validate_offnote_draft.mjs`는 오프노트 자료형 글을 검증한다. 필수 조건은 account, 길이, 금지어, Instagram/KakaoTalk CTA, pending/approved 상태 호환성이다.

## Data Flow

1. GitHub schedule 또는 manual workflow가 오프노트 초안을 생성한다.
2. 초안은 `outputs/afterwork-profit/automation/YYYY-MM-DD/OFFNOTE-...json`에 `pending_approval` 상태로 저장된다.
3. Telegram preview가 사용자에게 초안을 보낸다.
4. 사용자가 승인하면 기존 approval checker가 `approved` 상태로 바꾼다.
5. publish job은 승인된 초안만 발행한다.

## Error Handling

- 생성된 글에 금지어가 있으면 validator가 실패한다.
- Instagram/KakaoTalk CTA가 없으면 validator가 실패한다.
- offnote account가 아니면 validator가 실패한다.
- schedule 지연은 GitHub Actions 한계로 남는다. 즉시성 높은 Telegram 답장 처리는 별도 webhook/worker 전환이 필요하다.

## Testing

- Offnote generator가 sample date/slot에서 `pending_approval` draft를 만드는지 확인한다.
- Draft body가 canonical tone과 같은 CTA 구조를 포함하는지 확인한다.
- Validator가 금지어와 CTA 누락을 거부하는지 확인한다.
- Workflow syntax check와 existing offnote guard test를 실행한다.
