import json
from collections import Counter
from pathlib import Path

log_path = Path("outputs/afterwork-profit/meta-publish-log.json")
rows = json.loads(log_path.read_text(encoding="utf-8"))
rows = [row for row in rows if row.get("account") == "offnote.kr"]

print(json.dumps({
    "published_posts": len(rows),
    "posts_with_replies": sum(bool(row.get("reply_ids")) for row in rows),
    "posts_without_replies": sum(not row.get("reply_ids") for row in rows),
    "topic_tag_counts": Counter(str(row.get("topic_tag") or "(missing)") for row in rows).most_common(),
    "exact_topic_counts": Counter(str(row.get("topic") or "(missing)") for row in rows).most_common(15),
    "recent_20": [
        {
            "published_at": row.get("published_at"),
            "topic": row.get("topic"),
            "topic_tag": row.get("topic_tag"),
            "reply_count": len(row.get("reply_ids") or []),
        }
        for row in rows[-20:]
    ],
}, ensure_ascii=False, indent=2))
