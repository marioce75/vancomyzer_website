import logging
from fastapi import FastAPI, APIRouter, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Literal
import numpy as np
from scipy import optimize
from scipy.stats import multivariate_normal
import json
import math
import uuid
from datetime import datetime
from enum import Enum

# Configure logging
log = logging.getLogger("vancomyzer")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Vancomyzer API - Vancomycin Calculator Suite",
    description="Evidence-based vancomycin dosing calculator following ASHP/IDSA 2020 guidelines with Trough, AUC-guided, and Bayesian MAP calculations",
    version="3.0.0"
)

# CORS (explicit origins as requested)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://vancomyzer.com",
        "https://www.vancomyzer.com",
        "https://vancomyzer.onrender.com",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Routers
api_router = APIRouter(prefix="/api")
root_router = APIRouter()

# ============================================================================
# DATA MODELS
# ============================================================================

class Gender(str, Enum):
    male = "male"
    female = "female"

class CalculationMode(str, Enum):
    trough = "trough"
    auc_guided = "auc_guided"
    bayesian = "bayesian"

class WeightBasis(str, Enum):
    tbw = "tbw"  # Total Body Weight
    ibw = "ibw"  # Ideal Body Weight  
    adjbw = "adjbw"  # Adjusted Body Weight

class VancomycinLevel(BaseModel):
    concentration_mg_l: float = Field(..., gt=0, le=200, description="Vancomycin concentration in mg/L")
    time_hours: float = Field(..., gt=0, le=72, description="Time after dose start in hours")
    dose_mg: float = Field(..., gt=0, le=4000, description="Dose given in mg")
    infusion_duration_hours: float = Field(1.0, gt=0, le=24, description="Infusion duration in hours")

class PatientData(BaseModel):
    age_years: float = Field(..., gt=0, le=120, description="Age in years")
    gender: Gender
    height_cm: float = Field(..., gt=100, le=250, description="Height in cm")
    weight_kg: float = Field(..., gt=0.5, le=300, description="Weight in kg")
    serum_creatinine_mg_dl: float = Field(..., gt=0.1, le=20, description="Serum creatinine in mg/dL")
    
    # Optional advanced settings
    scr_floor_mg_dl: Optional[float] = Field(0.6, gt=0, le=2, description="Serum creatinine floor")
    use_scr_floor: bool = Field(False, description="Apply serum creatinine floor")
    
    @validator('serum_creatinine_mg_dl')
    def validate_scr(cls, v, values):
        if values.get('use_scr_floor', False):
            floor = values.get('scr_floor_mg_dl', 0.6)
            return max(v, floor)
        return v

class DosingParameters(BaseModel):
    target_auc_min: float = Field(400, gt=0, le=1000, description="Target AUC minimum mg·h/L")
    target_auc_max: float = Field(600, gt=0, le=1000, description="Target AUC maximum mg·h/L")
    mic_mg_l: float = Field(1.0, gt=0, le=16, description="MIC in mg/L")
    dosing_interval_hours: Optional[float] = Field(None, description="Fixed interval or None for auto")
    weight_basis: WeightBasis = Field(WeightBasis.tbw, description="Weight basis for dosing")
    
    # Advanced options
    obesity_adjustment: bool = Field(True, description="Apply obesity adjustment if applicable")
    beta_lactam_allergy: bool = Field(False, description="Beta-lactam allergy")
    icu_setting: bool = Field(False, description="ICU setting")

class CalculatorRequest(BaseModel):
    calculation_mode: CalculationMode
    patient: PatientData
    dosing_params: DosingParameters
    levels: List[VancomycinLevel] = Field(default_factory=list, description="Measured vancomycin levels")

# ============================================================================
# PK CALCULATIONS ENGINE
# ============================================================================

