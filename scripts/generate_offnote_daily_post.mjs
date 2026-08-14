import fs from "node:fs";
import path from "node:path";

const KST = "Asia/Seoul";
const RECENT_DEDUPE_DAYS = 21;
const OUTPUT_ROOT = path.join("outputs", "afterwork-profit", "automation");
const PUBLISH_LOG = path.join("outputs", "afterwork-profit", "meta-publish-log.json");

function kstDate(input = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: KST, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(input);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateKey(date) {
  return date.replaceAll("-", "");
}

function dayNumber(date) {
  return Number(String(date).replaceAll("-", "")) || 0;
}

function readJson(file, fallback) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")) : fallback;
  } catch {
    return fallback;
  }
}

// 오프노트는 "일 잘하는 법"을 가르치는 계정이 아니다. IT 교육업계에서 10년간 일하며
// 이동·작업·수업 운영 중 실제로 한 선택을 기록하는 개인 SNS다. 모든 소재는
// 장면 → 내가 고른 방식 → 그 선택을 남기는 이유의 세 문단을 가진다.
const NOTES = [
  ["cafe_one_tab", "카페에서 탭을 세 개 닫은 아침", "카페에 앉자마자 브라우저 탭을 세 개 닫았다.\n\n오늘은 강의 자료 한 장만 고치기로 했고, 그 외 창은 오히려 방해가 됐다.\n\n할 일이 적어서가 아니라, 지금 열어둘 일을 내가 고른 아침이었다."],
  ["train_no_laptop", "기차에서 노트북을 안 연 날", "이동 시간이 길었는데 노트북을 열지 않았다.\n\n창밖 보면서 다음 주 수업 순서만 메모장에 적었다.\n\n이동 중엔 결과를 만드는 일보다 생각을 정리하는 일이 더 잘 맞는다."],
  ["hotel_desk_reset", "호텔 책상 위 물건 세 개", "출장지 호텔 책상 위에는 노트북, 충전기, 물병만 올려뒀다.\n\n준비물을 더 꺼내지 않으니 저녁 작업도 예상보다 빨리 끝났다.\n\n낯선 곳에서는 익숙한 순서 하나만 있어도 충분하다."],
  ["lunch_calendar_gap", "점심 약속을 비워둔 이유", "오늘 점심 약속은 일부러 잡지 않았다.\n\n오전 회의 뒤에 밀린 피드백을 천천히 읽고 싶었다.\n\n일정표의 빈칸은 남는 시간이 아니라, 내 생각을 다시 듣는 시간이다."],
  ["rainy_route_change", "비 오는 날 동선을 바꾼 오후", "비가 와서 평소 가던 카페 대신 가까운 라운지에 앉았다.\n\n장소가 바뀌니 미뤄둔 기획안도 조금 다르게 보였다.\n\n가끔은 멀리 가는 것보다 자리 하나만 바꾸면 된다."],
  ["bag_cable_pouch", "가방에서 케이블 파우치를 뺀 날", "출장 가방을 싸다가 케이블 파우치를 하나 뺐다.\n\n현지에서 꼭 쓸 것만 남기니 가방이 눈에 띄게 가벼워졌다.\n\n일을 오래 할수록 챙기는 것보다 덜 들고 가는 쪽이 편하다."],
  ["walk_after_feedback", "피드백 보내고 걸은 20분", "수강생 피드백을 보내고 바로 다음 일을 열지 않았다.\n\n동네를 한 바퀴 걸으면서 내가 쓴 문장을 다시 생각했다.\n\n답장을 보낸 뒤 잠깐 비워두면, 다음 대화가 더 또렷해진다."],
  ["no_back_to_back_calls", "통화를 연달아 잡지 않는 이유", "오후 통화 사이에 30분을 비워뒀다.\n\n한 통화가 길어져도 다음 사람에게 급한 목소리를 내고 싶지 않아서다.\n\n여유는 시간이 남을 때보다, 미리 간격을 만들 때 생긴다."],
  ["day_off_no_notification", "쉬는 날 알림을 끈 이유", "오늘은 쉬는 날이라 업무 알림을 껐다.\n\n급한 연락은 따로 들어오게 해뒀고, 나머지는 내일 보기로 했다.\n\n다시 잘 일하려면 안 보는 시간도 일정에 넣어야 한다."],
  ["new_notebook_second_page", "새 노트의 두 번째 페이지", "새 노트 첫 장은 비워두고 두 번째 페이지부터 썼다.\n\n첫 장을 잘 써야 한다는 생각이 들면 메모가 늦어진다.\n\n일은 시작을 예쁘게 만드는 것보다, 다음 문장을 빨리 남기는 편이 낫다."],
  ["early_leave_decision", "일이 남아도 먼저 나온 저녁", "오늘은 할 일이 조금 남았는데도 먼저 자리를 떴다.\n\n내일 오전에 더 선명하게 볼 수 있는 일이라서다.\n\n끝까지 붙잡는 것보다 다시 열기 좋게 남겨두는 날도 있다."],
  ["afternoon_same_seat", "오후에만 가는 창가 자리", "오후에는 늘 같은 창가 자리에 앉는다.\n\n그 자리에서는 상담 정리처럼 길게 생각해야 하는 일을 연다.\n\n장소가 집중을 대신해주진 않지만, 시작을 덜 망설이게는 한다."],
  ["phone_in_bag", "작업할 때 휴대폰을 가방에 넣는 이유", "자료를 고칠 때는 휴대폰을 가방 안쪽에 넣어둔다.\n\n눈앞에 있으면 작은 알림도 자꾸 한 번씩 보게 된다.\n\n집중은 거창한 다짐보다 시야에서 하나 치우는 데서 시작한다."],
  ["table_booking", "미팅 장소를 먼저 예약한 날", "다음 주 미팅 장소를 미리 예약해뒀다.\n\n회의 내용보다 동선이 꼬이는 게 더 싫어서다.\n\n작은 준비를 먼저 해두면, 만났을 때는 사람 이야기에만 집중할 수 있다."],
  ["taxi_voice_memo", "택시 안에서 남긴 음성 메모", "이동 중에 떠오른 문장을 음성 메모로 남겼다.\n\n나중에 다시 들으면 대부분 지워지지만, 한 줄은 다음 강의 제목이 되기도 한다.\n\n생각은 완성해서 잡는 것보다 지나가기 전에 붙잡는 쪽이 쉽다."],
  ["new_city_morning", "낯선 도시에서 맞은 오전", "다른 도시에서 맞은 오전에는 할 일을 더 단순하게 적는다.\n\n오후 수업 전에 꼭 끝낼 것만 남기고 나머지는 비워뒀다.\n\n장소가 바뀌면 내 기준도 조금 더 선명해진다."],
  ["airport_last_email", "공항에서 메일 한 통만 보낸 이유", "공항 라운지에서 메일을 한 통만 보냈다.\n\n답장할 수 있는 것과 지금 결정해야 하는 것을 분리했다.\n\n이동하는 날까지 평소 속도를 고집할 필요는 없다."],
  ["friday_close_file", "금요일에 파일을 닫는 방식", "금요일 오후에는 새 문서를 잘 열지 않는다.\n\n이번 주에 고친 자료를 정리하고, 월요일에 볼 질문만 남겨둔다.\n\n한 주를 닫는 감각이 있어야 다음 주도 덜 급해진다."],
  ["coffee_start_signal", "커피를 보상으로 안 마시는 이유", "커피를 사면 바로 일부터 시작한다.\n\n다 마신 뒤에 하겠다고 미루면 시작 시간이 계속 늦어진다.\n\n내게 커피는 보상보다 작업 시작 버튼에 가깝다."],
  ["playlist_no_change", "몇 년째 같은 작업 음악", "오늘도 같은 플레이리스트를 틀었다.\n\n새로운 음악은 이동할 때 듣고, 자료 만들 때는 익숙한 걸 고른다.\n\n집중할 때만큼은 새 자극보다 예측 가능한 리듬이 좋다."],
  ["calendar_buffer", "일정표에 남긴 40분", "오늘 일정표 중간에 40분을 남겨뒀다.\n\n갑자기 생긴 수정 요청을 그 시간 안에 처리했다.\n\n계획이 잘 맞아떨어져서가 아니라, 틀어질 자리를 미리 남겨둔 덕분이다."],
  ["light_bag_day", "가방이 유난히 가벼운 날", "오늘 가방에는 노트북과 충전기, 얇은 노트만 넣었다.\n\n미팅 자료는 클라우드에서 보고, 종이는 가져가지 않았다.\n\n들고 다니는 물건이 줄면 이동하는 하루가 조금 더 길어진다."],
  ["close_laptop_before_dinner", "저녁 전에 노트북을 닫은 날", "저녁 약속 30분 전에 노트북을 닫았다.\n\n마지막 문장 하나를 더 고치고 싶었지만 내일 아침으로 넘겼다.\n\n일이 끝난 뒤의 시간을 지키는 것도 내 일정 관리에 들어간다."],
  ["screen_brightness", "화면 밝기를 낮춘 밤", "늦은 밤 자료를 다듬다가 화면 밝기를 낮췄다.\n\n밤에는 더 많이 보는 것보다, 내일 다시 볼 수 있게 남기는 편을 고른다.\n\n작업을 오래 끌지 않는 것도 실력이라고 생각한다."],
  ["walk_route_after_class", "수업 뒤 다른 길로 걸은 날", "수업이 끝난 뒤 평소와 다른 길로 걸었다.\n\n방금 나온 질문을 머릿속에서 한 번 더 정리하고 싶었다.\n\n책상에서 못 푼 생각은 걷다가 정리될 때가 있다."],
  ["desk_only_water", "책상 위에 물만 남긴 오후", "오후 작업 전에 책상 위 물건을 다 치우고 물만 남겼다.\n\n기획안 한 장을 읽는 데 필요한 건 생각보다 많지 않았다.\n\n일이 복잡해질수록 주변부터 조용하게 만드는 편이다."],
  ["two_stops_city", "하루 동선을 두 곳으로 줄인 날", "오늘은 미팅 장소와 작업 장소를 두 곳으로만 정했다.\n\n중간에 한 곳을 더 들르면 일도 대화도 얇아질 것 같았다.\n\n많이 움직인 날보다, 필요한 곳만 다녀온 날이 더 선명하게 남는다."],
  ["weekend_slow_start", "주말 오전을 늦게 연 날", "주말 오전에는 바로 노트북을 열지 않았다.\n\n커피를 마시며 지난주에 적어둔 메모만 훑었다.\n\n다음 일을 시작하기 전에 이미 쌓인 생각을 먼저 보는 쪽이 내게는 맞다."],
  ["class_slide_cut", "슬라이드 30장을 11장으로 줄인 날", "오늘 강의 자료에서 슬라이드 19장을 지웠다.\n\n설명은 줄었지만 수강생이 직접 눌러볼 시간이 생겼다.\n\n자료가 길다고 수업이 깊어지는 건 아니라는 걸 또 확인했다."],
  ["example_close_to_work", "예시를 실제 업무 쪽으로 옮긴 이유", "이번 수업 예시를 쇼핑몰 주문이 아니라 예약 관리로 바꿨다.\n\n수강생들이 자기 업무 장면을 더 빨리 떠올렸다.\n\n좋은 예시는 쉬운 예시보다 내 일처럼 보이는 예시다."],
  ["feedback_queue", "피드백 순서를 바꾼 오후", "오늘 피드백은 먼저 온 순서대로 보내지 않았다.\n\n내일 수업에 바로 써야 하는 작업부터 먼저 열었다.\n\n공정한 순서와 필요한 순서는 가끔 다르다."],
  ["live_demo_changed", "현장 데모를 바꾼 순간", "수업 중 데모가 예상보다 빨리 끝났다.\n\n준비한 다음 예시 대신 수강생 화면에서 막힌 부분을 같이 봤다.\n\n현장에서는 완성된 계획보다 살아 있는 질문이 더 중요하다."],
  ["course_outline_reorder", "커리큘럼 순서를 바꾼 주", "이번 주 커리큘럼 순서를 조금 바꿨다.\n\n앞 단원보다 지금 반복해서 나오는 질문을 먼저 다루는 게 맞았다.\n\n교재 순서보다 수강생이 멈춘 순서를 믿는 편이다."],
  ["client_brief_short", "협업 브리프를 한 장으로 줄인 날", "새 협업 브리프를 한 장으로 줄였다.\n\n해야 할 일보다 이번에 하지 않을 일을 먼저 적었다.\n\n작은 팀에서는 그 한 줄이 회의를 훨씬 짧게 만든다."],
  ["instructor_wait_time", "수업에서 10초 더 기다린 날", "오늘은 질문 뒤에 바로 답하지 않고 10초를 더 기다렸다.\n\n수강생이 자기 화면을 다시 보다가 원인을 먼저 말했다.\n\n가르치는 일은 내가 빨리 말하는 것보다 상대가 먼저 생각할 틈을 남기는 쪽에 가깝다."],
  ["registration_limit", "이번 모집 인원을 그대로 둔 이유", "이번 과정 모집 인원을 더 늘리지 않았다.\n\n상담과 피드백에 쓸 시간이 줄어드는 건 원하지 않았다.\n\n운영이 커져도 내가 지키고 싶은 기준은 따로 있다."],
  ["say_no_project", "새 프로젝트를 거절한 오후", "오늘 오후, 새 교육 과정을 같이 해보자는 연락을 받았다.\n\n일정만 보면 할 수는 있었는데, 이번 달 수강생 피드백이 밀리는 건 싫었다. 그래서 이번엔 정중히 거절했다.\n\n할 수 있는 일을 줄이는 게 아니라, 이미 약속한 일을 잘 끝내려고 했다."],
  ["revision_log", "수정 이력을 남겨두는 이유", "오늘 자료 파일에 수정 이력을 짧게 남겼다.\n\n다음 달의 내가 왜 이 문장을 지웠는지 다시 묻지 않게 하려고.\n\n일한 흔적을 남겨두면 다음 선택이 훨씬 가벼워진다."],
  ["learner_question_map", "질문을 지도처럼 정리한 날", "수업 뒤에 나온 질문을 주제별로 묶어봤다.\n\n비슷한 질문이 세 번 나오면 그건 개인 문제가 아니라 수업 설계 문제다.\n\n다음 자료는 그 질문부터 열어볼 생각이다."],
  ["consulting_current_job", "상담에서 현재 일을 먼저 들은 이유", "오늘 상담에서는 희망 직무보다 지금 하는 일을 먼저 들었다.\n\n이미 잘하는 일을 새 기술과 어디에 연결할지부터 보려고 했다.\n\n경력 전환은 지우는 일보다 이어 붙이는 일에 더 가깝다."],
  ["lesson_material_blank", "자료 끝에 빈 슬라이드를 남긴 이유", "이번 강의 자료 맨 끝에는 빈 슬라이드를 하나 남겼다.\n\n수강생이 자기 업무 예시를 적어볼 자리다.\n\n내 사례를 하나 더 보여주는 것보다 그 한 칸이 오래 남는다."],
  ["meeting_no_deck", "미팅에서 발표 자료를 안 연 날", "오늘 미팅에서는 준비한 발표 자료를 열지 않았다.\n\n먼저 상대가 지금 어디에서 멈췄는지 듣고 싶었다.\n\n도구를 보여주는 일보다 문제를 제대로 듣는 일이 먼저였다."],
  ["ten_years_small_change", "10년 차에도 바뀌는 설명 방식", "교육 일을 오래 했는데도 오늘 설명 하나를 다시 고쳤다.\n\n내가 이해하기 쉬운 순서와 수강생이 바로 써볼 수 있는 순서는 다를 때가 있다.\n\n익숙한 방식도 현장 앞에서는 계속 가볍게 바꿔둔다."],
  ["project_close_note", "프로젝트를 닫으며 남긴 메모", "오늘 프로젝트 파일을 닫기 전에 메모 세 줄을 남겼다.\n\n잘된 점보다 다음에 시작할 때 먼저 볼 곳을 적었다.\n\n끝내는 방식이 정리되면 다음 시작도 덜 무겁다."],
  ["team_decision_record", "작은 팀에서 결정한 한 가지", "오늘 팀과 논의 끝에 기능 하나를 보류했다.\n\n넣을 수는 있었지만 이번 수업 목표와는 거리가 있었다.\n\n작은 팀일수록 무엇을 안 할지 같이 정하는 시간이 필요하다."],
  ["student_real_use", "수강생이 실제 업무에 써본 화면", "오늘 수강생에게 실제 업무에 써본 화면을 받았다.\n\n완성도보다 자기 방식으로 바꿔 쓴 흔적이 먼저 보였다.\n\n그 한 장이면 다음 수업에서 뭘 더 다뤄야 할지 충분히 알 수 있다."],
  ["schedule_boundary", "문의 답변 시간을 정해둔 이유", "오늘은 정해둔 시간까지만 문의 답변을 했다.\n\n계속 열어두면 모든 메시지가 급해 보인다.\n\n내일 처리할 일을 남겨둘 줄 알아야 수업 준비 시간도 지킬 수 있다."],
  ["classroom_question_pause", "질문 하나에 진도를 멈춘 수업", "오늘 수업은 질문 하나 때문에 계획보다 늦게 끝났다.\n\n그 질문을 넘기면 다음 내용도 자기 일이 되지 않을 것 같았다.\n\n진도를 다 채우는 것보다 함께 멈출 곳을 고르는 편이 더 중요할 때가 있다."],
  ["portfolio_before_after", "포트폴리오의 전후 화면", "수강생 포트폴리오에서 전후 화면을 나란히 보게 했다.\n\n잘 만든 결과보다 무엇을 고쳤는지가 더 분명해졌다.\n\n자기 선택을 설명할 수 있으면 작업의 무게가 달라진다."],
  ["workshop_room_check", "워크숍 전날 좌석을 다시 본 이유", "워크숍 전날 좌석 배치를 다시 확인했다.\n\n서로 화면을 보여주기 어려운 자리 하나를 발견해서 옮겼다.\n\n수업의 분위기는 시작 전 작은 불편에서 먼저 흔들린다."],
  ["no_hurry_content", "올리지 않은 글이 더 많았던 주", "이번 주에도 쓴 글 몇 개를 올리지 않았다.\n\n지금 내 이름으로 남기고 싶은 말인지 한 번 더 봤다.\n\n콘텐츠는 쌓이는 속도보다 나중에 다시 읽을 수 있는지가 더 중요하다."],
];

