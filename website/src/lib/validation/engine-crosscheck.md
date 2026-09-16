# Engine Cross-Check — Vancomyzer vs Tucuxi (Part A)

**Status:** Engineering record behind the public Engine Cross-Check page
(`/transparent-dosing/engine-crosscheck`, linked from the Transparent Dosing
hub). Developer-run synthetic analysis (not real patients).
**Run date:** 2026-05-30, with the Vancomyzer engine as of that date (before the
2026-09-15 retirement of the custom obesity model).
**Author:** Vancomyzer team (Dōsys Health LLC)
**Cohort:** n = 200 synthetic ICU patients, seed 42, 0 dropped.

> Companion to the Predictive Performance page
> (`/transparent-dosing/predictive-performance`, Part B), which is also a
> developer-run synthetic analysis. Real-patient performance has not been
> evaluated.

> **Revision 2026-09-16 (external review remediation).** The recorded results
> (report.json and the tables in §5) are unchanged. Interpretation was
> corrected: (1) "statistically interchangeable" and "corroboration" claims
> removed, since no equivalence margins were prespecified and both engines were
> given the same priors and a model file written by Vancomyzer; (2) the claim
> that tail disagreements are confined to augmented renal clearance was wrong
> and is replaced in §5.3; (3) the regenerated seed-42 cohort shows 2 patients
> with BMI ≥ 40 (p87, p196) for whom the engine used the since-retired custom
> obesity model on the run date; (4) the residual-error description in §4 is
> flagged as inconsistent with the committed generator.

---

## 1. Question

Given **identical priors and identical data**, does Vancomyzer's TypeScript
Bayesian engine (posterior MAP over a two-compartment model) reach the **same
posterior PK parameters** as an *independently implemented* engine? Agreement
shows the engine (optimizer + structural model + likelihood) behaves
consistently with an independently written engine for this model encoding. It
is not proof of correctness, it does not check the Colin 2019 equations, and it
says nothing about clinical accuracy. This is separate from Literature
Reproducibility (published values) and Part B (accuracy vs a synthetic truth).

Comparator: **Tucuxi** (`tucucli`), the open-source MIPD engine from
REDS/HEIG-VD (Yann Thoma), `github.com/sotalya/tucuxi-core`, AGPL-3.0, C++17.
Independent language, independent numerical implementation, peer-reviewed.

---

## 2. Honest scope & caveats (read first)

1. **This checks the fitting ENGINE, not our Colin transcription.** No canonical
   Colin-2019 vancomycin drug file exists in any public Tucuxi repo (verified by
   clean clone: `sotalya/tucuxi-drugs` ships only imatinib; `tucuxi-core` ships
   only synthetic test models + a C++ vancomycin unit test, not a loadable
   `.tdd`). The clinical Colin file ships only with the closed GUI app. **We
   authored the `.tdd` used here.** So this shows whether two independently
   written engines fed the same model encoding reach similar posteriors — it
   does NOT independently confirm our Colin equations or clinical accuracy.

2. **The prior is injected, not derived by Tucuxi.** For each patient we compute
   Vancomyzer's per-patient prior in our own code (Colin 2019, or on the run date
   the since-retired custom obesity model for BMI ≥ 40) and bake those four
   numbers (CL, V1, Q, V2) into the patient's Tucuxi `.tdd` as fixed
   `standardValue`s (no covariate equations). Both engines therefore start from the
   same prior values; posterior differences reflect the engines plus any
   differences in variability or error-model settings (see §4 notes).

3. **Synthetic data.** Patients + levels are Monte-Carlo simulated (same seed-42
   cohort as Part B), truth drawn from the Goti-2018 model. No PHI.

---

## 3. Build notes (reproducibility)

`tucucli` does not build out-of-the-box on macOS. One fix in
`make/qtcreator/general.pri`:

```diff
 unix {
 QMAKE_CXXFLAGS += -Wall -Wconversion ...
-QMAKE_LFLAGS += -Wl,--no-as-needed -ldl
+# Linux ld needs --no-as-needed + explicit -ldl; macOS ld64 rejects
+# --no-as-needed and bundles dlopen in libSystem, so guard to non-Darwin.
+!macx {
+    QMAKE_LFLAGS += -Wl,--no-as-needed -ldl
+}
 }
```

Build-config portability fix only — does not touch the numerical engine, so
Tucuxi remains a valid independent comparator.

```bash
git clone --recurse-submodules https://github.com/sotalya/tucuxi-core.git
cd tucuxi-core/libs/botan
python3 configure.py --without-documentation --cc=clang --disable-shared --amalgamation
make -j8 -f Makefile                      # → libbotan-2.a
# apply the general.pri fix
cd ../../make/qtcreator/tucucli
export PATH="/opt/homebrew/opt/qt@5/bin:$PATH"   # Qt 5.15
qmake tucucli.pro && make -j8             # → tucucli (arm64 Mach-O)
```

Run: `tucucli -d <drugdir> -i query.tqf -o response.xml`. A-posteriori is
selected inside the query XML (`<parametersType>aposteriori</parametersType>` +
non-empty `<samples>` + `<retrieveParameters>true</retrieveParameters>`), not a
CLI flag. Posterior params emit per `<cycleData>` as
`<parameter><id>CL</id><value>…</value></parameter>`.

Verified: `linear.2comp.macro` infusion binds `{CL, V1, Q, V2}`
(`src/tucucore/pkmodels/twocompartmentinfusion.cpp:328`).

**Gotcha that cost the most time:** the `.tdd` `<halfLife><multiplier>` gates a
steady-state-reachability check. With multiplier 20, Tucuxi *rejects the whole
drug file* for any patient whose half-life is long enough that 20 half-lives
don't span enough time ("modify the multiplier… 24 should be all right"). This
silently dropped 25/30 patients in a first run (only short-half-life patients
survived). Fixed by setting multiplier to 50. Lesson baked into the analyzer: it
asserts `parsed + dropped == n` and refuses to summarize on any drop.

---

## 4. Method

- **Cohort:** n = 200 synthetic ICU patients, seed 42 (same generator as Part B,
  `src/lib/validation/predictive/syntheticIcuPopulation.ts`).
- **Truth:** Goti 2018-based individual params (`goti2018.ts`; weight scaling and
  variability are developer choices) → simulate steady-state peak (t = 3.0 h) +
  trough (t = 11.5 h) in a 12 h interval, dose 15 mg/kg q12h (rounded 250 mg),
  90-min infusion, + combined residual error (recorded here as 0.15 prop +
  1.0 mg/L additive).
  *Note (2026-09-16):* the committed generator (`goti2018.ts`, unchanged since
  2026-05-29) uses 0.20 proportional + 1.0 mg/L additive. 0.15 is the
  proportional term of Vancomyzer's fitting likelihood
  (`fitPosteriorParameters.ts`: SD = max(1.0, 0.15 × concentration)). The
  one-off harness scripts were not saved, so which truth residual error this
  run used cannot be confirmed from the repository.
- **Vancomyzer:** `runPosteriorEngine` → prior + posterior {CL,V1,Q,V2}.
- **Tucuxi:** per-patient `.tdd` with Vancomyzer's prior baked as fixed
  `standardValue`s; bsv `exponential` stdDev = Vancomyzer's log-prior SDs
  (CL 0.35, V1 0.25, Q 0.5, V2 0.5); error model `mixed`
  (sigma[0]=1.0 additive, sigma[1]=0.15 proportional). Same dose history + same
  two levels in the `.tqf`. Parse posterior {CL,V1,Q,V2}.
  *Note (2026-09-16):* these settings approximate, but may not match in form,
  Vancomyzer's likelihood (SD = max(1.0, 0.15 × concentration)). For patients
  with BMI ≥ 40 the engine on the run date used the since-retired custom obesity
  model with different prior SDs (CL 0.29, V1 0.32, Q 0.50, V2 0.28); whether the
  Tucuxi files for those patients used matching SDs was not recorded.