class PKCalculator:
    def __init__(self):
        # Population PK parameters based on literature and ASHP/IDSA 2020
        self.pk_params = {
            'cl_slope': 0.06,  # CrCl coefficient for clearance (L/h per mL/min)
            'cl_intercept': 0.5,  # Base clearance (L/h)
            'vd_per_kg': 0.7,  # Volume of distribution (L/kg)
            'obesity_vd_factor': 0.5,  # Obesity adjustment for Vd (0.5-0.9 L/kg range)
        }
    
    def calculate_anthropometrics(self, patient: PatientData) -> Dict[str, float]:
        """Calculate IBW, AdjBW, BMI, and weight for Cockcroft-Gault"""
        height_inches = patient.height_cm / 2.54
        inches_over_60 = max(0, height_inches - 60)
        
        # Ideal Body Weight (Devine formula)
        if patient.gender == Gender.male:
            ibw_kg = 50 + (2.3 * inches_over_60)
        else:
            ibw_kg = 45.5 + (2.3 * inches_over_60)
        
        # BMI
        bmi = patient.weight_kg / ((patient.height_cm / 100) ** 2)
        
        # Adjusted Body Weight (if TBW >= 120% IBW)
        if patient.weight_kg >= 1.2 * ibw_kg:
            adjbw_kg = ibw_kg + 0.4 * (patient.weight_kg - ibw_kg)
        else:
            adjbw_kg = patient.weight_kg
        
        # Weight for Cockcroft-Gault
        if patient.weight_kg < ibw_kg:
            weight_for_cg = patient.weight_kg
        elif patient.weight_kg >= 1.2 * ibw_kg:
            weight_for_cg = adjbw_kg
        else:
            weight_for_cg = ibw_kg
        
        return {
            'ibw_kg': ibw_kg,
            'adjbw_kg': adjbw_kg,
            'bmi': bmi,
            'weight_for_cg_kg': weight_for_cg
        }
    
    def calculate_creatinine_clearance(self, patient: PatientData, weight_for_cg: float) -> float:
        """Calculate creatinine clearance using Cockcroft-Gault equation"""
        scr = patient.serum_creatinine_mg_dl
        age = patient.age_years
        
        crcl = ((140 - age) * weight_for_cg) / (72 * scr)
        
        if patient.gender == Gender.female:
            crcl *= 0.85
        
        return max(crcl, 10.0)  # Minimum 10 mL/min
    
    def calculate_pk_parameters(self, patient: PatientData, dosing_params: DosingParameters) -> Dict[str, float]:
        """Calculate patient-specific PK parameters"""
        anthropometrics = self.calculate_anthropometrics(patient)
        
        # Select weight basis
        if dosing_params.weight_basis == WeightBasis.ibw:
            weight_for_dosing = anthropometrics['ibw_kg']
        elif dosing_params.weight_basis == WeightBasis.adjbw:
            weight_for_dosing = anthropometrics['adjbw_kg']
        else:  # TBW
            weight_for_dosing = patient.weight_kg
        
        # Creatinine clearance
        crcl_ml_min = self.calculate_creatinine_clearance(patient, anthropometrics['weight_for_cg_kg'])
        
        # Clearance calculation: CL = a + b × CrCl
        clearance_l_h = self.pk_params['cl_intercept'] + (self.pk_params['cl_slope'] * crcl_ml_min)
        
        # Volume of distribution
        vd_per_kg = self.pk_params['vd_per_kg']
        
        # Obesity adjustment if enabled and applicable
        if dosing_params.obesity_adjustment and anthropometrics['bmi'] > 30:
            vd_per_kg = max(0.5, min(0.9, vd_per_kg * (0.5 + 0.4 * (30 / anthropometrics['bmi']))))
        
        volume_l = vd_per_kg * weight_for_dosing
        
        # Derived parameters
        elimination_rate = clearance_l_h / volume_l
        half_life_hours = 0.693 / elimination_rate
        
        return {
            **anthropometrics,
            'weight_for_dosing_kg': weight_for_dosing,
            'crcl_ml_min': crcl_ml_min,
            'clearance_l_h': clearance_l_h,
            'volume_l': volume_l,
            'elimination_rate_h': elimination_rate,
            'half_life_hours': half_life_hours,
            'vd_per_kg_used': vd_per_kg
        }
    
    def suggest_loading_dose(self, patient: PatientData, severe_infection: bool = False) -> Dict[str, Any]:
        """Calculate loading dose suggestion"""
        dose_per_kg = 30 if severe_infection else 25
        raw_dose = patient.weight_kg * dose_per_kg
        max_dose = 3000 if severe_infection else 2500
        
        capped_dose = min(raw_dose, max_dose)
        rounded_dose = round(capped_dose / 250) * 250
        
        return {
            'loading_dose_mg': rounded_dose,
            'raw_dose_mg': raw_dose,
            'dose_per_kg': dose_per_kg,
            'max_dose_mg': max_dose,
            'was_capped': capped_dose < raw_dose,
            'recommendation': f"{rounded_dose} mg IV over ≥{max(1, rounded_dose/1000):.0f} hour(s)"
        }

