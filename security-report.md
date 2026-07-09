# דוח ממצאי אבטחה — invoice-intelligence
**תאריך:** 09-07-2026  
**כלי:** Claude Code `/security-review` + Sub-Agents

---

## חולשות שנמצאו

| # | קובץ | חולשה | OWASP | חומרה |
|---|------|-------|-------|-------|
| 1 | `extractor.py` | אין error handling — Gemini timeout או ValidationError קורסים ללא טיפול | A04 — Insecure Design | 🟠 גבוה |
| 2 | `schemas.py` | `Optional[str]` בלי `= None` — קריסה ב-Pydantic v2 כשGemini מחזיר null | A04 — Insecure Design | 🟠 גבוה |
| 3 | `test_extract.py` / שורש הפרויקט | PDF אמיתי עם PII פיננסי (`Tax_Invoice_Receipt_3606951.pdf`) לא מוגן ב-`.gitignore` | A02 — Cryptographic Failures | 🔴 קריטי |
| 4 | `test_connection.py` | קריאה ישירה ל-Gemini SDK במקום דרך `extractor.py` — שובר את ה-convention | A04 — Insecure Design | 🟡 בינוני |

---

## False Positives

- **"אין rate limiting ל-Gemini"** — לא רלוונטי, זהו כלי פנימי ולא API ציבורי חשוף.
- **"אין authentication בדף ה-dashboard"** — עדיין לא נבנה, לא חל.

---

## תיקונים שיושמו

1. **`schemas.py`** — הוספת `= None` לכל שדות ה-`Optional`
2. **`extractor.py`** — הוספת `try/except` לטיפול ב-Gemini errors ו-ValidationError
3. **`.gitignore`** — הוספת `*.pdf` למניעת commit של מסמכים רגישים

---

## כיצד AI עזר

Sub-agents רצו במקביל על שני חלקי הפרויקט (web + Python) וסיימו תוך 36 שניות.  
הממצא הקריטי ביותר (PDF עם PII) התגלה אוטומטית — לא חשבתי עליו מראש.

---

## סיכום

מתוך 4 ממצאים — 3 תוקנו. הנותר (`test_connection.py`) יטופל בשלב הבדיקות.
