from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
import numpy as np
from scipy import optimize
from scipy.stats import multivariate_normal
import json
import math
import os
import uuid
from datetime import datetime
from enum import Enum
from utils import pk
from backend.pk import bayesian as bayesian_pk
from backend.pk.deterministic import compute_curve_and_metrics
from backend.pk.sim import Event, simulate_regimen_0_48h
from backend.regimen_recommender import (
    recommend_regimen,
    recommend_regimens,
    loading_dose as recommend_loading_dose,
)

# --- CamelModel and alias generator ---
def _to_camel(s: str) -> str:
    parts = s.split('_')
    return parts[0] + ''.join(p.capitalize() for p in parts[1:])


class CamelModel(BaseModel):
    class Config:
        allow_population_by_field_name = True
        alias_generator = _to_camel

app = FastAPI(
    title="Vancomyzer API",
    description="Evidence-based vancomycin dosing calculator following ASHP/IDSA 2020 guidelines",
    version="2.0.0"
)

# CORS middleware for web frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files
from pathlib import Path

# Path to backend/static relative to project root
static_path = Path(__file__).parent / "static"
build_info_path = static_path / "build-info.json"

app.mount("/static", StaticFiles(directory=static_path, check_dir=False), name="static")
app.mount("/assets", StaticFiles(directory=static_path / "assets", check_dir=False), name="assets")

if os.getenv("VANCO_DEBUG_ROUTES") == "1":
    @app.get("/api/routes")
    async def list_routes():
        return {"routes": sorted({route.path for route in app.routes if hasattr(route, "path")})}


def _read_build_info() -> dict:
    git_sha = os.getenv("RENDER_GIT_COMMIT") or os.getenv("GIT_SHA")
    build_time = None
    if build_info_path.exists():
        try:
            data = json.loads(build_info_path.read_text())
            git_sha = git_sha or data.get("git_sha")
            build_time = data.get("build_time")
        except Exception:
            pass
    return {
        "git_sha": git_sha or "unknown",
        "build_time": build_time or datetime.utcnow().isoformat() + "Z",
    }


@app.get("/", response_class=HTMLResponse)
def serve_index():
    html = (static_path / "index.html").read_text()
    html = html.replace('src="/assets/', 'src="/static/assets/')
    html = html.replace('href="/assets/', 'href="/static/assets/')
    return HTMLResponse(html, headers={"Cache-Control": "no-store, no-cache, must-revalidate"})


@app.get("/build-info.json")
def build_info():
    if build_info_path.exists():
        return json.loads(build_info_path.read_text())
    return {"detail": "Not Found"}


@app.get("/api/version")
@app.get("/version")
def api_version():
    info = _read_build_info()
    return {
        "app": "Vancomyzer",
        "version": "v1",
        "git_sha": info["git_sha"],
        "build_time": info["build_time"],
    }


@app.get("/api/meta/version")
@app.get("/meta/version")
def meta_version():
    return _read_build_info()

# Data Models
class PopulationType(str, Enum):
    adult = "adult"
    pediatric = "pediatric"
    neonate = "neonate"

class Gender(str, Enum):
    male = "male"
    female = "female"
    other = "other"

class Indication(str, Enum):
    pneumonia = "pneumonia"
    skin_soft_tissue = "skin_soft_tissue"
    bacteremia = "bacteremia"
    endocarditis = "endocarditis"
    meningitis = "meningitis"
    osteomyelitis = "osteomyelitis"
    other = "other"

class Severity(str, Enum):
    mild = "mild"
    moderate = "moderate"
    severe = "severe"

class CrClMethod(str, Enum):
    cockcroft_gault = "cockcroft_gault"
    mdrd = "mdrd"
    ckd_epi = "ckd_epi"
    custom = "custom"

class PatientInput(BaseModel):
    population_type: PopulationType
    age_years: Optional[float] = None
    age_months: Optional[float] = None
    gestational_age_weeks: Optional[float] = None
    postnatal_age_days: Optional[float] = None
    gender: Gender
    weight_kg: float = Field(..., gt=0, le=300)
    height_cm: Optional[float] = Field(None, gt=0, le=250)
    serum_creatinine: float = Field(..., gt=0, le=20)
    indication: Indication
    severity: Severity
    is_renal_stable: bool = True
    is_on_hemodialysis: bool = False
    is_on_crrt: bool = False
    crcl_method: CrClMethod = CrClMethod.cockcroft_gault
    custom_crcl: Optional[float] = None
    
    @validator('age_years')
    def validate_age_years(cls, v, values):
        if values.get('population_type') == PopulationType.neonate and v is not None:
            raise ValueError("Neonates should not have age in years")
        if values.get('population_type') == PopulationType.adult and (v is None or v < 18):
            raise ValueError("Adults must be 18+ years")
        return v

class VancomycinLevel(BaseModel):
    concentration: float = Field(..., gt=0, le=200)
    time_after_dose_hours: float = Field(..., gt=0, le=72)
    dose_given_mg: float = Field(..., gt=0, le=4000)
    infusion_duration_hours: Optional[float] = Field(1.0, gt=0, le=24)
    level_type: str = Field("trough", pattern="^(trough|peak|random)$")
    draw_time: datetime
    notes: Optional[str] = None

class DosingResult(BaseModel):
    recommended_dose_mg: float
    interval_hours: float
    daily_dose_mg: float
    mg_per_kg_per_day: float
    loading_dose_mg: Optional[float]
    predicted_auc_24: float
    predicted_trough: float
    predicted_peak: float
    clearance_l_per_h: float
    volume_distribution_l: float
    half_life_hours: float
    elimination_rate_constant: float
    creatinine_clearance: float
    target_achievement_probability: float
    safety_warnings: List[str]
    monitoring_recommendations: List[str]
    calculation_method: str
    pk_curve_data: List[Dict[str, float]]  # For visualization
    auc_breakdown: Dict[str, Any]  # Detailed AUC calculation