# ============================================================================
# CALCULATION MODES
# ============================================================================

class TroughCalculator:
    def __init__(self, pk_calc: PKCalculator):
        self.pk_calc = pk_calc
    
    def calculate(self, patient: PatientData, dosing_params: DosingParameters) -> Dict[str, Any]:
        """Legacy trough-based dosing calculations"""
        pk_params = self.pk_calc.calculate_pk_parameters(patient, dosing_params)
        
        # Target trough range (10-20 mg/L per ASHP/IDSA)
        target_trough_min = 10.0
        target_trough_max = 20.0
        target_trough = 15.0  # Midpoint
        
        # Calculate steady-state dose for target trough
        k = pk_params['elimination_rate_h']
        v = pk_params['volume_l']
        
        # Determine optimal interval based on half-life
        if pk_params['half_life_hours'] <= 6:
            interval_hours = 8
        elif pk_params['half_life_hours'] <= 12:
            interval_hours = 12
        else:
            interval_hours = 24
        
        # Calculate dose for target trough (steady-state one-compartment)
        # Cmin = (Dose/V) * exp(-k*1) / (1 - exp(-k*tau))
        # Rearranging: Dose = Cmin * V * (1 - exp(-k*tau)) / exp(-k*1)
        infusion_time = 1.0  # hours
        exp_k_tau = np.exp(-k * interval_hours)
        exp_k_infusion = np.exp(-k * infusion_time)
        
        dose_mg = target_trough * v * (1 - exp_k_tau) / exp_k_infusion
        
        # Round dose to practical increments
        if dose_mg < 500:
            dose_mg = round(dose_mg / 125) * 125
        elif dose_mg < 1500:
            dose_mg = round(dose_mg / 250) * 250
        else:
            dose_mg = round(dose_mg / 500) * 500
        
        # Calculate predicted metrics
        predicted_trough = dose_mg * exp_k_infusion / (v * (1 - exp_k_tau))
        predicted_peak = (dose_mg / v) * (1 - exp_k_infusion) / (1 - exp_k_tau)
        
        # Daily dose and AUC estimation
        daily_dose_mg = dose_mg * (24 / interval_hours)
        predicted_auc_24 = daily_dose_mg / pk_params['clearance_l_h']
        
        return {
            'calculation_method': 'Trough-based (Legacy)',
            'recommended_dose_mg': dose_mg,
            'interval_hours': interval_hours,
            'daily_dose_mg': daily_dose_mg,
            'predicted_trough_mg_l': predicted_trough,
            'predicted_peak_mg_l': predicted_peak,
            'predicted_auc_24': predicted_auc_24,
            'target_trough_range': f"{target_trough_min}-{target_trough_max} mg/L",
            'pk_parameters': pk_params,
            'rationale': f"Dose calculated for target trough of {target_trough} mg/L using steady-state one-compartment model"
        }