function daysBetween(from, to) {
  return Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

function recentContentIds(date) {
  const ids = new Set();
  for (const row of readJson(PUBLISH_LOG, [])) {
    if (!row || String(row.status || "").startsWith("deleted_")) continue;
    const published = String(row.published_at || "").slice(0, 10);
    if (published && daysBetween(published, date) >= 0 && daysBetween(published, date) <= RECENT_DEDUPE_DAYS) {
      ids.add(String(row.content_id || row.draft_id || ""));
    }
  }
  if (!fs.existsSync(OUTPUT_ROOT)) return ids;
  for (const day of fs.readdirSync(OUTPUT_ROOT)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || daysBetween(day, date) < 0 || daysBetween(day, date) > RECENT_DEDUPE_DAYS) continue;
    const folder = path.join(OUTPUT_ROOT, day);
    for (const file of fs.readdirSync(folder).filter((name) => name.endsWith(".json"))) {
      const draft = readJson(path.join(folder, file), {});
      if (draft && !String(draft.status || "").startsWith("deleted_")) ids.add(String(draft.content_id || draft.id || ""));
    }
  }
  return ids;
}

function existingDraftForSlot(date, slot) {
  const folder = path.join(OUTPUT_ROOT, date);
  if (!fs.existsSync(folder)) return "";
  const prefix = `OFFNOTE-${dateKey(date)}-${slot}-`;
  const files = fs.readdirSync(folder)
    .filter((file) => file.startsWith(prefix) && file.endsWith(".json"))
    .sort();
  return files.length ? path.join(folder, files[0]) : "";
}

