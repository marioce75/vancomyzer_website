#!/usr/bin/env python3
"""
Tucuxi-core comparator for the engine cross-check (acceptance-criteria.md).

What it does
  1. Writes a Tucuxi drug model (.tdd) that encodes the Colin 2019 adult
     vancomycin prior EXACTLY as modelRegistry.ts / buildPriorParameters.ts do
     (covariate formulas in Tucuxi softFormula JS), with log-normal BSV
     omega = (0.35, 0.25, 0.5, 0.5) on CL/V1/Q/V2 and a "mixed" residual error
     model sigma0 = 1 mg/L, sigma1 = 0.15.
  2. Validates the model file: runs an A PRIORI prediction for the reference
     patient (35 y, 70 kg, SCr 0.83; 1000 mg q12h over 1.75 h) and requires
     CL 4.1024 L/h, steady-state peak 31.92 and trough 12.93 mg/L before any
     posterior run. A mismatch aborts (exit 3) — no comparator results are
     written.
  3. For every fixture patient writes a .tqf (dosage loop: dose q12h, 1.5 h
     infusion, 60 doses so the last interval is at steady state; two samples at
     3.0 h and 11.5 h after the start of the last dose), runs tucucli with an
     A POSTERIORI prediction over the last interval with retrieveParameters,
     and parses posterior CL/V1/Q/V2 plus cycle statistics (auc, peak,
     residual=trough).
  4. Writes results/tucuxi-<model-hash>-crosscheck-seed42-n200.json in the
     crosscheck result schema so compare.ts can evaluate it.

Documented form difference (acceptance-criteria.md requires it be stated):
  Vancomyzer residual sigma = max(1, 0.15 * max(obs, pred))
  Tucuxi   "mixed" sigma    = sqrt((0.15 * pred)^2 + 1^2)
Both are Gaussian NLL with ln(sigma); the prior term eta^2/(2 omega^2) is the
same in both engines (Tucuxi Likelihood::negativeLogLikelihood + negativeLogPrior).

Usage
  python3 run_tucuxi.py --tucucli /path/to/tucucli --tucuxi-commit <sha> \
      [--fixture ../fixtures/crosscheck-seed42-n200.json] [--work /tmp/tucuxi-run]
"""
import argparse, hashlib, json, math, os, subprocess, sys, tempfile, datetime as dt
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
CROSSCHECK = os.path.dirname(HERE)

# ── Colin 2019 (Table 3) — must equal modelRegistry.ts COLIN_2019_PARAMETERS ──
COLIN = dict(thetaCL=5.31, thetaV1=42.9, thetaV2=41.7, thetaQ=3.22,
             pma50Weeks=46.4, hillMaturation=2.89, age50DeclineYears=61.6,
             hillDecline=2.24, thetaSCr=0.649)
OMEGA = dict(CL=0.35, V1=0.25, Q=0.5, V2=0.5)
SIGMA0, SIGMA1 = 1.0, 0.15

# Reference check (modelRegistry.ts referenceCheck / oracle): 35 y, 70 kg, SCr 0.83
REF = dict(age=35, wt=70, scr=0.83, dose=1000, tau=12, inf_h=1.75,
           CL=4.102381651824105, V1=42.9, Q=3.22, V2=41.7,
           peak=31.920450104043, trough=12.927927800297, auc24=487.521681243555)

def colin_prior(age, wt, scr):
    """Python re-statement of buildPriorParameters.ts (used only to cross-check
    the softFormula output; the .tdd code below is what Tucuxi evaluates)."""
    wt = max(30.0, wt); age = max(18.0, age)
    pma_yr = age + 40 / 52; pma_wk = pma_yr * 52
    fsize = wt / 70
    fmat = pma_wk ** COLIN["hillMaturation"] / (pma_wk ** COLIN["hillMaturation"] + COLIN["pma50Weeks"] ** COLIN["hillMaturation"])
    fdec = 1 / (1 + (pma_yr / COLIN["age50DeclineYears"]) ** COLIN["hillDecline"])
    scrstd = math.exp(-1.228 + math.log10(pma_yr) * 0.672 + 6.27 * math.exp(-3.11 * pma_yr))
    fscr = math.exp(-COLIN["thetaSCr"] * (scr - scrstd))
    return dict(CL=COLIN["thetaCL"] * fsize ** 0.75 * fmat * fdec * fscr,
                V1=COLIN["thetaV1"] * fsize, V2=COLIN["thetaV2"] * fsize,
                Q=COLIN["thetaQ"] * fsize ** 0.75)