class AUCGuidedCalculator:
    def __init__(self, pk_calc: PKCalculator):
        self.pk_calc = pk_calc
    
    def calculate_steady_state_auc(self, patient: PatientData, dosing_params: DosingParameters) -> Dict[str, Any]:
        """AUC-guided dosing using steady-state shortcut method"""
        pk_params = self.pk_calc.calculate_pk_parameters(patient, dosing_params)
        
        # Target AUC range
        target_auc_center = (dosing_params.target_auc_min + dosing_params.target_auc_max) / 2
        
        # Calculate required daily dose: Daily Dose = Target AUC × Clearance
        required_daily_dose = target_auc_center * pk_params['clearance_l_h']
        
        # Determine optimal interval
        if dosing_params.dosing_interval_hours:
            interval_hours = dosing_params.dosing_interval_hours
        else:
            # Auto-select based on half-life
            if pk_params['half_life_hours'] <= 6:
                interval_hours = 8
            elif pk_params['half_life_hours'] <= 12:
                interval_hours = 12
            else:
                interval_hours = 24
        
        # Calculate dose per interval
        dose_per_interval = required_daily_dose * (interval_hours / 24)
        
        # Round to practical doses
        if dose_per_interval < 500:
            dose_per_interval = round(dose_per_interval / 125) * 125
        elif dose_per_interval < 1500:
            dose_per_interval = round(dose_per_interval / 250) * 250
        else:
            dose_per_interval = round(dose_per_interval / 500) * 500
        
        # Recalculate actual daily dose and AUC
        actual_daily_dose = dose_per_interval * (24 / interval_hours)
        predicted_auc_24 = actual_daily_dose / pk_params['clearance_l_h']
        
        # Calculate peak and trough estimates (simplified steady-state)
        k = pk_params['elimination_rate_h']
        v = pk_params['volume_l']
        infusion_time = max(1.0, dose_per_interval / 1000)  # ≥1h per 1g rule
        
        # Peak (end of infusion)
        predicted_peak = (dose_per_interval / v) * (1 - np.exp(-k * infusion_time)) / (1 - np.exp(-k * interval_hours))
        
        # Trough (just before next dose)
        predicted_trough = predicted_peak * np.exp(-k * (interval_hours - infusion_time))
        
        # AUC/MIC ratio
        auc_mic_ratio = predicted_auc_24 / dosing_params.mic_mg_l
        
        return {
            'calculation_method': 'AUC-guided (Steady-state)',
            'recommended_dose_mg': dose_per_interval,
            'interval_hours': interval_hours,
            'infusion_duration_hours': infusion_time,
            'daily_dose_mg': actual_daily_dose,
            'predicted_auc_24': predicted_auc_24,
            'predicted_peak_mg_l': predicted_peak,
            'predicted_trough_mg_l': predicted_trough,
            'auc_mic_ratio': auc_mic_ratio,
            'target_auc_range': f"{dosing_params.target_auc_min}-{dosing_params.target_auc_max} mg·h/L",
            'pk_parameters': pk_params,
            'formula_used': f"AUC₂₄ = Daily Dose ÷ Clearance = {actual_daily_dose:.0f} ÷ {pk_params['clearance_l_h']:.2f} = {predicted_auc_24:.0f} mg·h/L",
            'rationale': f"Dose optimized for target AUC of {target_auc_center:.0f} mg·h/L"
        }
    
    def calculate_two_level_auc(self, patient: PatientData, dosing_params: DosingParameters, levels: List[VancomycinLevel]) -> Dict[str, Any]:
        """Two-level trapezoid method for AUC calculation"""
        if len(levels) < 2:
            raise ValueError("Two-level method requires at least 2 measured levels")
        
        # Sort levels by time
        sorted_levels = sorted(levels, key=lambda x: x.time_hours)
        level1, level2 = sorted_levels[0], sorted_levels[1]
        
        # Calculate elimination rate constant from two levels
        delta_t = level2.time_hours - level1.time_hours
        if delta_t <= 0:
            raise ValueError("Time difference between levels must be positive")
        
        # Ensure both levels are post-distribution (typically >1h after infusion end)
        if level1.time_hours < 1.0:
            raise ValueError("First level should be drawn >1h after infusion end")
        
        # Calculate k from log-linear decline: C2 = C1 * exp(-k * Δt)
        k_empirical = -np.log(level2.concentration_mg_l / level1.concentration_mg_l) / delta_t
        
        # Calculate AUC using trapezoid rule between the two levels
        auc_between_levels = 0.5 * (level1.concentration_mg_l + level2.concentration_mg_l) * delta_t
        
        # Extrapolate to get AUC for full dosing interval
        # This is simplified - in practice would need more sophisticated extrapolation
        pk_params = self.pk_calc.calculate_pk_parameters(patient, dosing_params)
        
        # Estimate dose interval from levels context or use 12h default
        dose_interval = 12.0  # Could be inferred from dosing history
        
        # Calculate total AUC for the interval (simplified approach)
        # Full implementation would require dose history and proper superposition
        total_auc_interval = auc_between_levels * (dose_interval / delta_t)  # Rough approximation
        
        # Convert to AUC24
        predicted_auc_24 = total_auc_interval * (24 / dose_interval)
        
        # Back-calculate individual clearance
        dose_mg = level1.dose_mg  # Assuming same dose
        daily_dose = dose_mg * (24 / dose_interval)
        individual_clearance = daily_dose / predicted_auc_24
        
        return {
            'calculation_method': 'AUC-guided (Two-level trapezoid)',
            'empirical_elimination_rate': k_empirical,
            'empirical_half_life_hours': 0.693 / k_empirical,
            'individual_clearance_l_h': individual_clearance,
            'predicted_auc_24': predicted_auc_24,
            'auc_between_levels': auc_between_levels,
            'levels_used': [
                {'time_h': level1.time_hours, 'conc_mg_l': level1.concentration_mg_l},
                {'time_h': level2.time_hours, 'conc_mg_l': level2.concentration_mg_l}
            ],
            'pk_parameters': pk_params,
            'rationale': f"AUC calculated from empirical elimination rate (k={k_empirical:.4f} h⁻¹) using trapezoid method"
        }

