# Law-check eval · 2026-11-13 · claude

40 contracts (0 errors), $0.212 total, 46.7 s per check.

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
- recall (flagged and cited the key's article): 63% (33/52)
- by visibility: explicit 67% (12/18) · indirect 61% (11/18) · hidden 63% (10/16)
- by jurisdiction: RU 63% (12/19) · DE 69% (11/16) · EU 100% (7/7) · US-NY 30% (3/10)
- retrieval recall (key article among provisions retrieved for the clause): 72% (34/47)
  - by channel: vector search 23% (11/47) · articles named by the model 55% (26/47)
- model recall when the article was retrieved: 88% (30/34)
- flip traps flagged (false positives): 36% (5/14)
- law findings on clauses outside the key: 45

| defect | violating | caught | flagged, other article | retrieved | lawful | false positives |
|---|---|---|---|---|---|---|
| L1 | 12 | 10 | 1 | 9/12 | 0 | 0 |
| L2 | 4 | 1 | 3 | 1/4 | 7 | 3 |
| L3 | 10 | 7 | 0 | 5/5 | 0 | 0 |
| L4 | 4 | 4 | 0 | 4/4 | 3 | 0 |
| L5 | 1 | 1 | 0 | 1/1 | 2 | 2 |
| L6 | 9 | 1 | 0 | 5/9 | 0 | 0 |
| L7 | 7 | 7 | 0 | 7/7 | 2 | 0 |
| L8 | 5 | 2 | 1 | 2/5 | 0 | 0 |

General traps D1–D7 found by the R1–R7 pass: 90% (103/114)
