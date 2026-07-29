#!/usr/bin/env python3
"""Minimal, controlled markdown -> email-HTML-body converter for the eräSauna
newsletter. Handles only the constructs the newsletter uses: h1-h4, hr, tables,
unordered lists, ordered (multi-line) list items, block paragraphs, and the
inline forms **bold**, *italic*, [text](url). Not a general markdown engine."""
import html
import re
import sys

BOLD = re.compile(r"\*\*(.+?)\*\*")
LINK = re.compile(r"\[([^\]]+)\]\((https?://[^)]+)\)")
ITAL = re.compile(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)")
# Bare URL not already inside an href="..." or >...</a>
BARE_URL = re.compile(r'(?<![">])(https?://[^\s<)]+)')

def _anchor(url, label=None):
    return (
        f'<a href="{url}" style="color:#8a5a2b;text-decoration:underline;'
        f'word-break:break-all;">{label or url}</a>'
    )

def inline(text):
    text = html.escape(text, quote=False)
    text = LINK.sub(lambda m: _anchor(m.group(2), m.group(1)), text)
    text = BARE_URL.sub(lambda m: _anchor(m.group(1)), text)
    text = BOLD.sub(r"<strong>\1</strong>", text)
    text = ITAL.sub(r"<em>\1</em>", text)
    return text

def convert(md):
    lines = md.split("\n")
    out = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        s = line.strip()
        if not s:
            i += 1
            continue
        # horizontal rule
        if s == "---":
            out.append('<hr style="border:none;border-top:1px solid #e6e4dd;margin:28px 0;" />')
            i += 1
            continue
        # heading
        m = re.match(r"(#{1,4})\s+(.*)", s)
        if m:
            level = len(m.group(1))
            sizes = {1: "22px", 2: "18px", 3: "15px", 4: "14px"}
            tops = {1: "0", 2: "32px", 3: "22px", 4: "16px"}
            colors = {1: "#1a1a17", 2: "#1a1a17", 3: "#2b2b26", 4: "#4a4a42"}
            out.append(
                f'<div style="font-size:{sizes[level]};font-weight:700;color:{colors[level]};'
                f'margin:{tops[level]} 0 8px;line-height:1.3;">{inline(m.group(2))}</div>'
            )
            i += 1
            continue
        # table
        if s.startswith("|"):
            tbl = []
            while i < n and lines[i].strip().startswith("|"):
                tbl.append(lines[i].strip())
                i += 1
            out.append(render_table(tbl))
            continue
        # unordered list
        if s.startswith("- "):
            items = []
            while i < n and lines[i].strip().startswith("- "):
                items.append(lines[i].strip()[2:])
                i += 1
            lis = "".join(
                f'<li style="margin:0 0 6px;">{inline(x)}</li>' for x in items
            )
            out.append(
                f'<ul style="margin:8px 0 12px;padding-left:20px;font-size:14px;color:#2b2b26;line-height:1.6;">{lis}</ul>'
            )
            continue
        # ordered list item (may span indented continuation lines)
        mo = re.match(r"(\d+)\.\s+(.*)", s)
        if mo:
            num = mo.group(1)
            parts = [mo.group(2)]
            i += 1
            while i < n and lines[i].startswith("   ") and lines[i].strip():
                parts.append(lines[i].strip())
                i += 1
            body = "<br>".join(inline(p) for p in parts)
            out.append(
                f'<p style="margin:0 0 14px;font-size:14px;color:#2b2b26;line-height:1.6;">'
                f'<strong>{num}.</strong> {body}</p>'
            )
            continue
        # paragraph (collect consecutive plain lines)
        para = []
        while i < n and lines[i].strip() and not _is_block_start(lines[i].strip()):
            para.append(lines[i].strip())
            i += 1
        joined = " ".join(para)
        out.append(
            f'<p style="margin:0 0 12px;font-size:14px;color:#2b2b26;line-height:1.65;">{inline(joined)}</p>'
        )
    return "\n".join(out)

def _is_block_start(s):
    return (
        s == "---"
        or s.startswith("|")
        or s.startswith("- ")
        or bool(re.match(r"#{1,4}\s", s))
        or bool(re.match(r"\d+\.\s", s))
    )

def render_table(rows):
    header = [c.strip() for c in rows[0].strip("|").split("|")]
    body = rows[2:]  # skip separator row
    ths = "".join(
        f'<th style="text-align:left;padding:6px 8px;border-bottom:2px solid #d9d6cd;'
        f'font-size:12px;color:#4a4a42;">{inline(h)}</th>'
        for h in header
    )
    trs = []
    for r in body:
        cells = [c.strip() for c in r.strip("|").split("|")]
        tds = "".join(
            f'<td style="padding:6px 8px;border-bottom:1px solid #eeece5;'
            f'font-size:12px;color:#2b2b26;vertical-align:top;">{inline(c)}</td>'
            for c in cells
        )
        trs.append(f"<tr>{tds}</tr>")
    return (
        '<div style="overflow-x:auto;margin:8px 0 16px;">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="border-collapse:collapse;min-width:520px;">'
        f"<thead><tr>{ths}</tr></thead><tbody>{''.join(trs)}</tbody></table></div>"
    )

if __name__ == "__main__":
    src = sys.argv[1]
    with open(src, encoding="utf-8") as f:
        md = f.read()
    sys.stdout.write(convert(md))
