function decodeHtml(value = "") {
  return String(value)
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value = "") {
  return decodeHtml(String(value).replace(/<[^>]*>/g, " "));
}

function normalizeName(value = "") {
  return stripHtml(value)
    .replace(/\s*[-|｜]\s*(쿠팡|Coupang|상품정보|상품 상세|공식몰).*$/i, "")
    .replace(/^쿠팡!\s*/i, "")
    .replace(/^상품\s*[:：]\s*/i, "")
    .trim()
    .slice(0, 180);
}

function normalizePrice(value = "") {
  const digits = String(value).replace(/[^0-9]/g, "");
  const price = Number(digits);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

function parseAttributes(tag = "") {
  const attrs = {};
  const matcher = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = matcher.exec(tag))) {
    attrs[match[1].toLowerCase()] = decodeHtml(match[2] || match[3] || match[4] || "");
  }
  return attrs;
}

function findMeta(html, keys) {
  const tags = String(html).match(/<meta\b[^>]*>/gi) || [];
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  for (const tag of tags) {
    const attrs = parseAttributes(tag);
    const key = String(attrs.property || attrs.name || attrs.itemprop || "").toLowerCase();
    if (wanted.has(key) && attrs.content) return attrs.content;
  }
  return "";
}

function findTitle(html) {
  const titleMatch = String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? normalizeName(titleMatch[1]) : "";
}

function parseJsonLdProducts(html) {
  const scripts = String(html).match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  const products = [];

  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const type = value["@type"];
    const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
    if (isProduct) products.push(value);
    Object.values(value).forEach(visit);
  };

  for (const script of scripts) {
    const body = script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      visit(JSON.parse(body));
    } catch {
      // Invalid embedded JSON-LD is common; Open Graph metadata remains a safe fallback.
    }
  }
  return products;
}

function firstImage(value) {
  if (Array.isArray(value)) return firstImage(value[0]);
  if (value && typeof value === "object") return String(value.url || value.contentUrl || "").trim();
  return String(value || "").trim();
}

function firstOfferPrice(value) {
  const offer = Array.isArray(value) ? value[0] : value;
  if (!offer || typeof offer !== "object") return 0;
  return normalizePrice(offer.price || offer.lowPrice || offer.highPrice || "");
}

function firstBrand(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  return String(value.name || "").trim();
}

function isAccessBlockedPage(html, metadata) {
  const pageText = `${metadata.product_name || ""} ${metadata.description || ""} ${stripHtml(html)}`.toLowerCase();
  return /access denied|you don.?t have permission|접근할 수 있는 권한이 없습니다|권한이 없습니다|captcha|robot check/.test(pageText);
}

export function extractProductMetadata(html, sourceUrl = "") {
  const product = parseJsonLdProducts(html)[0] || {};
  const productName = normalizeName(
    product.name ||
      findMeta(html, ["og:title", "twitter:title", "product:name"]) ||
      findTitle(html),
  );
  const imageUrl = String(
    firstImage(product.image) ||
      findMeta(html, ["og:image", "twitter:image", "product:image"]) ||
      "",
  ).trim();
  const price = firstOfferPrice(product.offers) || normalizePrice(findMeta(html, ["product:price:amount", "og:price:amount"]));
  const brand = firstBrand(product.brand) || findMeta(html, ["product:brand", "brand"]);
  const description = stripHtml(product.description || findMeta(html, ["og:description", "description"])).slice(0, 500);

  return {
    product_name: productName,
    product_url: sourceUrl,
    image_url: imageUrl,
    price,
    brand: brand.slice(0, 80),
    description,
    metadata_status: productName ? "resolved" : "name_not_found",
  };
}

export async function resolveProductLink(url, options = {}) {
  const sourceUrl = String(url || "").trim();
  if (!/^https?:\/\//i.test(sourceUrl)) {
    return { product_url: sourceUrl, metadata_status: "invalid_url", metadata_error: "http 또는 https 상품 링크가 아닙니다." };
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = Number(options.timeoutMs || 15000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(sourceUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LifemagazineProductResolver/1.0; +https://github.com/seosanjcom/jayssam-threads-automation)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
    const resolvedUrl = response.url || sourceUrl;
    if (!response.ok) {
      return { product_url: resolvedUrl, metadata_status: "fetch_failed", metadata_error: `상품 페이지 응답 ${response.status}` };
    }
    if (!contentType.includes("html")) {
      return { product_url: resolvedUrl, metadata_status: "unsupported_content", metadata_error: "상품 상세 HTML을 확인할 수 없습니다." };
    }
    const html = await response.text();
    const metadata = extractProductMetadata(html, resolvedUrl);
    if (isAccessBlockedPage(html, metadata)) {
      return {
        product_name: "",
        product_url: resolvedUrl,
        image_url: "",
        price: 0,
        brand: "",
        description: "",
        metadata_status: "access_denied",
        metadata_error: "상품 페이지가 접근을 차단해 상품 정보를 확인할 수 없습니다. 상품명 또는 상품 상세 화면을 함께 보내 주세요.",
        affiliate_url: sourceUrl,
      };
    }
    return { ...metadata, affiliate_url: sourceUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { product_url: sourceUrl, affiliate_url: sourceUrl, metadata_status: "fetch_failed", metadata_error: message.slice(0, 220) };
  } finally {
    clearTimeout(timeout);
  }
}
