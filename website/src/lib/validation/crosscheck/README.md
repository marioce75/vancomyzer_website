# Engine cross-check harness (reproducible)

Replaces the unsaved one-off scripts behind `engine-crosscheck-report.json`
(30 May 2026 snapshot, engine before the 15 Sep 2026 obesity-model retirement).

```
npx tsx src/lib/validation/crosscheck/generateFixtures.ts 42 200     # fixtures/crosscheck-seed42-n200.json
npx tsx src/lib/validation/crosscheck/runVancomyzer.ts fixtures/crosscheck-seed42-n200.json
# comparator (see below) → results/tucuxi-<version>-crosscheck-seed42-n200.json
npx tsx src/lib/validation/crosscheck/compare.ts results/vancomyzer-....json results/tucuxi-....json
```

## Comparator: Tucuxi (`tucucli`) — status: BLOCKED in this environment
No Tucuxi binary, model file (`.tdd`) or query file (`.tqf`) is committed to
this repository, and the May 2026 files were not saved. To run:
1. Build `tucucli` from https://github.com/Tucuxi/tucuxi-core (record the commit hash).
2. Per patient, write a `.tdd` with the Vancomyzer prior baked in as fixed
   typical values (`prior` in the Vancomyzer result file), `bsv exponential`
   stdDev = prior_log_sd (0.35/0.25/0.50/0.50), error model `mixed`
   (additive 1.0 mg/L, proportional 0.15). **State in the result file that
   Tucuxi's mixed model (σ² = a² + (b·f)²) is not identical in form to
   Vancomyzer's σ = max(1, 0.15·max(obs, pred)).**
3. `.tqf`: same regimen as the fixture (dose, q12h, 1.5 h infusion, steady state)
   and the two fixture levels at 3.0 h and 11.5 h after dose start.
4. Emit `results/tucuxi-<hash>-crosscheck-seed42-n200.json` following the
   schema of the Vancomyzer result file (`product`, `engine_manifest`/`version`,
   `fixture`, `results[{id, posterior{CL,V1,Q,V2}, fit{success}}]`).
Until that file exists `compare.ts` exits BLOCKED.

## Other comparators (ClinCalc, VancoPK, DoseMeRx, InsightRX, PrecisePK)
See `docs/audit-2026-09-17/comparator-matrix.md`. Commercial products require
authorised accounts; no runs are fabricated.
