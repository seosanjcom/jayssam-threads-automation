# 제이쌤 교육뉴스 발행 큐

사용자가 링크를 던지면 `content/jayssam-news-queue.csv`에 한 줄씩 넣는다. 이 파일은 Google Sheets로 그대로 가져갈 수 있는 구조이며, GitHub Actions 자동화가 매일 해당 날짜와 슬롯에 맞는 행을 먼저 읽는다.

## 운영 원칙

- 원문 복붙 금지.
- 기사 제목만 전달하지 말고, 학부모가 볼 지점으로 재해석한다.
- `due_date`가 오늘이고 `slot`이 실행 슬롯과 맞는 행만 자동 발행 후보가 된다.
- 큐에 오늘 행이 없으면 기존 제이쌤 자동 주제 생성기로 넘어간다.
- `status`는 `queued` 또는 `approved`만 발행 후보로 본다.
- 매일 같은 소재가 반복되지 않도록 링크별 `due_date`를 하루씩 나눠 배치한다.

## 필수 컬럼

- `id`: 짧은 영문/숫자 식별자. 예: `snu-2028-admission`
- `done_mark`: `⬜`는 예약, `✅`는 발행 완료
- `status`: `queued`, `approved`, `posted`, `rejected`
- `due_date`: `YYYY-MM-DD`
- `slot`: `afternoon`, `evening`, `night`
- `source_url`: 기사 링크
- `source_title`: 기사 제목
- `category`: 입시정보, AI교육, 진로교육, 정보교과, 고교학점제 등
- `hook`: Threads 첫 문장
- `key_facts`: 핵심 사실. `|`로 구분하면 본문에서 줄바꿈 처리된다.
- `parent_takeaway`: 학부모가 봐야 할 지점
- `jayssam_angle`: 제이쌤 해석
- `hashtags`: 공백으로 구분

## 카드뉴스 컬럼

`card_1_title`부터 `card_6_body`까지 채우면 그대로 카드뉴스가 생성된다. 비워두면 자동으로 기본 구조를 채운다.

## 링크를 받았을 때 처리 순서

1. 링크를 열어 제목, 날짜, 핵심 사실을 확인한다.
2. 선정 가치가 낮은 링크는 큐에 넣지 않는다.
3. 좋은 링크는 `due_date`를 다음 빈 날짜로 배정한다.
4. 본문, 댓글 2개, 카드뉴스 6장 문구까지 채운다.
5. 자동화가 해당 날짜에 카드뉴스와 함께 발행한다.
6. 발행이 끝나면 해당 행을 `✅`, `posted`, `posted_url`, `published_at`으로 자동 표시한다.
