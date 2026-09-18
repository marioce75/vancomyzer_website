# Engine cross-check harness (reproducible)

Replaces the unsaved one-off scripts behind `engine-crosscheck-report.json`
(30 May 2026 snapshot, engine before the 15 Sep 2026 obesity-model retirement).

```
npx tsx src/lib/validation/crosscheck/generateFixtures.ts 42 200     # fixtures/crosscheck-seed42-n200.json
npx tsx src/lib/validation/crosscheck/runVancomyzer.ts fixtures/crosscheck-seed42-n200.json
# comparator (see below) → results/tucuxi-<version>-crosscheck-seed42-n200.json
npx tsx src/lib/validation/crosscheck/compare.ts results/vancomyzer-....json results/tucuxi-....json
```

## Comparator: Tucuxi (`tucucli`) — status: RUN (18 Sep 2026)
Built from source (sotalya/tucuxi-core `d09737e3`) in the audit sandbox; the
model file, generator, example queries/responses and the full run record are
in `tucuxi/` (`tucuxi/README.md`). Prior validation against the oracle passed
(peak/trough to 1e-7) before any posterior run. Against the pre-set criteria:
CL median |Δ| 0.84 % (P95 4.8 %, max 9.2 %), V1 median 0.87 %, 0/200 excluded —
all criteria met; the whole tail is attributed to the residual error-model form
(`tucuxi/attribute_differences.py`), see `tucuxi/README.md`.

```
python3 src/lib/validation/crosscheck/tucuxi/run_tucuxi.py --tucucli <tucucli> --tucuxi-commit d09737e3
npx tsx src/lib/validation/crosscheck/compare.ts results/vancomyzer-2026-09-17.1-crosscheck-seed42-n200.json results/tucuxi-49f6ebe6bcb3-crosscheck-seed42-n200.json
python3 src/lib/validation/crosscheck/tucuxi/attribute_differences.py --threshold 3
```

Without a `tucucli` binary `compare.ts` still exits BLOCKED if the Tucuxi
result file is absent; it never fabricates a comparator run.

## Other comparators (ClinCalc, VancoPK, DoseMeRx, InsightRX, PrecisePK)
See `docs/audit-2026-09-17/comparator-matrix.md`. Commercial products require
authorised accounts; no runs are fabricated.