# ── .tdd ──────────────────────────────────────────────────────────────────────
CL_CODE = f"""
    wt = Math.max(30.0, bodyweight);
    a = Math.max(18.0, age);
    pma_yr = a + 40.0 / 52.0;
    pma_wk = pma_yr * 52.0;
    fsize = wt / 70.0;
    g1 = {COLIN["hillMaturation"]};
    fmat = Math.pow(pma_wk, g1) / (Math.pow(pma_wk, g1) + Math.pow({COLIN["pma50Weeks"]}, g1));
    fdec = 1.0 / (1.0 + Math.pow(pma_yr / {COLIN["age50DeclineYears"]}, {COLIN["hillDecline"]}));
    scrstd = Math.exp(-1.228 + Math.log10(pma_yr) * 0.672 + 6.27 * Math.exp(-3.11 * pma_yr));
    fscr = Math.exp(-{COLIN["thetaSCr"]} * (scr - scrstd));
    return {COLIN["thetaCL"]} * Math.pow(fsize, 0.75) * fmat * fdec * fscr;
"""
V1_CODE = f"    wt = Math.max(30.0, bodyweight);\n    return {COLIN['thetaV1']} * (wt / 70.0);\n"
V2_CODE = f"    wt = Math.max(30.0, bodyweight);\n    return {COLIN['thetaV2']} * (wt / 70.0);\n"
Q_CODE  = f"    wt = Math.max(30.0, bodyweight);\n    return {COLIN['thetaQ']} * Math.pow(wt / 70.0, 0.75);\n"

def covariate(cid, name, unit, std):
    return f"""
      <covariate>
        <covariateId>{cid}</covariateId>
        <name><name lang="en">{name}</name></name>
        <description><desc lang="en">{name}</desc></description>
        <unit>{unit}</unit>
        <covariateType>standard</covariateType>
        <dataType>double</dataType>
        <interpolationType>direct</interpolationType>
        <refreshPeriod><unit>d</unit><value>365</value></refreshPeriod>
        <covariateValue><standardValue>{std}</standardValue></covariateValue>
        <validation>
          <errorMessage><text lang="en">out of range</text></errorMessage>
          <operation><softFormula><inputs><input><id>{cid}</id><type>double</type></input></inputs>
            <code><![CDATA[return true;]]></code></softFormula><comments/></operation>
          <comments/>
        </validation>
        <comments/>
      </covariate>"""

def parameter(pid, unit, std, inputs, code, omega):
    ins = "".join(f"<input><id>{i}</id><type>double</type></input>" for i in inputs)
    return f"""
            <parameter>
              <parameterId>{pid}</parameterId>
              <unit>{unit}</unit>
              <parameterValue>
                <standardValue>{std}</standardValue>
                <aprioriComputation>
                  <softFormula>
                    <inputs>{ins}</inputs>
                    <code><![CDATA[{code}]]></code>
                  </softFormula>
                  <comments/>
                </aprioriComputation>
              </parameterValue>
              <bsv>
                <bsvType>lognormal</bsvType>
                <stdDevs><stdDev>{omega}</stdDev></stdDevs>
              </bsv>
              <validation>
                <errorMessage><text lang="en">must be positive</text></errorMessage>
                <operation><softFormula><inputs><input><id>{pid}</id><type>double</type></input></inputs>
                  <code><![CDATA[return {pid} > 0.0;]]></code></softFormula><comments/></operation>
                <comments/>
              </validation>
              <comments/>
            </parameter>"""

DRUG_MODEL_ID = "vancomyzer.crosscheck.colin2019"