function pickNote(date, slot) {
  const recent = recentContentIds(date);
  const offset = (dayNumber(date) + (slot === "night" ? 1 : 0)) % NOTES.length;
  for (let index = 0; index < NOTES.length; index += 1) {
    const [seedId, title, text] = NOTES[(offset + index) % NOTES.length];
    if (!recent.has(seedId)) return { seedId, title, text };
  }
  throw new Error("최근 21일 안에 재사용하지 않을 오프노트 기록 소재가 부족합니다. 새 소재를 추가한 뒤 다시 실행하세요.");
}

function personalNoteText(note) {
  return note.text.length <= 500 ? note.text : note.text.slice(0, 499).trimEnd() + "…";
}

function makeDraft(date, slot) {
  const note = pickNote(date, slot);
  const id = `OFFNOTE-${dateKey(date)}-${slot}-${note.seedId}`;
  return {
    id,
    content_id: note.seedId,
    account: "offnote.kr",
    account_name: "오프노트",
    project: "afterwork-profit",
    date,
    slot,
    topic: note.title,
    topic_tag: "디지털노마드 일상",
    status: "approved",
    created_at: new Date().toISOString(),
    source: "github-actions-offnote-digital-nomad-notes",
    recommended_publish_time: slot === "night" ? "21:30 KST" : "15:30 KST",
    content_mode: "digital_nomad_personal_note",
    pillar: note.seedId.includes("class") || note.seedId.includes("lesson") || note.seedId.includes("course") || note.seedId.includes("student") || note.seedId.includes("workshop") || note.seedId.includes("consult") ? "ten_year_education_work" : "cool_digital_nomad_daily",
    threads_text: personalNoteText(note),
    thread_comments: [],
    cardnews_slides: [],
    offnote_tone_profile: {
      voice: "IT 교육업계 10년 차 디지털노마드가 실제 장면 뒤에 남기는 여유 있고 쿨한 개인 기록",
      structure: "구체적인 장면 → 내가 고른 방식 → 과장 없는 판단",
      cta_policy: "일상 글에는 CTA 없음. 자료·강의 안내는 전체 게시물의 10% 이하에서만 별도 소재로 사용.",
      banned_framing: ["불안", "버텼다", "아무것도 못 했다", "성공 비법", "나처럼 해", "수익 보장", "자기계발 조언"],
    },
    safety_rules: [
      "Do not add a KakaoTalk or Instagram CTA to personal-note posts.",
      "Do not use anxious hustle, scarcity, income-guarantee, or generic self-help framing.",
      "Do not reuse the same content_id within 21 days.",
    ],
  };
}