class BayesianResult(BaseModel):
    individual_clearance: float
    individual_volume: float
    clearance_ci_lower: float
    clearance_ci_upper: float
    volume_ci_lower: float
    volume_ci_upper: float
    predicted_auc_ci_lower: float
    predicted_auc_ci_upper: float
    predicted_trough_ci_lower: float
    predicted_trough_ci_upper: float
    model_fit_r_squared: float
    convergence_achieved: bool
    iterations_used: int
    individual_pk_curve: List[Dict[str, float]]
    population_pk_curve: List[Dict[str, float]]

# Streamlined dosing models (2020 ASHP/IDSA/PIDS/SIDP)
class PatientInfo(CamelModel):
    age_years: float = Field(..., gt=0, le=120)
    weight_kg: float = Field(..., gt=0, le=300)
    height_cm: Optional[float] = Field(None, gt=0, le=250)
    sex: str = Field(..., pattern="^(male|female)$")
    # Accept legacy frontend payload key `serum_creatinine_mg_dl` as well as camelCase/snake_case
    serum_creatinine: float = Field(..., gt=0, le=20, alias="serum_creatinine_mg_dl")
    serious_infection: bool = False

class BayesianLevel(CamelModel):
    level_mg_l: float = Field(..., gt=0, le=200)
    time_hours: float = Field(..., gt=0, le=72)
    level_type: Optional[str] = Field(None, pattern="^(peak|trough)$")
    dose_mg: Optional[float] = Field(None, gt=0, le=4000)
    infusion_hours: Optional[float] = Field(1.0, gt=0, le=24)

class DoseHistoryEvent(CamelModel):
    dose_mg: float = Field(..., gt=0, le=4000)
    start_time_hr: float = Field(..., ge=0, le=240)
    infusion_hr: float = Field(..., gt=0, le=24)

class RegimenOverride(CamelModel):
    dose_mg: float = Field(..., gt=0, le=4000)
    interval_hr: float = Field(..., gt=0, le=72)
    infusion_hr: float = Field(..., gt=0, le=24)

class DoseRequest(CamelModel):
    patient: PatientInfo
    levels: Optional[List[BayesianLevel]] = None
    dose_history: Optional[List[DoseHistoryEvent]] = None
    regimen: Optional[RegimenOverride] = None

class DoseResponse(BaseModel):
    loading_dose_mg: float
    maintenance_dose_mg: float
    interval_hours: float
    infusion_hours: float
    predicted_peak_mg_l: float
    predicted_trough_mg_l: float
    predicted_auc_24: float
    k_e: float
    vd_l: float
    half_life_hours: float
    crcl_ml_min: float
    method: str
    notes: List[str]
    concentration_curve: List[Dict[str, float]]
    auc24_ci_low: Optional[float] = None
    auc24_ci_high: Optional[float] = None
    curve_ci_low: Optional[List[Dict[str, float]]] = None
    curve_ci_high: Optional[List[Dict[str, float]]] = None
    regimen_options: Optional[List[Dict[str, float]]] = None
    calculation_details: Optional[Dict[str, Any]] = None
    fit_diagnostics: Optional[Dict[str, Any]] = None


class BasicPatientPayload(BaseModel):
    age: int = Field(ge=0, le=120)
    sex: str = Field(..., pattern="^(male|female)$")
    height_cm: float = Field(gt=0, le=250)
    weight_kg: float = Field(gt=0, le=300)
    serum_creatinine: float = Field(gt=0, le=20)


class BasicRegimenPayload(BaseModel):
    dose_mg: float = Field(gt=0, le=4000)
    interval_hr: float = Field(gt=0, le=72)
    infusion_hr: Optional[float] = Field(default=None, gt=0, le=24)


class BasicCalculateAlias(BaseModel):
    patient: BasicPatientPayload
    regimen: BasicRegimenPayload

