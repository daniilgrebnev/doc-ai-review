# Raw legal sources for the jurisdiction RAG

Unprocessed texts, exactly as the official sources serve them. Nothing here is chunked,
cleaned or embedded yet. Collected 2026-11-11.

| Folder | Act | Source | Edition | Format | Size |
|---|---|---|---|---|---|
| `de/` | Bürgerliches Gesetzbuch (BGB), whole code | https://www.gesetze-im-internet.de/bgb/xml.zip | Neugefasst 2.1.2002; zuletzt geändert durch Art. 6 G v. 23.7.2026 I Nr. 226 (build 2026-09-26) | XML, DTD gii-norm 1.01, one `<norm>` per paragraph (2,841 norms) | 2.5 MB |
| `eu/32011L0007-*.xhtml` | Directive 2011/7/EU on combating late payment in commercial transactions | EUR-Lex / Publications Office Cellar, `https://publications.europa.eu/resource/celex/32011L0007` | Original text, OJ L 48, 23.2.2011 (not amended) | XHTML, EN (`eng`) and DE (`deu`) | 126 KB / 130 KB |
| `eu/01993L0013-20220528-*.xhtml` | Council Directive 93/13/EEC on unfair terms in consumer contracts | Cellar, `https://publications.europa.eu/resource/celex/01993L0013-20220528` | Consolidated text as of 28.05.2022 (incl. 2011/83/EU, 2019/2161) | XHTML, EN and DE | 39 KB / 36 KB |
| `ru/` | ГК РФ, части 1 и 2 | pravo.gov.ru (planned) | — | — | **not collected yet** |
| `us-ny/` | NY General Obligations Law Art. 5, NY UCC Art. 2 | legislation.nysenate.gov (planned) | — | — | **not collected yet** |

## Licensing

- BGB: amtliches Werk, no copyright (§ 5 UrhG).
- EU directives: free reuse under Commission Decision 2011/833/EU.
- ГК РФ: законы не являются объектами авторского права (ст. 1259 ГК РФ).
- New York statutes: public domain.

## Why Russia and New York are missing

- pravo.gov.ru does not answer from non-Russian IP addresses; the Mac was on a Serbian VPN exit.
- nysenate.gov blocks scripted downloads; the official route is the Open Legislation API,
  which needs a free API key (https://legislation.nysenate.gov).
