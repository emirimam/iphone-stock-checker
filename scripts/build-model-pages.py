#!/usr/bin/env python3
"""Generise SEO stranice po modelu (iphone-18-pro-max-in-stock.html itd.). Pokreni: python3 scripts/build-model-pages.py"""
import json, html, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = "https://iphone-stock-checker-hazel.vercel.app/"
IMG = "https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/{}?wid=400&hei=512&fmt=png-alpha"
UPDATED = "2026-10-16"

MODELS = [
  dict(slug="iphone-18-pro-max-in-stock", name="iPhone 18 Pro Max", img="iphone-compare-iphone-18-pro-202609",
       title="iPhone 18 Pro Max In Stock Near Me – Apple Store Pickup Checker",
       desc="Find iPhone 18 Pro Max in stock for pickup at Apple Stores near your ZIP. All storage sizes and colors, free alerts the moment one is available.",
       intro="The iPhone 18 Pro Max is the hardest iPhone to find this season, especially the 256GB model and the new Burgundy color. Delivery dates often slip by weeks, but individual Apple Stores receive pickup stock throughout the day. iPhone Stock watches those stores for you and alerts you as soon as the configuration you want is ready for pickup.",
       specs=[("Display", "6.9″ Super Retina XDR, ProMotion up to 120 Hz, Always-On"), ("Chip", "A20 Pro"),
              ("Cameras", "3 × 48MP (Main, Ultra Wide, Telephoto), 0.5×–8× optical zoom range"),
              ("Battery", "Up to 45 hours video playback"), ("Build", "Aluminum unibody")],
       configs=[("256GB", "$1,299"), ("512GB", "$1,499"), ("1TB", "$1,899"), ("2TB", "$2,499")],
       colors="Black, Silver, Glacier, Burgundy",
       tips=["256GB sells out first. 1TB and 2TB are available for pickup far more often.",
             "Glacier and Black usually show up before Burgundy.",
             "Widen your search radius: a store 60–100 miles away often has stock when the closest one doesn't.",
             "When you get an alert, order online for pickup right away. Pro Max pickup stock often disappears within minutes."],
       faq=[("Why is the iPhone 18 Pro Max sold out everywhere?", "Demand for the Pro Max is highest at launch and Apple fills pre-orders first. Stores still receive new pickup stock regularly, it just sells quickly."),
            ("Which iPhone 18 Pro Max is easiest to find?", "Higher storage (1TB, 2TB) in Black or Glacier. The 256GB model and Burgundy color are the hardest to get."),
            ("Can I walk into an Apple Store and buy one?", "Sometimes, but walk-ins are served after online pickup orders. Ordering online for pickup is the reliable way to reserve one.")]),
  dict(slug="iphone-18-pro-in-stock", name="iPhone 18 Pro", img="iphone-compare-iphone-18-pro-202609",
       title="iPhone 18 Pro In Stock Near Me – Apple Store Pickup Checker",
       desc="Check iPhone 18 Pro pickup availability at Apple Stores near your ZIP code. Every storage size and color, with free alerts when stock appears.",
       intro="The iPhone 18 Pro gets the same A20 Pro chip and triple 48MP camera as the Pro Max in a smaller 6.3-inch body. It is usually easier to find than the Pro Max, but popular configurations still go out of stock. iPhone Stock tells you which nearby Apple Stores have it for pickup and alerts you when your configuration shows up.",
       specs=[("Display", "6.3″ Super Retina XDR, ProMotion up to 120 Hz, Always-On"), ("Chip", "A20 Pro"),
              ("Cameras", "3 × 48MP (Main, Ultra Wide, Telephoto), 0.5×–8× optical zoom range"),
              ("Battery", "Shorter than Pro Max (Apple's 45 h claim is for the larger model)"), ("Build", "Aluminum unibody")],
       configs=[("256GB", "$1,199"), ("512GB", "$1,399"), ("1TB", "$1,799"), ("2TB", "$2,399")],
       colors="Black, Silver, Glacier, Burgundy",
       tips=["Most iPhone 18 Pro configurations are available for pickup somewhere nearby on most days.",
             "If you only need the Pro camera system, the 18 Pro is often in stock when the Pro Max isn't.",
             "Compare the Pro and Pro Max side by side in the Compare tab before you choose."],
       faq=[("Is the iPhone 18 Pro easier to find than the Pro Max?", "Usually yes. Most Pro configurations show up for pickup more often than the equivalent Pro Max."),
            ("What is the difference between iPhone 18 Pro and Pro Max?", "Screen size (6.3″ vs 6.9″), battery life and price ($100 more for the Pro Max). Chip and cameras are the same."),
            ("Does iPhone Stock reserve the phone?", "No. It alerts you, then you order on apple.com with in-store pickup to reserve it.")]),
  dict(slug="iphone-air-in-stock", name="iPhone Air", img="iphone-compare-iphone-air-202609",
       title="iPhone Air In Stock Near Me – Apple Store Pickup Checker",
       desc="See where iPhone Air is available for pickup at Apple Stores near your ZIP code. Free alerts for the storage and color you want.",
       intro="iPhone Air is Apple's thinnest and lightest iPhone, with a 6.5-inch ProMotion display and a titanium frame. Specific colors can be hard to find in a given store. iPhone Stock checks pickup availability at Apple Stores near you and notifies you when the Air you want is ready.",
       specs=[("Display", "6.5″ Super Retina XDR, ProMotion up to 120 Hz, Always-On"), ("Chip", "A19 Pro"),
              ("Camera", "48MP Fusion Main, 1×–2× optical zoom range"), ("Battery", "Up to 27 hours video playback"),
              ("Build", "Titanium frame")],
       configs=[("256GB", "from $1,099")],
       colors="Sky Blue, Light Gold, Cloud White, Space Black",
       tips=["Sky Blue and Light Gold tend to sell out before Space Black and Cloud White.",
             "Check the Stock tab for the storage sizes stores near you currently have."],
       faq=[("How much does iPhone Air cost?", "It starts at $1,099 in the US."),
            ("Is iPhone Air easy to find in stores?", "Usually, though specific colors can be out of stock at individual stores. Alerts help you catch the one you want."),
            ("Does iPhone Stock work for iPhone Air?", "Yes. Select iPhone Air in Settings to get alerts.")]),
  dict(slug="iphone-17-in-stock", name="iPhone 17", img="iphone-compare-iphone-17-202609",
       title="iPhone 17 In Stock Near Me – Apple Store Pickup Checker",
       desc="Find iPhone 17 in stock for pickup at Apple Stores near your ZIP. Check every color and storage size and get free alerts.",
       intro="iPhone 17 brings ProMotion, Always-On display and a dual 48MP camera to the standard iPhone. It is widely stocked, but specific colors like Lavender or Sage can be missing at your nearest store. iPhone Stock shows nearby pickup availability and alerts you when your color is in.",
       specs=[("Display", "6.3″ Super Retina XDR, ProMotion up to 120 Hz, Always-On"), ("Chip", "A19"),
              ("Cameras", "2 × 48MP (Main, Ultra Wide)"), ("Battery", "Up to 30 hours video playback"), ("Build", "Aluminum frame")],
       configs=[("256GB", "from $899 with carrier activation")],
       colors="Lavender, Sage, Mist Blue, White, Black",
       tips=["Black and White are the most commonly stocked colors.",
             "If your color is missing nearby, set a wider radius to include more stores."],
       faq=[("How much is iPhone 17?", "From $899 with carrier activation in the US."),
            ("Does iPhone 17 have ProMotion?", "Yes, up to 120 Hz, plus an Always-On display."),
            ("Can I get alerts for a specific color?", "Yes. Choose iPhone 17 and the color in Settings.")]),
  dict(slug="iphone-17e-in-stock", name="iPhone 17e", img="iphone-compare-iphone-17e-202609",
       title="iPhone 17e In Stock Near Me – Apple Store Pickup Checker",
       desc="Check iPhone 17e pickup availability at Apple Stores near your ZIP code. Free alerts when the storage and color you want are in stock.",
       intro="iPhone 17e is the most affordable current iPhone, starting at $699 with the A19 chip and a 48MP camera. iPhone Stock shows which Apple Stores near you have it for pickup today and can alert you when a specific color or storage size arrives.",
       specs=[("Display", "6.1″ Super Retina XDR"), ("Chip", "A19"), ("Camera", "48MP Fusion Main, 1×–2× optical zoom range"),
              ("Battery", "Up to 26 hours video playback"), ("Front camera", "12MP TrueDepth (notch, no Dynamic Island)")],
       configs=[("Base model", "from $699")],
       colors="Soft Pink, White, Black",
       tips=["iPhone 17e is usually in stock for same-day pickup.",
             "Use alerts if you want a specific color like Soft Pink."],
       faq=[("How much does iPhone 17e cost?", "From $699 in the US."),
            ("What's the difference between iPhone 17e and iPhone 17?", "The 17e has a 6.1″ display without ProMotion or Dynamic Island and a single camera. See the Compare tab for the full list."),
            ("Is iPhone 17e available for pickup today?", "Usually yes. Check the Stock tab for stores near your ZIP code.")]),
]