# Pharmacokinetic Calculation Engine
class VancomycinPKCalculator:
    def __init__(self):
        # Population PK parameters based on literature
        self.population_params = {
            PopulationType.adult: {
                'clearance_l_per_h_per_70kg': 3.5,
                'volume_l_per_kg': 0.7,
                'creatinine_factor': 0.79,
                'age_factor': 0.985,
                'target_auc': (400, 600),
                'target_trough': (10, 20)
            },
            PopulationType.pediatric: {
                'clearance_l_per_h_per_kg': 0.1,
                'volume_l_per_kg': 0.7,
                'age_factor': 1.2,
                'target_auc': (400, 600),
                'target_trough': (10, 20)
            },
            PopulationType.neonate: {
                'clearance_base': 0.05,
                'volume_l_per_kg': 0.8,
                'ga_factor': 1.3,
                'pna_factor': 1.1,
                'target_auc': (400, 600),
                'target_trough': (10, 15)
            }
        }
    
    def calculate_creatinine_clearance(self, patient: PatientInput) -> float:
        """Calculate creatinine clearance using specified method"""
        if patient.custom_crcl is not None:
            return patient.custom_crcl
        
        if patient.crcl_method == CrClMethod.cockcroft_gault:
            return self._cockcroft_gault(patient)
        elif patient.crcl_method == CrClMethod.mdrd:
            return self._mdrd(patient)
        elif patient.crcl_method == CrClMethod.ckd_epi:
            return self._ckd_epi(patient)
        else:
            return self._cockcroft_gault(patient)
    
    def _cockcroft_gault(self, patient: PatientInput) -> float:
        """Cockcroft-Gault equation"""
        if patient.age_years is None:
            # For neonates, use modified approach
            return 120.0  # Placeholder for neonatal CrCl
        
        weight = patient.weight_kg
        age = patient.age_years
        scr = patient.serum_creatinine
        
        crcl = ((140 - age) * weight) / (72 * scr)
        if patient.gender == Gender.female:
            crcl *= 0.85
            
        return max(crcl, 10.0)  # Minimum 10 mL/min
    
    def _mdrd(self, patient: PatientInput) -> float:
        """MDRD equation"""
        if patient.age_years is None:
            return 120.0
        
        scr = patient.serum_creatinine
        age = patient.age_years
        
        gfr = 186 * (scr ** -1.154) * (age ** -0.203)
        if patient.gender == Gender.female:
            gfr *= 0.742
            
        return max(gfr, 10.0)
    
    def _ckd_epi(self, patient: PatientInput) -> float:
        """CKD-EPI equation"""
        if patient.age_years is None:
            return 120.0
        
        scr = patient.serum_creatinine
        age = patient.age_years
        
        kappa = 0.7 if patient.gender == Gender.female else 0.9
        alpha = -0.329 if patient.gender == Gender.female else -0.411
        
        gfr = 141 * min(scr/kappa, 1)**alpha * max(scr/kappa, 1)**(-1.209) * (0.993**age)
        if patient.gender == Gender.female:
            gfr *= 1.018
            
        return max(gfr, 10.0)
    
    def calculate_pk_parameters(self, patient: PatientInput) -> Dict[str, float]:
        """Calculate individual PK parameters"""
        params = self.population_params[patient.population_type]
        crcl = self.calculate_creatinine_clearance(patient)
        
        if patient.population_type == PopulationType.adult:
            # Adult calculations
            weight_factor = patient.weight_kg / 70.0
            clearance = params['clearance_l_per_h_per_70kg'] * weight_factor * (crcl / 120.0)
            volume = params['volume_l_per_kg'] * patient.weight_kg
            
            if patient.age_years:
                age_factor = params['age_factor'] ** (patient.age_years - 40)
                clearance *= age_factor
                
        elif patient.population_type == PopulationType.pediatric:
            # Pediatric calculations
            clearance = params['clearance_l_per_h_per_kg'] * patient.weight_kg * (crcl / 120.0)
            volume = params['volume_l_per_kg'] * patient.weight_kg
            
            if patient.age_years and patient.age_years < 12:
                clearance *= params['age_factor']
                
        else:  # Neonate
            # Neonatal calculations
            weight_factor = patient.weight_kg / 3.5  # Reference 3.5kg neonate
            clearance = params['clearance_base'] * weight_factor
            volume = params['volume_l_per_kg'] * patient.weight_kg
            
            if patient.gestational_age_weeks:
                ga_factor = (patient.gestational_age_weeks / 40.0) ** 1.5
                clearance *= ga_factor
                
            if patient.postnatal_age_days:
                pna_factor = min(1.0 + patient.postnatal_age_days / 30.0, 2.0)
                clearance *= pna_factor
        
        # Apply severity adjustments
        severity_multipliers = {
            Severity.mild: 1.0,
            Severity.moderate: 1.1,
            Severity.severe: 1.2
        }
        
        # Renal adjustments
        if patient.is_on_hemodialysis:
            clearance *= 0.3
        elif patient.is_on_crrt:
            clearance *= 1.2
        elif not patient.is_renal_stable:
            clearance *= 0.8
        
        # Calculate derived parameters
        elimination_rate = clearance / volume
        half_life = 0.693 / elimination_rate
        
        return {
            'clearance': max(clearance, 0.5),
            'volume': max(volume, 10.0),
            'elimination_rate': elimination_rate,
            'half_life': half_life,
            'creatinine_clearance': crcl
        }
    
    def calculate_dosing(self, patient: PatientInput) -> DosingResult:
        """Calculate optimal vancomycin dosing"""
        pk_params = self.calculate_pk_parameters(patient)
        target_auc = self._get_target_auc(patient)
        
        # Calculate dose and interval
        clearance = pk_params['clearance']
        volume = pk_params['volume']
        
        # Target daily dose based on AUC
        daily_dose = target_auc * clearance
        
        # Determine optimal interval
        half_life = pk_params['half_life']
        if half_life <= 6:
            interval = 8
        elif half_life <= 12:
            interval = 12
        else:
            interval = 24
        
        # Calculate dose per interval
        dose_per_interval = (daily_dose * interval) / 24
        
        # Round to practical doses
        dose_per_interval = self._round_dose(dose_per_interval)
        daily_dose = (dose_per_interval * 24) / interval
        
        # Calculate predictions
        predicted_auc = daily_dose / clearance
        predicted_trough = self._calculate_trough(dose_per_interval, interval, pk_params)
        predicted_peak = self._calculate_peak(dose_per_interval, pk_params, infusion_time=1.0)
        
        # Generate PK curve data for visualization
        pk_curve_data = self._generate_pk_curve(dose_per_interval, interval, pk_params)
        
        # AUC breakdown for detailed view
        auc_breakdown = self._calculate_auc_breakdown(dose_per_interval, interval, pk_params)
        
        # Safety and monitoring
        safety_warnings = self._assess_safety(predicted_auc, predicted_trough, predicted_peak, patient)
        monitoring_recs = self._get_monitoring_recommendations(patient, interval)
        
        # Calculate loading dose if needed
        loading_dose = None
        if patient.severity == Severity.severe or patient.indication in [Indication.endocarditis, Indication.meningitis]:
            loading_dose = 25 * patient.weight_kg
            loading_dose = min(loading_dose, 3000)
        
        # Target achievement probability
        target_prob = self._calculate_target_probability(predicted_auc, target_auc)
        
        return DosingResult(
            recommended_dose_mg=dose_per_interval,
            interval_hours=interval,
            daily_dose_mg=daily_dose,
            mg_per_kg_per_day=daily_dose / patient.weight_kg,
            loading_dose_mg=loading_dose,
            predicted_auc_24=predicted_auc,
            predicted_trough=predicted_trough,
            predicted_peak=predicted_peak,
            clearance_l_per_h=clearance,
            volume_distribution_l=volume,
            half_life_hours=half_life,
            elimination_rate_constant=pk_params['elimination_rate'],
            creatinine_clearance=pk_params['creatinine_clearance'],
            target_achievement_probability=target_prob,
            safety_warnings=safety_warnings,
            monitoring_recommendations=monitoring_recs,
            calculation_method=f"Population PK ({patient.population_type.value.title()})",
            pk_curve_data=pk_curve_data,
            auc_breakdown=auc_breakdown
        )
    
    def _get_target_auc(self, patient: PatientInput) -> float:
        """Get target AUC based on indication and severity"""
        base_targets = {
            Indication.pneumonia: 450,
            Indication.skin_soft_tissue: 400,
            Indication.bacteremia: 450,
            Indication.endocarditis: 500,
            Indication.meningitis: 550,
            Indication.osteomyelitis: 500,
            Indication.other: 450
        }
        
        target = base_targets.get(patient.indication, 450)
        
        # Severity adjustments
        if patient.severity == Severity.severe:
            target *= 1.1
        elif patient.severity == Severity.mild:
            target *= 0.95
        
        return min(target, 600)  # Cap at 600 per guidelines
    
    def _round_dose(self, dose: float) -> float:
        """Round dose to practical increments"""
        if dose < 500:
            return round(dose / 125) * 125
        elif dose < 1500:
            return round(dose / 250) * 250
        else:
            return round(dose / 500) * 500
    
    def _calculate_trough(self, dose: float, interval: float, pk_params: Dict[str, float]) -> float:
        """Calculate predicted trough concentration"""
        k = pk_params['elimination_rate']
        v = pk_params['volume']
        
        # One-compartment model steady-state trough
        trough = (dose / v) * (np.exp(-k * 1.0) / (1 - np.exp(-k * interval)))
        return trough
    
    def _calculate_peak(self, dose: float, pk_params: Dict[str, float], infusion_time: float = 1.0) -> float:
        """Calculate predicted peak concentration"""
        k = pk_params['elimination_rate']
        v = pk_params['volume']
        
        # Peak at end of infusion
        peak = (dose / (v * k * infusion_time)) * (1 - np.exp(-k * infusion_time))
        return peak
    
    def _generate_pk_curve(self, dose: float, interval: float, pk_params: Dict[str, float]) -> List[Dict[str, float]]:
        """Generate concentration-time curve data for visualization"""
        k = pk_params['elimination_rate']
        v = pk_params['volume']
        
        curve_data = []
        time_points = np.linspace(0, 24, 100)
        
        for t in time_points:
            # Calculate concentration at time t (steady state)
            doses_given = int(t / interval) + 1
            conc = 0
            
            for dose_num in range(doses_given):
                dose_time = dose_num * interval
                if dose_time <= t:
                    time_since_dose = t - dose_time
                    # Infusion + elimination
                    conc += (dose / (v * k * 1.0)) * (1 - np.exp(-k * 1.0)) * np.exp(-k * (time_since_dose - 1.0))
            
            curve_data.append({
                'time': float(t),
                'concentration': max(float(conc), 0.0)
            })
        
        return curve_data
    
    def _calculate_auc_breakdown(self, dose: float, interval: float, pk_params: Dict[str, float]) -> Dict[str, Any]:
        """Calculate detailed AUC breakdown for visualization"""
        clearance = pk_params['clearance']
        
        # AUC components
        total_auc = (dose * 24) / (interval * clearance)
        
        return {
            'total_auc_24h': total_auc,
            'auc_per_dose': total_auc * interval / 24,
            'doses_per_day': 24 / interval,
            'clearance_contribution': clearance,
            'dose_contribution': dose,
            'interval_contribution': interval,
            'formula': f'AUC = (Dose × 24h) ÷ (Interval × Clearance) = ({dose:.0f} × 24) ÷ ({interval} × {clearance:.2f}) = {total_auc:.0f} mg·h/L'
        }
    
    def _assess_safety(self, auc: float, trough: float, peak: float, patient: PatientInput) -> List[str]:
        """Assess safety and generate warnings"""
        warnings = []
        
        if auc > 600:
            warnings.append("⚠️ AUC >600 mg·h/L increases nephrotoxicity risk")
        
        if trough > 20:
            warnings.append("⚠️ Predicted trough >20 mg/L - consider dose reduction")
        
        if peak > 40:
            warnings.append("⚠️ Predicted peak >40 mg/L - consider longer infusion")
        
        if patient.age_years and patient.age_years > 65 and auc > 550:
            warnings.append("⚠️ Elderly patient with high AUC - enhanced monitoring recommended")
        
        if patient.serum_creatinine > 1.5 and auc > 500:
            warnings.append("⚠️ Elevated creatinine with moderate AUC - monitor renal function closely")
        
        return warnings
    
    def _get_monitoring_recommendations(self, patient: PatientInput, interval: float) -> List[str]:
        """Generate monitoring recommendations"""
        recommendations = []
        
        recommendations.append("📊 Obtain levels before 4th dose (steady state)")
        recommendations.append("🩸 Trough: draw 30 minutes before next dose")
        recommendations.append("🔬 Monitor SCr and BUN every 2-3 days")
        
        if interval <= 8:
            recommendations.append("👂 Consider hearing assessment if therapy >7 days")
        
        if patient.population_type == PopulationType.neonate:
            recommendations.append("👶 Monitor for feeding intolerance and development")
        
        if patient.is_on_crrt:
            recommendations.append("🏥 Monitor levels more frequently due to CRRT")
        
        return recommendations
    
    def _calculate_target_probability(self, predicted_auc: float, target_auc: float) -> float:
        """Calculate probability of achieving target AUC"""
        # Simplified model - in reality would use Monte Carlo simulation
        target_center = target_auc
        cv = 0.2  # 20% coefficient of variation
        
        # Normal distribution approximation
        from scipy.stats import norm
        lower_bound = target_center * 0.9
        upper_bound = target_center * 1.1
        
        prob = norm.cdf(upper_bound, predicted_auc, predicted_auc * cv) - \
               norm.cdf(lower_bound, predicted_auc, predicted_auc * cv)
        
        return min(max(prob, 0.0), 1.0)

