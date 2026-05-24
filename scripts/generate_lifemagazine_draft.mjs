import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_ACCOUNT = "lifemagazine_";
const DEFAULT_PROJECT = "lifemagazine";

export const TONE_STYLES = [
  {
    key: "discovery_over",
    label: "발견 오바형",
    description: "보고 멈춤, 확대함, 나만 본 거 아니지 같은 반응 과장형.",
    example: "ㅇㅇ 유튜브 보다가 이 장면에서 멈춤\n아니 저 광 뭐냐고...\n나만 확대해서 본 거 아니지\n찾아보니까 후기 많은 이유가 있긴 하더라\n정보 댓글에 둠",
  },
  {
    key: "friend_tip",
    label: "친구 제보형",
    description: "야 이거 봤어? 하고 보내는 톡 같은 말투.",
    example: "야 이거 봤어?\nㅇㅇ 유튜브에 나온 건데\n처음엔 그냥 예쁘다 하고 넘겼다가 계속 생각남\n결국 찾아봤고... 응 졌다\n댓글에 둘게",
  },
  {
    key: "review_receipt",
    label: "후기 납득형",
    description: "후기 수, 평점, 재구매 같은 숫자 근거로 납득시키는 말투.",
    example: "이거 보고 찾아봤는데\n후기 수 보고 납득함\n나만 눈 돌아간 게 아니었네\n이런 건 괜히 화면에서 살아남는 게 아니구나 싶음\n정보 댓글에 남겨둘게",
  },
  {
    key: "story_buy",
    label: "썰 풀기형",
    description: "내돈내산/몇 통째/추천해준 사람 같은 사연으로 끌고 가는 말투.",
    example: "예전에 이런 느낌 찾다가 실패를 몇 번 했거든\n근데 이 장면 보고 다시 검색창 열림\n이런 건 너무 싼티 나면 바로 티 나서 좀 걸러봤어\n괜찮아 보이는 것만 댓글에 남김",
  },
  {
    key: "authority_pick",
    label: "권위자 찍어줌형",
    description: "쇼핑 많이 해본 사람이 딱 찍어주는 리스트형.",
    example: "쇼핑 많이 망해본 사람이 딱 말할게\n이런 무드는 소재랑 라인이 전부야\n사진에서 예뻐 보여도 실제로 흐물거리면 끝남\n그래서 볼 만한 것만 추려둠",
  },
  {
    key: "twist",
    label: "반전형",
    description: "다 똑같다 생각했는데 써보면/찾아보면 바뀌는 구조.",
    example: "이런 거 다 비슷하다 생각했는데\n이 장면 보고 생각 바뀜\n은근히 차이가 나는 포인트가 있더라\n찾아본 정보 댓글에 둘게",
  },
  {
    key: "soft_curiosity",
    label: "담백 궁금증형",
    description: "오바는 줄이고 왜 눈에 들어왔는지 자연스럽게 푸는 말투.",
    example: "이 장면에서 은근히 눈 가던 게 이 디테일이었어\n너무 꾸민 느낌은 아닌데 화면에서는 확실히 살아남더라\n비슷하게 볼 만한 정보 댓글에 정리해둘게",
  },
];

export function toneStyleByKey(key) {
  return TONE_STYLES.find((style) => style.key === key) || TONE_STYLES[0];
}

function compactDate(date) {
  return String(date || "").replaceAll("-", "");
}

function slugify(value) {
  return String(value || "draft")
    .trim()
    .normalize("NFC")
    .replace(/[^\p{Letter}\p{Number}\s_-]/gu, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "draft";
}

export function buildDraftId(date, slot, topic) {
  return `LIFE-${compactDate(date)}-${slot || "manual"}-${slugify(topic)}`;
}

function slotPublishTime(slot) {
  if (slot === "night") return "21:00";
  if (slot === "afternoon") return "15:00";
  return "18:00";
}

function normalizeClockTime(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function kstDateTimeToIso(date, clockTime) {
  const [year, month, day] = String(date || "").split("-").map(Number);
  const [hour, minute] = String(clockTime || "").split(":").map(Number);
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) return "";
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute, 0, 0)).toISOString();
}

function disclosureFor(productLinks) {
  return productLinks.length ? "[제휴 링크 포함]\n\n" : "";
}

function sourceLabel(input) {
  return String(input.celebrity_or_content || "이 콘텐츠").trim();
}

