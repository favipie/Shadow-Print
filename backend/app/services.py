from collections import defaultdict, Counter
from datetime import datetime, timedelta, timezone
from itertools import combinations
from hashlib import sha256
from .repository import Repository

LIMITATION = "Synthetic demonstration records with explicit provenance. Signals require human review; shared devices do not prove identity or contribute risk points."


def iso(value):
    return value.replace(tzinfo=timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def priority(score):
    return "High" if score >= 45 else "Medium" if score >= 20 else "Low"


def snapshot(repo: Repository):
    raw = repo.read()
    reviewed = {r["comment_id"]: bool(r["reviewed"]) for r in raw["reviews"]}
    labels = defaultdict(list)
    for r in raw["labels"]:
        labels[r["comment_id"]].append({"category": r["label_code"], "method": r["label_method"], "provenanceId": r["provenance_id"]})
    logins = [{"id": r["id"], "accountId": r["account_id"], "deviceId": r["device_id"], "at": iso(r["occurred_at"])} for r in raw["logins"]]
    profiles = [{"id": r["id"], "handle": r["handle"], "created": iso(r["created_at"])[:10], "bio": r["bio"],
                 "devices": sorted({l["deviceId"] for l in logins if l["accountId"] == r["id"]}),
                 "provenanceId": r["provenance_id"], "provenanceKind": r["provenance_kind"], "score": r["score"]} for r in raw["profiles"]]
    handles = {r["id"]: r["handle"] for r in profiles}
    scores = {r["id"]: r["score"] for r in profiles}
    comments = []
    for r in raw["comments"]:
        annotation = labels[r["id"]]
        category = annotation[0]["category"] if annotation else "Unflagged"
        event_id = "SQL-" + sha256((r["author_id"] + "|" + category).encode()).hexdigest()[:12] if annotation else None
        comments.append({"id": r["id"], "accountId": r["author_id"], "targetId": r["target_id"], "text": r["body"], "at": iso(r["created_at"]),
            "category": category, "source": annotation[0]["method"] if annotation else "Unlabeled", "eventId": event_id,
            "annotations": annotation, "provenanceId": r["provenance_id"], "provenanceKind": r["provenance_kind"], "reviewed": reviewed.get(r["id"], False)})
    by_comment = {c["id"]: c for c in comments}
    evidence = defaultdict(list)
    for r in raw["finding_evidence"]:
        evidence[r["finding_id"]].append(r["comment_id"])
    findings = [{"id": r["id"], "runId": r["run_id"], "accountId": r["account_id"], "rule": r["rule_code"], "reason": r["explanation"],
                 "weight": r["weight"], "anchorId": r["anchor_comment_id"], "commentIds": evidence[r["id"]]} for r in raw["findings"]]
    devices = [{"id": r["id"], "name": r["display_name"], "context": r["context"]} for r in raw["devices"]]
    device_map = {d["id"]: d for d in devices}
    connections = [{"id": "LINK-" + l["id"], "source": l["accountId"], "target": l["deviceId"], "kind": "Device usage",
                    "evidence": [l["id"]], "at": l["at"], "reason": device_map[l["deviceId"]]["context"] + " Device-only association: zero risk points."} for l in logins]
    windows = defaultdict(list)
    for r in raw["coordination"]:
        windows[r["anchor_id"]].append(r["comment_id"])
    clusters = []
    for anchor, ids in windows.items():
        members = sorted({by_comment[c]["accountId"] for c in ids})
        cluster_id = "COORD-" + anchor
        description = "SQL COORD-01: identical normalized text and target within an inclusive 90-second window. Review context."
        clusters.append({"id": cluster_id, "name": "Coordinated window " + anchor, "members": members, "commentIds": ids, "description": description, "kind": "Behavioral scenario"})
        for source, target in combinations(members, 2):
            connections.append({"id": f"{cluster_id}-{source}-{target}", "source": source, "target": target,
                "kind": "Coordinated posting", "evidence": ids, "at": max(by_comment[c]["at"] for c in ids), "reason": description})
    for device in devices:
        members = sorted({l["accountId"] for l in logins if l["deviceId"] == device["id"]})
        if len(members) > 1:
            clusters.append({"id": "DEVICE-" + device["id"], "name": device["name"], "members": members,
                "commentIds": [c["id"] for c in comments if c["accountId"] in members],
                "description": device["context"] + " Shared access alone is not a detection.",
                "kind": "Benign control" if all(scores[a] == 0 for a in members) else "Device context"})
    cases = [{"id": r["id"], "title": r["title"], "description": r["description"], "status": r["status"], "decision": r["decision"], "updatedAt": iso(r["updated_at"]),
              "accountIds": [x["account_id"] for x in raw["case_accounts"] if x["investigation_id"] == r["id"]],
              "commentIds": [x["comment_id"] for x in raw["case_comments"] if x["investigation_id"] == r["id"]],
              "notes": [{"text": n["body"], "at": iso(n["created_at"])} for n in raw["notes"] if n["investigation_id"] == r["id"]]} for r in raw["cases"]]
    rules = {r["code"]: r for r in raw["rules"] if r["version"] == 1}
    thresholds = {"repetition": rules["REP-01"]["min_count"], "windowMinutes": rules["REP-01"]["window_seconds"] // 60,
                  "coordinationAccounts": rules["COORD-01"]["min_count"], "coordinationSeconds": rules["COORD-01"]["window_seconds"]}
    state = {"version": 2, "cases": cases, "reviewed": sorted(k for k,v in reviewed.items() if v), "thresholds": thresholds,
             "audit": [{"id": str(r["id"]), "at": iso(r["occurred_at"]), "action": r["action"] + " / " + (r["investigation_id"] or "comment review")} for r in raw["audit"]]}
    groups = defaultdict(list)
    for c in comments:
        if c["eventId"]:
            groups[c["eventId"]].append(c)
    events = []
    for id, group in groups.items():
        newest = max(c["at"] for c in group)
        account = group[0]["accountId"]
        events.append({"id": id, "account": handles[account], "initials": handles[account][:2].upper(), "category": group[0]["category"],
            "reason": f"{len(group)} SQL source annotations; inspect context", "priority": priority(scores[account]), "time": newest,
            "day": datetime.fromisoformat(newest).date().toordinal(), "evidence": [f'{c["id"]}: {c["text"]} ({c["at"]})' for c in group]})
    events.sort(key=lambda e: e["time"], reverse=True)
    last = max((datetime.fromisoformat(c["at"]).date() for c in comments), default=datetime.now(timezone.utc).date())
    activity = []
    for offset in range(13, -1, -1):
        day = last - timedelta(days=offset)
        records = [c for c in comments if c["at"][:10] == day.isoformat()]
        activity.append({"day": day.toordinal(), "label": day.isoformat(), "analyzed": len(records), "flagged": sum(bool(c["annotations"]) for c in records)})
    current_evidence = {r["comment_id"] for r in raw["current_evidence"]}
    dashboard = {"accounts": len(profiles), "comments": len(comments), "annotatedComments": sum(bool(c["annotations"]) for c in comments),
                 "detectedComments": len(current_evidence), "findings": len(findings), "openCases": sum(c["status"] not in ("Closed","Resolved") for c in cases),
                 "riskBreakdown": dict(Counter(priority(p["score"]) for p in profiles)), "periodEnd": last.isoformat()}
    return {"profiles": profiles, "comments": comments, "devices": devices, "logins": logins, "connections": connections, "clusters": clusters,
        "findings": findings, "state": state, "events": events, "activity": activity,
        "accounts": [{"name": p["handle"], "initials": p["handle"][:2].upper(), "signals": len({f["rule"] for f in findings if f["accountId"] == p["id"]}), "priority": priority(p["score"])} for p in profiles if p["score"] > 0],
        "settings": {"database": repo.config.database, "rules": raw["rules"], "provenance": raw["provenance"], "thresholdsEditable": False, "limitation": LIMITATION},
        "dashboard": dashboard}