class BayesianCalculator:
    def __init__(self, pk_calc: PKCalculator):
        self.pk_calc = pk_calc
    
    def calculate(self, patient: PatientData, dosing_params: DosingParameters, levels: List[VancomycinLevel]) -> Dict[str, Any]:
        """Bayesian MAP estimation - simplified implementation"""
        if len(levels) == 0:
            raise ValueError("Bayesian optimization requires at least one measured level")
        
        pk_params = self.pk_calc.calculate_pk_parameters(patient, dosing_params)
        
        # Prior parameters (log-normal distributions)
        prior_cl_mean = np.log(pk_params['clearance_l_h'])
        prior_cl_var = 0.3**2  # 30% CV
        prior_v_mean = np.log(pk_params['volume_l'])
        prior_v_var = 0.2**2   # 20% CV
        
        # Observation data
        observed_times = np.array([level.time_hours for level in levels])
        observed_concs = np.array([level.concentration_mg_l for level in levels])
        
        # MAP estimation using optimization
        def negative_log_posterior(params):
            log_cl, log_v = params
            cl = np.exp(log_cl)
            v = np.exp(log_v)
            
            # Prior contribution
            prior_ll = -0.5 * ((log_cl - prior_cl_mean)**2 / prior_cl_var + 
                              (log_v - prior_v_mean)**2 / prior_v_var)
            
            # Likelihood contribution (simplified one-compartment model)
            likelihood_ll = 0
            residual_var = 0.1  # 10% CV residual error
            
            for i, (time, obs_conc) in enumerate(zip(observed_times, observed_concs)):
                # Simplified prediction - would need full PK model in practice
                dose = levels[i].dose_mg
                infusion_time = levels[i].infusion_duration_hours
                
                # One-compartment prediction after infusion
                k = cl / v
                if time <= infusion_time:
                    pred_conc = (dose / (v * k * infusion_time)) * (1 - np.exp(-k * time))
                else:
                    conc_end_infusion = (dose / (v * k * infusion_time)) * (1 - np.exp(-k * infusion_time))
                    pred_conc = conc_end_infusion * np.exp(-k * (time - infusion_time))
                
                # Log-normal likelihood
                likelihood_ll -= 0.5 * ((np.log(obs_conc) - np.log(max(pred_conc, 0.1)))**2) / residual_var
            
            return -(prior_ll + likelihood_ll)
        
        # Optimize to find MAP estimates
        initial_guess = [prior_cl_mean, prior_v_mean]
        bounds = [(prior_cl_mean - 3*np.sqrt(prior_cl_var), prior_cl_mean + 3*np.sqrt(prior_cl_var)),
                 (prior_v_mean - 3*np.sqrt(prior_v_var), prior_v_mean + 3*np.sqrt(prior_v_var))]
        
        try:
            result = optimize.minimize(negative_log_posterior, initial_guess, bounds=bounds, method='L-BFGS-B')
            optimal_log_cl, optimal_log_v = result.x
            individual_cl = np.exp(optimal_log_cl)
            individual_v = np.exp(optimal_log_v)
            convergence_achieved = result.success
        except:
            # Fallback to population estimates if optimization fails
            individual_cl = pk_params['clearance_l_h']
            individual_v = pk_params['volume_l']
            convergence_achieved = False
        
        # Calculate predictions with individual parameters
        individual_k = individual_cl / individual_v
        individual_half_life = 0.693 / individual_k
        
        # Target AUC achievement
        target_auc_center = (dosing_params.target_auc_min + dosing_params.target_auc_max) / 2
        required_daily_dose = target_auc_center * individual_cl
        
        # Optimal interval selection
        if individual_half_life <= 6:
            optimal_interval = 8
        elif individual_half_life <= 12:
            optimal_interval = 12
        else:
            optimal_interval = 24
        
        optimal_dose = required_daily_dose * (optimal_interval / 24)
        optimal_dose = round(optimal_dose / 250) * 250  # Round to 250mg increments
        
        # Predicted metrics
        actual_daily_dose = optimal_dose * (24 / optimal_interval)
        predicted_auc_24 = actual_daily_dose / individual_cl
        
        # Confidence intervals (simplified using asymptotic approximation)
        cl_ci_lower = individual_cl * 0.7
        cl_ci_upper = individual_cl * 1.3
        auc_ci_lower = actual_daily_dose / cl_ci_upper
        auc_ci_upper = actual_daily_dose / cl_ci_lower
        
        return {
            'calculation_method': 'Bayesian MAP',
            'individual_clearance_l_h': individual_cl,
            'individual_volume_l': individual_v,
            'individual_half_life_hours': individual_half_life,
            'clearance_ci_lower': cl_ci_lower,
            'clearance_ci_upper': cl_ci_upper,
            'convergence_achieved': convergence_achieved,
            'recommended_dose_mg': optimal_dose,
            'interval_hours': optimal_interval,
            'daily_dose_mg': actual_daily_dose,
            'predicted_auc_24': predicted_auc_24,
            'auc_ci_lower': auc_ci_lower,
            'auc_ci_upper': auc_ci_upper,
            'population_parameters': pk_params,
            'levels_used': len(levels),
            'rationale': f"Individual parameters estimated from {len(levels)} level(s) using Bayesian MAP optimization"
        }

