export const VISUAL_AVOID_LIST = [
  "hands",
  "fingers",
  "arms",
  "faces",
  "body parts",
  "paper",
  "receipts",
  "books",
  "notebooks",
  "sticky notes",
  "labels",
  "shipping boxes",
  "screens",
  "readable text",
  "Korean text",
  "English text",
  "numbers",
  "QR codes",
  "price tags",
  "discount badges",
  "logos",
  "brand marks",
  "mirrors",
  "reflective surfaces",
];

const EXACT_APPEARANCE_KEYWORDS = ["쿠션", "파운데이션", "컨실러", "립스틱", "가전", "전자", "브랜드", "캐릭터"];

function needsExactImage(candidate) {
  const text = `${candidate.product_name || ""} ${candidate.category || ""}`;
  return EXACT_APPEARANCE_KEYWORDS.some((keyword) => text.includes(keyword));
}

function surfaceFor(candidate, requestedSurface) {
  if (requestedSurface) return requestedSurface;
  const text = `${candidate.product_name || ""} ${candidate.category || ""}`;
  if (text.includes("욕실")) return "bathroom shelf";
  if (text.includes("주방") || text.includes("행주")) return "kitchen counter";
  if (text.includes("파우치")) return "desk beside a plain pouch";
  return "desk";
}

export function buildLifestyleVisualPlan(candidate = {}, options = {}) {
  if (needsExactImage(candidate) && candidate.image_url) {
    return {
      visual_mode: "api_product_image",
      visual_prompt: "",
      visual_avoid_list: [...VISUAL_AVOID_LIST],
      visual_review_status: "pending",
      media_urls: [candidate.image_url],
    };
  }

  const surface = surfaceFor(candidate, options.surface);
  const prompt = [
    `Realistic casual phone-camera photo of ${candidate.product_name || "a practical daily-use product"} on an ordinary Korean home ${surface}.`,
    "Slightly imperfect quick snapshot, not centered, natural daylight, mild grain, normal shadows.",
    "Small safe clutter only: plain charging cable, unbranded lip balm, simple pouch, neutral tray, or folded cloth with no writing.",
    "No text overlays, no promotional layout, no studio lighting, no influencer flat lay.",
    `Avoid: ${VISUAL_AVOID_LIST.join(", ")}.`,
  ].join(" ");

  return {
    visual_mode: "ai_lifestyle_reference",
    visual_prompt: prompt,
    visual_avoid_list: [...VISUAL_AVOID_LIST],
    visual_review_status: "pending",
    media_urls: [],
  };
}

export function validateVisualPlan(plan = {}) {
  const errors = [];
  const prompt = String(plan.visual_prompt || "").toLowerCase();
  const avoid = Array.isArray(plan.visual_avoid_list) ? plan.visual_avoid_list.map((item) => String(item).toLowerCase()) : [];
  if (!plan.visual_mode) errors.push("visual_mode is required.");
  if (plan.visual_mode === "ai_lifestyle_reference" && !prompt) errors.push("visual_prompt is required for ai_lifestyle_reference.");
  if (plan.visual_mode === "ai_lifestyle_reference") {
    for (const required of ["hands", "readable text", "receipts", "logos", "price tags"]) {
      if (!avoid.includes(required)) errors.push(`visual_avoid_list must include ${required}.`);
    }
    if (/\bwith hands\b|holding/.test(prompt)) errors.push("visual_prompt must not include hands.");
    if (/receipt|korean text/.test(prompt) && !prompt.includes("avoid:")) errors.push("visual_prompt must not include readable text.");
  }
  return { ok: errors.length === 0, errors };
}
