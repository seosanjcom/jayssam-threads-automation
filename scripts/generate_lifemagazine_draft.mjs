import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { COUPANG_DISCLOSURE } from "./lifemagazine_product_candidates.mjs";
import { buildLifestyleVisualPlan } from "./lifemagazine_visual_policy.mjs";

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

function disclosureFor(productLinks, input = {}) {
  if (input.content_mode === "found_product" || input.content_mode === "recommendation" || input.affiliate_disclosure_location === "reply") {
    return "";
  }
  return productLinks.length ? "[제휴 링크 포함]\n\n" : "";
}

function sourceLabel(input) {
  return String(input.celebrity_or_content || "이 콘텐츠").trim();
}

function cleanOfficialNoteLine(line, productName = "") {
  let value = String(line || "").trim();
  if (productName) value = value.replace(productName, "").trim();
  return value.replace(/\s+/g, " ").replace(/[.。]+$/g, "").trim();
}

function firstMatchingLine(lines, pattern, productName = "") {
  const line = lines.find((item) => pattern.test(item));
  return cleanOfficialNoteLine(line, productName);
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
    const lovedItemLine = firstMatchingLine(noteLines, /2\s*통|찐\s*애정템|내돈내산|사용\s*중|재구매|n통|N통/i, productName);
    const concernLine = firstMatchingLine(
      noteLines.filter((line) => cleanOfficialNoteLine(line, productName) !== lovedItemLine),
      /다크서클|커버|피부화장|잡티|톤|컨실러|쿠션|파데|탈모|비듬|머릿결|건조|각질|향|광/i,
      productName,
    );
    return [
      lovedItemLine || `${source}에서 나온 장면 보고 멈춤`,
      concernLine && concernLine !== lovedItemLine ? `${concernLine}이면 이건 안 찾아볼 수가 없더라` : "이거 궁금했던 사람은 한번 볼 만해",
      `${source} 보고 나도 바로 궁금해져서 찾아봄 ㅎㅎ`,
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

function productSceneLines(input) {
  const candidate = input.product_candidate || {};
  const name = String(input.product_name || candidate.product_name || input.topic || "이 제품").trim();
  const operatorNote = String(input.operator_note || candidate.operator_note || "").trim();
  const scene = String(input.scene_brief || candidate.scene_hint || candidate.selection_reason || "매일 반복되는 작은 불편").trim();
  const combined = `${name} ${scene}`;

  if (/링티|아이\s*전용|어린이용\s*(?:음료|식품)/.test(combined)) {
    return [
      "아이와 나갈 때 물병은 챙겼는데, 정작 손이 잘 안 가는 날이 있더라.",
      `${name}은(는) 아이가 먹는 제품인 만큼 ‘좋다’는 말보다 원재료·알레르기 정보·권장 섭취 방법을 먼저 확인하는 쪽이 맞아 보여.`,
      "외출 가방에 넣기 전에는 아이 연령과 평소 먹는 음료를 기준으로, 우리 집 루틴에 맞는지만 한 번 더 살펴보면 돼.",
      "제품 정보·표시 가격·제휴 링크는 댓글에 정리해둘게. 필요한 경우에만 상세 정보를 확인해봐.",
    ];
  }
  if (operatorNote) {
    return [
      `${scene}에서 실제로 자주 쓰일지부터 생각해봤어.`,
      `${name}은(는) 과장된 장점보다 그 상황과 내 생활 루틴이 맞는지가 더 중요해 보여.`,
      "구성·가격·후기처럼 확인 가능한 정보는 링크에서 직접 보고 결정하는 쪽을 추천해.",
      "상품 정보와 링크는 댓글에 정리해둘게. 필요한 경우에만 천천히 확인해봐.",
    ];
  }
  if (/머리끈/.test(combined)) {
    return [
      "아침마다 머리끈 하나 찾느라 서랍을 뒤지는 날이 은근 많더라.",
      `${name}처럼 소모품은 예쁜 한 개보다, 자주 쓰는 곳에 여분을 남겨두는 쪽이 훨씬 실용적이었어.`,
      "세면대 옆·가방 안·책상 서랍에 나눠 두면 ‘없어서 못 묶는’ 순간이 줄어듦.",
      "지금 쓰는 방식이 불편했던 사람만 댓글의 상품 정보 확인해봐.",
    ];
  }
  if (/케이블|충전/.test(combined)) {
    return [
      "충전할 때마다 선이 책상 아래로 떨어지면, 그 작은 짜증이 하루에 몇 번씩 쌓이더라.",
      `${name}은(는) 책상을 예쁘게 만드는 물건보다, 자주 쓰는 선의 자리를 정해두는 용도로 봤어.`,
      "새로 사기 전에 내 케이블 굵기와 붙일 면이 맞는지만 확인하면 실패 확률이 훨씬 낮아.",
      "정리보다 ‘찾는 시간’을 줄이고 싶은 사람에게만 링크 남길게.",
    ];
  }
  if (/파우치|가방/.test(combined)) {
    return [
      "가방 안에서 립밤·충전선·카드지갑 찾느라 한 번씩 멈추는 거, 별일 아닌데 꽤 피곤함.",
      `${name}은(는) 수납을 늘리는 것보다 자주 꺼내는 물건의 위치를 고정하는 쪽으로 골랐어.`,
      "가방 크기와 들고 다니는 물건 수를 먼저 떠올려 보고, 내 루틴에 맞으면 그때 확인해봐.",
      "제품 정보와 가격은 댓글 링크에서 최신 기준으로 볼 수 있어.",
    ];
  }
  if (/청소|행주|욕실|주방/.test(combined)) {
    return [
      "매일 쓰는 살림템은 특별한 날보다 ‘없을 때’ 존재감이 더 크더라.",
      `${name}은(는) ${scene}에서 손이 한 번 덜 가는지를 기준으로 골랐어.`,
      "좋다는 말보다 우리 집에서 어디에 둘지, 얼마나 자주 쓸지를 먼저 생각해보는 게 맞는 것 같아.",
      "필요한 사람만 댓글에서 상품 정보 확인해봐.",
    ];
  }
  return [
    `${name}, ${scene}에서 실제로 자주 쓰일지부터 따져봤어.`,
    "생활템은 기능이 많아 보이는 것보다 내 동선에서 한 번이라도 덜 번거로운지가 더 중요하더라.",
    "사기 전에 크기·구성·후기처럼 확인 가능한 정보는 링크에서 직접 보고 결정하는 걸 추천해.",
    "상품 정보는 댓글에 남길게. 내 생활에 맞는 사람만 천천히 봐줘.",
  ];
}

function buildThreadsText(input, productLinks) {
  if (input.content_mode === "found_product" || input.content_mode === "recommendation") {
    return productSceneLines(input).join("\n");
  }
  const lines = [
    disclosureFor(productLinks, input).trimEnd(),
    ...toneOpening(input),
    relationshipNote(input),
    input.product_relationship === "official_confirmed" ? "정보는 댓글에 남겨둘게!!" : "정보는 댓글에 남겨둘게.",
  ].filter(Boolean);
  return lines.join("\n");
}

function buildComments(input, productLinks) {
  const comments = [];
  const sourceUrls = Array.isArray(input.source_urls) ? input.source_urls.filter(Boolean) : [];
  const relationship = input.product_relationship || "trend_only";
  const productName = String(input.product_name || "").trim();
  const notes = String(input.notes || "").trim();
  const noteLines = notes
    .split(/[.!?\n]/)
    .map((line) => line.trim())
    .filter(Boolean);
  const exactUseLine =
    noteLines.find((line) => /쓴대|썼대|사용한대|발랐대/i.test(line)) ||
    noteLines.find((line) => /호\b|코렉트업|베이지/i.test(line)) ||
    noteLines.find((line) => /사용|2\s*통|찐\s*애정템/i.test(line));

  if ((sourceUrls.length || input.official_confirmation_source) && relationship !== "official_confirmed") {
    comments.push([
      "내가 본 출처/확인 메모",
      input.official_confirmation_source || "",
      ...sourceUrls,
    ].filter(Boolean).join("\n"));
  }

  if (productLinks.length) {
    if (input.content_mode === "found_product" || input.content_mode === "recommendation") {
      const productMetadata = input.product_metadata || {};
      const verifiedDetails = [
        productName ? `상품명: ${productName}` : "",
        productMetadata.brand ? `브랜드: ${productMetadata.brand}` : "",
        productMetadata.price ? `확인 당시 표시가: ${Number(productMetadata.price).toLocaleString("ko-KR")}원 (가격은 변동될 수 있어요)` : "",
      ].filter(Boolean);
      const usesCoupangLink = productLinks.some((item) => /coupang\.com/i.test(String(item.url || item)));
      comments.push([
        "제품 정보는 여기 정리해둘게.",
        ...verifiedDetails,
        ...productLinks.map((item) => `${item.label || "제품 링크"}: ${item.url || item}`),
        "",
        usesCoupangLink ? COUPANG_DISCLOSURE : "이 댓글에는 제휴 링크가 포함될 수 있으며, 구매 시 수수료를 받을 수 있어요.",
      ].join("\n"));
      return comments;
    }
    if (relationship === "official_confirmed") {
      comments.push([
        exactUseLine || "",
        productName || "",
        ...productLinks.map((item) => `${item.label || "구매링크"}: ${item.url || item}`),
        "이 댓글에는 제휴 링크가 포함되어 있고, 구매 시 수수료를 받을 수 있어.",
      ].filter(Boolean).join("\n"));
      return comments;
    }
    const relationLine =
      relationship === "official_confirmed"
        ? "사용자 메모/출처 기준으로 제품 정보를 정리했어."
        : relationship === "trend_only"
          ? "트렌드 참고용 링크야. 특정인이 쓴 제품이라고 단정하지 않아."
          : "동일 제품 단정은 아니고, 비슷한 무드로 볼 만한 참고템이야.";

    comments.push([
      "제품 정보는 여기.",
      relationLine,
      relationship === "official_confirmed" && exactUseLine ? exactUseLine : "",
      relationship === "official_confirmed" && productName ? `확인한 상품명: ${productName}` : "",
      ...productLinks.map((item, index) => `${index + 1}. ${item.label || "추천 링크"}: ${item.url || item}`),
      "",
      "공정위 고지: 이 댓글에는 제휴 링크가 포함되어 있고, 구매 시 수수료를 받을 수 있어.",
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
  const productCandidate = input.product_candidate || {};
  const visualPlan = input.visual_plan || buildLifestyleVisualPlan(productCandidate);
  const mediaUrls = Array.isArray(input.media_urls) && input.media_urls.length
    ? input.media_urls
    : Array.isArray(visualPlan.media_urls) ? visualPlan.media_urls : [];

  return {
    id,
    account: DEFAULT_ACCOUNT,
    account_name: "라이프매거진",
    project: DEFAULT_PROJECT,
    topic,
    product_name: input.product_name || "",
    content_mode: input.content_mode || "",
    scene_brief: input.scene_brief || productCandidate.scene_hint || productCandidate.selection_reason || "",
    target_reader: input.target_reader || productCandidate.scene_hint || "",
    usage_status: input.usage_status || productCandidate.usage_status || "not_confirmed",
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
    media_urls: mediaUrls,
    local_media_paths: Array.isArray(input.local_media_paths) ? input.local_media_paths : [],
    visual_mode: input.visual_mode || visualPlan.visual_mode || "text_only",
    visual_prompt: input.visual_prompt || visualPlan.visual_prompt || "",
    visual_avoid_list: input.visual_avoid_list || visualPlan.visual_avoid_list || [],
    visual_review_status: input.visual_review_status || visualPlan.visual_review_status || "pending",
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
    product_metadata: input.product_metadata || {},
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
