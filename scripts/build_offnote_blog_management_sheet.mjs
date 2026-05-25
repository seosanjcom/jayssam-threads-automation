import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const artifactToolPath = path.join(
  "C:",
  "Users",
  "NOTE",
  ".cache",
  "codex-runtimes",
  "codex-primary-runtime",
  "dependencies",
  "node",
  "node_modules",
  "@oai",
  "artifact-tool",
  "dist",
  "artifact_tool.mjs",
);
const { SpreadsheetFile, Workbook } = await import(pathToFileURL(artifactToolPath).href);

const cwd = process.cwd();
const outputDir = path.join(cwd, "outputs", "offnote");
const outputPath = path.join(outputDir, "offnote-blog-management-sheet.xlsx");

function columnName(index) {
  let name = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

async function readJsonIfExists(filePath, fallback) {
  try {
    return JSON.parse((await fs.readFile(filePath, "utf8")).replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

function setHeader(range) {
  range.format = {
    fill: "#1F2937",
    font: { bold: true, color: "#FFFFFF" },
    wrapText: true,
  };
}

function setTitle(range) {
  range.format = {
    fill: "#166534",
    font: { bold: true, color: "#FFFFFF", size: 16 },
  };
}

function styleBody(range) {
  range.format = {
    wrapText: true,
    font: { color: "#111827" },
  };
}

function writeSheet(sheet, values, options = {}) {
  const rowCount = values.length;
  const colCount = values[0].length;
  sheet.getRangeByIndexes(0, 0, rowCount, colCount).values = values;
  setHeader(sheet.getRangeByIndexes(0, 0, 1, colCount));
  styleBody(sheet.getRangeByIndexes(1, 0, Math.max(rowCount - 1, 1), colCount));
  sheet.freezePanes.freezeRows(1);
  sheet.showGridLines = false;

  if (options.tableName) {
    const endColumn = columnName(colCount - 1);
    sheet.tables.add(`A1:${endColumn}${rowCount}`, true, options.tableName);
  }

  for (let column = 0; column < colCount; column += 1) {
    sheet.getRangeByIndexes(0, column, rowCount, 1).format.columnWidthPx = options.widths?.[column] ?? 150;
  }
}

const dailyPlanRows = [
  ["날짜", "요일", "발행 시간", "상태", "발행 주제", "본문 첫 문장/훅", "본문 방향", "댓글로 풀 내용", "체험단/블로그 목적", "비고"],
  ["2026-05-26", "화", "18:00 KST", "예약", "블로그 아직도 일기만 쓰는 사람에게", "블로그 아직도 일기장처럼만 쓰고 있으면 조금 아까워요.", "미용실, 네일샵, 카페, 음식점 체험단으로 생활비가 줄어드는 이야기를 쉽게 설명", "처음 신청하기 좋은 업종: 카페, 음식점, 네일샵, 미용실", "블로그=돈 벌기 전에 생활비 방어라는 인식 심기", "첫 글은 아주 쉽게"],
  ["2026-05-27", "수", "18:00 KST", "예약", "체험단 신청 전에 블로그가 준비해야 할 것", "방문자 수만 보는 줄 아는데, 초보는 블로그 상태부터 봐야 해요.", "최근 글, 사진 수, 제목, 후기 구조가 왜 중요한지 알려주기", "신청 전 최소 세팅 5개: 최근 글 3개, 사진 8장, 동네명 제목, 솔직 후기, 프로필 한 줄", "체험단 신청 전 준비물 알려주기", "체크리스트형"],
  ["2026-05-28", "목", "18:00 KST", "예약", "체험단 글이 광고처럼 보이지 않게 쓰는 법", "체험단 글이 광고처럼 보이는 이유는 대부분 순서 때문이에요.", "업체 칭찬부터 하지 말고 내가 왜 갔는지부터 쓰는 후기 구조 설명", "후기글 순서: 왜 갔는지, 예약, 가격, 과정, 좋았던 점, 아쉬운 점, 맞는 사람", "초보가 바로 따라 쓰게 만들기", "복붙 템플릿 느낌"],
  ["2026-05-29", "금", "18:00 KST", "예약", "블로그 체험단을 생활비 장부처럼 보는 법", "체험단은 수익 인증보다 생활비 장부로 보면 더 현실적이에요.", "네일 5만원, 외식 7만원, 카페 2만원처럼 절약액을 숫자로 보여주기", "체험단 장부 항목: 날짜, 업종, 원래 가격, 내가 쓴 돈, 절약액, 글 발행일", "블로그 운영 동기 만들기", "숫자 들어가게"],
  ["2026-05-30", "토", "21:00 KST", "예약", "동네 후기 블로그가 초보에게 좋은 이유", "처음부터 전국 핫플 잡으면 너무 빡세요.", "내 생활권 카페, 미용실, 네일샵, 음식점 후기가 왜 쉬운지 설명", "지역+상황+업종 제목 예시: 상수역 혼밥, 부천 주차 카페, 강남 레이어드컷", "동네 글감 10개 쌓기 유도", "댓글 반응 노리기"],
  ["2026-05-31", "일", "21:00 KST", "예약", "일기형 블로그에서 정보형 블로그로 바꾸는 법", "좋았다에서 끝내면 일기고, 누가 가면 좋은지까지 쓰면 정보예요.", "말투를 싹 바꾸지 말고 가격, 대상, 다음 선택 한 줄만 더 붙이는 법", "일기 문장 -> 정보 문장 변환 예시", "일기 쓰던 사람도 부담 없이 바꾸게 하기", "공감형"],
  ["2026-06-01", "월", "18:00 KST", "후보", "체험단으로 한 달 생활비 얼마나 줄일 수 있을까", "현금이 들어온 건 아니어도 안 쓴 돈은 진짜 남는 돈이에요.", "카페/음식점/네일/미용실 업종별 절약액 계산해 보여주기", "한 달 체험단 절약액 계산표", "숫자로 저장 유도", "반응 좋으면 시리즈"],
  ["2026-06-02", "화", "18:00 KST", "후보", "카페 체험단이 초보에게 제일 쉬운 이유", "처음 체험단은 카페부터 시작하는 게 덜 부담스러워요.", "사진 찍기 쉽고 글감이 자연스러운 카페 후기 장점 설명", "카페 후기 사진 체크리스트: 입구, 좌석, 콘센트, 메뉴, 실제 크기", "초보 진입장벽 낮추기", "업종별 시리즈"],
  ["2026-06-03", "수", "18:00 KST", "후보", "네일샵 체험단 글은 전후 사진이 반이다", "네일 후기는 예쁜 사진보다 전후 차이가 훨씬 중요해요.", "손톱 고민, 시술 과정, 유지 기간, 전후 사진 중심으로 쓰는 법", "네일 후기 구성: 전 손톱 상태, 컬러 선택, 시술 시간, 유지력", "미용 업종 확장", "전후 사진 강조"],
  ["2026-06-04", "목", "18:00 KST", "후보", "음식점 체험단 글에서 제일 많이 놓치는 것", "맛있다만 쓰면 읽는 사람한테 남는 게 없어요.", "양, 대기, 주차, 가격, 재방문 상황처럼 실사용 정보를 넣는 법", "음식점 후기 표: 대기, 양, 가격대, 주차, 다시 갈 상황", "지역 검색 유입", "찐 후기"],
  ["2026-06-05", "금", "18:00 KST", "후보", "미용실 체험단은 상담 내용을 꼭 써야 하는 이유", "미용실 후기는 결과 사진만으로는 부족해요.", "머리 고민, 상담 내용, 시술 전후, 관리법까지 적어야 신뢰 생김", "미용실 사진/글 체크리스트", "고가 체험단으로 확장", "미용실 소재"],
  ["2026-06-06", "토", "21:00 KST", "후보", "체험단 글에 아쉬운 점 1개를 넣어야 믿긴다", "전부 좋았다는 글은 오히려 덜 믿겨요.", "좋았던 점 2개와 아쉬운 점 1개로 균형 잡힌 후기 만드는 법", "아쉬운 점을 무례하지 않게 쓰는 문장 예시", "광고티 줄이기", "댓글 유도 좋음"],
  ["2026-06-07", "일", "21:00 KST", "후보", "블로그 글감 없을 때 내 카드값을 보면 된다", "글감 없다고 생각하면 이번 달 카드값부터 보세요.", "내가 돈 쓴 곳이 곧 후기 글감이라는 관점 제시", "카드값에서 뽑는 글감: 카페, 병원, 미용, 외식, 쇼핑", "일상에서 소재 찾기", "생활밀착"],
  ["2026-06-08", "월", "18:00 KST", "후보", "체험단 신청할 때 피해야 할 블로그 상태", "이 상태로 신청하면 떨어질 확률이 높아요.", "최근 글 없음, 사진 적음, 제목 감정일기, 복붙 말투 같은 문제 짚기", "신청 전 점검표", "실패 방지", "살짝 자극적"],
  ["2026-06-09", "화", "18:00 KST", "후보", "내돈내산 글 3개가 체험단 포트폴리오가 된다", "체험단 하고 싶으면 내돈내산 글부터 3개만 제대로 써보세요.", "내돈내산 후기를 체험단 신청용 포트폴리오로 쓰는 법", "내돈내산 후기 3개 주제 추천", "초보 실행 유도", "실행형"],
  ["2026-06-10", "수", "18:00 KST", "후보", "블로그 후기는 예쁜 말보다 구체적인 말이 이긴다", "분위기 좋았어요보다 콘센트가 어디 있는지가 더 도움돼요.", "구체적인 정보가 저장과 검색 유입을 만드는 이유 설명", "추상 문장 -> 구체 문장 변환 예시", "글 품질 개선", "문장 팁"],
];

const contentCalendarRows = [
  ["날짜", "추천 시간", "상태", "주제", "포맷", "핵심 훅", "댓글/확장", "비고"],
  ["2026-05-26", "18:00 KST", "예정", "블로그를 일기장으로만 쓰는 사람에게", "생활비 절약 훅", "미용실/네일샵/카페/음식점 체험단으로 생활비 줄이기", "체험단 처음 시작 업종 리스트", "한동안 블로그 체험단 중심"],
  ["2026-05-27", "18:00 KST", "예정", "체험단 신청 전에 블로그가 준비해야 할 것", "초보 체크리스트", "방문자보다 최근 글/사진/후기 구조가 먼저", "신청 전 최소 세팅 5개", "어렵게 말하지 않기"],
  ["2026-05-28", "18:00 KST", "예정", "체험단 글이 광고처럼 보이지 않게 쓰는 법", "후기 글쓰기", "업체 칭찬보다 내가 왜 갔는지 먼저", "후기글 순서 템플릿", "찐 정보 느낌"],
  ["2026-05-29", "18:00 KST", "예정", "블로그 체험단을 생활비 장부처럼 보는 법", "숫자화", "네일 5만+외식 7만+카페 2만=14만원 절약", "체험단 장부 항목", "절약액 기록 유도"],
  ["2026-05-30", "21:00 KST", "예정", "동네 후기 블로그가 초보에게 좋은 이유", "동네 글감", "전국 핫플보다 내 생활권 후기가 쉽다", "지역+상황+업종 제목 예시", "댓글 유도 좋음"],
  ["2026-05-31", "21:00 KST", "예정", "일기형 블로그에서 정보형 블로그로 바꾸는 법", "문장 전환", "좋았다에서 끝내지 말고 누가 가면 좋은지 쓰기", "일기문장->정보문장 예시", "초보 공감형"],
  ["2026-06-01", "18:00 KST", "후보", "체험단으로 한 달 생활비 얼마나 줄일 수 있을까", "계산형", "수익 인증보다 덜 쓴 돈부터 계산", "업종별 평균 절약액", "반응 좋으면 반복"],
  ["2026-06-02", "18:00 KST", "후보", "카페 체험단이 초보에게 제일 쉬운 이유", "업종별 팁", "사진 찍기 쉽고 글감이 자연스럽다", "카페 후기 사진 체크리스트", "시작 난이도 낮음"],
  ["2026-06-03", "18:00 KST", "후보", "네일샵 체험단 글은 전후 사진이 반이다", "업종별 팁", "예쁜 사진보다 손톱 고민과 전후가 중요", "네일 후기 구성", "미용 업종 확장"],
  ["2026-06-04", "18:00 KST", "후보", "음식점 체험단 글에서 제일 많이 놓치는 것", "후기 디테일", "맛있다보다 양/대기/주차/재방문 상황", "음식점 후기 체크리스트", "지역 검색 유입"],
];

const topicBankRows = [
  ["분류", "글감", "훅", "본문에 넣을 찐 정보", "댓글 확장", "상태"],
  ["블로그 체험단", "일기장 블로그에서 체험단 블로그로", "블로그 아직도 일기만 쓰면 아깝다", "생활비 절약부터 시작", "처음 신청할 업종 리스트", "사용"],
  ["블로그 체험단", "체험단 신청 전 준비", "방문자보다 블로그 상태가 먼저", "최근 글/사진/제목/후기 구조", "최소 세팅 5개", "사용"],
  ["후기 글쓰기", "광고처럼 안 보이는 후기 순서", "칭찬부터 하면 바로 티 난다", "내 상황->과정->기준->대상", "복붙 가능한 후기 순서", "사용"],
  ["생활비 절약", "체험단 장부", "현금 입금이 아니어도 덜 쓴 돈은 성과", "업종별 절약액 계산", "장부 양식", "사용"],
  ["동네 블로그", "동네 후기 10개 쌓기", "전국 핫플보다 내 생활권이 쉽다", "지역+상황+업종 제목", "동네 글감 예시", "사용"],
  ["블로그 운영", "일기형 문장 바꾸기", "좋았다에서 끝내지 말기", "가격/대상/다음 선택 한 줄 추가", "문장 변환 예시", "사용"],
  ["블로그 체험단", "미용실 체험단 후기", "머리 망할까 봐 검색하는 사람이 많다", "상담/가격/전후/관리법", "미용실 사진 체크리스트", "후보"],
  ["블로그 체험단", "네일샵 체험단 후기", "예쁜 사진보다 유지력과 전후", "손톱 고민/시술 과정/유지 기간", "네일 후기 순서", "후보"],
  ["블로그 체험단", "카페 체험단 후기", "노트북/혼밥/주차 같은 상황이 검색된다", "콘센트/좌석/소음/메뉴 크기", "카페 사진 체크리스트", "후보"],
  ["블로그 체험단", "음식점 체험단 후기", "맛있다만 쓰면 안 남는다", "대기/양/가격/주차/재방문", "음식점 후기 표", "후보"],
];

const ledgerRows = [
  ["날짜", "업종", "장소/브랜드", "원래 가격", "내가 쓴 비용", "절약액", "블로그 글 제목", "상태", "메모"],
  ["", "카페", "", "", "", '=IF(OR(D2="",E2=""),"",D2-E2)', "", "후보", "초보 시작용"],
  ["", "음식점", "", "", "", '=IF(OR(D3="",E3=""),"",D3-E3)', "", "후보", "지역 검색 유입"],
  ["", "네일샵", "", "", "", '=IF(OR(D4="",E4=""),"",D4-E4)', "", "후보", "전후 사진 강함"],
  ["", "미용실", "", "", "", '=IF(OR(D5="",E5=""),"",D5-E5)', "", "후보", "금액 체감 큼"],
  ["", "피부관리", "", "", "", '=IF(OR(D6="",E6=""),"",D6-E6)', "", "후보", "후기 디테일 필요"],
];

const publishLog = await readJsonIfExists(path.join(cwd, "outputs", "afterwork-profit", "meta-publish-log.json"), []);
const publishRows = [
  ["발행일", "계정", "초안 ID", "주제", "Threads ID", "댓글 수", "상태"],
  ...publishLog
    .filter((item) => item.account === "offnote.kr")
    .map((item) => [
      item.published_at ? item.published_at.slice(0, 10) : "",
      item.account || "",
      item.draft_id || "",
      item.topic || "",
      item.threads_media_id || "",
      Array.isArray(item.reply_ids) ? item.reply_ids.length : 0,
      "발행완료",
    ]),
];

const dashboardRows = [
  ["오프노트 블로그 운영 관리"],
  [""],
  ["현재 집중", "블로그 체험단/생활비 절약/초보 후기글"],
  ["기본 발행 시간", "18:00 KST, 댓글 유도 강한 글은 21:00 KST"],
  ["이번 주 예정 글", "=COUNTIF('콘텐츠 캘린더'!C:C,\"예정\")"],
  ["후보 글감", "=COUNTIF('글감 보관함'!F:F,\"후보\")"],
  ["기록된 체험단 절약액", "=SUM('체험단 장부'!F:F)"],
  ["발행 완료", "=COUNTIF('발행 로그'!G:G,\"발행완료\")"],
  [""],
  ["운영 메모", "한동안 블로그 쪽으로 고정. 어렵게 말하지 말고, '나도 이걸로 생활비 줄였다'처럼 바로 체감되는 정보로 쓴다."],
];

const rulesRows = [
  ["항목", "규칙"],
  ["톤", "친근하게. 블로그 강의 말투 금지. 찐 정보 주는 언니/누나 느낌."],
  ["주제 범위", "블로그 체험단, 생활비 절약, 동네 후기, 후기글 쓰는 법, 초보 블로그 세팅."],
  ["당분간 제외", "AI 문서 자동화, 유튜브/쇼츠 부업, 키워드 선점 반복."],
  ["라이프매거진과 구분", "연예인 제품/제휴링크/구매링크/댓글 상품정보는 lifemagazine_로 보낸다."],
  ["발행 시간", "국내용은 23:00 기본 사용 금지. 18:00 우선, 댓글형은 21:00."],
  ["좋은 훅", "아직도 일기만 쓰면 아깝다 / 체험단으로 얼마 아꼈다 / 광고처럼 안 보이게 쓰는 순서."],
];

const workbook = Workbook.create();
await fs.mkdir(outputDir, { recursive: true });

const dailyPlanSheet = workbook.worksheets.add("날짜별 발행계획");
writeSheet(dailyPlanSheet, dailyPlanRows, {
  tableName: "OffnoteDailyPlan",
  widths: [95, 55, 95, 70, 270, 330, 360, 320, 240, 150],
});

const dashboard = workbook.worksheets.add("대시보드");
dashboard.getRangeByIndexes(0, 0, dashboardRows.length, 2).values = dashboardRows;
setTitle(dashboard.getRange("A1:B1"));
styleBody(dashboard.getRangeByIndexes(2, 0, dashboardRows.length - 2, 2));
dashboard.getRange("A3:A8").format = { font: { bold: true }, fill: "#E5F3E8" };
dashboard.getRange("A10:B10").format = { fill: "#FFF7ED", wrapText: true };
dashboard.getRange("A:A").format.columnWidthPx = 170;
dashboard.getRange("B:B").format.columnWidthPx = 520;
dashboard.showGridLines = false;

const calendarSheet = workbook.worksheets.add("콘텐츠 캘린더");
writeSheet(calendarSheet, contentCalendarRows, { tableName: "OffnoteCalendar", widths: [95, 95, 90, 250, 120, 330, 250, 180] });

const topicSheet = workbook.worksheets.add("글감 보관함");
writeSheet(topicSheet, topicBankRows, { tableName: "OffnoteTopicBank", widths: [120, 230, 280, 310, 230, 80] });

const ledgerSheet = workbook.worksheets.add("체험단 장부");
writeSheet(ledgerSheet, ledgerRows, { tableName: "ExperienceLedger", widths: [95, 100, 180, 110, 110, 110, 280, 90, 180] });

const logSheet = workbook.worksheets.add("발행 로그");
writeSheet(logSheet, publishRows.length > 1 ? publishRows : [...publishRows, ["", "offnote.kr", "", "", "", "", "기록 없음"]], {
  tableName: "OffnotePublishLog",
  widths: [100, 110, 300, 300, 180, 80, 100],
});

const rulesSheet = workbook.worksheets.add("운영 규칙");
writeSheet(rulesSheet, rulesRows, { tableName: "OffnoteRules", widths: [140, 620] });

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
console.log(JSON.stringify({ ok: true, output: outputPath }, null, 2));