def build_tdd():
    ref = colin_prior(REF["age"], REF["wt"], REF["scr"])
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="0.6" xsi:noNamespaceSchemaLocation="drug2.xsd">
  <history>
    <revisions>
      <revision>
        <revisionAction>creation</revisionAction>
        <revisionAuthorName>Vancomyzer cross-check harness</revisionAuthorName>
        <institution>-</institution>
        <email>-</email>
        <date>2026-09-18</date>
        <comments><comment lang="en">Colin 2019 adult vancomycin prior encoded for engine cross-check only. Synthetic use; not a clinical model file.</comment></comments>
      </revision>
    </revisions>
  </history>
  <head>
    <drugModelId>{DRUG_MODEL_ID}</drugModelId>
    <drugId>vancomycin</drugId>
    <drugModelName><name lang="en">Vancomycin Colin 2019 (cross-check)</name></drugModelName>
    <domainName><name lang="en">Adults</name></domainName>
    <study>
      <studyName><name lang="en">Colin PJ et al. Clin Pharmacokinet 2019;58:767-780</name></studyName>
      <studyAuthors>Colin PJ et al.</studyAuthors>
      <description><desc lang="en">Two-compartment model, allometric weight, maturation/age-decline sigmoid, SCr covariate on CL.</desc></description>
      <references><reference type="bibtex">@article{{colin2019, title={{Vancomycin Pharmacokinetics Throughout Life}}, author={{Colin, Pieter J. and others}}, journal={{Clin Pharmacokinet}}, year={{2019}}, volume={{58}}, pages={{767--780}}}}</reference></references>
    </study>
    <comments/>
  </head>
  <drugModel>
    <drugId>vancomycin</drugId>
    <drugModelId>{DRUG_MODEL_ID}</drugModelId>
    <domain>
      <description><desc lang="en">Adults (age &gt;= 18).</desc></description>
      <constraints>
        <constraint>
          <constraintType>hard</constraintType>
          <errorMessage><text lang="en">Age must be at least 18</text></errorMessage>
          <requiredCovariates><covariateId>age</covariateId></requiredCovariates>
          <checkOperation><softFormula><inputs><input><id>age</id><type>double</type></input></inputs>
            <code><![CDATA[return (age >= 18);]]></code></softFormula><comments/></checkOperation>
          <comments/>
        </constraint>
      </constraints>
    </domain>
    <covariates>{covariate("bodyweight", "Total body weight", "kg", 70)}{covariate("age", "Age", "y", 35)}{covariate("scr", "Serum creatinine", "mg/dl", 0.83)}
    </covariates>
    <activeMoieties>
      <activeMoiety>
        <activeMoietyId>vancomycin</activeMoietyId>
        <activeMoietyName><name lang="en">Vancomycin</name></activeMoietyName>
        <unit>mg/l</unit>
        <analyteIdList><analyteId>vancomycin</analyteId></analyteIdList>
        <analytesToMoietyFormula><hardFormula>direct</hardFormula><comments/></analytesToMoietyFormula>
        <targets>
          <target>
            <targetType>auc24</targetType>
            <targetValues>
              <unit>mg*h/l</unit>
              <min><standardValue>400</standardValue></min>
              <max><standardValue>600</standardValue></max>
              <best><standardValue>500</standardValue></best>
              <toxicityAlarm><standardValue>800</standardValue></toxicityAlarm>
              <inefficacyAlarm><standardValue>300</standardValue></inefficacyAlarm>
            </targetValues>
            <comments/>
          </target>
        </targets>
      </activeMoiety>
    </activeMoieties>
    <analyteGroups>
      <analyteGroup>
        <groupId>vancomycin</groupId>
        <pkModelId>linear.2comp.macro</pkModelId>
        <analytes>
          <analyte>
            <analyteId>vancomycin</analyteId>
            <unit>mg/l</unit>
            <molarMass><value>1449.3</value><unit>g/mol</unit></molarMass>
            <description><desc lang="en">vancomycin</desc></description>
            <errorModel>
              <errorModelType>mixed</errorModelType>
              <sigmas>
                <sigma><standardValue>{SIGMA0}</standardValue></sigma>
                <sigma><standardValue>{SIGMA1}</standardValue></sigma>
              </sigmas>
              <comments><comment lang="en">sigma = sqrt((sigma1*pred)^2 + sigma0^2); additive 1 mg/L, proportional 0.15. NOT identical in form to Vancomyzer max(1, 0.15*max(obs,pred)).</comment></comments>
            </errorModel>
            <comments/>
          </analyte>
        </analytes>
        <dispositionParameters>
          <parameters>{parameter("CL", "l/h", round(ref["CL"], 6), ["bodyweight", "age", "scr"], CL_CODE, OMEGA["CL"])}{parameter("V1", "l", ref["V1"], ["bodyweight"], V1_CODE, OMEGA["V1"])}{parameter("Q", "l/h", ref["Q"], ["bodyweight"], Q_CODE, OMEGA["Q"])}{parameter("V2", "l", ref["V2"], ["bodyweight"], V2_CODE, OMEGA["V2"])}
          </parameters>
          <correlations/>
        </dispositionParameters>
      </analyteGroup>
    </analyteGroups>
    <formulationAndRoutes default="id0">
      <formulationAndRoute>
        <formulationAndRouteId>id0</formulationAndRouteId>
        <formulation>parenteral solution</formulation>
        <administrationName>IV infusion</administrationName>
        <administrationRoute>intravenousDrip</administrationRoute>
        <absorptionModel>infusion</absorptionModel>
        <dosages>
          <analyteConversions><analyteConversion><analyteId>vancomycin</analyteId><factor>1</factor></analyteConversion></analyteConversions>
          <availableDoses>
            <unit>mg</unit>
            <default><standardValue>1000</standardValue></default>
            <rangeValues><from><standardValue>250</standardValue></from><to><standardValue>4000</standardValue></to><step><standardValue>250</standardValue></step></rangeValues>
          </availableDoses>
          <intervals>
            <unit>h</unit>
            <default><standardValue>12</standardValue></default>
            <fixedValues><value>8</value><value>12</value><value>24</value></fixedValues>
          </intervals>
          <infusions>
            <unit>min</unit>
            <default><standardValue>90</standardValue></default>
            <fixedValues><value>60</value><value>90</value><value>105</value><value>120</value></fixedValues>
          </infusions>
          <comments/>
        </dosages>
        <absorptionParameters/>
      </formulationAndRoute>
    </formulationAndRoutes>
    <timeConsiderations>
      <halfLife>
        <unit>h</unit>
        <duration><standardValue>8</standardValue></duration>
        <multiplier>100</multiplier>
        <comments/>
      </halfLife>
      <outdatedMeasure>
        <unit>d</unit>
        <duration><standardValue>100</standardValue></duration>
        <comments/>
      </outdatedMeasure>
    </timeConsiderations>
    <comments/>
  </drugModel>