function relationshipNote(input) {
  const relationship = input.product_relationship || "trend_only";
  if (relationship === "official_confirmed") {
    return "";
  }
  if (relationship === "strong_guess") {
    return "공식 확인은 아니라서 같은 제품처럼 말하진 않고, 화면 속 무드 기준으로만 볼게.";
  }
  if (relationship === "similar_mood") {
    return "정확한 동일템 단정은 안 하고, 비슷한 무드로 볼 만한 쪽만 추려봤어.";
  }
  return "제품 단정은 빼고, 왜 눈에 들어왔는지 포인트만 정리해볼게.";
}

function toneOpening(input) {
  const style = toneStyleByKey(input.tone_style);
  const source = sourceLabel(input);
  const topic = String(input.topic || "이 아이템").trim();
  const productName = String(input.product_name || "").trim();
  const notes = String(input.notes || "").trim();

  if (input.product_relationship === "official_confirmed") {
    const noteLines = notes.split(/[.!?\n]/).map((line) => line.trim()).filter(Boolean);
    const lovedItemLine = /2\s*통|찐|애정템|사용\s*중|내돈내산/.test(notes)
      ? noteLines.find((line) => /2\s*통|찐|애정템|사용\s*중|내돈내산/.test(line))
      : "";
    const concernLine = /다크서클|커버|피부화장|잡티|홍조|컨실러|쿠션|파데/.test(notes)
      ? noteLines.find((line) => line !== lovedItemLine && /다크서클|커버|피부화장|잡티|홍조|컨실러|쿠션|파데/.test(line))
      : "";
    return [
      lovedItemLine || `${source}에서 이 장면 보고 멈춤`,
      concernLine && concernLine !== lovedItemLine ? `${concernLine}이면 이건 안 찾아볼 수가 없더라` : "이거 궁금했던 사람은 한번 볼 만해",
      `${source} 보고 나도 바로 궁금해짐`,
    ].filter(Boolean);
  }

  if (style.key === "friend_tip") {
    return [
      `야 이거 봤어?`,
      `${source}에 나온 건데`,
      `처음엔 그냥 예쁘다 하고 넘겼다가 ${topic} 계속 생각남`,
      "결국 찾아봤고... 응 졌다",
    ];
  }
  if (style.key === "review_receipt") {
    return [
      `${source}에서 보고 찾아봤는데`,
      "후기 수 보고 납득함",
      "나만 눈 돌아간 게 아니었네",
      "이런 건 괜히 화면에서 살아남는 게 아니구나 싶음",
    ];
  }
  if (style.key === "story_buy") {
    return [
      `예전에 ${topic} 이런 느낌 찾다가 실패를 몇 번 했거든`,
      `근데 ${source} 보고 다시 검색창 열림`,
      "이런 건 너무 싼티 나면 바로 티 나서 좀 걸러봤어",
    ];
  }
  if (style.key === "authority_pick") {
    return [
      "쇼핑 많이 망해본 사람이 딱 말할게",
      `${topic}은 사진에서 예뻐 보여도 실제로는 디테일 차이가 커`,
      "소재랑 라인 이상한 건 빼고 볼 만한 것만 추려둘게",
    ];
  }
  if (style.key === "twist") {
    return [
      `${topic} 다 비슷하다 생각했는데`,
      `${source} 이 장면 보고 생각 바뀜`,
      "은근히 차이가 나는 포인트가 있더라",
    ];
  }
  if (style.key === "soft_curiosity") {
    return [
      `${source}에서 은근히 눈 가던 게 ${topic}이었어`,
      "너무 꾸민 느낌은 아닌데 화면에서는 확실히 살아남더라",
      "비슷하게 볼 만한 정보 댓글에 정리해둘게",
    ];
  }
  return [
    `${source} 보다가 이 장면에서 멈춤`,
    `아니 ${topic} 뭐냐고...`,
    "나만 확대해서 본 거 아니지",
    "찾아보니까 눈에 들어온 이유가 있긴 하더라",
  ];
}

function buildThreadsText(input, productLinks) {
  const lines = [
    disclosureFor(productLinks).trimEnd(),
    ...toneOpening(input),
    relationshipNote(input),
    "정보는 댓글에 남겨둘게.",
  ].filter(Boolean);
  return lines.join("\n");
}

