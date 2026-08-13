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

// 오프노트는 불안한 부업 계정이 아니라, IT 교육업계에서 오래 일한 사람이
// 자기 리듬으로 일·이동·콘텐츠·성장을 기록하는 디지털노마드 SNS다.
const NOTES = [
  ["cafe_same_seat", "카페에 가면 늘 앉는 자리가 있다", "카페에 가면 늘 앉는 자리가 있다.\n자리보다 중요한 건, 노트북을 열면 바로 일 모드로 들어가는 그 익숙함이다."],
  ["work_bag_light", "가방이 가벼운 날", "가방이 가벼운 날은 일도 조금 가볍다.\n노트북 하나, 충전기 하나, 메모할 것 하나. 오래 일할수록 필요한 건 생각보다 많지 않다."],
  ["calendar_blank_space", "일정표의 빈칸", "일정표에 빈칸이 있는 걸 좋아한다.\n여유가 남는 날에 생각이 더 잘 정리된다. 꽉 찬 날보다 오래 가는 방식이다."],
  ["walk_between_calls", "통화와 통화 사이", "통화와 통화 사이에 15분이 남으면 무조건 걷는다.\n의외로 다음 일의 답은 책상보다 길에서 먼저 나온다."],
  ["desktop_clean", "바탕화면 정리", "바탕화면이 정리되면 할 일도 조금 정리된다.\n일을 오래 하다 보니 새로운 앱보다 지우는 일이 더 중요해졌다."],
  ["lunch_alone", "혼자 먹는 점심", "혼자 먹는 점심이 잘 맞는 날이 많다.\n누구와 맞추지 않아도 되는 한 시간이 오후 일을 꽤 깔끔하게 만들어준다."],
  ["no_rush_reply", "답장을 조금 늦게 하는 이유", "메시지에 바로 답하지 않는 날도 있다.\n급한 것과 중요한 걸 구분하는 데는 약간의 간격이 필요하다."],
  ["early_leave", "일찍 자리를 뜨는 날", "오늘은 할 일을 다 끝내기 전에 자리를 떴다.\n내일도 일할 거라서. 오래 하는 사람은 마무리보다 리듬을 먼저 챙긴다."],
  ["new_notebook", "새 노트 첫 장", "새 노트 첫 장은 늘 비어 있는 채로 며칠 간다.\n좋은 생각은 억지로 시작할 때보다, 일하다가 자연스럽게 들어올 때가 많다."],
  ["airport_work", "공항에서 일할 때", "공항에서 일하면 이상하게 할 일이 단순해진다.\n들고 갈 수 있는 일만 남기면, 진짜 중요한 게 보인다."],
  ["tool_not_status", "장비는 도구일 뿐", "새 장비가 필요할 때도 있지만, 대부분은 지금 있는 걸 더 잘 쓰면 된다.\n일의 결과는 장비보다 내가 얼마나 선명한지에서 갈린다."],
  ["one_priority", "오늘의 한 가지", "오늘 할 일은 여러 개인데, 끝까지 잡을 건 하나만 정했다.\n이렇게 일하면 하루가 덜 흩어진다."],
  ["class_preparation", "수업 전 준비", "수업 준비를 오래 했다고 수업이 좋은 건 아니다.\n수강생이 어디에서 멈추고, 어떤 예시에서 자기 일과 연결할지까지 생각해두면 그때부터 준비가 된다."],
  ["say_no_project", "새 프로젝트를 거절한 오후", "오늘 오후, 새 교육 과정을 같이 해보자는 연락을 받았다.\n일정만 보면 할 수는 있었는데, 이번 달 수강생 피드백이 밀리는 건 싫었다. 그래서 이번엔 정중히 거절했다.\n\n할 수 있는 일을 줄이는 게 아니라, 이미 약속한 일을 잘 끝내려고. 오래 일할수록 이 기준이 내 시간을 더 편하게 만든다."],
  ["income_quality", "돈 되는 일과 오래 가는 일", "돈이 되는 일도 중요하다.\n그런데 내가 계속 말할 수 있는 내용인지까지 같이 본다. 그게 결국 내 이름으로 남는다."],
  ["teaching_year_ten", "교육 일을 오래 하며 생긴 습관", "교육 일을 오래 하면서 제일 많이 바뀐 건 설명하는 방식이다.\n더 많이 말하기보다, 상대가 스스로 이해할 틈을 남기는 쪽으로 바뀌었다."],
  ["content_not_noise", "콘텐츠를 고르는 기준", "콘텐츠는 많이 올리는 것보다 내 이름으로 남겨도 되는 걸 고르는 게 더 중요하다.\n그래서 나는 올리지 않는 글도 꽤 많다."],
  ["travel_packing", "출장 가방", "출장 갈 때 가방을 싸면 내가 평소에 뭘 중요하게 여기는지 보인다.\n일할 것, 편할 것, 그리고 조금의 여유."],
  ["hotel_morning", "낯선 도시의 아침", "낯선 도시에서 일하는 아침을 좋아한다.\n장소는 바뀌어도 내가 하는 일은 이어진다는 감각이 꽤 좋다."],
  ["work_playlist", "일할 때 듣는 음악", "일할 때 듣는 음악은 몇 년째 비슷하다.\n새로운 자극보다 익숙한 리듬이 집중에는 더 잘 맞는다."],
  ["old_files", "오래된 파일", "예전 파일을 열어보면 그때의 내가 생각보다 잘해둔 게 있다.\n쌓인 시간은 티가 안 나다가, 가끔 이렇게 답을 보여준다."],
  ["small_team", "작은 팀의 장점", "작은 팀으로 일하면 결정이 빠르다.\n대신 서로의 기준은 더 분명해야 한다. 그 균형이 맞을 때 일이 제일 재밌다."],
  ["mentor_without_pose", "후배에게 하는 말", "후배에게 늘 대단한 조언을 하진 않는다.\n다만 자기 일이 어떤 사람에게 필요한지는 빨리 알아두라고 말한다."],
  ["lecture_future", "나중에 강의한다면", "언젠가 강의를 더 넓게 하게 되면, 멋진 말보다 바로 써먹을 장면을 많이 남기고 싶다.\n이 업계에서 오래 일하며 배운 건 결국 현장에 있었다."],
  ["brand_quiet", "브랜드를 키우는 방식", "브랜드는 크게 말한다고 커지지 않는다.\n내가 하는 말을 오래 믿을 수 있게 만드는 쪽이 나한테는 더 맞다."],
  ["client_trust", "함께 일할 사람", "같이 일할 사람을 고를 때 실력만 보진 않는다.\n약속을 편하게 지키는 사람과 오래 간다."],
  ["workday_rhythm", "일하는 시간", "나는 새벽형도 밤샘형도 아니다.\n내가 가장 또렷한 시간에 중요한 일을 넣고, 나머지는 가볍게 흘려보낸다."],
  ["city_change", "장소를 바꾸는 이유", "가끔은 일하려고 장소를 바꾼다.\n새로운 풍경이 필요한 게 아니라, 같은 생각을 다른 각도에서 보기 위해서."],
  ["coffee_not_reward", "커피 한 잔", "커피는 보상이 아니라 작업 시작 버튼에 가깝다.\n잔을 놓고 노트북을 열면, 이제 내가 할 차례라는 뜻이다."],
  ["good_enough", "충분히 잘한 날", "오늘은 크게 한 일이 없어도 충분히 잘한 날이다.\n해야 할 일 하나를 제대로 끝냈고, 다음 날을 위한 여유도 남겼으니까."],
  ["phone_away", "휴대폰을 멀리 두는 시간", "작업할 때 휴대폰을 멀리 두면 생각보다 마음이 조용해진다.\n집중은 대단한 기술보다 방해를 조금 덜어내는 데서 시작한다."],
  ["meeting_short", "짧은 미팅", "미팅이 길다고 일이 깊어지는 건 아니다.\n서로 뭘 결정했는지만 선명하면, 짧을수록 좋다."],
  ["work_clothes", "일할 때 입는 옷", "일할 때 입는 옷도 나만의 기준이 있다.\n편해야 하고, 어디서 누구를 만나도 내가 흐트러진 느낌은 아니어야 한다."],
  ["education_market", "교육 시장을 볼 때", "교육 시장은 늘 새로운 말이 많다.\n그래도 수강생이 실제로 오래 기억하는 건, 결국 자기 일에 바로 붙여본 한 장면이다."],
  ["content_archive", "내 콘텐츠를 다시 볼 때", "예전에 쓴 글을 다시 읽는 날이 있다.\n지금의 나와 달라서 지우기보다, 그때도 나름 잘 보고 있었다고 생각한다."],
  ["next_city", "다음 도시", "다음 주엔 다른 도시에서 일할 예정이다.\n일이 있는 곳으로 가는 것도 좋지만, 일을 들고 갈 수 있다는 게 더 좋다."],
  ["conversation_after_class", "수업 뒤 피드백", "수업 뒤에 수강생과 짧게 나누는 피드백이 좋다.\n결과를 확인하는 시간보다, 다음 주에 자기 일에 뭘 붙여볼지 정리되는 순간이 더 오래 남는다."],
  ["project_finish", "프로젝트를 끝내는 감각", "프로젝트를 끝낼 때는 다음 걸 바로 시작하지 않는다.\n한 번 잘 닫아봐야, 다음 일을 더 가볍게 열 수 있다."],
  ["quiet_confidence", "조용한 자신감", "내가 하는 일을 굳이 크게 설명하지 않아도 되는 날이 있다.\n오래 쌓인 건 말투보다 결과에서 먼저 보이니까."],
  ["weekend_idea", "주말에 떠오르는 생각", "주말에 떠오른 생각은 월요일까지 기다려본다.\n그래도 남아 있으면 그때 시작한다. 좋은 일은 조금 기다려도 사라지지 않는다."],
  ["long_game", "오래 하는 사람", "일을 오래 할수록 단기 성과에 덜 흔들린다.\n내가 만드는 흐름이 맞으면, 숫자는 조금 늦게 따라와도 괜찮다."],
  ["lesson_material", "자료를 만들 때", "자료를 만들 때 제일 먼저 지우는 건 멋있어 보이기만 하는 문장이다.\n사람들이 실제로 쓰는 문장만 남기고 싶다."],
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || daysBetween(day, date) <= 0 || daysBetween(day, date) > RECENT_DEDUPE_DAYS) continue;
    const folder = path.join(OUTPUT_ROOT, day);
    for (const file of fs.readdirSync(folder).filter((name) => name.endsWith(".json"))) {
      const draft = readJson(path.join(folder, file), {});
      if (draft && !String(draft.status || "").startsWith("deleted_")) ids.add(String(draft.content_id || draft.id || ""));
    }
  }
  return ids;
}