# Bayesian Optimization Engine
class BayesianOptimizer:
    def __init__(self, pk_calculator: VancomycinPKCalculator):
        self.pk_calculator = pk_calculator
        
    def optimize_dosing(self, patient: PatientInput, levels: List[VancomycinLevel]) -> BayesianResult:
        """Perform Bayesian optimization using measured levels"""
        if not levels:
            raise ValueError("At least one vancomycin level required for Bayesian optimization")
        
        # Get population priors
        pop_params = self.pk_calculator.calculate_pk_parameters(patient)
        
        # Set up priors (log-normal distributions)
        prior_cl_mean = np.log(pop_params['clearance'])
        prior_cl_var = 0.3  # CV ~30%
        prior_v_mean = np.log(pop_params['volume'])
        prior_v_var = 0.2   # CV ~20%
        
        # Observation data
        observations = []
        for level in levels:
            observations.append({
                'concentration': level.concentration,
                'time': level.time_after_dose_hours,
                'dose': level.dose_given_mg,
                'infusion_time': level.infusion_duration_hours or 1.0
            })
        
        # MAP estimation using optimization
        def negative_log_posterior(params):
            log_cl, log_v = params
            cl = np.exp(log_cl)
            v = np.exp(log_v)
            
            # Prior contribution
            prior_ll = -0.5 * ((log_cl - prior_cl_mean)**2 / prior_cl_var + 
                              (log_v - prior_v_mean)**2 / prior_v_var)
            
            # Likelihood contribution
            likelihood_ll = 0
            residual_var = 0.1  # Residual error variance
            
            for obs in observations:
                predicted = self._predict_concentration(
                    obs['dose'], obs['time'], obs['infusion_time'], cl, v
                )
                likelihood_ll -= 0.5 * ((obs['concentration'] - predicted)**2) / residual_var
            
            return -(prior_ll + likelihood_ll)
        
        # Optimize
        initial_guess = [prior_cl_mean, prior_v_mean]
        bounds = [(prior_cl_mean - 2*prior_cl_var, prior_cl_mean + 2*prior_cl_var),
                 (prior_v_mean - 2*prior_v_var, prior_v_mean + 2*prior_v_var)]
        
        result = optimize.minimize(negative_log_posterior, initial_guess, bounds=bounds)
        
        # Extract results
        optimal_log_cl, optimal_log_v = result.x
        individual_cl = np.exp(optimal_log_cl)
        individual_v = np.exp(optimal_log_v)
        
        # Calculate confidence intervals using Hessian approximation
        try:
            hessian = optimize.approx_fprime(result.x, negative_log_posterior, epsilon=1e-8)
            inv_hessian = np.linalg.inv(hessian.reshape(2, 2))
            
            # 95% CI
            cl_se = np.sqrt(inv_hessian[0, 0])
            v_se = np.sqrt(inv_hessian[1, 1])
            
            cl_ci_lower = np.exp(optimal_log_cl - 1.96 * cl_se)
            cl_ci_upper = np.exp(optimal_log_cl + 1.96 * cl_se)
            v_ci_lower = np.exp(optimal_log_v - 1.96 * v_se)
            v_ci_upper = np.exp(optimal_log_v + 1.96 * v_se)
            
        except:
            # Fallback if Hessian calculation fails
            cl_ci_lower = individual_cl * 0.7
            cl_ci_upper = individual_cl * 1.3
            v_ci_lower = individual_v * 0.8
            v_ci_upper = individual_v * 1.2
        
        # Calculate model fit
        r_squared = self._calculate_r_squared(observations, individual_cl, individual_v)
        
        # Generate prediction curves
        individual_pk_curve = self._generate_individual_curve(individual_cl, individual_v)
        population_pk_curve = self._generate_individual_curve(pop_params['clearance'], pop_params['volume'])
        
        # Calculate predicted AUC with CI
        predicted_auc = 1000 / individual_cl  # Simplified for 1000mg dose
        auc_ci_lower = 1000 / cl_ci_upper
        auc_ci_upper = 1000 / cl_ci_lower
        
        # Calculate predicted trough with CI
        k = individual_cl / individual_v
        predicted_trough = (1000 / individual_v) * np.exp(-k * 12)  # 12h interval example
        trough_ci_lower = predicted_trough * 0.8  # Approximate
        trough_ci_upper = predicted_trough * 1.2
        
        return BayesianResult(
            individual_clearance=individual_cl,
            individual_volume=individual_v,
            clearance_ci_lower=cl_ci_lower,
            clearance_ci_upper=cl_ci_upper,
            volume_ci_lower=v_ci_lower,
            volume_ci_upper=v_ci_upper,
            predicted_auc_ci_lower=auc_ci_lower,
            predicted_auc_ci_upper=auc_ci_upper,
            predicted_trough_ci_lower=trough_ci_lower,
            predicted_trough_ci_upper=trough_ci_upper,
            model_fit_r_squared=r_squared,
            convergence_achieved=result.success,
            iterations_used=result.nit if hasattr(result, 'nit') else 0,
            individual_pk_curve=individual_pk_curve,
            population_pk_curve=population_pk_curve
        )
    
    def _predict_concentration(self, dose: float, time: float, infusion_time: float, cl: float, v: float) -> float:
        """Predict concentration using 1-compartment model"""
        k = cl / v
        
        if time <= infusion_time:
            # During infusion
            conc = (dose / (v * k * infusion_time)) * (1 - np.exp(-k * time))
        else:
            # After infusion
            conc_end_infusion = (dose / (v * k * infusion_time)) * (1 - np.exp(-k * infusion_time))
            conc = conc_end_infusion * np.exp(-k * (time - infusion_time))
        
        return max(conc, 0.0)
    
    def _calculate_r_squared(self, observations: List[Dict], cl: float, v: float) -> float:
        """Calculate R-squared for model fit"""
        observed = [obs['concentration'] for obs in observations]
        predicted = [
            self._predict_concentration(obs['dose'], obs['time'], obs['infusion_time'], cl, v)
            for obs in observations
        ]
        
        if len(observed) < 2:
            return 0.0
        
        # Calculate R-squared
        ss_res = sum((obs - pred)**2 for obs, pred in zip(observed, predicted))
        ss_tot = sum((obs - np.mean(observed))**2 for obs in observed)
        
        return 1 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
    
    def _generate_individual_curve(self, cl: float, v: float) -> List[Dict[str, float]]:
        """Generate individual PK curve for visualization"""
        curve_data = []
        time_points = np.linspace(0, 24, 100)
        dose = 1000  # mg
        interval = 12  # hours
        
        for t in time_points:
            conc = self._predict_concentration(dose, t % interval, 1.0, cl, v)
            curve_data.append({
                'time': float(t),
                'concentration': float(conc)
            })
        
        return curve_data

