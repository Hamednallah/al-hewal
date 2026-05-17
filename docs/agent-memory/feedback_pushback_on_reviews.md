---
name: feedback-pushback-on-reviews
description: "When the user provides team-review docs (DB-review.md, code-review.md, security-review.md, etc.), respond with a written disposition that addresses each item, applies the right ones, and pushes back where I'm correct"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3692c396-8443-4856-b863-63dcc5583bc3
---

The user dropped `DB-review.md` at the project root and said: "see [the] level of review you are facing and above) and push back if you think you are correct."

**Why:** they want me to behave like a senior engineer who can defend a design — not a coding assistant who folds at the first critique. Blindly applying every review comment is a junior mistake; it produces churn, removes intentional design decisions, and signals lack of conviction. Defending decisions WHEN I'm right is a senior signal the user values.

**How to apply:** when a review doc arrives (look for `*review*.md` at project root):

1. Read it end-to-end before responding
2. Write a `docs/<topic>_REVIEW_RESPONSE.md` doc with three columns: item / disposition / rationale
3. Apply genuine fixes via an append-only migration / commit (never edit committed files retroactively if the project rule says append-only)
4. Push back on items where the reviewer is wrong, citing project context (free-tier constraints, YAGNI, existing safeguards, etc.)
5. Defer items that are real but premature, with an explicit phase target

Format: see `al-hewal/docs/DB_REVIEW_RESPONSE.md` from the first DB review in this project. Keep the tone respectful but firm — "I appreciate the catch, but here's why I disagree" not "the reviewer is wrong."