function pickNote(date, slot) {
  const recent = recentContentIds(date);
  const offset = (dayNumber(date) + (slot === "night" ? 1 : 0)) % NOTES.length;
  for (let index = 0; index < NOTES.length; index += 1) {
    const [seedId, title, text] = NOTES[(offset + index) % NOTES.length];
    if (!recent.has(seedId)) return { seedId, title, text };
  }
  throw new Error("최근 21일 안에 재사용하지 않을 오프노트 일상 소재가 부족합니다. 새 소재를 추가한 뒤 다시 실행하세요.");
}

const REFLECTION_ENDINGS = [
  "이렇게 한 번 정리해두면, 다음 작업을 시작할 때 무엇부터 열지 선명해진다.",
  "오늘 정한 순서는 내일 바뀔 수 있어도, 지금 할 일을 흐리지 않게 해준다.",
  "예전보다 덜 서두르게 된 건, 이 정도의 속도로도 내가 가는 방향은 흔들리지 않는다는 걸 알아서다.",
  "일은 계속 바뀌지만, 나한테 맞는 리듬을 알아가는 일은 생각보다 오래 남는다.",
  "그래서 오늘은 이것만 해도 됐다고 생각한다. 다음 일은 내일의 내가 조금 가볍게 열면 된다.",
  "그런 날들이 모여서 지금의 일을 만든다고 믿는다. 그래서 굳이 하루를 과하게 채우지 않는다.",
];