- **Design note:** injecting the prior via query *covariates* (Design B) failed —
  Tucuxi's importer rejects covariate `<unit>l</unit>`. Baking the prior into
  the `.tdd` as fixed values (Design C) is cleaner and sidesteps it.

---

## 5. Results (n = 200, 0 dropped) — verbatim from report.json

### 5.1 Engine-to-engine agreement (VZ posterior vs Tucuxi posterior)

| Param | median \|Δ\| | mean signed Δ | p90 \|Δ\| | p95 \|Δ\| | max \|Δ\| |
|---|---|---|---|---|---|
| CL | **0.81%** | +0.97% | 3.48% | 5.65% | 18.10% |
| V1 | **0.85%** | +0.62% | 2.23% | 3.00% | 32.76% |
| Q  | **0.66%** | −0.01% | 1.76% | 2.93% | 21.34% |
| V2 | **0.23%** | +0.36% | 1.58% | 3.83% | 13.77% |

Δ = relative difference vs the mean of the two engines. Apriori requests echo
the injected prior exactly, confirming the extraction pipeline is sound.

Observed agreement: median |Δ| 0.23–0.85% across the four parameters; p95
2.93–5.65%; maxima 13.77–32.76%. Mean signed offsets range from −0.01% (Q) to
+0.97% (CL). No equivalence margins were prespecified, so this describes observed
agreement only. The maxima are not confined to augmented renal clearance — see
§5.3.

### 5.2 Accuracy vs the known Goti truth (median abs %)

| Param | prior (no fit) | Vancomyzer | Tucuxi |
|---|---|---|---|
| CL | 31.7 | **10.2** | **10.3** |
| V1 | 28.9 | 26.0 | 26.3 |
| Q  | 53.2 | 53.0 | 52.6 |
| V2 | 26.2 | 25.4 | 25.2 |

The two engines' median errors are within 0.1–0.4 percentage points of each
other on every parameter. No equivalence margins were prespecified; this is
observed agreement, not a test of interchangeability.

**Important honest nuance:** only **CL** is materially improved by the fit
(31.7 → ~10.2). V1 improves modestly (28.9 → ~26), and **Q and V2 are barely
moved** (53 → ~53; 26.2 → ~25.3). A peak + trough at steady state mainly
constrains clearance; it does not constrain the inter-compartmental and
peripheral-volume parameters, so both engines correctly leave Q/V2 near the
prior. This is a property of the two-sample sampling design. Similar behaviour
is expected when two engines fit the same model and prior to the same data.

### 5.3 Where the tail disagreement lives (corrected 2026-09-16)

Top five recorded outliers per parameter, verbatim from report.json (id, CrCl
mL/min, Δ):

| Param | worst cases |
|---|---|
| CL | p196 (177, +18.1%), p100 (42.2, +14.7%), p111 (70.7, +8.3%), p96 (130.4, +8.0%), p166 (80, +7.1%) |
| V1 | p196 (177, +32.8%), p87 (83.8, +11.6%), p166 (80, +7.4%), p24 (57.4, +5.5%), p148 (55.3, +5.2%) |
| Q  | p196 (177, −21.3%), p117 (165.2, +7.3%), p87 (83.8, −7.3%), p166 (80, +5.5%), p95 (164.4, +4.1%) |
| V2 | p148 (55.3, +13.8%), p100 (42.2, +13.5%), p70 (52.2, +10.7%), p24 (57.4, +9.4%), p152 (80.2, +7.3%) |

The disagreements are **not** confined to augmented renal clearance: of the 20
listed entries, 6 (patients p196, p96, p117, p95) have CrCl above 130 mL/min;
the rest range from 42 to 84 mL/min, and no V2 outlier is above 130.