const date = process.argv[2] || kstDate();
const slot = process.argv[3] || "evening";
const outDir = path.join(OUTPUT_ROOT, date);
fs.mkdirSync(outDir, { recursive: true });
const createdFlagPath = path.join("outputs", "afterwork-profit", "preview-created.txt");
const existingSlotPath = existingDraftForSlot(date, slot);

if (existingSlotPath) {
  const existing = readJson(existingSlotPath, {});
  if (new Set(["approved", "pending_approval", "published", "held", "publish_failed", "ready_to_review"]).has(existing.status)) {
    const portableExistingPath = existingSlotPath.replaceAll("\\", "/");
    fs.writeFileSync(path.join("outputs", "afterwork-profit", "latest-draft-path.txt"), `${portableExistingPath}\n`, "utf8");
    fs.writeFileSync(createdFlagPath, "false\n", "utf8");
    console.log(JSON.stringify({ ok: true, created: false, draft: portableExistingPath, id: existing.id, status: existing.status }, null, 2));
    process.exit(0);
  }
}

const draft = makeDraft(date, slot);
const outPath = path.join(outDir, `${draft.id}.json`);
const portableOutPath = outPath.replaceAll("\\", "/");
fs.writeFileSync(outPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join("outputs", "afterwork-profit", "latest-draft-path.txt"), `${portableOutPath}\n`, "utf8");
fs.writeFileSync(createdFlagPath, "true\n", "utf8");
console.log(JSON.stringify({ ok: true, created: true, draft: portableOutPath, id: draft.id }, null, 2));