def e(s): return html.escape(s, quote=True)

def css():
    s = (ROOT / "index.html").read_text()
    base = s[s.index("<style>") + 7:s.index("</style>")]
    return base.split("  /* tabovi */")[0]

def page(m, others):
    url = URL + m["slug"]
    faq_ld = {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in m["faq"]]}
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "WebPage", "@id": url, "url": url, "name": m["title"], "description": m["desc"], "dateModified": UPDATED,
         "isPartOf": {"@id": URL + "#website"}, "inLanguage": "en-US",
         "about": {"@type": "Product", "name": m["name"], "brand": {"@type": "Brand", "name": "Apple"}}},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "iPhone Stock", "item": URL},
            {"@type": "ListItem", "position": 2, "name": f"{m['name']} in stock", "item": url}]},
        faq_ld]}
    specs = "".join(f"<tr><th>{e(k)}</th><td>{e(v)}</td></tr>" for k, v in m["specs"])
    configs = "".join(f"<tr><td>{e(k)}</td><td>{e(v)}</td></tr>" for k, v in m["configs"])
    tips = "".join(f"<li>{e(t)}</li>" for t in m["tips"])
    faq = "".join(f'<details class="faq"><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in m["faq"])
    links = " · ".join(f'<a href="/{o["slug"]}">{e(o["name"])}</a>' for o in others)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(m['title'])}</title>