function buildComments(input, productLinks) {
  const comments = [];
  const sourceUrls = Array.isArray(input.source_urls) ? input.source_urls.filter(Boolean) : [];
  const relationship = input.product_relationship || "trend_only";

  if (sourceUrls.length || input.official_confirmation_source) {
    comments.push([
      "내가 본 출처/확인 메모",
      input.official_confirmation_source || "",
      ...sourceUrls,
    ].filter(Boolean).join("\n"));
  }

  if (productLinks.length) {
    const relationLine =
      relationship === "official_confirmed"
        ? "사용자 메모/출처 기준으로 제품 정보를 정리했어."
        : relationship === "trend_only"
          ? "트렌드 참고용 링크야. 특정인이 쓴 제품이라고 단정하지 않아."
          : "동일 제품 단정은 아니고, 비슷한 무드로 볼 만한 참고템이야.";

    comments.push([
      "제품 정보는 여기.",
      relationLine,
      ...productLinks.map((item, index) => `${index + 1}. ${item.label || "추천 링크"}: ${item.url || item}`),
      "",
      "제휴 링크라 구매하면 수수료가 생길 수 있어.",
    ].join("\n"));
  } else {
    comments.push("제품 링크 없이 포인트만 정리한 초안이야. 링크 넣을 거면 상품 링크를 추가해줘.");
  }

  return comments;
}

export function generateLifemagazineDraft(input = {}, options = {}) {
  const date = input.date || new Date().toISOString().slice(0, 10);
  const slot = input.slot || "manual";
  const topic = input.topic || "lifemagazine draft";
  const productLinks = Array.isArray(input.product_links) ? input.product_links.filter(Boolean) : [];
  const id = input.id || buildDraftId(date, slot, topic);
  const toneStyle = toneStyleByKey(input.tone_style).key;
  const customPublishTime = normalizeClockTime(input.custom_publish_time);
  const clockTime = customPublishTime || normalizeClockTime(input.recommended_publish_time) || slotPublishTime(slot);
  const publishTimeSource = customPublishTime ? "custom" : "recommended";

  return {
    id,
    account: DEFAULT_ACCOUNT,
    account_name: "라이프매거진",
    project: DEFAULT_PROJECT,
    topic,
    product_name: input.product_name || "",
    status: input.status || "ready_to_review",
    draft_date: date,
    created_at: options.now || new Date().toISOString(),
    recommended_publish_time: `${clockTime} KST`,
    scheduled_publish_at: kstDateTimeToIso(date, clockTime),
    publish_time_source: publishTimeSource,
    tone_style: toneStyle,
    tone_label: toneStyleByKey(toneStyle).label,
    threads_text: buildThreadsText({ ...input, tone_style: toneStyle }, productLinks),
    thread_comments: buildComments(input, productLinks),
    media_urls: Array.isArray(input.media_urls) ? input.media_urls : [],
    local_media_paths: Array.isArray(input.local_media_paths) ? input.local_media_paths : [],
    source_urls: Array.isArray(input.source_urls) ? input.source_urls.filter(Boolean) : [],
    safety_rules: [
      "Publish only when Threads profile username is lifemagazine_.",
      "Separate official confirmed products from substitute items.",
      "Show affiliate/ad disclosure when product links exist.",
    ],
    celebrity_or_content: input.celebrity_or_content || "",
    source_type: input.source_type || "user_memo",
    product_relationship: input.product_relationship || "trend_only",
    product_claim_confidence: input.product_claim_confidence || "",
    product_links: productLinks,
    affiliate_disclosure_required: productLinks.length > 0,
    affiliate_disclosure_text: productLinks.length ? "제휴 링크 포함." : "",
    non_endorsement_disclaimer: "이 게시물은 언급된 인물의 구매 권유나 보증을 의미하지 않아.",
    official_confirmation_source: input.official_confirmation_source || "",
    notes: input.notes || "",
  };
}

export function saveLifemagazineDraft(draft, options = {}) {
  const root = options.root || process.cwd();
  const date = draft.draft_date || String(draft.created_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
  const outDir = path.join(root, "outputs", "lifemagazine", "automation", date);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${draft.id}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  return outPath;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const inputPath = process.argv[2];
  const input = inputPath ? JSON.parse(fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, "")) : {};
  const draft = generateLifemagazineDraft(input);
  const saved = saveLifemagazineDraft(draft);
  console.log(JSON.stringify({ ok: true, draft: saved, id: draft.id }, null, 2));
}