function personalNoteText(note, date, slot) {
  // 이미 구체적인 장면·판단·마무리가 있는 소재에는 범용적인 여운을 덧붙이지 않는다.
  if (note.seedId === "say_no_project") return note.text;
  const ending = REFLECTION_ENDINGS[(dayNumber(date) + (slot === "night" ? 1 : 0)) % REFLECTION_ENDINGS.length];
  const text = `${note.text}\n\n${ending}`;
  return text.length <= 500 ? text : text.slice(0, 499).trimEnd() + "…";
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
    pillar: note.seedId.includes("education") || note.seedId.includes("lesson") || note.seedId.includes("class") ? "ten_year_education_work" : "cool_digital_nomad_daily",
    threads_text: personalNoteText(note, date, slot),
    thread_comments: [],
    cardnews_slides: [],
    offnote_tone_profile: {
      voice: "여유 있고 쿨한 IT 교육업계 10년 차 디지털노마드의 짧은 일상 기록",
      cta_policy: "일상 글에는 CTA 없음. 자료·강의 안내는 전체 게시물의 10% 이하에서만 별도 소재로 사용.",
      banned_framing: ["불안", "버텼다", "아무것도 못 했다", "성공 비법", "나처럼 해", "수익 보장"],
    },
    safety_rules: [
      "Do not add a KakaoTalk or Instagram CTA to personal-note posts.",
      "Do not use anxious hustle, scarcity, or income-guarantee framing.",
      "Do not reuse the same content_id within 21 days.",
    ],
  };
}

const date = process.argv[2] || kstDate();
const slot = process.argv[3] || "evening";
const draft = makeDraft(date, slot);
const outDir = path.join(OUTPUT_ROOT, date);
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${draft.id}.json`);
const portableOutPath = outPath.replaceAll("\\", "/");
const createdFlagPath = path.join("outputs", "afterwork-profit", "preview-created.txt");

if (fs.existsSync(outPath)) {
  const existing = readJson(outPath, {});
  if (new Set(["approved", "pending_approval", "published", "held", "publish_failed", "ready_to_review"]).has(existing.status)) {
    fs.writeFileSync(path.join("outputs", "afterwork-profit", "latest-draft-path.txt"), `${portableOutPath}\n`, "utf8");
    fs.writeFileSync(createdFlagPath, "false\n", "utf8");
    console.log(JSON.stringify({ ok: true, created: false, draft: portableOutPath, id: existing.id, status: existing.status }, null, 2));
    process.exit(0);
  }
}

fs.writeFileSync(outPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join("outputs", "afterwork-profit", "latest-draft-path.txt"), `${portableOutPath}\n`, "utf8");
fs.writeFileSync(createdFlagPath, "true\n", "utf8");
console.log(JSON.stringify({ ok: true, created: true, draft: portableOutPath, id: draft.id }, null, 2));
