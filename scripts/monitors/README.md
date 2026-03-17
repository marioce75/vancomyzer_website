Monitoring script plan

Goal:
Collect signals for the research-intelligence agent using compliant methods.

Initial monitors:
1. PubMed monitor
   - query PubMed for predefined search terms
   - save titles, dates, abstracts, URLs
2. Guideline monitor
   - snapshot public guideline/news pages
   - detect obvious updates or new relevant pages
3. Public discussion monitor
   - gather publicly accessible discussion signals
   - prioritize compliant methods such as feeds, APIs, and manual review-friendly extraction

Outputs:
- raw results in data/raw/
- normalized summaries in data/processed/
- report-ready notes in reports/market-intel/incoming/
