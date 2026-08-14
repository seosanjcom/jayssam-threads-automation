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

// 오프노트는 ‘완성된 미니 에세이’가 아니라, 일을 하다 바로 남긴 개인 기록이다.
// 소재는 작은 작업·이동 사건이며, 결론·교훈·CTA를 붙이지 않는다.
const RECORDS = [
  { id: "meeting_no_decision", title: "회의는 끝났는데", shape: "one_line", tag: "프로젝트관리", text: `회의는 끝났는데
결정된 건 없음` },
  { id: "quote_read_no_contract", title: "견적 확인 답장", shape: "memo", tag: "프리랜서일상", text: `견적 보냈는데
답장은 확인했습니다 하나 옴
계약서 얘기는 아직 없음` },
  { id: "train_revision", title: "KTX 직전 수정", shape: "status", tag: "원격근무", text: `KTX 타기 직전에 수정 요청 옴
파일은 이미 보냈는데
다시 열었음` },
  { id: "calendar_hold_question", title: "일정만 먼저", shape: "question", tag: "프리랜서일상", text: `계약서 안 썼는데
일정부터 잡자고 하면
보통 캘린더 비워둬?` },
  { id: "final_final2", title: "최종 파일 이름", shape: "loose", tag: "프로젝트관리", text: `파일 이름이 최종_최종2까지 갔다
이번엔 진짜 끝난 줄 알았는데
메일 하나 더 옴` },
  { id: "charger_priority", title: "충전기가 먼저", shape: "one_line", tag: "디지털노마드", text: `제안서보다 충전기가 더 급함` },
  { id: "wifi_upload", title: "와이파이 업로드", shape: "memo", tag: "원격근무", text: `와이파이 연결은 됐는데
업로드가 안 됨` },
  { id: "zoom_link_change", title: "줌 링크 변경", shape: "status", tag: "프로젝트관리", text: `회의 시작 5분 전에
줌 링크 바뀜
일단 다시 들어감` },
  { id: "quote_followup_question", title: "견적 재문의", shape: "question", tag: "프리랜서일상", text: `견적 확인했다는 답만 오고
며칠째 조용한데
한 번 더 물어봐도 되나` },
  { id: "desk_photo", title: "숙소 책상", shape: "loose", tag: "디지털노마드", text: `숙소 책상 보고 예약했는데
책상 아니고 화장대였음
노트북은 겨우 올라감` },
  { id: "slack_decision", title: "슬랙 답장", shape: "one_line", tag: "프로젝트관리", text: `슬랙에는 답이 왔는데
결정은 아직 안 났다` },
  { id: "battery_19", title: "배터리 19%", shape: "memo", tag: "디지털노마드", text: `충전기 두고 나옴
배터리 19%
회의는 아직 하나 남음` },
  { id: "wrong_file", title: "다른 파일 수정", shape: "status", tag: "프로젝트관리", text: `수정 다 했다고 보냈는데
다른 파일을 고친 거였음
다시 보냄` },
  { id: "scope_question", title: "범위가 바뀐 메일", shape: "question", tag: "프리랜서일상", text: `처음 얘기한 범위보다
할 일이 늘어난 것 같은데
이거 그냥 진행해?` },
  { id: "coffee_noise", title: "카페 소음", shape: "loose", tag: "디지털노마드", text: `카페 옮겼는데
여기가 더 시끄러움 ㅋㅋ
노이즈캔슬링 찾는 중` },
  { id: "reply_draft", title: "답장만 세 번", shape: "one_line", tag: "프리랜서일상", text: `답장 쓰다가
지웠다 다시 썼다 세 번째` },
  { id: "client_reads", title: "읽음 표시", shape: "memo", tag: "프로젝트관리", text: `제안서 읽음은 떴는데
답장은 없음` },
  { id: "meeting_notes", title: "회의 뒤 슬랙", shape: "status", tag: "협업", text: `회의 끝났는데
내가 뭘 하기로 한 건지
다시 슬랙 보는 중` },
  { id: "meeting_time_question", title: "회의 시간", shape: "question", tag: "원격근무", text: `오후 6시 회의면
저녁 먹기 전에 하는 편이야
끝나고 먹는 편이야` },
  { id: "chair_not_desk", title: "작업 자리", shape: "loose", tag: "디지털노마드", text: `작업할 자리 찾았는데
콘센트는 멀고
의자는 편함` },
  { id: "revision_14", title: "수정 14개", shape: "one_line", tag: "프로젝트관리", text: `파일 다시 열었는데
수정사항 14개 더 와있음` },
  { id: "send_later", title: "보낼까 말까", shape: "memo", tag: "프리랜서일상", text: `메일은 다 썼는데
지금 보내면 또 바로 답 올 것 같아서
예약 발송 걸어둠` },
  { id: "calendar_overlaps", title: "캘린더 겹침", shape: "status", tag: "프로젝트관리", text: `캘린더 보니까
같은 시간에 두 개 잡혀있음
누가 먼저 잡은 건지도 모르겠음` },
  { id: "zoom_wifi_question", title: "와이파이 속도", shape: "question", tag: "원격근무", text: `숙소 와이파이 이 정도면
줌 회의 그냥 들어가?
아니면 카페 감` },
  { id: "missed_call", title: "부재중 전화", shape: "loose", tag: "협업", text: `회의 시작 직전에
부재중 전화 하나
끝나고 보니까 이미 해결됐다고 함` },
  { id: "one_more_change", title: "한 줄 더", shape: "one_line", tag: "프로젝트관리", text: `이 문장 하나만 바꾸면 된다더니
하나 더 나옴` },
  { id: "outside_rain", title: "비 오는 이동", shape: "memo", tag: "디지털노마드", text: `비 오기 전에 나왔는데
회의 끝나니까 더 많이 옴
택시 앱 켬` },
  { id: "folder_confusion", title: "폴더 두 개", shape: "status", tag: "프로젝트관리", text: `드라이브에 같은 이름 폴더가 두 개
둘 다 최근 수정됨
둘 중 하나는 내가 만든 게 아님` },
  { id: "hold_or_confirm", title: "홀드인지 확정인지", shape: "question", tag: "협업", text: `이게 일정 확정이라는 건지
일단 비워두라는 건지
모르겠음` },
  { id: "camera_off", title: "카메라 끈 회의", shape: "loose", tag: "원격근무", text: `오늘 회의는 카메라 끄고 들었는데
표정 관리 안 해도 돼서
생각보다 괜찮았음` },
  { id: "mail_subject", title: "메일 제목", shape: "one_line", tag: "프로젝트관리", text: `메일 제목만 열 번 바꿈` },
  { id: "seat_taken", title: "콘센트 자리", shape: "memo", tag: "디지털노마드", text: `콘센트 있는 자리 찾았는데
누가 가방만 올려두고 감` },
  { id: "feedback_split", title: "피드백 두 방향", shape: "status", tag: "협업", text: `피드백이 두 방향으로 옴
둘 다 맞는 말 같아서
일단 파일 닫음` },
  { id: "client_silence_question", title: "읽음 뒤 침묵", shape: "question", tag: "프리랜서일상", text: `읽음만 남기고 조용하면
보통 며칠까지 기다려?` },
  { id: "late_checkin", title: "체크인 뒤 회의", shape: "loose", tag: "디지털노마드", text: `체크인하고 바로 회의 들어갔는데
배경이 아직 캐리어였음
카메라는 안 켬` },
  { id: "task_not_clear", title: "할 일 불명", shape: "one_line", tag: "협업", text: `회의는 끝났는데
내 할 일은 더 흐려짐` },
  { id: "small_text", title: "작은 글씨", shape: "memo", tag: "프로젝트관리", text: `피드백 보다가
글씨가 너무 작아서 확대했는데
수정할 건 더 많아 보임` },
  { id: "meeting_moves", title: "회의 재조정", shape: "status", tag: "원격근무", text: `회의 시간이 또 바뀜
오늘만 세 번째
알림은 다 켜둠` },
  { id: "send_before_train_question", title: "기차 전 발송", shape: "question", tag: "디지털노마드", text: `기차 타기 전에 보내면
도착할 때까지 답장 기다리게 되는데
그래도 보내?` },
  { id: "table_too_low", title: "낮은 테이블", shape: "loose", tag: "디지털노마드", text: `창가 자리는 좋았는데
테이블이 너무 낮음
노트북 받침대 생각남` },
  { id: "draft_saved", title: "임시저장", shape: "one_line", tag: "프로젝트관리", text: `보내기 대신 임시저장 눌렀다` },
  { id: "reply_after_walk", title: "산책 뒤 답장", shape: "memo", tag: "프리랜서일상", text: `답장 쓰다가 막혀서
잠깐 걸었는데
돌아와도 문장은 그대로` },
  { id: "calendar_empty", title: "비어 있던 시간", shape: "status", tag: "프로젝트관리", text: `오후가 비어 있어서
밀린 일 하려고 했는데
새 요청이 먼저 들어옴` },
  { id: "revision_now_question", title: "지금 고칠까", shape: "question", tag: "프로젝트관리", text: `수정 요청 지금 왔는데
오늘 안에 고치면 되는 건지
내일 봐도 되는 건지 모르겠음` },
  { id: "noise_cancel", title: "노이즈캔슬링", shape: "loose", tag: "디지털노마드", text: `옆 테이블 통화가 길어짐
내 작업도 같이 길어지는 중` },
  { id: "unknown_attachment", title: "첨부파일", shape: "one_line", tag: "협업", text: `메일 첨부파일 이름이
진짜_최종임` },
  { id: "zoom_waiting", title: "대기실", shape: "memo", tag: "원격근무", text: `줌 대기실 들어왔는데
회의 시간이 지났음
나만 들어와 있음` },
  { id: "brief_missing", title: "브리프 빠짐", shape: "status", tag: "협업", text: `브리프 읽고 있는데
정작 마감일이 없음
다시 물어봄` },
  { id: "back_to_back_question", title: "연속 회의", shape: "question", tag: "원격근무", text: `회의 두 개 연달아 있으면
중간에 물 마실 시간
어떻게 남겨?` },
  { id: "battery_saver", title: "절전 모드", shape: "loose", tag: "디지털노마드", text: `배터리 절전 모드 켰는데
화면이 어두워져서
피드백이 더 안 보임` }
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
  const offset = (dayNumber(date) + (slot === "night" ? 1 : 0)) % RECORDS.length;
  for (let index = 0; index < RECORDS.length; index += 1) {
    const note = RECORDS[(offset + index) % RECORDS.length];
    if (!recent.has(note.id)) return note;
  }
  throw new Error("최근 21일 안에 재사용하지 않을 오프노트 기록 소재가 부족합니다. 새 기록을 추가한 뒤 다시 실행하세요.");
}

