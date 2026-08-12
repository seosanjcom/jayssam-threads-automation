# 2026-08-12 자동화 운영 메모

## Threads API 답글

- Meta 공식 Create Replies 문서: 루트 게시물 소유자이거나 `threads_keyword_search` 또는 `threads_manage_mentions` 권한이 있어야 답글을 작성할 수 있다. `reply_to_id`로 컨테이너를 만든 뒤 `threads_publish`로 게시한다.
- 출처: https://developers.facebook.com/documentation/threads/retrieve-and-manage-replies/create-replies
- Meta 공식 Reply Management 문서: 답글 숨김·승인·답글 권한 제어를 지원한다.
- 출처: https://developers.facebook.com/documentation/threads/reply-management

## 쿠팡 파트너스 API

- GitHub Actions Secret: `COUPANG_PARTNERS_ACCESS_KEY`, `COUPANG_PARTNERS_SECRET_KEY`가 암호화된 repository secret으로 등록됐다. 값은 이 문서나 저장소에 기록하지 않는다.
- HMAC 인증은 2자리 UTC 연도 형식(`YYMMDDTHHMMSSZ`)을 사용하도록 수정했다.
- 실제 조회 점검 성공: https://github.com/seosanjcom/jayssam-threads-automation/actions/runs/31558821124
- 링티 아이 아이전용 조회 성공: https://github.com/seosanjcom/jayssam-threads-automation/actions/runs/31559790681
- 조회 결과 중 확인된 후보: `[약국용] 링티 아이 아이전용 아이전용보틀 증정 수분충전 어린이`, 카테고리 `식품`, 가격 `21,000원`, 이미지·상품 URL 제공.
- 원본 `link.coupang.com` 단축 링크는 상품 페이지 접근 거부를 반환하며, API 검색에는 상품명을 함께 전달해야 정확한 후보를 확인할 수 있다.

## Threads 대댓글 자동 응답 준비

- 댓글 조회에는 `threads_read_replies`, 대댓글 발행에는 `threads_manage_replies`가 필요하다. 기존 발행 토큰은 이 권한들이 확인되지 않았으므로, 세 계정 모두 해당 권한을 포함해 다시 연결한 새 토큰으로 교체해야 한다.
- 게시물의 모든 깊이의 답글은 `GET /{media-id}/conversation`으로 조회한다. 최상위 답글만 보려면 `GET /{media-id}/replies`를 사용한다.
- 실시간 웹훅 답글 수신은 `threads_read_replies` 권한 외에 앱 심사 Advanced Access, 사업체 인증, 공개 계정, 공개 수신 엔드포인트가 필요하다. 권한 재연결 전에는 기능 플래그를 비활성으로 유지한다.
- 공식 문서: https://developers.facebook.com/documentation/threads/retrieve-and-manage-replies , https://developers.facebook.com/documentation/threads/retrieve-and-manage-replies/replies-and-conversations , https://developers.facebook.com/documentation/threads/webhooks