</model>
"""

# ── .tqf ──────────────────────────────────────────────────────────────────────
T0 = dt.datetime(2026, 1, 1, 8, 0, 0)
N_DOSES = 60  # 30 days q12h: >= 12 terminal half-lives even at t1/2 = 60 h

def iso(t): return t.strftime("%Y-%m-%dT%H:%M:%S")

def build_tqf(qid, age, wt, scr, dose_mg, tau_h, inf_h, samples, params_type):
    start = T0
    end = T0 + dt.timedelta(hours=N_DOSES * tau_h)
    last = T0 + dt.timedelta(hours=(N_DOSES - 1) * tau_h)
    covs = "".join(f"""
        <covariate><covariateId>{cid}</covariateId><date>{iso(start - dt.timedelta(days=1))}</date><value>{v}</value><unit>{u}</unit><dataType>double</dataType><nature>discrete</nature></covariate>"""
        for cid, v, u in (("bodyweight", wt, "kg"), ("age", age, "y"), ("scr", scr, "mg/dl")))
    samp = "".join(f"""
          <sample>
            <sampleId>s{i+1}</sampleId>
            <sampleDate>{iso(last + dt.timedelta(hours=t))}</sampleDate>
            <concentrations><concentration><analyteId>vancomycin</analyteId><value>{c}</value><unit>mg/l</unit></concentration></concentrations>
          </sample>""" for i, (t, c) in enumerate(samples))
    hh, mm = int(tau_h), int(round((tau_h - int(tau_h)) * 60))
    return f"""<?xml version="1.0" ?>