function personalNoteText(note) {
  return note.text.length <= 500 ? note.text : note.text.slice(0, 499).trimEnd() + "…";
}

function makeDraft(date, slot) {
  const note = pickNote(date, slot);
  const id = `OFFNOTE-${dateKey(date)}-${slot}-${note.id}`;
  return {
    id,
    content_id: note.id,
    account: "offnote.kr",
    account_name: "오프노트",
    project: "afterwork-profit",
    date,
    slot,
    topic: note.title,
    topic_tag: note.tag,
    status: "approved",
    created_at: new Date().toISOString(),
    source: "github-actions-offnote-digital-nomad-notes",
    recommended_publish_time: slot === "night" ? "21:30 KST" : "15:30 KST",
    content_mode: "digital_nomad_personal_note",
    pillar: "offnote_unfinished_work_record",
    record_shape: note.shape,
    threads_text: personalNoteText(note),
    thread_comments: [],
    cardnews_slides: [],
    offnote_tone_profile: {
      voice: "일하다가 휴대폰으로 바로 적은 것처럼 보이는 개인 작업·이동 기록",
      structure: "한 줄 사건·두세 줄 메모·미결정 상태·좁은 질문·덜 정리된 기록을 순환",
      cta_policy: "일상 글에는 CTA 없음. 질문은 실제 판단이 필요한 날에만 하나까지 허용.",
      banned_framing: ["불안", "버텼다", "아무것도 못 했다", "성공 비법", "나처럼 해", "수익 보장", "자기계발 조언"],
    },
    safety_rules: [
      "Do not add a KakaoTalk or Instagram CTA to personal-note posts.",
      "Do not use anxious hustle, scarcity, income-guarantee, or generic self-help framing.",
      "Do not reuse the same content_id within 21 days.",
      "Do not add a lesson, value statement, or polished conclusion after the event.",
      "Do not invent performance numbers, client names, or detailed factual claims.",
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
