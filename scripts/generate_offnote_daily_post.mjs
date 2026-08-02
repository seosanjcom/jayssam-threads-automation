import fs from "node:fs";
import path from "node:path";

function kstDate(input = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(input);
  const map = Object.fromEntries(parts.map((item) => [item.type, item.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function dateKey(date) {
  return date.replaceAll("-", "");
}

function seedNumber(...parts) {
  return [...parts.join("|")].reduce((sum, ch, index) => sum + ch.charCodeAt(0) * (index + 1), 0);
}

const MATERIAL_TOPICS = [
  {
    slug: "blog-monetization-start",
    label: "블로그 수익화",
    opener: "요즘 블로그 수익화 물어보는 분들 많은데",
    materials: ["글감 잡는 법", "제목 잡는 법", "검색어 보는 법", "제휴글 쓰는 법"],
  },
  {
    slug: "blog-title-search",
    label: "블로그 제목",
    opener: "블로그 제목에서 막히는 분들 진짜 많은데",
    materials: ["지역 넣는 법", "대상 넣는 법", "상황 넣는 법", "검색어 예시"],
  },
  {
    slug: "affiliate-post",
    label: "제휴글",
    opener: "제휴글은 처음부터 링크만 넣으면 광고처럼 보이기 쉬워서",
    materials: ["상품 고르는 법", "광고처럼 안 보이게 쓰는 법", "링크 넣는 위치", "고지문구"],
  },
  {
    slug: "shorts-topic-script",
    label: "유튜브 쇼츠",
    opener: "쇼츠 시작하려는 분들도 제일 먼저 편집앱부터 찾는데",
    materials: ["주제 잡는 법", "짧은 대본 구조", "얼굴 없이 만드는 법", "반복 포맷"],
  },
  {
    slug: "instagram-threads-ideas",
    label: "인스타/쓰레드",
    opener: "인스타랑 쓰레드는 글을 길게 잘 쓰는 것보다",
    materials: ["글감 모으는 법", "댓글 열리는 질문", "공지방 연결", "자료형 콘텐츠"],
  },
  {
    slug: "experience-campaign",
    label: "체험단/협찬",
    opener: "체험단이나 협찬도 그냥 많이 신청한다고 되는 게 아니라",
    materials: ["신청 전 준비", "후기글 구조", "사진 체크", "광고티 줄이는 법"],
  },
  {
    slug: "beginner-roadmap",
    label: "부업 초보 로드맵",
    opener: "처음엔 블로그, 유튜브, 쇼츠, 인스타가 다 따로 보이는데",
    materials: ["처음 볼 자료", "플랫폼 고르는 법", "콘텐츠 쌓는 순서", "수익화 연결"],
  },
  {
    slug: "content-income-map",
    label: "콘텐츠 수익화 구조",
    opener: "콘텐츠 수익화는 한 방에 돈 버는 방법부터 보면 더 헷갈려서",
    materials: ["검색 유입", "제휴", "자료 배포", "챌린지/강의 연결"],
  },
];

const FOLLOW_LINES = [
  "이런 자료들 하나씩 풀고 있으니, 팔로우하고 정보 줍줍하기!",
  "관련 자료 계속 풀어둘 거라 필요하면 팔로우해둬 :)",
  "처음 시작하는 분들 보라고 자료 하나씩 정리해두는 중!",
  "필요한 사람들 보기 좋게 자료 계속 쌓아둘게.",
];

const INSTAGRAM_LINES = [
  "필요한 사람은 인스타 같은 글에 댓글 남겨줘",
  "자료 필요한 사람은 인스타 같은 글에 댓글로 남겨줘",
  "이 자료 보고 싶은 분들은 인스타 같은 글에 댓글 남겨줘",
  "댓글은 인스타 같은 글에 댓글로 남겨줘. 거기서 확인할게",
];

const KAKAO_LINES = [
  "+카톡방에서만 자료랑 챌린지 공지하고 있으니 필요하면 프로필 링크타고 들어와 :)",
  "+자료, 챌린지, 강의 공지는 카톡방에서만 올리고 있어. 필요하면 프로필 링크로 들어와 :)",
  "+카톡방에는 자료랑 챌린지 공지만 따로 올려둘게. 필요한 사람은 프로필 링크!",
  "+자료 모음이랑 챌린지/강의 소식은 카톡방에서만 공지할게 :)",
];

function pickTopic(date, slot) {
  const seed = seedNumber(date, slot);
  return MATERIAL_TOPICS[seed % MATERIAL_TOPICS.length];
}

function pickLine(lines, date, slot, salt) {
  return lines[seedNumber(date, slot, salt) % lines.length];
}

function formatMaterials(materials) {
  if (materials.length <= 2) return materials.join(", ");
  return `${materials.slice(0, -1).join(", ")}, ${materials.at(-1)}`;
}

function buildThreadsText(topic, date, slot) {
  const follow = pickLine(FOLLOW_LINES, date, slot, "follow");
  const instagram = pickLine(INSTAGRAM_LINES, date, slot, "instagram");
  const kakao = pickLine(KAKAO_LINES, date, slot, "kakao");
  const bridge = topic.slug === "affiliate-post"
    ? "처음엔 뭘 어디까지 써야 하는지도 헷갈릴 수밖에 없어."
    : "처음엔 뭘 배워야 하는지도 헷갈릴 수밖에 없어.";

  return [
    topic.opener,
    bridge,
    formatMaterials(topic.materials),
    follow,
    instagram,
    kakao,
  ].join("\n");
}

function buildSlides(topic) {
  return [
    { title: topic.label, body: "처음 시작하는 사람이 먼저 보면 좋은 자료" },
    { title: "자료", body: topic.materials.slice(0, 2).join(" / ") },
    { title: "추가 자료", body: topic.materials.slice(2).join(" / ") },
    { title: "공지", body: "자료, 챌린지, 강의 공지는 카톡방에서만" },
  ];
}

function makeDraft(date, slot) {
  const topic = pickTopic(date, slot);
  const id = `OFFNOTE-${dateKey(date)}-${slot}-${topic.slug}`;
  return {
    id,
    account: "offnote.kr",
    account_name: "오프노트",
    project: "afterwork-profit",
    date,
    slot,
    topic: `${topic.label} 자료`,
    topic_tag: topic.label,
    status: "pending_approval",
    created_at: new Date().toISOString(),
    source: "github-actions-offnote-materials-generator",
    recommended_publish_time: slot === "night" ? "21:00 KST" : "18:00 KST",
    content_mode: "offnote_materials",
    threads_text: buildThreadsText(topic, date, slot),
    thread_comments: [],
    cardnews_slides: buildSlides(topic),
    offnote_tone_profile: {
      voice: "짧고 일상적인 자료 공유",
      instagram_cta: true,
      kakao_notice: true,
      banned_framing: ["기준", "나처럼 해", "성공담", "망한 것/배운 것/수정한 것"],
    },
    safety_rules: [
      "Generated Offnote drafts require approval before publishing.",
      "Threads CTA routes material requests to Instagram same-post comments.",
      "KakaoTalk room is positioned as the only place for materials, challenges, and class notices.",
      "Do not use follow-my-success framing.",
    ],
  };
}

const date = process.argv[2] || kstDate();
const slot = process.argv[3] || "evening";
const draft = makeDraft(date, slot);
const outDir = path.join("outputs", "afterwork-profit", "automation", date);
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${draft.id}.json`);
const portableOutPath = outPath.replaceAll("\\", "/");
const createdFlagPath = path.join("outputs", "afterwork-profit", "preview-created.txt");

if (fs.existsSync(outPath)) {
  const existing = JSON.parse(fs.readFileSync(outPath, "utf8").replace(/^\uFEFF/, ""));
  const protectedStatuses = new Set(["approved", "pending_approval", "published", "held", "publish_failed", "ready_to_review"]);
  if (protectedStatuses.has(existing.status)) {
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