<query xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="1.0" xsi:noNamespaceSchemaLocation="xml_query.xsd">
  <queryId>{qid}</queryId>
  <clientId>vancomyzer-crosscheck</clientId>
  <date>{iso(end)}</date>
  <language>en</language>
  <drugTreatment>
    <patient>
      <covariates>{covs}
      </covariates>
    </patient>
    <drugs>
      <drug>
        <drugId>vancomycin</drugId>
        <activePrinciple>vancomycin</activePrinciple>
        <brandName>-</brandName>
        <atc>J01XA01</atc>
        <treatment>
          <dosageHistory>
            <dosageTimeRange>
              <start>{iso(start)}</start>
              <end>{iso(end)}</end>
              <dosage>
                <dosageLoop>
                  <lastingDosage>
                    <interval>{hh:02d}:{mm:02d}:00</interval>
                    <dose>
                      <value>{dose_mg}</value>
                      <unit>mg</unit>
                      <infusionTimeInMinutes>{inf_h * 60:g}</infusionTimeInMinutes>
                    </dose>
                    <formulationAndRoute>
                      <formulation>parenteralSolution</formulation>
                      <administrationName>IV infusion</administrationName>
                      <administrationRoute>intravenousDrip</administrationRoute>
                      <absorptionModel>infusion</absorptionModel>
                    </formulationAndRoute>
                  </lastingDosage>
                </dosageLoop>
              </dosage>
            </dosageTimeRange>
          </dosageHistory>
        </treatment>
        <samples>{samp}
        </samples>
      </drug>
    </drugs>
  </drugTreatment>
  <requests>
    <request>
      <requestId>{qid}.pred</requestId>
      <drugId>vancomycin</drugId>
      <drugModelId>{DRUG_MODEL_ID}</drugModelId>
      <predictionTraits>
        <computingOption>
          <parametersType>{params_type}</parametersType>
          <compartmentOption>allActiveMoieties</compartmentOption>
          <retrieveStatistics>true</retrieveStatistics>
          <retrieveParameters>true</retrieveParameters>
          <retrieveCovariates>true</retrieveCovariates>
        </computingOption>
        <nbPointsPerHour>20</nbPointsPerHour>
        <dateInterval>
          <start>{iso(last)}</start>
          <end>{iso(end)}</end>
        </dateInterval>
      </predictionTraits>
    </request>
  </requests>
