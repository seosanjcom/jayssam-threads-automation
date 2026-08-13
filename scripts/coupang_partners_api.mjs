import crypto from "node:crypto";

const HOST = "https://api-gateway.coupang.com";
const SEARCH_PATH = "/v2/providers/affiliate_open_api/apis/openapi/products/search";
const BEST_CATEGORY_PATH = "/v2/providers/affiliate_open_api/apis/openapi/products/bestcategories";

function compact(value = "", limit = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function signedDate(date = new Date()) {
  return date.toISOString().slice(2).replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildCoupangAuthorization({ accessKey, secretKey, method = "GET", path, query = "", date = new Date() }) {
  const timestamp = signedDate(date);
  const message = `${timestamp}${method.toUpperCase()}${path}${query}`;
  const signature = crypto.createHmac("sha256", secretKey).update(message, "utf8").digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${timestamp}, signature=${signature}`;
}

function normalizeProduct(item = {}) {
  return {
    product_name: compact(item.productName || item.product_name || item.title),
    product_url: compact(item.productUrl || item.product_url || item.url, 500),
    image_url: compact(item.productImage || item.product_image || item.image, 500),
    price: Number(item.productPrice || item.product_price || item.price || 0) || 0,
    brand: compact(item.brand || item.vendorName || item.vendor_name, 80),
    description: compact(item.productName || item.product_name || item.title, 500),
    product_id: String(item.productId || item.product_id || "").trim(),
    category_name: compact(item.categoryName || item.category_name, 120),
  };
}

function resolveCredentials(options = {}) {
  return {
    accessKey: String(options.accessKey || process.env.COUPANG_PARTNERS_ACCESS_KEY || "").trim(),
    secretKey: String(options.secretKey || process.env.COUPANG_PARTNERS_SECRET_KEY || "").trim(),
  };
}

export async function getCoupangPartnerBestProducts(categoryId, options = {}) {
  const normalizedCategoryId = Number(categoryId);
  const { accessKey, secretKey } = resolveCredentials(options);
  if (!Number.isInteger(normalizedCategoryId) || normalizedCategoryId <= 0) {
    return { status: "category_required", products: [], error: "카테고리별 베스트 조회에는 유효한 카테고리 ID가 필요합니다." };
  }
  if (!accessKey || !secretKey) return { status: "credentials_missing", products: [], error: "쿠팡 파트너스 API 키가 설정되지 않았습니다." };

  const params = new URLSearchParams({ limit: String(Math.max(1, Math.min(Number(options.limit || 5), 100))) });
  const query = params.toString();
  const path = `${BEST_CATEGORY_PATH}/${normalizedCategoryId}`;
  const authorization = buildCoupangAuthorization({ accessKey, secretKey, method: "GET", path, query, date: options.date || new Date() });
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  try {
    const response = await fetchImpl(`${HOST}${path}?${query}`, {
      method: "GET",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.rCode && String(body.rCode) !== "0") {
      return { status: "api_error", products: [], error: compact(body.message || body.rMessage || `쿠팡 API 응답 ${response.status}`, 220) };
    }
    const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body?.data?.productData) ? body.data.productData : [];
    return {
      status: rows.length ? "resolved" : "no_match",
      products: rows.map(normalizeProduct).filter((item) => item.product_name).map((item, index) => ({ ...item, category_rank: index + 1, category_id: normalizedCategoryId })),
    };
  } catch (error) {
    return { status: "request_failed", products: [], error: compact(error instanceof Error ? error.message : error, 220) };
  }
}

export async function searchCoupangPartnerProducts(keyword, options = {}) {
  const queryText = compact(keyword, 80);
  const { accessKey, secretKey } = resolveCredentials(options);
  if (!queryText) return { status: "keyword_required", products: [], error: "쿠팡 상품 검색에는 상품명 또는 검색어가 필요합니다." };
  if (!accessKey || !secretKey) return { status: "credentials_missing", products: [], error: "쿠팡 파트너스 API 키가 설정되지 않았습니다." };

  const params = new URLSearchParams({ keyword: queryText, limit: String(Math.max(1, Math.min(Number(options.limit || 5), 10))) });
  const query = params.toString();
  const date = options.date || new Date();
  const authorization = buildCoupangAuthorization({ accessKey, secretKey, method: "GET", path: SEARCH_PATH, query, date });
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  try {
    const response = await fetchImpl(`${HOST}${SEARCH_PATH}?${query}`, {
      method: "GET",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.rCode && String(body.rCode) !== "0") {
      return { status: "api_error", products: [], error: compact(body.message || body.rMessage || `쿠팡 API 응답 ${response.status}`, 220) };
    }
    const rows = Array.isArray(body?.data?.productData) ? body.data.productData : [];
    return { status: rows.length ? "resolved" : "no_match", products: rows.map(normalizeProduct).filter((item) => item.product_name) };
  } catch (error) {
    return { status: "request_failed", products: [], error: compact(error instanceof Error ? error.message : error, 220) };
  }
}
