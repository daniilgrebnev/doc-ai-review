"""Shared slot builder for the law slicers (same schema as slice-gk.py).

A unit's text comes in as a list of paragraphs. Each paragraph may start with a
marker ("1.", "(a)", "a)", "(i)" ...). Marker rules give a level; the paragraphs are
turned into a tree of slots linked by parentSlotId. A paragraph without a marker
belongs to the current level-1 slot, or to the parent of the current list item.
"""
import hashlib
import re
import uuid

MAX_PIECE = 800
NS = uuid.UUID("6f1c9a52-6b7e-4c1e-9a43-2a1d3f0c8e11")
ROMAN = re.compile(r"^(?=[ivxlc]+$)c{0,3}(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$")


def sentences(text, abbrev):
    parts = re.split(abbrev + r"(?:(?<=[.!?])\s+(?=[A-ZÄÖÜА-ЯЁ0-9«„(§])|(?<=;)\s+)", text)
    return [p.strip() for p in parts if p.strip()]


def pieces_of(text, abbrev):
    out, cur = [], ""
    for s in sentences(text, abbrev):
        while len(s) > MAX_PIECE:
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


def detect(par, markers, stack):
    """markers: list of (level, kind, regex). Roman numerals win over letters unless
    the current letter list would continue with this letter (h -> i)."""
    hits = []
    for level, kind, rx in markers:
        m = rx.match(par)
        if m:
            hits.append((level, kind, m.group(1)))
    if not hits:
        return None, None, None
    if len(hits) > 1:
        roman = [h for h in hits if h[1] == "roman"]
        letter = [h for h in hits if h[1] == "letter"]
        if roman and letter:
            lv = letter[0][0]
            prev = stack.get(lv)
            prev_marker = prev["number"] if prev is not None else None
            if prev_marker and len(prev_marker) == 1 and ord(letter[0][2][0]) == ord(prev_marker) + 1:
                return letter[0]
            return roman[0]
    return hits[0]


def build_unit(*, key, number, title, unit_title, paragraphs, markers, meta, url,
               labels, abbrev, amendments=None, repealed=None):
    """Return the slots of one unit (article / § / section) in document order."""
    def slot(k, parent, kind, num):
        return {
            "slotId": k, "uid": str(uuid.uuid5(NS, k)), "parentSlotId": parent, "kind": kind,
            "number": num, "title": title, "articleTitle": unit_title, "summary": None,
            **meta, "sourceUrl": url, "requirements": [], "repealed": False,
            "children": [], "amendments": [], "_paras": [], "_label": unit_title,
        }

    root = slot(key, None, "article", number)
    root["amendments"] = list(amendments or [])
    slots, stack = [root], {0: root}
    for par in paragraphs:
        par = re.sub(r"\s+", " ", par).strip()
        if not par:
            continue
        level, kind, marker = detect(par, markers, stack)
        if level is None:
            # unmarked text: stays with a level-1 slot, or goes back up from a list item to its parent
            deepest = max(stack)
            target = stack[deepest] if deepest <= 1 else stack[max(k for k in stack if k < deepest)]
            target["_paras"].append(par)
            continue
        parent = stack[max(k for k in stack if k < level)]
        child = slot(f"{parent['slotId']}:{marker}", parent["slotId"], labels[level][0], marker)
        child["_label"] = f"{parent['_label']}, {labels[level][1]} {marker}"
        if child["slotId"] in {s["slotId"] for s in slots}:  # duplicate marker: keep as text
            parent["_paras"].append(par)
            continue
        parent["children"].append(child["slotId"])
        slots.append(child)
        for k in [k for k in stack if k >= level]:
            del stack[k]
        stack[level] = child
        child["_paras"].append(par)
    for s in slots:
        text = " ".join(s.pop("_paras"))
        label = s.pop("_label")
        s["text"] = text
        s["hash"] = hashlib.sha256(text.encode()).hexdigest()[:16] if text else None
        s["repealed"] = bool(repealed(s, text)) if repealed else False
        s["pieces"] = [{"pieceId": f"{s['slotId']}#{i}", "order": i, "text": p, "embedText": f"{label}: {p}"}
                       for i, p in enumerate(pieces_of(text, abbrev), 1)] if text and not s["repealed"] else []
    return slots
