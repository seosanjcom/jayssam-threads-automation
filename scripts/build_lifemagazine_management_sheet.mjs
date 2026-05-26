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
const outputDir = path.join(cwd, "outputs", "lifemagazine");
const outputPath = path.join(outputDir, "lifemagazine-management-sheet.xlsx");

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
    fill: "#6D284C",
    font: { bold: true, color: "#FFFFFF" },
    wrapText: true,
  };
}

function setTitle(range) {
  range.format = {
    fill: "#9F1239",
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
  ["날짜", "요일", "추천 시간", "상태", "플랫폼", "콘텐츠 주제", "필요 소스", "본문 훅", "댓글/DM 정보", "상품 링크 상태", "주의사항"],
  ["2026-05-26", "화", "18:00 KST", "후보", "Threads+Instagram", "잇츠스킨 웨딩드레스 퓨어크림", "원본 영상 컷+제품 링크+메모", "민와와 영상 보다가 피부톤 정리템으로 눈에 들어온 그 크림", "댓글: 제품명/구매링크/제휴고지. 인스타: 댓글 키워드 '크림' DM 안내", "링크 필요", "제품명은 댓글에. 본문은 무드/고민 중심"],
  ["2026-05-27", "수", "21:00 KST", "후보", "Threads+Reels", "쑥뜸 집에서 해보는 홈케어템", "소유 영상 멘트 컷+홈 쑥뜸 제품 링크", "쑥뜸 좋다는 멘트 들으면 집에서 할 수 있는 것도 찾게 됨", "댓글: 홈케어 제품 링크/주의 문구/제휴고지", "링크 필요", "의학적 효능 단정 금지. 편안함/온열감 중심"],
  ["2026-05-28", "목", "18:00 KST", "후보", "Threads", "연예인 파우치 속 컨실러/쿠션류", "사진 또는 영상 캡처+출처 메모+상품 링크", "피부화장 열심히 하는 사람이 계속 쓰는 베이스템은 그냥 못 지나침", "댓글: 색상/호수/링크/제휴고지", "대기", "동일템이면 출처 명확히, 아니면 비슷한 무드라고만"],
  ["2026-05-29", "금", "18:00 KST", "후보", "Threads", "헤어 윤기템/헤어오일", "릴스 캡처+상품 후보", "머리에서 광 도는 장면 보면 나만 확대해서 보는 거 아니지", "댓글: 제품명 또는 대체템/링크/제휴고지", "대기", "본문에 상품명 과다 노출 금지"],
  ["2026-05-30", "토", "21:00 KST", "후보", "Instagram", "연예인 메이크업 쇼츠 1개", "영상 클립+워터마크+상품 링크", "피부표현 좋아 보이는 장면만 빠르게 편집", "댓글 키워드 받기: '정보' 또는 제품 카테고리", "대기", "인스타는 반말보다 자연스러운 존댓말"],
  ["2026-05-31", "일", "21:00 KST", "후보", "Threads", "여름 베이스 무너짐 방지템", "유튜브/릴스 캡처+제품 링크", "더워지면 베이스 무너지는 사람들 이거 그냥 못 지나침", "댓글: 프라이머/파우더/픽서 후보 링크", "대기", "직접 언급 없으면 대체템 표현"],
  ["2026-06-01", "월", "18:00 KST", "후보", "Threads", "다크서클 커버템 2탄", "민경님 컨실러 후속/비슷한 고민템 링크", "다크서클 커버는 한 번 검색하면 계속 파게 됨", "댓글: 이전 컨실러+비슷한 커버템 링크", "대기", "이미 발행한 컨실러와 중복 문장 피하기"],
  ["2026-06-02", "화", "18:00 KST", "후보", "Threads", "여배우/아이돌 립 컬러 무드", "캡처+비슷한 컬러 링크", "입술 색감 예쁘면 결국 비슷한 색 찾아보게 됨", "댓글: 동일템 확인 여부/비슷한 컬러 링크", "대기", "동일템 단정 금지"],
  ["2026-06-03", "수", "18:00 KST", "후보", "Threads+Instagram", "여름 바디/향기템", "영상 장면+상품 링크", "가까이 갔을 때 좋은 향 나는 사람들 이런 거 쓰나 싶음", "댓글/DM: 바디미스트/바디로션 링크", "대기", "과장 문구 줄이기"],
  ["2026-06-04", "목", "21:00 KST", "후보", "Threads", "연예인 가방 속 미니템", "방송/유튜브 캡처+상품 링크", "가방에서 꺼내는 작은템이 은근 제일 궁금함", "댓글: 미니템 링크/제휴고지", "대기", "제품 노출 사진 권리 주의"],
  ["2026-06-05", "금", "18:00 KST", "후보", "Threads", "올리브영 세일 때 담을 뷰티템", "세일 정보+후보 링크", "세일 때 괜히 사는 것 말고 진짜 쓸 것만 추려야 함", "댓글: 카테고리별 링크", "대기", "가격/세일 정보는 발행 당일 확인"],
  ["2026-06-06", "토", "21:00 KST", "후보", "Instagram", "릴스: 제품 언급 장면만 빠르게", "영상 원본+구간 메모", "제품 언급/호수 언급/고민 얘기만 빠르게 컷", "댓글 키워드로 DM 링크", "대기", "자막 없이 워터마크만 선호"],
  ["2026-06-07", "일", "21:00 KST", "후보", "Threads", "여름 샴푸/두피 고민템", "후기형 메모+상품 링크", "비듬/두피 고민이면 샴푸는 한 번 실패하면 바로 티남", "댓글: 제품 후보 링크/제휴고지", "대기", "의학적 치료 표현 금지"],
  ["2026-06-08", "월", "18:00 KST", "후보", "Threads", "속건/쿨링 잠옷 또는 이너웨어", "캡처+상품 링크", "여름에 집에서 입는 옷이 은근 삶의 질 바꿈", "댓글: 소재/사이즈/링크", "대기", "노출 과한 이미지 피하기"],
  ["2026-06-09", "화", "18:00 KST", "후보", "Threads", "방송 속 주얼리 무드 대체템", "캡처+대체템 링크", "귀걸이 하나로 얼굴 분위기 달라지는 장면 있잖아", "댓글: 비슷한 무드 링크/제휴고지", "대기", "동일 제품 확인 안 되면 대체템"],
  ["2026-06-10", "수", "18:00 KST", "후보", "Threads", "여름 모공/피지 고민템", "유튜브 장면+상품 링크", "피부화장 공들여도 피지 올라오면 다 무너져서 찾게 되는 쪽", "댓글: 제품 링크/사용 포인트/제휴고지", "대기", "효능 단정 금지"],
];

const sourceBankRows = [
  ["상태", "소재", "출처/메모", "상품명", "링크", "이미지/영상", "활용 방향", "주의"],
  ["완료", "민경님 컨실러", "민와와 유튜브. 피부화장에 가장 공을 들이는 민경님이 2통째 사용. 3호 코렉트업 베이지", "더샘 커버퍼펙션 트리플 팟 컨실러 3호 코렉트업 베이지", "https://link.coupang.com/a/d0ZdzZeyRg", "컨실러 쇼츠 v1 있음", "Threads 발행 완료. 인스타 존댓말 캡션도 사용 가능", "댓글 공정위 고지 포함"],
  ["진행", "잇츠스킨 웨딩드레스 퓨어크림", "같은 원본 영상에서 해당 구간 컷 완료. 얼굴/제품 크게 보이는 세로 크롭 요청 있었음", "잇츠스킨 시크릿 솔루션 웨딩드레스 퓨어크림", "", "영상 컷 있음", "톤업/피부톤 정리 무드로 작성", "효능 과장 금지"],
  ["진행", "쑥뜸 홈케어템", "소유 영상. 쑥뜸방 소개가 아니라 쑥뜸 좋다는 멘트 위주로 컷 필요", "집에서 할 수 있는 쑥뜸/온열 제품", "", "원본 영상 있음", "온열감/편안함 중심", "건강 효능 단정 금지"],
  ["후보", "헤어 윤기템", "유튜브 속 광나는 헤어템", "", "https://shop.example.com/hair", "", "윤기/향/고급스러운 무드", "상품명 확인 필요"],
  ["후보", "립 컬러 무드", "방송/릴스 캡처 필요", "", "", "", "비슷한 컬러 대체템", "동일템 단정 금지"],
  ["후보", "주얼리 무드템", "방송 속 귀걸이/목걸이 캡처 필요", "", "", "", "비슷한 무드 대체템", "브랜드 단정 금지"],
  ["후보", "여름 두피 샴푸", "내돈내산/후기형 참고 문장 사용 가능", "", "", "", "두피 고민 공감형", "탈모 개선 등 치료 표현 금지"],
];

const productLinkRows = [
  ["상태", "상품/카테고리", "정확도", "링크", "본문 노출 여부", "댓글/DM 문구", "고지 문구"],
  ["사용", "더샘 커버퍼펙션 트리플 팟 컨실러 3호 코렉트업 베이지", "공식 언급/메모 기준", "https://link.coupang.com/a/d0ZdzZeyRg", "본문 상품명 미노출", "민경님은 3호 코렉트업 베이지 쓴대", "이 댓글에는 제휴 링크가 포함되어 있고, 구매 시 수수료를 받을 수 있어."],
  ["필요", "잇츠스킨 시크릿 솔루션 웨딩드레스 퓨어크림", "상품명 확인됨", "", "본문 상품명 미노출", "영상에서 언급된 제품 정보 기준으로 정리했어", "제휴 링크 포함 고지 필요"],
  ["필요", "홈 쑥뜸/온열 제품", "대체템", "", "본문 상품명 미노출", "집에서 해볼 수 있는 비슷한 홈케어템으로 정리했어", "제휴 링크 포함 고지 필요"],
  ["대기", "헤어오일/헤어팩", "확인 필요", "", "본문 상품명 미노출", "영상 속 무드 기준으로 볼 만한 쪽만 정리했어", "제휴 링크 포함 고지 필요"],
  ["대기", "립/주얼리/바디향", "대체템", "", "본문 상품명 미노출", "동일템 단정은 아니고 비슷한 무드로 볼 만한 링크야", "제휴 링크 포함 고지 필요"],
];

const toneRows = [
  ["말투 이름", "쓸 상황", "본문 예시", "댓글 예시"],
  ["궁금해서 찾아봄형", "연예인/유튜브 장면 보고 상품 궁금할 때", "[제휴 링크 포함]\n이 장면 보고 나만 검색창 연 거 아니지\n{고민}이면 이건 그냥 못 지나치겠더라\n{출처} 보고 나도 바로 궁금해져서 찾아봄\n정보는 댓글에 남겨둘게.", "{출처} 기준으로 {상품정보} 정리했어\n구매링크: {링크}\n이 댓글에는 제휴 링크가 포함되어 있고, 구매 시 수수료를 받을 수 있어."],
  ["찐 애정템형", "출연자가 직접 사용/호수/재구매를 언급했을 때", "[제휴 링크 포함]\n{사람}이 {횟수/기간}째 쓰는 찐 애정템이래\n{고민} 있으면 이건 안 찾아볼 수가 없더라\n{출처} 보고 나도 바로 궁금해짐\n정보는 댓글에 남겨둘게.", "{사람}은 {옵션/호수} 쓴대\n{정확한 상품명}\n구매링크: {링크}\n제휴 링크 포함, 구매 시 수수료를 받을 수 있어."],
  ["대체템 무드형", "동일 제품 확인이 안 됐을 때", "[제휴 링크 포함]\n이 무드 좋아하는 사람은 저장해도 될 듯\n동일템이라고 단정은 안 하고\n비슷한 느낌으로 볼 만한 것만 추려봤어\n정보는 댓글에 남겨둘게.", "동일 제품 단정은 아니고 비슷한 무드 대체템이야\n링크: {링크}\n제휴 링크 포함 고지."],
  ["인스타 DM형", "인스타 릴스 캡션", "[제휴 링크 포함]\n{출처}에서 언급된 {카테고리} 정보예요.\n{고민} 있으신 분들은 참고해보셔도 좋을 것 같아요.\n궁금하신 분들은 댓글에 \"{키워드}\" 남겨주세요.", "댓글에 {키워드} 남겨주시면 DM으로 링크 보내드릴게요. 제휴 링크가 포함될 수 있어요."],
];

const checklistRows = [
  ["체크 항목", "기준", "상태"],
  ["본문 시작", "[제휴 링크 포함] 포함", "필수"],
  ["본문 상품명", "상품명은 가능하면 댓글/DM에. 본문은 고민과 출처 중심", "필수"],
  ["동일템 여부", "직접 언급/공식 확인 없으면 동일템 단정 금지", "필수"],
  ["댓글", "상품명, 링크, 공정위 고지 포함", "필수"],
  ["건강/뷰티 효능", "치료/개선 단정 금지. 고민/무드/사용감 중심", "필수"],
  ["인스타", "반말보다 자연스러운 존댓말. 링크는 댓글 키워드/DM", "권장"],
  ["영상", "@lifemagazine_ 워터마크. 자막은 요청 없으면 넣지 않음", "권장"],
  ["발행 시간", "18:00 기본, 댓글 유도 강한 글은 21:00", "권장"],
];

const publishLog = await readJsonIfExists(path.join(cwd, "outputs", "lifemagazine", "meta-publish-log.json"), []);
const publishRows = [
  ["발행일", "계정", "초안 ID", "주제", "Threads ID", "댓글 수", "링크", "상태"],
  ...publishLog
    .filter((item) => item.account === "lifemagazine_")
    .map((item) => [
      item.published_at ? item.published_at.slice(0, 10) : "",
      item.account || "",
      item.draft_id || "",
      item.topic || "",
      item.threads_media_id || "",
      Array.isArray(item.reply_ids) ? item.reply_ids.length : 0,
      item.threads_permalink || "",
      "발행완료",
    ]),
];

const dashboardRows = [
  ["lifemagazine_ 운영 관리"],
  [""],
  ["현재 포지션", "연예인/유튜브/릴스 속 제품 정보 + 쇼핑 링크 수익화"],
  ["기본 톤", "쇼핑 잘 알려주는 언니/누나. 반말은 친근하게, 시건방지지 않게. 이모지는 최소."],
  ["예정/후보 글", '=COUNTIF(\'날짜별 발행계획\'!D:D,"후보")+COUNTIF(\'날짜별 발행계획\'!D:D,"예약")'],
  ["상품 링크 필요", '=COUNTIF(\'상품 링크 장부\'!A:A,"필요")'],
  ["발행 완료", '=COUNTIF(\'발행 로그\'!H:H,"발행완료")'],
  [""],
  ["운영 메모", "사진/영상+상품링크+메모를 받으면 본문은 궁금증/고민 중심, 상품 정보와 제휴고지는 댓글/DM으로 분리한다."],
];

const workbook = Workbook.create();
await fs.mkdir(outputDir, { recursive: true });

const dailyPlanSheet = workbook.worksheets.add("날짜별 발행계획");
writeSheet(dailyPlanSheet, dailyPlanRows, {
  tableName: "LifeDailyPlan",
  widths: [95, 55, 95, 70, 130, 260, 260, 330, 310, 110, 250],
});

const dashboard = workbook.worksheets.add("대시보드");
dashboard.getRangeByIndexes(0, 0, dashboardRows.length, 2).values = dashboardRows;
setTitle(dashboard.getRange("A1:B1"));
styleBody(dashboard.getRangeByIndexes(2, 0, dashboardRows.length - 2, 2));
dashboard.getRange("A3:A7").format = { font: { bold: true }, fill: "#FFE4E6" };
dashboard.getRange("A9:B9").format = { fill: "#FFF7ED", wrapText: true };
dashboard.getRange("A:A").format.columnWidthPx = 150;
dashboard.getRange("B:B").format.columnWidthPx = 560;
dashboard.showGridLines = false;

const sourceSheet = workbook.worksheets.add("소재 보관함");
writeSheet(sourceSheet, sourceBankRows, {
  tableName: "LifeSourceBank",
  widths: [80, 220, 360, 300, 230, 200, 260, 220],
});

const productSheet = workbook.worksheets.add("상품 링크 장부");
writeSheet(productSheet, productLinkRows, {
  tableName: "LifeProductLinks",
  widths: [80, 320, 130, 260, 130, 330, 310],
});

const toneSheet = workbook.worksheets.add("말투 템플릿");
writeSheet(toneSheet, toneRows, {
  tableName: "LifeToneTemplates",
  widths: [150, 220, 420, 420],
});

const checklistSheet = workbook.worksheets.add("안전 체크");
writeSheet(checklistSheet, checklistRows, {
  tableName: "LifeSafetyChecklist",
  widths: [150, 520, 90],
});

const logSheet = workbook.worksheets.add("발행 로그");
writeSheet(logSheet, publishRows.length > 1 ? publishRows : [...publishRows, ["", "lifemagazine_", "", "", "", "", "", "기록 없음"]], {
  tableName: "LifePublishLog",
  widths: [100, 120, 300, 260, 180, 80, 320, 100],
});

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
console.log(JSON.stringify({ ok: true, output: outputPath }, null, 2));