</query>
"""

def run_tucucli(tucucli, drugdir, tqf, out):
    r = subprocess.run([tucucli, "-d", drugdir, "-i", tqf, "-o", out], capture_output=True, text=True, timeout=600)
    return r

def parse_response(path):
    """Returns dict(status, params{...}, stats{auc, peak, residual}, times, values)."""
    tree = ET.parse(path); root = tree.getroot()
    res = {"status": None, "params": {}, "stats": {}, "cycles": 0}
    # status: first <status>/<statusCode> style node anywhere
    for n in root.iter():
        if n.tag in ("statusCode", "statusCodeLit") and res["status"] is None:
            res["status"] = n.text
    cycles = list(root.iter("cycleData"))
    res["cycles"] = len(cycles)
    if cycles:
        c = cycles[-1]
        unit = (c.findtext("unit") or "").strip()
        scale = {"ug/l": 1e-3, "mg/l": 1.0}.get(unit)
        if scale is None: raise RuntimeError(f"unexpected concentration unit in response: {unit!r}")
        res["unit"] = unit
        for p in c.iter("parameter"):
            res["params"][p.findtext("id")] = float(p.findtext("value"))
        st = c.find("statistics")
        if st is not None:
            for k in ("auc", "peak", "residual", "mean", "cumulativeAuc"):
                v = st.findtext(k)
                if v is not None: res["stats"][k] = float(v) * scale
        times = c.findtext("times"); values = c.findtext("values")
        if times and values:
            res["times"] = [float(x) for x in times.split(",") if x.strip()]
            res["values"] = [float(x) * scale for x in values.split(",") if x.strip()]
    return res

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tucucli", required=True)
    ap.add_argument("--tucuxi-commit", required=True)
    ap.add_argument("--fixture", default=os.path.join(CROSSCHECK, "fixtures", "crosscheck-seed42-n200.json"))
    ap.add_argument("--work", default=os.path.join(tempfile.gettempdir(), "tucuxi-crosscheck-run"))
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()

    os.makedirs(a.work, exist_ok=True)
    drugdir = os.path.join(a.work, "drugfiles"); os.makedirs(drugdir, exist_ok=True)
    tdd = build_tdd()
    tdd_path = os.path.join(drugdir, f"{DRUG_MODEL_ID}.tdd")
    open(tdd_path, "w").write(tdd)
    model_hash = hashlib.sha256(tdd.encode()).hexdigest()
    open(os.path.join(HERE, f"{DRUG_MODEL_ID}.tdd"), "w").write(tdd)  # committed copy
    print(f"model file sha256 {model_hash}")

    # ── Step 2: prior validation on the reference patient ────────────────────
    ref_tqf = os.path.join(a.work, "ref-apriori.tqf"); ref_out = os.path.join(a.work, "ref-apriori.xml")
    open(ref_tqf, "w").write(build_tqf("ref.apriori", REF["age"], REF["wt"], REF["scr"], REF["dose"], REF["tau"], REF["inf_h"], [], "apriori"))
    r = run_tucucli(a.tucucli, drugdir, ref_tqf, ref_out)
    if r.returncode != 0 or not os.path.exists(ref_out):
        print("tucucli failed on the reference query:\n", r.stdout[-3000:], r.stderr[-3000:]); sys.exit(3)
    ref = parse_response(ref_out)
    checks = []
    def chk(name, got, exp, tol):
        ok = abs(got - exp) / exp <= tol
        checks.append((name, got, exp, ok)); return ok
    p = ref["params"]; s = ref["stats"]
    okall = True
    okall &= chk("prior CL (L/h)", p.get("CL", float("nan")), REF["CL"], 1e-4)
    okall &= chk("prior V1 (L)", p.get("V1", float("nan")), REF["V1"], 1e-6)
    okall &= chk("prior Q (L/h)", p.get("Q", float("nan")), REF["Q"], 1e-6)
    okall &= chk("prior V2 (L)", p.get("V2", float("nan")), REF["V2"], 1e-6)
    okall &= chk("SS peak (mg/L, end of infusion)", s.get("peak", float("nan")), REF["peak"], 2e-3)
    okall &= chk("SS trough (mg/L, end of interval)", s.get("residual", float("nan")), REF["trough"], 2e-3)
    okall &= chk("SS AUC per 12 h interval (mg*h/L)", s.get("auc", float("nan")), REF["auc24"] / 2, 2e-3)
    for name, got, exp, ok in checks:
        print(f"  [{'OK ' if ok else 'FAIL'}] {name}: tucuxi {got:.6f} vs reference {exp:.6f}")
    if not okall:
        print("PRIOR VALIDATION FAILED — model encoding does not reproduce the reference; stopping before any posterior run.")
        sys.exit(3)
    print("prior validation passed")

    # ── Step 3: posterior runs on the fixture ───────────────────────────────
    fx = json.load(open(a.fixture))
    patients = fx["patients"][: a.limit] if a.limit else fx["patients"]
    results = []; failures = []
    for i, pt in enumerate(patients):
        P = pt["patient"]; R = pt["regimen"]
        samples = [(l["time_since_last_dose_hours"], l["value_mcg_ml"]) for l in pt["levels"]]
        qid = f"cc.{pt['id']}"
        tqf = os.path.join(a.work, f"{pt['id']}.tqf"); out = os.path.join(a.work, f"{pt['id']}.xml")
        open(tqf, "w").write(build_tqf(qid, P["age"], P["weight_kg"], P["serum_creatinine_mg_dl"], R["dose_mg"], R["interval_hours"], R["infusion_duration_hours"], samples, "aposteriori"))
        r = run_tucucli(a.tucucli, drugdir, tqf, out)
        rec = {"id": pt["id"], "prior": colin_prior(P["age"], P["weight_kg"], P["serum_creatinine_mg_dl"]), "posterior": {}, "truth": pt["truth"],
               "exposure_steady_state": {}, "fit": {"success": False, "status": None}}
        if r.returncode == 0 and os.path.exists(out):
            res = parse_response(out)
            rec["fit"]["status"] = res["status"]
            if all(k in res["params"] for k in ("CL", "V1", "Q", "V2")):
                rec["posterior"] = {k: res["params"][k] for k in ("CL", "V1", "Q", "V2")}
                rec["fit"]["success"] = True
                rec["exposure_steady_state"] = {"auc24": res["stats"].get("auc", float("nan")) * (24 / R["interval_hours"]),
                                                "auc_interval": res["stats"].get("auc"),
                                                "peak": res["stats"].get("peak"), "trough": res["stats"].get("residual"),
                                                "horizon": "steady_state (60 doses simulated)"}
            else:
                failures.append((pt["id"], f"no parameters in response (status {res['status']})"))
        else:
            failures.append((pt["id"], f"tucucli exit {r.returncode}: {(r.stderr or r.stdout)[-300:]}"))
        results.append(rec)
        if (i + 1) % 20 == 0: print(f"  {i+1}/{len(patients)} done")

    out_json = {
        "product": "Tucuxi-core tucucli (sotalya/tucuxi-core, built from source in the audit sandbox)",
        "engine_manifest": f"tucuxi-core@{a.tucuxi_commit}",
        "run_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "fixture": os.path.basename(a.fixture), "fixture_seed": fx["seed"],
        "model_file": f"{DRUG_MODEL_ID}.tdd", "model_file_sha256": model_hash,
        "prior_model": "Colin 2019 encoded as Tucuxi softFormula (this harness); validated against the reference patient before the run",
        "prior_log_sd": OMEGA, "bsv_type": "lognormal (value * exp(eta))",
        "error_model": f"Tucuxi 'mixed': sigma = sqrt(({SIGMA1} * pred)^2 + {SIGMA0}^2); Gaussian NLL with ln(sigma). NOT identical in form to Vancomyzer's max(1, 0.15 * max(obs, pred)).",
        "estimator": "Tucuxi MAP (a posteriori etas), objective = sum NLL + sum eta^2/(2 omega^2)",
        "renal_assumption": "SCr (mg/dL) used directly as the Colin 2019 covariate",
        "exposure_horizon": f"last of {N_DOSES} simulated doses (steady state)",
        "peak_definition": "max of the last-interval curve at 20 points/h (end of infusion)",
        "trough_definition": "residual = concentration at the end of the last interval",
        "dose_history": f"{N_DOSES} x dose q<interval>h, infusion per fixture; samples at fixture times after the start of the last dose",
        "units": {"concentration": "mg/L", "CL": "L/h", "V": "L", "time": "h"},
        "prior_validation": [{"check": n, "tucuxi": g, "reference": e, "ok": ok} for n, g, e, ok in checks],
        "failures": [{"id": i, "reason": why} for i, why in failures],
        "command": f"{os.path.basename(a.tucucli)} -d <drugfiles> -i <patient>.tqf -o <patient>.xml",
        "results": results,
    }
    out_path = os.path.join(CROSSCHECK, "results", f"tucuxi-{model_hash[:12]}-crosscheck-seed{fx['seed']}-n{fx['n']}.json")
    json.dump(out_json, open(out_path, "w"), indent=1)
    print(f"wrote {out_path}: {sum(1 for r in results if r['fit']['success'])}/{len(results)} fits, {len(failures)} failures")

if __name__ == "__main__":
    main()
