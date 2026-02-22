"""
Extract Spanish/English sight word pairs from sight_words_reference.pdf.
Layout: 3 pairs per page, left half = English, right half = Spanish.
Page is 612 wide; midpoint = 306. Three card zones vertically: 0-264, 264-528, 528-792.
"""

import json
import re
import fitz  # PyMuPDF

PDF_PATH = "sight_words_reference.pdf"
OUTPUT_PATH = "docs/words.json"

PAGE_MID_X = 306
ZONE_BOUNDARIES = [0, 264, 528, 792]  # 3 equal-height zones per page


def strip_word(w: str) -> str:
    return re.sub(r"[^\w\u00C0-\u024F/\- ]+", "", w).strip()


def get_zone(y: float) -> int:
    for i in range(len(ZONE_BOUNDARIES) - 1):
        if ZONE_BOUNDARIES[i] <= y < ZONE_BOUNDARIES[i + 1]:
            return i
    return len(ZONE_BOUNDARIES) - 2


def group_words_by_line(words: list, line_gap: float = 12.0) -> list[str]:
    """
    Group words into lines by vertical proximity, join same-line words with space.
    Returns list of line strings (one per line).
    """
    if not words:
        return []
    words_sorted = sorted(words, key=lambda w: (w[1], w[0]))  # sort by y then x
    lines: list[list] = []
    current_line = [words_sorted[0]]
    for w in words_sorted[1:]:
        if abs(w[1] - current_line[-1][1]) <= line_gap:
            current_line.append(w)
        else:
            lines.append(current_line)
            current_line = [w]
    lines.append(current_line)
    return [" ".join(strip_word(tok[4]) for tok in line) for line in lines]


def lines_to_translation(lines: list[str]) -> str:
    """
    Combine lines into a single translation string.
    Same line → space joined (already done).
    Multiple lines → joined with ' / ' (gender variants, etc.).
    """
    cleaned = [ln for ln in lines if ln]
    return " / ".join(cleaned)


def extract_pairs() -> list[dict]:
    doc = fitz.open(PDF_PATH)
    pairs: list[dict] = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        raw_words = page.get_text("words")  # (x0, y0, x1, y1, word, block, line, wi)

        # Split into left (EN) and right (ES) by x midpoint
        en_words = [w for w in raw_words if w[0] < PAGE_MID_X]
        es_words = [w for w in raw_words if w[0] >= PAGE_MID_X]

        # Bucket into zones
        en_zones: dict[int, list] = {0: [], 1: [], 2: []}
        es_zones: dict[int, list] = {0: [], 1: [], 2: []}
        for w in en_words:
            en_zones[get_zone(w[1])].append(w)
        for w in es_words:
            es_zones[get_zone(w[1])].append(w)

        for zone in range(3):
            en_lines = group_words_by_line(en_zones[zone])
            es_lines = group_words_by_line(es_zones[zone])
            en_text = " ".join(en_lines).strip()
            es_text = lines_to_translation(es_lines)

            if en_text and es_text:
                pairs.append({"en": en_text, "es": es_text})

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[dict] = []
    for p in pairs:
        key = (p["en"].lower(), p["es"].lower())
        if key not in seen:
            seen.add(key)
            unique.append(p)

    # Assign stable ids
    result = [{"id": i, **p} for i, p in enumerate(unique)]
    return result


def main():
    pairs = extract_pairs()
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(pairs, f, ensure_ascii=False, indent=2)
    print(f"Extracted {len(pairs)} word pairs → {OUTPUT_PATH}")
    print("\nFirst 10 pairs:")
    for p in pairs[:10]:
        print(f"  {p['id']:3d}  {p['en']:<20} → {p['es']}")
    print("\nLast 5 pairs:")
    for p in pairs[-5:]:
        print(f"  {p['id']:3d}  {p['en']:<20} → {p['es']}")


if __name__ == "__main__":
    main()
