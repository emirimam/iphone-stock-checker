const B = "https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/";
const imgs = {
  pro: "iphone-compare-iphone-18-pro-202609?wid=400&hei=512&fmt=png-alpha",
  air: "iphone-compare-iphone-air-202609?wid=400&hei=512&fmt=png-alpha",
  i17: "iphone-compare-iphone-17-202609?wid=400&hei=512&fmt=png-alpha",
  i17e: "iphone-compare-iphone-17e-202609?wid=400&hei=512&fmt=png-alpha",
};
for (const [k, p] of Object.entries(imgs)) {
  const r = await fetch(B + p, { headers: { Referer: "https://iphone-stock-checker-hazel.vercel.app/" } });
  const b = await r.arrayBuffer();
  console.log(`::notice::${k} [${r.status}] ${r.headers.get("content-type")} ${b.byteLength} B, CORP=${r.headers.get("cross-origin-resource-policy")}`);
}
