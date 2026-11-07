import csv
import io
import re
from html import escape
from .services import LIMITATION


def csv_report(case, comments):
    out = io.StringIO(newline="")
    writer = csv.writer(out, lineterminator="\r\n")
    def safe(value):
        value = str(value)
        return "'" + value if re.match(r"^\s*[=+\-@]", value) else value
    writer.writerow(["Case", "Title", "Status", "Description", "Decision", "Notes", "Comment", "Account", "Target", "Text", "Category", "Source", "UTC", "Provenance", "Limitations"])
    for c in comments or [{}]:
        writer.writerow([safe(x) for x in [case["id"], case["title"], case["status"], case["description"], case["decision"],
            " | ".join(n["at"] + ": " + n["text"] for n in case["notes"]), c.get("id",""), c.get("accountId",""), c.get("targetId",""),
            c.get("text",""), c.get("category",""), c.get("source",""), c.get("at",""), c.get("provenanceId",""), LIMITATION]])
    return "\ufeff" + out.getvalue()


def html_report(case, comments, findings):
    e = lambda value: escape(str(value), quote=True)
    paragraphs = "".join(f'<article><h3>{e(c["id"])} / {e(c["accountId"])}</h3><p>{e(c["text"])}</p><small>{e(c["at"])} · {e(c["category"])} · {e(c["source"])} · {e(c["provenanceId"])}</small></article>' for c in comments)
    notes = "".join(f'<p>{e(n["text"])}<br><small>{e(n["at"])}</small></p>' for n in case["notes"])
    patterns = "".join(f'<p>{e(f["accountId"])} / {e(f["rule"])}: {e(f["reason"])}<br>Evidence: {e(", ".join(f["commentIds"]))}</p>' for f in findings)
    return f"""<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>{e(case["id"])} — SHADOWPRINT</title><style>body{{font:16px/1.6 Arial,sans-serif;max-width:850px;margin:40px auto;padding:20px;color:#172727}}article{{border-top:1px solid #ccc;padding:12px 0;break-inside:avoid}}small{{color:#455}}h1,h2,h3{{line-height:1.2}}p{{white-space:pre-wrap;overflow-wrap:anywhere}}@page{{margin:18mm}}@media print{{body{{margin:0;padding:0;font-size:13px;line-height:1.45}}h1{{font-size:25px}}h2{{font-size:19px;margin:18px 0 10px;break-after:avoid}}h3{{break-after:avoid}}p{{margin:8px 0}}}}</style>
    <main><header><p>SHADOWPRINT · SQL investigation report · synthetic demonstration</p><h1>{e(case["title"])}</h1><p>{e(case["id"])} · {e(case["status"])} · Updated {e(case["updatedAt"])}</p></header>
    <h2>Scope</h2><p>{e(case["description"])}</p><h2>Detected patterns</h2><p>Latest saved detection run; account-wide evidence may extend beyond the case register. Rule weights count once per account.</p>{patterns}
    <h2>Case evidence</h2>{paragraphs}<h2>Notes</h2>{notes}<h2>Decision</h2><p>{e(case["decision"] or "No decision recorded.")}</p>
    <h2>Limitations</h2><p>{e(LIMITATION)}</p></main></html>"""