# Global instances
pk_calculator = VancomycinPKCalculator()
bayesian_optimizer = BayesianOptimizer(pk_calculator)

# WebSocket manager for real-time calculations
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        try:
            await websocket.send_text(message)
        except:
            self.disconnect(websocket)
    
    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                self.disconnect(connection)

manager = ConnectionManager()

# API Endpoints

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/api/calculate-dose", response_model=DoseResponse)
async def calculate_dose_endpoint(request: DoseRequest):
    """Guideline-based dosing using traditional PK equations."""
    patient = request.patient
    crcl = pk.cockcroft_gault(
        patient.age_years,
        patient.weight_kg,
        patient.sex,
        patient.serum_creatinine,
        patient.height_cm,
    )
    k_e = pk.elimination_constant(crcl)
    vd = pk.volume_distribution(patient.weight_kg)
    options, warnings = recommend_regimens(
        weight_kg=patient.weight_kg,
        crcl=crcl,
        serious=patient.serious_infection,
        k_e=k_e,
        vd_l=vd,
    )
    recommended = options[0]
    notes = warnings[:]
    if recommended.auc24 >= 800:
        notes.append("Predicted AUC exceeds 800 mg·h/L; consider dose reduction.")

    regimen_override = request.regimen
    chosen_dose = regimen_override.dose_mg if regimen_override else recommended.dose_mg
    chosen_interval = regimen_override.interval_hr if regimen_override else recommended.interval_hr
    chosen_infusion = regimen_override.infusion_hr if regimen_override else recommended.infusion_hr
    metrics = compute_curve_and_metrics(
        cl_l_hr=k_e * vd,
        v_l=vd,
        dose_mg=chosen_dose,
        interval_hr=chosen_interval,
        infusion_hr=chosen_infusion,
        dt_min=10.0,
    )
    curve = metrics["curve"]

    option_payload: List[Dict[str, float]] = []
    for candidate in options[:5]:
        option_metrics = compute_curve_and_metrics(
            cl_l_hr=k_e * vd,
            v_l=vd,
            dose_mg=candidate.dose_mg,
            interval_hr=candidate.interval_hr,
            infusion_hr=candidate.infusion_hr,
            dt_min=10.0,
        )
        option_payload.append(
            {
                "dose_mg": float(candidate.dose_mg),
                "interval_hr": float(candidate.interval_hr),
                "infusion_hr": float(candidate.infusion_hr),
                "auc24": float(option_metrics["auc24"]),
                "peak": float(option_metrics["peak"]),
                "trough": float(option_metrics["trough"]),
                "daily_dose_mg": float(candidate.daily_dose_mg),
            }
        )

    if regimen_override:
        notes.append(
            f"Regimen override applied: {chosen_dose:.0f} mg q{chosen_interval:g}h (infusion {chosen_infusion:g}h)."
        )
    return DoseResponse(
        loading_dose_mg=recommend_loading_dose(patient.weight_kg, patient.serious_infection),
        maintenance_dose_mg=recommended.dose_mg,
        interval_hours=recommended.interval_hr,
        infusion_hours=recommended.infusion_hr,
        predicted_peak_mg_l=float(metrics["peak"]),
        predicted_trough_mg_l=float(metrics["trough"]),
        predicted_auc_24=float(metrics["auc24"]),
        k_e=k_e,
        vd_l=vd,
        half_life_hours=pk.half_life_hours(k_e),
        crcl_ml_min=crcl,
        method="population_recommender",
        notes=notes,
        concentration_curve=curve,
        regimen_options=option_payload,
        calculation_details={
            "model": "1-compartment IV infusion (first-order elimination)",
            "method": "Deterministic population PK",
            "auc_method": "Trapezoidal (0–24h) from simulated curve",
            "assumptions": "Simulate repeated doses 0–48h at 10-min resolution; peak at end of infusion in last interval; trough just before next dose.",
            "formulas": {
                "cl": "CL = k_e × V",
                "auc": "AUC24 = trapezoid(curve, 0–24h)",
            },
            "peak_time_hr": metrics["peak_time_hr"],
            "trough_time_hr": metrics["trough_time_hr"],
            "dt_min": metrics["dt_min"],
            "parameters": {
                "k_e": k_e,
                "vd_l": vd,
                "cl_l_hr": k_e * vd,
                "half_life_hr": pk.half_life_hours(k_e),
                "crcl_ml_min": crcl,
            },
            "chosen_regimen": {
                "dose_mg": float(chosen_dose),
                "interval_hr": float(chosen_interval),
                "infusion_hr": float(chosen_infusion),
            },
        },
    )


