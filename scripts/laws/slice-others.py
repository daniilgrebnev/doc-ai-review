"""Cut BGB, the two EU directives and the New York laws into slots (schema of slice-gk.py).

Usage: python3 scripts/laws/slice-others.py [de|eu|us-ny ...] [--sample]
Output: data/laws/slots/<jurisdiction>/*.json (+ *.sample.json with --sample)
"""
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from slotlib import build_unit  # noqa: E402

RAW = Path("data/laws/raw")
OUT = Path("data/laws/slots")

def rx(p):
    return re.compile(p)

def text(e):
    return re.sub(r"\s+", " ", "".join(e.itertext())).strip()

def strip_ns(root):
    for el in root.iter():
        if isinstance(el.tag, str) and "}" in el.tag:
            el.tag = el.tag.split("}", 1)[1]
    return root

def save(folder, name, slots, sample_keys=None):
    d = OUT / folder
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{name}.json").write_text(json.dumps(slots, ensure_ascii=False, indent=1), encoding="utf-8")
    units = sum(s["parentSlotId"] is None for s in slots)
    pieces = sum(len(s["pieces"]) for s in slots)
    msg = f"{folder}/{name}.json: {units} units, {len(slots)} slots, {pieces} pieces"
    if sample_keys:
        roots = {k for k in sample_keys}
        sample = [s for s in slots if s["slotId"].split(":")[0:3] and any(
            s["slotId"] == r or s["slotId"].startswith(r + ":") for r in roots)]
        (d / f"{name}.sample.json").write_text(json.dumps(sample, ensure_ascii=False, indent=1), encoding="utf-8")
        msg += f" (sample {len(sample)} slots)"
    print(msg)

# ---------------------------------------------------------------- Germany: BGB XML
DE_ABBREV = "".join(rf"(?<!\b{a}\.)" for a in ("Abs", "Nr", "Art", "S", "Satz", "vgl", "z.B", "bzw", "ff", "f", "Buchst", "Alt", "d.h", "u.a", "i.S.d", "i.V.m", "BGBl"))
DE_MARKERS = [
    (1, "absatz", rx(r"^\((\d+[a-z]?)\)\s")),
    (2, "nummer", rx(r"^(\d+[a-z]?)\.\s")),
    (3, "letter", rx(r"^([a-z])\)\s")),
    (4, "letter2", rx(r"^([a-z]{2})\)\s")),
]
DE_LABELS = {1: ("paragraph", "Abs."), 2: ("number", "Nr."), 3: ("letter", "Buchst."), 4: ("letter", "Doppelbuchst.")}

def de_lines(el):
    """Linearize one <P>: its own text, then each DL item (DT marker + DD), nested lists after."""
    out, own = [], [el.text or ""]
    for ch in el:
        if ch.tag == "DL":
            out.append("".join(own))
            own = []
            dt = None
            for item in ch:
                if item.tag == "DT":
                    dt = text(item)
                elif item.tag == "DD":
                    sub = de_dd(item)
                    if sub:
                        sub[0] = f"{dt} {sub[0]}"
                    out.extend(sub)
            own = [ch.tail or ""]
        elif ch.tag in ("FnR", "SUP"):
            own.append(ch.tail or "")
        else:
            own.append(text(ch) + " " + (ch.tail or ""))
    out.append("".join(own))
    return [l for l in (re.sub(r"\s+", " ", x).strip() for x in out) if l]

def de_dd(dd):
    lines = []
    for la in dd:
        lines.extend(de_lines(la))
    if not lines:
        return []
    head = []  # "(Kurzfristige Preiserhöhungen)" headings of § 309 numbers stay with the item text
    while len(lines) > 1 and re.fullmatch(r"\([^()]{2,80}\)", lines[0]) and not re.match(r"^\(?[a-z0-9]{1,3}[.)]\s", lines[1]):
        head.append(lines.pop(0))
    if head:
        lines[0] = " ".join(head + [lines[0]])
    return lines

