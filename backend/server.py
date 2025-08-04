from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
import numpy as np
from scipy import optimize
from scipy.stats import multivariate_normal
import json
import math
import uuid
from datetime import datetime
from enum import Enum

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
app.mount("/static", StaticFiles(directory="static"), name="static")

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
@app.get("/")
async def root():
    return {"message": "Vancomyzer API - Evidence-based vancomycin dosing calculator"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

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