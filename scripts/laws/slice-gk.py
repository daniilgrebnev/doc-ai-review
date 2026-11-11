"""Cut the raw Russian Civil Code (data/laws/raw/ru) into slots.

A slot is one legal unit: an article, a point ("1."), a subpoint ("1)") or a letter
item ("а)"). Slots form a tree through parentSlotId, so any depth works. An article
without points is a single slot. The text of each slot is split into pieces of at
most MAX_PIECE characters, on sentence boundaries; pieces carry the article title in
front of them (embedText) so they make sense on their own in search.

Consultant's service lines (court positions, "см. текст в предыдущей редакции",
"КонсультантПлюс: примечание") are dropped; amendment notes such as
"(в ред. Федерального закона ...)" are kept in the slot's `amendments`.

Usage: python3 scripts/laws/slice-gk.py [--only 333,450.1]
Output: data/laws/slots/ru/gk.json (or gk.sample.json with --only)
"""
import hashlib
import html
import json
import re
import sys
import uuid
from pathlib import Path

RAW = Path("data/laws/raw/ru")
OUT = Path("data/laws/slots/ru")
MAX_PIECE = 800
NS = uuid.UUID("6f1c9a52-6b7e-4c1e-9a43-2a1d3f0c8e11")  # fixed namespace -> stable uids

PARTS = [
    {"file": "gk-part1", "law": "ГК РФ", "lawPart": "часть первая", "act": "Федеральный закон от 30.11.1994 N 51-ФЗ",
     "edition": "ред. от 10.06.2026, с изм. от 22.10.2026"},
    {"file": "gk-part2", "law": "ГК РФ", "lawPart": "часть вторая", "act": "Федеральный закон от 26.01.1996 N 14-ФЗ",
     "edition": "ред. от 24.06.2025, с изм. от 09.06.2026"},
]
COMMON = {"jurisdiction": "RU", "lang": "ru"}

SERVICE = re.compile(
    r"^(КонсультантПлюс: примечание\.|Позиции высших судов|\(см\. текст в предыдущей редакции\)|"
    r"О выявлении конституционно-правового смысла|См\. также)"
)
AMENDMENT = re.compile(r"^\((в ред\.|введен|абзац|п\.|пп\.|подп\.|часть|ч\.|утратил|исключен|наименование)", re.I)
MARKERS = [
    (1, re.compile(r"^(\d+(?:\.\d+)?)\.\s+(?=\S)")),       # 1. / 2.1.
    (2, re.compile(r"^(\d+(?:\.\d+)?)\)\s+(?=\S)")),       # 1)
    (3, re.compile(r"^([а-яё])\)\s+(?=\S)")),              # а)
]
ABBREV = "".join(rf"(?<!\b{a}\.)" for a in ("ст", "п", "пп", "ч", "гл", "абз", "подп", "т.е", "т.д", "т.п", "г", "руб"))


def text_of(fragment: str) -> str:
    t = html.unescape(re.sub(r"<[^>]+>", "", fragment))
    return re.sub(r"\s+", " ", t).strip()


def sentences(text: str) -> list[str]:
    # sentence ends: . ! ? before a capital/number, or ; anywhere (enumerations go on in lower case)
    parts = re.split(ABBREV + r"(?:(?<=[.!?])\s+(?=[А-ЯЁA-Z0-9«(])|(?<=;)\s+)", text)
    return [p.strip() for p in parts if p.strip()]


def pieces_of(text: str) -> list[str]:
    out, cur = [], ""
    for s in sentences(text):
        while len(s) > MAX_PIECE:  # one very long sentence: cut on "; " / ", " before the limit
            cut = s.rfind("; ", 0, MAX_PIECE)
            if cut <= MAX_PIECE // 3:
                cut = s.rfind(", ", 0, MAX_PIECE)
            cut = cut + 1 if cut > MAX_PIECE // 3 else MAX_PIECE
            if cur:
                out.append(cur)
                cur = ""
            out.append(s[:cut].strip())
            s = s[cut:].strip()
        if cur and len(cur) + 1 + len(s) > MAX_PIECE:
            out.append(cur)
            cur = s
        else:
            cur = f"{cur} {s}".strip()
    if cur:
        out.append(cur)
    return out


def load_toc(name: str) -> dict:
    """article number -> path [раздел, подраздел, глава]."""
    s = (RAW / f"{name}.toc.html").read_text(encoding="utf-8")
    path, result = {}, {}
    for t in re.findall(r"<a [^>]*>([^<]*)</a>", s):
        t = html.unescape(t).strip()
        for lvl, prefix in enumerate(("Раздел", "Подраздел", "Глава")):
            if t.startswith(prefix + " "):
                path[lvl] = t
                for k in [k for k in path if k > lvl]:
                    del path[k]
        m = re.match(r"Статья (\d+(?:\.\d+)*(?:-\d+)?)\.", t)
        if m:
            result[m.group(1)] = [path[k] for k in sorted(path)]
    return result