def slice_de(sample):
    root = ET.parse(RAW / "de/BJNR001950896.xml").getroot()
    std = None
    current_code = ""
    path_by_code, slots = {}, []
    for norm in root.iter("norm"):
        md = norm.find("metadaten")
        g = md.find("gliederungseinheit")
        if g is not None:
            code = g.findtext("gliederungskennzahl")
            path_by_code[code] = f"{g.findtext('gliederungsbez')} {g.findtext('gliederungstitel') or ''}".strip()
            current_code = code
            continue
        enbez = md.findtext("enbez") or ""
        m = re.match(r"§\s*(\d+[a-z]?)$", enbez)
        if not m:
            if std is None:
                std = md.find("standangabe")
            continue
        num, title = m.group(1), (md.findtext("titel") or "").strip()
        content = norm.find("textdaten/text/Content")
        paras = []
        if content is not None:
            for p in content.findall("P"):
                paras.extend(de_lines(p))
        codes = [current_code[:i] for i in range(3, len(current_code) + 1, 3)]
        meta = {"jurisdiction": "DE", "lang": "de", "law": "BGB", "lawPart": None,
                "act": "Bürgerliches Gesetzbuch, neugefasst 2.1.2002 (BGBl. I S. 42)",
                "edition": "zuletzt geändert durch Art. 6 G v. 23.7.2026 I Nr. 226",
                "path": [path_by_code[c] for c in codes if c in path_by_code]}
        unit_title = f"BGB § {num} {title}".strip()
        slots.extend(build_unit(
            key=f"de:bgb:{num}", number=num, title=title, unit_title=unit_title, paragraphs=paras,
            markers=DE_MARKERS, meta=meta, url=f"https://www.gesetze-im-internet.de/bgb/__{num}.html",
            labels=DE_LABELS, abbrev=DE_ABBREV,
            repealed=lambda s, t: "(weggefallen)" in t[:30] or (s["kind"] == "article" and not s["children"] and not t)))
    save("de", "bgb", slots, ["de:bgb:286", "de:bgb:309", "de:bgb:343"] if sample else None)

# ---------------------------------------------------------------- EU: Cellar XHTML
EU_ABBREV = "".join(rf"(?<!\b{a}\.)" for a in ("Art", "No", "Nr", "p", "pp", "Abs", "e.g", "i.e", "OJ", "ABl", "S", "z.B"))
EU_MARKERS = [
    (1, "num", rx(r"^\(?(\d+)[.)]\s")),
    (2, "letter", rx(r"^\(?([a-z])\)\s")),
    (3, "roman", rx(r"^\(?([ivx]+)\)\s")),
]
EU_LABELS = {1: ("paragraph", "para."), 2: ("point", "point"), 3: ("subpoint", "point")}
ART_CLASSES = ("oj-ti-art", "title-article-norm")
SUBTITLE_CLASSES = ("oj-sti-art", "stitle-article-norm")
ANNEX_CLASSES = ("title-annex-1", "oj-doc-ti")
SKIP_CLASSES = ("oj-note", "note", "oj-super", "superscript", "arrow", "modref")

def cls(e):
    return e.get("class") or ""

def eu_blocks(e):
    """Yield (tag, text) in document order: ART / SUB / ANNEX headings and text lines."""
    c = cls(e)
    if any(k in c.split() for k in SKIP_CLASSES):
        return
    if e.tag == "p":
        t = text(e)
        if not t:
            return
        if any(k in c for k in ART_CLASSES):
            yield ("ART", t)
        elif any(k in c for k in SUBTITLE_CLASSES):
            yield ("SUB", t)
        elif any(k in c for k in ANNEX_CLASSES) and re.match(r"(ANNEX|ANHANG)\b", t):
            yield ("ANNEX", t)
        else:
            yield ("TXT", t)
        return
    if e.tag == "tr" or "grid-container" in c:
        cells = [ch for ch in e if ch.tag in ("td", "div")]
        if len(cells) >= 2:
            marker = text(cells[0])
            sub = [b for cell in cells[1:] for b in eu_blocks(cell)]
            txt = [b for b in sub if b[0] == "TXT"]
            if txt:
                i = sub.index(txt[0])
                sub[i] = ("TXT", f"{marker} {txt[0][1]}")
            yield from sub
            return
    if e.tag == "div" and "inline-element" in c:
        yield ("TXT", text(e))
        return
    if e.tag == "div" and c == "norm":
        span = e.find("span")
        if span is not None and "no-parag" in cls(span):
            marker = text(span)
            sub = [b for ch in e if ch is not span for b in eu_blocks(ch)]
            if sub and sub[0][0] == "TXT":
                sub[0] = ("TXT", f"{marker} {sub[0][1]}")
            yield from sub
            return
    for ch in e:
        yield from eu_blocks(ch)

