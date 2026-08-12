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
