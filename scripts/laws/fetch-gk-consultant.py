"""Download the articles of the Russian Civil Code (parts 1 and 2) from consultant.ru.

pravo.gov.ru only answers Russian IP addresses, so this uses the free online version of
КонсультантПлюс instead. Every article is its own page there. The script saves the
document body of each page unchanged, in code order, one HTML file per part, plus a
manifest with article numbers, titles and URLs. It does not clean or split anything.

Usage: python3 scripts/laws/fetch-gk-consultant.py [out_dir] [--limit N]
"""
import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

PARTS = {
    "gk-part1": "cons_doc_LAW_5142",
    "gk-part2": "cons_doc_LAW_9027",
}
BASE = "https://www.consultant.ru/document/"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
DELAY_S = 1.0


def get(url: str) -> str:
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read().decode("utf-8")
        except Exception as e:  # network hiccup: back off and retry
            if attempt == 3:
                raise
            print(f"  retry {attempt + 1} {url}: {e}", flush=True)
            time.sleep(2 ** (attempt + 1))
    raise RuntimeError("unreachable")


def body(page: str) -> str:
    start = page.find('<div class="document-page__content')
    if start < 0:
        raise ValueError("document body not found")
    end_markers = ['<div class="notes"', '<footer', '<div class="footer']
    ends = [i for i in (page.find(m, start) for m in end_markers) if i > 0]
    return page[start:min(ends)] if ends else page[start:]


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    if limit:
        args = [a for a in args if a != str(limit)]
    out = Path(args[0] if args else "data/laws/raw/ru")
    out.mkdir(parents=True, exist_ok=True)
    for name, doc in PARTS.items():
        root = get(BASE + doc + "/")
        edition = re.search(r"\(ред\. от [^)]*\)", root)
        title = re.search(r"<title>([^<]*)", root)
        links = re.findall(
            rf'href="/document/{doc}/([0-9a-f]{{40}})/"[^>]*>\s*(Статья [^<]*)', root
        )
        seen, items = set(), []
        for h, t in links:
            if h not in seen:
                seen.add(h)
                items.append((h, html.unescape(t).strip()))
        if limit:
            items = items[:limit]
        print(f"{name}: {len(items)} articles", flush=True)
        manifest, chunks = [], []
        for n, (h, t) in enumerate(items, 1):
            url = f"{BASE}{doc}/{h}/"
            try:
                page = get(url)
                chunks.append(f'<article data-url="{url}">\n{body(page)}\n</article>')
                manifest.append({"n": n, "title": t, "url": url})
            except Exception as e:
                manifest.append({"n": n, "title": t, "url": url, "error": str(e)})
                print(f"  FAIL {t}: {e}", flush=True)
            if n % 50 == 0:
                print(f"  {name} {n}/{len(items)}", flush=True)
            time.sleep(DELAY_S)
        head = (
            f"<!-- source: {BASE}{doc}/ ; {title.group(1) if title else ''} ; "
            f"{edition.group(0) if edition else ''} ; fetched {time.strftime('%Y-%m-%d')} -->\n"
        )
        (out / f"{name}.html").write_text(
            head + "<html><meta charset='utf-8'><body>\n" + "\n".join(chunks) + "\n</body></html>\n",
            encoding="utf-8",
        )
        (out / f"{name}.manifest.json").write_text(
            json.dumps(
                {"source": BASE + doc + "/", "edition": edition.group(0) if edition else None,
                 "articles": manifest}, ensure_ascii=False, indent=1),
            encoding="utf-8",
        )
        print(f"{name}: done, {sum('error' in m for m in manifest)} failed", flush=True)


if __name__ == "__main__":
    main()