EU_ACTS = [
    {"file": "32011L0007", "code": "2011-7", "law": "Directive 2011/7/EU", "annex": False,
     "edition": "original text, OJ L 48, 23.2.2011", "celex": "32011L0007"},
    {"file": "01993L0013-20220528", "code": "93-13", "law": "Directive 93/13/EEC", "annex": True,
     "edition": "consolidated text 28.05.2022", "celex": "01993L0013-20220528"},
]

def slice_eu(sample):
    for act in EU_ACTS:
        for lang, lang2 in (("eng", "en"), ("deu", "de")):
            root = strip_ns(ET.parse(RAW / f"eu/{act['file']}-{lang}.xhtml").getroot())
            body = root.find("body")
            units, cur = [], None
            for tag, t in eu_blocks(body):
                if tag == "ART":
                    m = re.match(r"(?:Article|Artikel)\s+(\d+[a-z]?)", t)
                    cur = {"num": m.group(1) if m else t, "head": t, "title": "", "paras": []}
                    units.append(cur)
                elif tag == "ANNEX":
                    cur = {"num": "annex", "head": t, "title": "", "paras": []} if act["annex"] else None
                    if cur:
                        units.append(cur)
                elif cur is None:
                    continue
                elif tag == "SUB" and not cur["paras"]:
                    cur["title"] = t
                elif cur["num"] == "annex" and not cur["paras"] and t.isupper():
                    cur["title"] = t
                elif tag in ("TXT", "SUB"):
                    if re.match(r"^(Done at|Geschehen zu|For the European|Im Namen|Für das Europäische|Für den Rat|For the Council)", t):
                        cur = None
                        continue
                    cur["paras"].append(t)
            slots = []
            for u in units:
                name = f"{act['law']}, {'Annex' if u['num'] == 'annex' else ('Art. ' + u['num'])}"
                unit_title = f"{name} {u['title']}".strip() if u["title"] else name
                meta = {"jurisdiction": "EU", "lang": lang2, "law": act["law"], "lawPart": None,
                        "act": act["law"], "edition": act["edition"], "path": []}
                slots.extend(build_unit(
                    key=f"eu:{act['code']}@{lang2}:{u['num']}", number=u["num"], title=u["title"],
                    unit_title=unit_title, paragraphs=u["paras"], markers=EU_MARKERS, meta=meta,
                    url=f"https://eur-lex.europa.eu/legal-content/{lang2.upper()}/TXT/?uri=CELEX:{act['celex']}",
                    labels=EU_LABELS, abbrev=EU_ABBREV))
            keys = [f"eu:{act['code']}@{lang2}:3", f"eu:{act['code']}@{lang2}:annex"] if sample else None
            save("eu", f"{act['code']}-{lang2}", slots, keys)