# ============================================================================
# GLOBAL INSTANCES
# ============================================================================

pk_calculator = PKCalculator()
trough_calc = TroughCalculator(pk_calculator)
auc_calc = AUCGuidedCalculator(pk_calculator)
bayesian_calc = BayesianCalculator(pk_calculator)

# ============================================================================
# API ENDPOINTS
# ============================================================================

@api_router.get("/health")
async def health_api():
    return {"status": "ok", "message": "Vancomyzer Calculator Suite API"}

@api_router.post("/calculate")
async def calculate_vancomycin_dosing(request: CalculatorRequest = Body(...)):
    """Main endpoint for vancomycin dosing calculations"""
    try:
        log.info(f"Calculation request: {request.calculation_mode.value}")
        
        # Input validation
        if request.calculation_mode == CalculationMode.bayesian and len(request.levels) == 0:
            raise HTTPException(status_code=422, detail="Bayesian calculation requires at least one measured level")
        
        if request.calculation_mode == CalculationMode.auc_guided and len(request.levels) >= 2:
            # Use two-level method if available
            result = auc_calc.calculate_two_level_auc(request.patient, request.dosing_params, request.levels)
        elif request.calculation_mode == CalculationMode.auc_guided:
            # Use steady-state method
            result = auc_calc.calculate_steady_state_auc(request.patient, request.dosing_params)
        elif request.calculation_mode == CalculationMode.trough:
            result = trough_calc.calculate(request.patient, request.dosing_params)
        elif request.calculation_mode == CalculationMode.bayesian:
            result = bayesian_calc.calculate(request.patient, request.dosing_params, request.levels)
        else:
            raise HTTPException(status_code=400, detail="Invalid calculation mode")
        
        # Add loading dose suggestion
        loading_dose = pk_calculator.suggest_loading_dose(
            request.patient, 
            severe_infection=request.dosing_params.icu_setting
        )
        result['loading_dose'] = loading_dose
        
        # Add safety warnings and monitoring recommendations
        result['safety_warnings'] = generate_safety_warnings(result, request.patient, request.dosing_params)
        result['monitoring_recommendations'] = generate_monitoring_recommendations(result, request.patient)
        result['citations'] = get_citations()
        
        return {"ok": True, "result": result}
        
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        log.exception("Calculation failed")
        raise HTTPException(status_code=400, detail=str(e))