p196 is the largest outlier for CL, V1 and Q. Regenerating the seed-42 cohort
from the committed generator reproduces the CrCl of all 12 outlier ids above
(ids are zero-based indices). In that cohort exactly 2 of 200 patients have
BMI ≥ 40 with height and sex present: **p87** (BMI 41.0) and **p196** (BMI 42.2).
On the run date the engine used the since-retired custom obesity model for both
(confirmed by running the pre-retirement engine on their inputs), with a small
central volume and different prior SDs. Both are prominent outliers. This may
explain part of their disagreement, but it has not been confirmed, and the other
outliers are unexplained. Individual disagreements should be investigated; a
re-run with the current engine and saved per-patient inputs is needed.

---

## 6. Conclusion

Given the same priors, a model file written by Vancomyzer and the same synthetic
data, Tucuxi (C++) and Vancomyzer's TypeScript engine produced posterior
estimates with median absolute differences of 0.23–0.85% (p95 2.93–5.65%,
maxima 13.77–32.76%), and median errors against the synthetic truth within
0.1–0.4 percentage points of each other. No equivalence margins were
prespecified. Both engines reduced the median CL error from 31.7% (prior) to
about 10%; Q and V2 stayed near the prior, as expected with two steady-state
levels. The largest individual disagreements span a wide range of renal
function and have not been explained (§5.3).

**What can be said:** *In a developer-run synthetic analysis (not real
patients), Tucuxi and Vancomyzer, given the same priors, model file and data,
produced similar posterior estimates for most of 200 synthetic patients (median
absolute CL difference 0.81%, p95 5.65%, maximum 18.1%).*

**Not claimed:** that the Colin 2019 equations are correct (we authored the
`.tdd`; prior injected); that the engines are interchangeable (no equivalence
margins); that the fit constrains Q/V2 (it does not, by sampling design); or
anything about accuracy in real patients.

**Correction to an earlier draft.** Two interim errors, both caught and fixed
before anything was pushed:
1. An interim write-up cited a "~11% systematic CL gap." That was an artifact of
   a broken run that silently aggregated only 5 of 30 patients (the `.tdd`
   multiplier bug in §3). Never committed.
2. A first version of *this* committed file transcribed approximate numbers from
   memory (e.g. CL median 1.45%, CL accuracy 16.8/16.5) instead of from
   `report.json`. Corrected here to the verbatim n=200 figures (CL median 0.81%,
   CL accuracy 10.2/10.3). The erroneous version existed only as a local commit
   and was amended, not pushed.

---

## 7. Reproduce

Harness scripts were one-offs (depend on a local Tucuxi build under `/tmp`,
ephemeral) and were not committed. To rebuild:

1. Build `tucucli` per §3 (apply the `general.pri` fix; set `.tdd` halfLife
   multiplier ≥ 50).
2. Author the per-patient `.tdd` from the imatinib template
   (`sotalya/tucuxi-drugs/drugfiles/ch.tucuxi.imatinib.gotta2012.tdd`):
   `pkModelId = linear.2comp.macro`; parameters CL/V1/Q/V2 with fixed
   `standardValue`s = the injected prior; bsv `exponential` stdDevs
   {0.35, 0.25, 0.5, 0.5}; error model `mixed` sigmas {1.0, 0.15}; one
   `intravenousDrip`/`infusion` formulation; no covariates (Design C).
3. Drive the cohort from `src/lib/validation/predictive/*` (seed 42): per
   patient, compute VZ prior+posterior via `runPosteriorEngine`, emit a `.tqf`
   (aposteriori + the two simulated levels + `retrieveParameters=true`), run
   `tucucli`, parse the posterior, compare per-parameter.
4. Analyzer MUST assert `parsed + dropped == n` and refuse to summarize on any
   drop (see §3 gotcha). Record each patient's Goti truth to reproduce §5.2.
5. Save the per-patient inputs (demographics, prior values and SDs, levels),
   the generated `.tdd`/`.tqf` files, the truth residual error used and the
   engine commit, so individual disagreements can be investigated.