# ---------------------------------------------------------------- New York: Open Legislation JSON
EN_ABBREV = "".join(rf"(?<!\b{a}\.)" for a in ("Sec", "sec", "No", "no", "subd", "par", "U.S", "U.S.C", "e.g", "i.e", "Inc", "Co", "et seq", "Corp", "Stat", "art"))
NY_MARKERS = {
    "GOB": [(1, "num", rx(r"^(\d+(?:-[a-z])?)\.\s")), (2, "letter", rx(r"^\(?([a-z])[.)]\s")),
            (3, "roman", rx(r"^\(([ivx]+)\)\s")), (4, "num2", rx(r"^\((\d+)\)\s"))],
    "UCC": [(1, "num", rx(r"^\((\d+)\)\s")), (2, "letter", rx(r"^\(([a-z])\)\s")),
            (3, "roman", rx(r"^\(([ivx]+)\)\s")), (4, "upper", rx(r"^\(([A-Z])\)\s"))],
}
NY_LABELS = {1: ("subdivision", "subd."), 2: ("paragraph", "par."), 3: ("subparagraph", "subpar."), 4: ("clause", "cl.")}
NY_LAWS = [("GOB", "gob", "General Obligations Law"), ("UCC", "ucc", "Uniform Commercial Code")]

def ny_paragraphs(raw, title):
    t = raw.replace("\\n", "\n")
    t = re.sub(r"^\s*(?:§|Section)\s*[\w.*-]+\.\s*", "", t, count=1)
    if title and t.startswith(title):
        t = t[len(title):].lstrip(". ")
    paras, cur = [], []
    for line in t.split("\n"):
        starts = re.match(r"^ {1,3}\S", line) or re.match(r"^\s+\(?[0-9a-zA-Z]{1,5}[.)]\s", line)
        if starts and cur:
            paras.append(" ".join(cur))
            cur = []
        if line.strip():
            cur.append(line.strip())
    if cur:
        paras.append(" ".join(cur))
    paras = [re.sub(r"(\w)-\s(\w)", r"\1-\2", p) for p in paras]
    # inline first subdivision: "Title. 1. The rate ..." is already stripped to "1. The rate ..."
    return paras

def slice_ny(sample):
    for law_id, code, law_name in NY_LAWS:
        d = json.load(open(RAW / f"us-ny/{law_id}-full.json", encoding="utf-8"))["result"]["documents"]
        slots = []

        def walk(node, path):
            if node.get("docType") == "SECTION":
                num, title = node["locationId"], (node.get("title") or "").strip()
                meta = {"jurisdiction": "US-NY", "lang": "en", "law": f"NY {law_name}", "lawPart": None,
                        "act": f"New York {law_name}", "edition": f"active {node.get('activeDate')}",
                        "path": path}
                unit_title = f"N.Y. {law_id} § {num} {title}".strip()
                slots.extend(build_unit(
                    key=f"us-ny:{code}:{num}", number=num, title=title, unit_title=unit_title,
                    paragraphs=ny_paragraphs(node.get("text") or "", title), markers=NY_MARKERS[law_id],
                    meta=meta, url=f"https://www.nysenate.gov/legislation/laws/{law_id}/{num}",
                    labels=NY_LABELS, abbrev=EN_ABBREV,
                    repealed=lambda s, t, n=node: (n.get("repealed") and s["kind"] == "article")
                    or bool(re.match(r"(\S+\s)?\*?\s*(Repealed|\[There is no)", t))))
                return
            label = f"{node.get('docType', '').title()} {node.get('docLevelId', '')} {node.get('title', '')}".strip()
            sub = path + [label] if node.get("docType") != "CHAPTER" else path
            for ch in (node.get("documents") or {}).get("items", []):
                walk(ch, sub)

        walk(d, [])
        keys = {"GOB": ["us-ny:gob:5-501", "us-ny:gob:5-1401"], "UCC": ["us-ny:ucc:2-718", "us-ny:ucc:2-719"]}[law_id]
        save("us-ny", code, slots, keys if sample else None)


def main():
    targets = [a for a in sys.argv[1:] if not a.startswith("--")] or ["de", "eu", "us-ny"]
    sample = "--sample" in sys.argv
    for t in targets:
        {"de": slice_de, "eu": slice_eu, "us-ny": slice_ny}[t](sample)


if __name__ == "__main__":
    main()
