import { searchCoupangPartnerProducts } from "./coupang_partners_api.mjs";

const keyword = String(process.argv[2] || "").trim();
if (!keyword) {
  console.error("Usage: node scripts/test_coupang_partners_lookup.mjs <product keyword>");
  process.exit(2);
}

const result = await searchCoupangPartnerProducts(keyword, { limit: 3 });
if (result.status !== "resolved") {
  console.error(JSON.stringify({ ok: false, status: result.status, error: result.error || "상품을 찾지 못했습니다." }));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  keyword,
  count: result.products.length,
  products: result.products.map((product) => ({
    product_name: product.product_name,
    brand: product.brand,
    price: product.price,
    category_name: product.category_name,
    has_image: Boolean(product.image_url),
    has_url: Boolean(product.product_url),
  })),
}, null, 2));