def generate_safety_warnings(result: Dict[str, Any], patient: PatientData, dosing_params: DosingParameters) -> List[str]:
    """Generate safety warnings based on results"""
    warnings = []
    
    predicted_auc = result.get('predicted_auc_24', 0)
    predicted_trough = result.get('predicted_trough_mg_l', 0)
    predicted_peak = result.get('predicted_peak_mg_l', 0)
    
    if predicted_auc > 600:
        warnings.append("⚠️ Predicted AUC >600 mg·h/L increases nephrotoxicity risk")
    
    if predicted_trough > 20:
        warnings.append("⚠️ Predicted trough >20 mg/L - consider dose reduction")
    
    if predicted_peak > 40:
        warnings.append("⚠️ Predicted peak >40 mg/L - consider longer infusion duration")
    
    if patient.age_years > 65 and predicted_auc > 550:
        warnings.append("⚠️ Elderly patient with elevated AUC - enhanced monitoring recommended")
    
    if patient.serum_creatinine_mg_dl > 1.5:
        warnings.append("⚠️ Elevated creatinine - monitor renal function closely")
    
    if dosing_params.beta_lactam_allergy and dosing_params.icu_setting:
        warnings.append("⚠️ High-risk patient profile - consider infectious disease consultation")
    
    return warnings

def generate_monitoring_recommendations(result: Dict[str, Any], patient: PatientData) -> List[str]:
    """Generate monitoring recommendations"""
    recommendations = []
    
    interval = result.get('interval_hours', 12)
    
    recommendations.append("📊 Obtain levels before 4th dose (steady state achieved)")
    recommendations.append("🩸 Trough: draw 30 minutes before next dose")
    
    if interval <= 8:
        recommendations.append("🔬 Peak: draw 1-2 hours after infusion end")
    
    recommendations.append("🧪 Monitor SCr and BUN every 2-3 days")
    recommendations.append("👂 Assess hearing if therapy >7 days")
    
    if patient.age_years > 65:
        recommendations.append("👴 Enhanced monitoring for elderly patient")
    
    return recommendations

def get_citations() -> List[Dict[str, str]]:
    """Get reference citations"""
    return [
        {
            "key": "ASHP_IDSA_2020",
            "title": "ASHP/IDSA/SIDP 2020 Vancomycin Therapeutic Guidelines",
            "short": "ASHP/IDSA 2020"
        },
        {
            "key": "Rybak_2020", 
            "title": "Therapeutic monitoring of vancomycin for serious MRSA infections",
            "short": "Rybak et al. 2020"
        }
    ]

# Root aliases
@root_router.get("/health")
async def health_root():
    return await health_api()

# Include routers
app.include_router(api_router)
app.include_router(root_router)

# Startup event
@app.on_event("startup")
async def startup_event():
    log.info("Vancomyzer Calculator Suite API started")
    log.info("Available calculation modes: Trough, AUC-guided, Bayesian MAP")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)