<meta name="description" content="{e(m['desc'])}">
<link rel="canonical" href="{url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="icon" type="image/svg+xml" href="/logo.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="article">
<meta property="og:site_name" content="iPhone Stock">
<meta property="og:title" content="{e(m['title'])}">
<meta property="og:description" content="{e(m['desc'])}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{URL}og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1B3FB8">
<script type="application/ld+json">
{json.dumps(ld, ensure_ascii=False, indent=1)}
</script>
<style>{css()}
  .doc h1 {{ font-size: clamp(26px, 5vw, 34px); margin: 8px 0 10px; }}
  .doc h2 {{ margin-top: 30px; }}
  .doc p, .doc li {{ line-height: 1.65; max-width: 70ch; }}
  .doc a {{ color: var(--accent); }}
  .hero {{ display: flex; gap: 20px; align-items: center; flex-wrap: wrap; }}
  .hero img {{ width: 150px; height: auto; flex: none; }}
  .hero > div {{ flex: 1; min-width: 240px; }}
  .cta {{ display: inline-block; background: var(--accent); color: #fff !important; text-decoration: none; padding: 11px 18px; border-radius: 10px; font-weight: 600; margin: 6px 0; }}
  table.spec {{ border-collapse: collapse; width: 100%; background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }}
  table.spec th, table.spec td {{ text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }}
  table.spec th {{ color: var(--muted); font-weight: 500; width: 34%; }}
  table.spec tr:last-child th, table.spec tr:last-child td {{ border-bottom: 0; }}
  details.faq {{ border-bottom: 1px solid var(--line); padding: 10px 0; }}
  details.faq summary {{ cursor: pointer; font-weight: 600; }}
  nav.crumbs {{ font-size: 13px; color: var(--muted); }}
  .credit {{ font-size: 12px; color: var(--muted); }}
</style>
</head>
<body>
<main class="doc">
<nav class="crumbs"><a href="/">iPhone Stock</a> › {e(m['name'])} in stock</nav>
<div class="hero">
  <img src="{IMG.format(m['img'])}" alt="{e(m['name'])}" width="150" height="192" loading="eager">
  <div>
    <h1>{e(m['name'])} in stock near me</h1>
    <p>{e(m['intro'])}</p>
    <a class="cta" href="/">Check {e(m['name'])} stock near you</a>
  </div>
</div>

<h2>How to get an {e(m["name"])} for pickup</h2>
<ol>
  <li>Open <a href="/">iPhone Stock</a>, enter your US ZIP code and how far you'd drive.</li>
  <li>Sign in with Google and choose {e(m['name'])}, plus storage and color if you care.</li>
  <li>Add a free ntfy topic (or email) to get an alert the moment it's ready for pickup.</li>
  <li>Order on apple.com and select in-store pickup at that store.</li>
</ol>

<h2>Tips for finding an {e(m["name"])}</h2>
<ul>{tips}</ul>

<h2>{e(m['name'])} prices and configurations (US)</h2>
<table class="spec"><tbody>{configs}</tbody></table>
<p>Colors: {e(m['colors'])}.</p>

<h2>{e(m['name'])} key specs</h2>
<table class="spec"><tbody>{specs}</tbody></table>
<p><a href="/#compare">Compare {e(m['name'])} with other iPhones</a></p>

<h2>FAQ</h2>
{faq}

<h2>Other iPhones</h2>
<p>{links}</p>

<p class="credit">Prices and specs from Apple's US online store, October 2026. Product image: Apple. iPhone Stock is an independent tool and is not affiliated with Apple Inc. iPhone is a trademark of Apple Inc.</p>
<footer><a href="/">iPhone Stock</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></footer>
</main>
</body>
</html>
"""

for m in MODELS:
    others = [o for o in MODELS if o is not m]
    (ROOT / f"{m['slug']}.html").write_text(page(m, others))

# sitemap
urls = [("", "daily", "1.0")] + [(m["slug"], "daily", "0.8") for m in MODELS] + [("privacy", "yearly", "0.2"), ("terms", "yearly", "0.2")]
sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
sm += "".join(f"  <url><loc>{URL}{u}</loc><lastmod>{UPDATED}</lastmod><changefreq>{c}</changefreq><priority>{p}</priority></url>\n" for u, c, p in urls)
sm += "</urlset>\n"
(ROOT / "sitemap.xml").write_text(sm)
print("ok", [m["slug"] for m in MODELS])
