# Law-check eval · 2026-11-13 · claude

40 contracts (0 errors), $0.1981 total, 38.8 s per check.

## Governing-law guess
- all: 92% (33/36) · explicit 100% (12/12) · indirect 100% (12/12) · hidden 75% (9/12)
- "none" contracts answered unknown: 100% (4/4)

| key \ guess | RU | DE | EU | US-NY | unknown |
|---|---|---|---|---|---|
| RU | 9 | 0 | 0 | 0 | 0 |
| DE | 0 | 9 | 0 | 0 | 0 |
| EU | 0 | 0 | 9 | 0 | 0 |
| US-NY | 0 | 0 | 0 | 6 | 3 |
| none | 0 | 0 | 0 | 0 | 4 |

## Law-specific defects
- recall (flagged and cited the key's article): 48% (25/52)
- by visibility: explicit 67% (12/18) · indirect 44% (8/18) · hidden 31% (5/16)
- by jurisdiction: RU 47% (9/19) · DE 44% (7/16) · EU 100% (7/7) · US-NY 20% (2/10)
- retrieval recall (key article among provisions retrieved for the clause): 49% (23/47)
- model recall when the article was retrieved: 78% (18/23)
- flip traps flagged (false positives): 7% (1/14)
- law findings on clauses outside the key: 24

| defect | violating | caught | flagged, other article | retrieved | lawful | false positives |
|---|---|---|---|---|---|---|
| L1 | 12 | 5 | 4 | 2/12 | 0 | 0 |
| L2 | 4 | 3 | 0 | 3/4 | 7 | 1 |
| L3 | 10 | 4 | 2 | 2/5 | 0 | 0 |
| L4 | 4 | 3 | 0 | 4/4 | 3 | 0 |
| L5 | 1 | 1 | 0 | 0/1 | 2 | 0 |
| L6 | 9 | 1 | 2 | 5/9 | 0 | 0 |
| L7 | 7 | 7 | 0 | 6/7 | 2 | 0 |
| L8 | 5 | 1 | 3 | 1/5 | 0 | 0 |

General traps D1–D7 found by the R1–R7 pass: 91% (104/114)
