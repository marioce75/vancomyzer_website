# Vancomyzer Posterior Fitting Implementation Note — 2026-03-15

## Step completed
Upgrade the existing-regimen posterior fitter from a fixed-V / Ke-only adjustment to a bounded MAP-style fit over both:
- elimination rate constant (Ke)
- volume of distribution (V)

Then replace the legacy internal prior equations/constants with an explicit literature-backed adult prior model while preserving the current API/UI.

This preserves the current API/UI and keeps all PK outputs coherent because:
- posterior fitting uses the shared one-compartment intermittent-infusion model
- AUC24, peak, trough, and concentration-time curve are still all recomputed from the same fitted parameter set
- prior-model changes stay confined to PK modules and explanatory notes

## Files modified
- `website/src/lib/pk/posterior/fitPosteriorParameters.ts`
  - replaced Ke-only fitting with a bounded two-parameter MAP grid search over Ke and V
  - retained use of the shared steady-state infusion model
- `website/src/lib/pk/existing/existingRegimenEngine.ts`
  - updated data-quality wording to describe the fitter more accurately
- `website/src/lib/pk/__tests__/existingRegimen.integration.test.ts`
  - strengthened posterior integration coverage so single-level posterior fitting must produce bounded, data-responsive changes

## Mathematical assumptions in this step
1. Structural model:
   - one-compartment IV intermittent infusion
   - repeating steady-state regimen
   - no missed/held-dose inference
2. Prior model:
   - explicit adult population prior now comes from Ducharme et al. (Ther Drug Monit. 1994; PMID 7846752):
     - `CL_vanco (mL/min) = 0.771 * CrCl + 18.9`
     - `V = 0.69 L/kg * ideal body weight`
   - Cockcroft-Gault remains the shared CrCl estimator used to feed the clearance prior
   - implementation keeps explicit numerical guardrails:
     - `V/IBW` bounded to the subgroup range reported in the abstract (`0.58` to `1.17 L/kg IBW`)
     - `Ke` constrained to a broad stability range after deriving `Ke = CL / V`
3. Posterior update method:
   - maximum a posteriori (MAP) objective
   - likelihood from observed concentrations versus model-predicted concentrations
   - weak log-scale quadratic penalties centered on prior `Ke` and `V`
4. Residual error model:
   - proportional error with a concentration floor to avoid unstable overweighting of low values
5. Bounds:
   - prior construction bounds:
     - `V/IBW` prior bounded to `0.58` to `1.17 L/kg IBW` per Ducharme adult subgroup range reported in the abstract
     - derived `Ke` constrained to `[0.002, 0.2] h^-1` as a numerical guardrail
   - posterior fitting bounds:
     - `Ke` constrained to `[0.002, 0.2] h^-1`
     - `V` constrained to `0.5x` to `1.5x` prior `V`

## Why this is better than the previous pass
Previous state:
- measured levels only changed `Ke`
- `V` was fixed to the population estimate
- single-level updates could be mathematically brittle because concentration mismatch was forced entirely into elimination

New state:
- measured levels can move both `Ke` and `V` within conservative bounds
- sparse data are still regularized toward the prior rather than producing unstable extremes
- posterior AUC24 / peak / trough / curve remain derived from the same fitted parameter set

## Limitations retained deliberately
- not a full nonparametric/commercial Bayesian engine
- still one-compartment
- still assumes repeating steady-state semantics
- no renal-dynamic model
- no assay-specific calibration
- no formal posterior uncertainty intervals yet

## Reference status
Brave search was not configured in the workspace, so literature lookup used direct PubMed/PMC fetches instead of search.

References used in this pass:
1. Ducharme MP, Slaughter RL, Edwards DJ. *Vancomycin pharmacokinetics in a patient population: effect of age, gender, and body weight.* Ther Drug Monit. 1994;16(5):513-518. PMID: 7846752.
   - Abstract-reported adult prior relationships used here:
     - `CL = 0.771 * CrCl + 18.9` mL/min
     - mean `V = 0.69 L/kg IBW`
     - subgroup `V` range reported as `0.58-1.17 L/kg IBW`
2. Rybak MJ, Le J, Lodise TP, et al. *Therapeutic Monitoring of Vancomycin for Serious Methicillin-Resistant Staphylococcus aureus Infections: A Revised Consensus Guideline...* Am J Health Syst Pharm. 2020.
   - Used for framing/limitations only: AUC-guided monitoring is preferred, Bayesian approaches can support early assessment, and clinical judgment remains essential.

Accordingly, this step upgrades the prior from legacy internal constants to an explicit literature-backed adult prior while keeping the bounded one-compartment structural model and avoiding overclaiming precision.

## Validation to run
- existing regimen integration test suite
- website build/lint if available in environment

## Next recommended step
Implement explicit prior metadata / model references and then add Monte Carlo target-attainment simulation on top of the fitted posterior parameter set without changing the public API contract.