def new_slot(key, parent, kind, number, title, art_title, meta, url):
    return {
        "slotId": key, "uid": str(uuid.uuid5(NS, key)), "parentSlotId": parent, "kind": kind,
        "number": number, "title": title, "articleTitle": art_title, "summary": None,
        **COMMON, **meta, "sourceUrl": url, "requirements": [], "repealed": False,
        "children": [], "amendments": [], "_paras": [],
    }


def slice_article(url, body, meta, toc):
    content = body.split('<div class="full-text', 1)[0]
    h1 = re.search(r"<h1>(.*?)</h1>", content, re.S)
    head = text_of(h1.group(1)) if h1 else ""
    m = re.match(r"(?:ГК РФ )?Стать[яи] (\d+(?:\.\d+)*(?:-\d+)?)((?:,| -| и) [Сс]татья \d+(?:\.\d+)*(?:-\d+)?)*\.\s*(.*)", head)
    if not m:
        raise ValueError(f"no article title: {head[:80]}")
    num, title = m.group(1), m.group(3).strip()
    art_title = f"ГК РФ, ст. {num}. {title}"
    key = f"ru:gk:{num}"
    art = new_slot(key, None, "article", num, title, art_title, {**meta, "path": toc.get(num, [])}, url)
    slots = [art]
    stack = {0: art}  # level -> current slot
    paras = re.findall(r"<p[^>]*>(.*?)</p>", content[h1.end() if h1 else 0:], re.S)
    for raw in paras:
        t = text_of(raw)
        if not t or t == head or SERVICE.match(t):
            continue
        if AMENDMENT.match(t) and t.endswith(")"):
            deepest = stack[max(stack)]
            deepest["amendments"].append(t.strip("()"))
            continue
        level, marker = None, None
        for lvl, rx in MARKERS:
            mm = rx.match(t)
            if mm:
                level, marker = lvl, mm.group(1)
                break
        if level is None:
            # an unmarked paragraph continues the nearest point (not a list item)
            target = stack.get(1) or stack[0]
            target["_paras"].append(t)
            continue
        parent_lvl = max(k for k in stack if k < level)
        parent = stack[parent_lvl]
        child = new_slot(f"{parent['slotId']}:{marker}", parent["slotId"],
                         {1: "point", 2: "subpoint", 3: "item"}[level], marker, title, art_title, meta, url)
        child["path"] = art["path"]
        parent["children"].append(child["slotId"])
        slots.append(child)
        for k in [k for k in stack if k >= level]:
            del stack[k]
        stack[level] = child
        child["_paras"].append(t)
    for s in slots:
        text = " ".join(s.pop("_paras"))
        s["text"] = text
        s["hash"] = hashlib.sha256(text.encode()).hexdigest()[:16] if text else None
        s["repealed"] = bool(re.match(r"(\d+(\.\d+)?[.)]\s+)?Утрати\w*\s+силу", text)) or \
            (s["kind"] == "article" and bool(re.match(r"Утрати\w*\s+силу", title)))
        label = art_title if s["kind"] == "article" else f"{art_title}, " + \
            ", ".join(f"{'п.' if i == 0 else 'подп.'} {p}" for i, p in enumerate(s["slotId"].split(":")[3:]))
        s["pieces"] = [{"pieceId": f"{s['slotId']}#{i}", "order": i, "text": p, "embedText": f"{label}: {p}"}
                       for i, p in enumerate(pieces_of(text), 1)] if text and not s["repealed"] else []
    return slots


def main():
    only = None
    if "--only" in sys.argv:
        only = set(sys.argv[sys.argv.index("--only") + 1].split(","))
    OUT.mkdir(parents=True, exist_ok=True)
    all_slots, errors = [], []
    for part in PARTS:
        meta = {k: v for k, v in part.items() if k != "file"}
        toc = load_toc(part["file"])
        s = (RAW / f"{part['file']}.html").read_text(encoding="utf-8")
        for url, body in re.findall(r'<article data-url="([^"]+)">(.*?)</article>', s, re.S):
            try:
                slots = slice_article(url, body, meta, toc)
            except Exception as e:
                errors.append({"url": url, "error": str(e)})
                continue
            if only and slots[0]["number"] not in only:
                continue
            all_slots.extend(slots)
    name = "gk.sample.json" if only else "gk.json"
    (OUT / name).write_text(json.dumps(all_slots, ensure_ascii=False, indent=1), encoding="utf-8")
    arts = sum(s["kind"] == "article" for s in all_slots)
    pieces = sum(len(s["pieces"]) for s in all_slots)
    print(f"{name}: {arts} articles, {len(all_slots)} slots, {pieces} pieces, {len(errors)} errors")
    for e in errors[:10]:
        print("  ", e)


if __name__ == "__main__":
    main()