@app.post("/api/basic/calculate", response_model=DoseResponse)
async def basic_calculate_alias(payload: BasicCalculateAlias):
    """Alias for deterministic calculator used by legacy clients."""
    dose_request = DoseRequest(
        patient=PatientInfo(
            age_years=payload.patient.age,
            weight_kg=payload.patient.weight_kg,
            height_cm=payload.patient.height_cm,
            sex=payload.patient.sex,
            serum_creatinine=payload.patient.serum_creatinine,
            serious_infection=False,
        ),
        levels=None,
        regimen=RegimenOverride(
            dose_mg=payload.regimen.dose_mg,
            interval_hr=payload.regimen.interval_hr,
            infusion_hr=payload.regimen.infusion_hr or 1.0,
        ),
    )
    return await calculate_dose_endpoint(dose_request)

# Route alias for trailing slash and legacy callers.
app.add_api_route(
    "/api/basic/calculate/",
    basic_calculate_alias,
    methods=["POST"],
    response_model=DoseResponse,
    include_in_schema=True,
)
app.add_api_route(
    "/api/calculate-dose/",
    calculate_dose_endpoint,
    methods=["POST"],
    response_model=DoseResponse,
    include_in_schema=False,
)

@app.post("/api/bayesian-dose", response_model=DoseResponse)
async def bayesian_dose_endpoint(request: DoseRequest):
    """Bayesian/Sawchuk–Zaske adjustment when levels are available."""
    patient = request.patient
    crcl = pk.cockcroft_gault(
        patient.age_years,
        patient.weight_kg,
        patient.sex,
        patient.serum_creatinine,
        patient.height_cm,
    )

    levels = request.levels or []
    if not levels:
        raise HTTPException(status_code=400, detail="At least one level is required for Bayesian dosing.")

    dose_history = request.dose_history or []
    level_payload = [{"level_mg_l": l.level_mg_l, "time_hours": l.time_hours} for l in levels]
    fallback_ke = pk.elimination_constant(crcl)
    fallback_vd = pk.volume_distribution(patient.weight_kg)

    if dose_history:
        events = [
            Event(dose_mg=d.dose_mg, start_hr=d.start_time_hr, infusion_hr=d.infusion_hr)
            for d in dose_history
        ]
    elif request.regimen:
        max_level = max(l["time_hours"] for l in level_payload)
        interval_hr = float(request.regimen.interval_hr)
        n_doses = int(max(1, (max_level // interval_hr) + 2))
        events = [
            Event(
                dose_mg=float(request.regimen.dose_mg),
                start_hr=float(i * interval_hr),
                infusion_hr=float(request.regimen.infusion_hr or 1.0),
            )
            for i in range(n_doses)
        ]
    else:
        raise HTTPException(status_code=400, detail="Dose history or regimen override is required for Bayesian MAP fitting.")

    levels_for_fit = [(l["time_hours"], l["level_mg_l"]) for l in level_payload]
    cl_mean = fallback_ke * fallback_vd
    cl_map, v_map, samples = bayesian_pk.posterior_samples(events, levels_for_fit, cl_mean, fallback_vd)
    k_e = cl_map / max(v_map, 1e-6)
    vd = v_map
    method = "bayesian_map"

    notes = []
    if method == "bayesian_map":
        notes.append("Bayesian MAP fit using dose history and measured levels.")
    options, warnings = recommend_regimens(
        weight_kg=patient.weight_kg,
        crcl=crcl,
        serious=patient.serious_infection,
        k_e=k_e,
        vd_l=vd,
    )
    recommended = options[0]
    notes.extend(warnings)
    if recommended.auc24 >= 800:
        notes.append("Predicted AUC exceeds 800 mg·h/L; consider dose reduction.")

    regimen_override = request.regimen
    chosen_dose = regimen_override.dose_mg if regimen_override else recommended.dose_mg
    chosen_interval = regimen_override.interval_hr if regimen_override else recommended.interval_hr
    chosen_infusion = regimen_override.infusion_hr if regimen_override else recommended.infusion_hr

    if regimen_override:
        notes.append(
            f"Regimen override applied: {chosen_dose:.0f} mg q{chosen_interval:g}h (infusion {chosen_infusion:g}h)."
        )

    metrics = compute_curve_and_metrics(
        cl_l_hr=k_e * vd,
        v_l=vd,
        dose_mg=chosen_dose,
        interval_hr=chosen_interval,
        infusion_hr=chosen_infusion,
        dt_min=10.0,
    )
    curve = metrics["curve"]

    t, _ = simulate_regimen_0_48h(
        cl_l_hr=k_e * vd,
        v_l=vd,
        dose_mg=chosen_dose,
        interval_hr=chosen_interval,
        infusion_hr=chosen_infusion,
        dt_min=10.0,
    )
    sample_curves = []
    for cl_s, v_s in samples[:120]:
        _, c_s = simulate_regimen_0_48h(
            cl_l_hr=float(cl_s),
            v_l=float(v_s),
            dose_mg=chosen_dose,
            interval_hr=chosen_interval,
            infusion_hr=chosen_infusion,
            dt_min=10.0,
        )
        sample_curves.append(c_s)
    if sample_curves:
        stack = np.vstack(sample_curves)
        lower = np.percentile(stack, 2.5, axis=0)
        upper = np.percentile(stack, 97.5, axis=0)
        curve_ci_low = [{"t_hr": float(tt), "conc_mg_l": float(cc)} for tt, cc in zip(t, lower)]
        curve_ci_high = [{"t_hr": float(tt), "conc_mg_l": float(cc)} for tt, cc in zip(t, upper)]
    else:
        curve_ci_low = None
        curve_ci_high = None

    auc_samples = []
    for cl_s, v_s in samples[:120]:
        k_s = float(cl_s) / max(float(v_s), 1e-6)
        auc_samples.append(pk.calculate_auc_24(chosen_dose, chosen_interval, k_s, float(v_s)))
    auc_ci_low = float(np.percentile(auc_samples, 2.5)) if auc_samples else None
    auc_ci_high = float(np.percentile(auc_samples, 97.5)) if auc_samples else None

    option_payload: List[Dict[str, float]] = []
    for candidate in options[:5]:
        option_metrics = compute_curve_and_metrics(
            cl_l_hr=k_e * vd,
            v_l=vd,
            dose_mg=candidate.dose_mg,
            interval_hr=candidate.interval_hr,
            infusion_hr=candidate.infusion_hr,
            dt_min=10.0,
        )
        option_payload.append(
            {
                "dose_mg": float(candidate.dose_mg),
                "interval_hr": float(candidate.interval_hr),
                "infusion_hr": float(candidate.infusion_hr),
                "auc24": float(option_metrics["auc24"]),
                "peak": float(option_metrics["peak"]),
                "trough": float(option_metrics["trough"]),
                "daily_dose_mg": float(candidate.daily_dose_mg),
            }
        )


    return DoseResponse(
        loading_dose_mg=recommend_loading_dose(patient.weight_kg, patient.serious_infection),
        maintenance_dose_mg=recommended.dose_mg,
        interval_hours=recommended.interval_hr,
        infusion_hours=recommended.infusion_hr,
        predicted_peak_mg_l=float(metrics["peak"]),
        predicted_trough_mg_l=float(metrics["trough"]),
        predicted_auc_24=float(metrics["auc24"]),
        k_e=k_e,
        vd_l=vd,
        half_life_hours=pk.half_life_hours(k_e),
        crcl_ml_min=crcl,
        method=f"{method}_recommender",
        notes=notes,
        concentration_curve=curve,
        auc24_ci_low=auc_ci_low,
        auc24_ci_high=auc_ci_high,
        curve_ci_low=curve_ci_low,
        curve_ci_high=curve_ci_high,
        regimen_options=option_payload,
        calculation_details={
            "model": "1-compartment IV infusion (first-order elimination)",
            "method": "Bayesian MAP fit",
            "auc_method": "Trapezoidal (0–24h) from simulated curve",
            "assumptions": "Simulate repeated doses 0–48h at 10-min resolution; peak at end of infusion in last interval; trough just before next dose.",
            "formulas": {
                "cl": "CL = k_e × V",
                "auc": "AUC24 = trapezoid(curve, 0–24h)",
            },
            "peak_time_hr": metrics["peak_time_hr"],
            "trough_time_hr": metrics["trough_time_hr"],
            "dt_min": metrics["dt_min"],
            "parameters": {
                "k_e": k_e,
                "vd_l": vd,
                "cl_l_hr": k_e * vd,
                "half_life_hr": pk.half_life_hours(k_e),
                "crcl_ml_min": crcl,
            },
            "levels": level_payload,
            "chosen_regimen": {
                "dose_mg": float(chosen_dose),
                "interval_hr": float(chosen_interval),
                "infusion_hr": float(chosen_infusion),
            },
        },
        fit_diagnostics={
            "method": method,
            "level_predictions": [
                {
                    "time_hours": float(t),
                    "observed": float(c),
                    "predicted": float(p),
                    "residual": float(c - p),
                }
                for t, c, p in zip(
                    [lv["time_hours"] for lv in level_payload],
                    [lv["level_mg_l"] for lv in level_payload],
                    bayesian_pk.predict_levels(events, [lv["time_hours"] for lv in level_payload], cl_map, v_map),
                )
            ],
        },
    )

# Route alias for bayesian endpoint with trailing slash
@app.post("/api/bayesian-dose/")
async def bayesian_dose_endpoint_slash(request: DoseRequest):
    return await bayesian_dose_endpoint(request)

@app.post("/api/calculate-dosing", response_model=DosingResult)
async def calculate_dosing(patient: PatientInput):
    """Calculate vancomycin dosing for a patient"""
    try:
        result = pk_calculator.calculate_dosing(patient)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/bayesian-optimization", response_model=BayesianResult)
async def bayesian_optimization(patient: PatientInput, levels: List[VancomycinLevel]):
    """Perform Bayesian optimization using measured vancomycin levels"""
    try:
        result = bayesian_optimizer.optimize_dosing(patient, levels)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/pk-simulation")
async def pk_simulation(patient: PatientInput, dose: float, interval: float):
    """Simulate PK curve for given dose and interval"""
    try:
        pk_params = pk_calculator.calculate_pk_parameters(patient)
        curve_data = pk_calculator._generate_pk_curve(dose, interval, pk_params)
        
        # Calculate key metrics
        predicted_auc = (dose * 24) / (interval * pk_params['clearance'])
        predicted_trough = pk_calculator._calculate_trough(dose, interval, pk_params)
        predicted_peak = pk_calculator._calculate_peak(dose, pk_params)
        
        return {
            'pk_curve': curve_data,
            'predicted_auc': predicted_auc,
            'predicted_trough': predicted_trough,
            'predicted_peak': predicted_peak,
            'pk_parameters': pk_params
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# WebSocket endpoint for real-time calculations
@app.websocket("/ws/realtime-calc")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            request = json.loads(data)
            
            # Parse patient data
            patient = PatientInput(**request['patient'])
            dose = request.get('dose', 1000)
            interval = request.get('interval', 12)
            
            # Calculate real-time
            pk_params = pk_calculator.calculate_pk_parameters(patient)
            curve_data = pk_calculator._generate_pk_curve(dose, interval, pk_params)
            
            predicted_auc = (dose * 24) / (interval * pk_params['clearance'])
            predicted_trough = pk_calculator._calculate_trough(dose, interval, pk_params)
            
            response = {
                'pk_curve': curve_data,
                'predicted_auc': predicted_auc,
                'predicted_trough': predicted_trough,
                'pk_parameters': pk_params,
                'timestamp': datetime.now().isoformat()
            }
            
            await manager.send_personal_message(json.dumps(response), websocket)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
