# Raw legal sources for the jurisdiction RAG

Unprocessed texts, exactly as the official sources serve them. Nothing here is chunked,
cleaned or embedded yet. Collected 2026-11-11.

| Folder | Act | Source | Edition | Format | Size |
|---|---|---|---|---|---|
| `de/` | Bürgerliches Gesetzbuch (BGB), whole code | https://www.gesetze-im-internet.de/bgb/xml.zip | Neugefasst 2.1.2002; zuletzt geändert durch Art. 6 G v. 23.7.2026 I Nr. 226 (build 2026-09-26) | XML, DTD gii-norm 1.01, one `<norm>` per paragraph (2,841 norms) | 2.5 MB |
| `eu/32011L0007-*.xhtml` | Directive 2011/7/EU on combating late payment in commercial transactions | EUR-Lex / Publications Office Cellar, `https://publications.europa.eu/resource/celex/32011L0007` | Original text, OJ L 48, 23.2.2011 (not amended) | XHTML, EN (`eng`) and DE (`deu`) | 126 KB / 130 KB |
| `eu/01993L0013-20220528-*.xhtml` | Council Directive 93/13/EEC on unfair terms in consumer contracts | Cellar, `https://publications.europa.eu/resource/celex/01993L0013-20220528` | Consolidated text as of 28.05.2022 (incl. 2011/83/EU, 2019/2161) | XHTML, EN and DE | 39 KB / 36 KB |
| `ru/gk-part1.*` | ГК РФ, часть первая (51-ФЗ), все 592 статьи | consultant.ru, `cons_doc_LAW_5142`, постатейно | ред. от 10.06.2026, с изм. от 22.10.2026 | HTML: тело страницы каждой статьи без изменений, в порядке кодекса, в `<article data-url>`; плюс manifest.json (номер, заголовок, URL) | 5.5 MB |
| `ru/gk-part2.*` | ГК РФ, часть вторая (14-ФЗ), все 684 статьи | consultant.ru, `cons_doc_LAW_9027`, постатейно | ред. от 24.06.2025, с изм. от 09.06.2026 | то же | 6.9 MB |
| `us-ny/GOB-full.json` | New York General Obligations Law, whole law (Art. 5 = contracts) | NY Senate Open Legislation API, `/api/3/laws/GOB?full=true` | active date 2026-07-24 | JSON tree: chapter → articles → titles → sections, full text in each node | 665 KB |
| `us-ny/UCC-full.json` | New York Uniform Commercial Code, whole law (Art. 2 = sales) | same API, `/api/3/laws/UCC?full=true` | active date 2026-06-12 | JSON tree, same shape | 1.7 MB |

## Licensing

- BGB: amtliches Werk, no copyright (§ 5 UrhG).
- EU directives: free reuse under Commission Decision 2011/833/EU.
- ГК РФ: законы не являются объектами авторского права (ст. 1259 ГК РФ).
- New York statutes: public domain.

## Notes on sources

- Russia: pravo.gov.ru only answers Russian IP addresses, so the Civil Code comes from the free online
  КонсультантПлюс (not an official source; the law text itself is public domain). Pages also carry
  Consultant's links and notes ("Позиции высших судов", "см. текст в предыдущей редакции") — strip them
  when cutting. Re-run: `python3 scripts/laws/fetch-gk-consultant.py data/laws/raw/ru` (~25 min, 1 req/s).
- New York: nysenate.gov pages block scripts, so the texts come from the official Open Legislation API.
  The key lives in `.env.local` as `NYSENATE_API_KEY` (not committed).
