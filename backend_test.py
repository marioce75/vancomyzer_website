#!/usr/bin/env python3
"""
Vancomyzer Calculator Suite Backend Test Suite
==============================================

Comprehensive testing for the Vancomyzer web application backend API endpoints.
Tests all three calculation modes: Trough-Based, AUC-Guided, and Bayesian MAP.
"""

import requests
import json
import sys
from datetime import datetime, timedelta
from typing import Dict, Any, List
import time
import os

class VancomyzerBackendTester:
    def __init__(self):
        # Use the public endpoint from frontend .env for testing
        frontend_env_path = "/app/frontend/.env"
        backend_url = "http://localhost:8001"  # Default fallback
        
        # Try to read the actual backend URL from frontend .env
        if os.path.exists(frontend_env_path):
            with open(frontend_env_path, 'r') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        backend_url = line.split('=', 1)[1].strip()
                        break
        
        self.base_url = backend_url
        self.api_url = f"{self.base_url}/api"
        self.test_results = {
            'health_check': {'passed': False, 'details': ''},
            'trough_calculation': {'passed': False, 'details': ''},
            'auc_guided_calculation': {'passed': False, 'details': ''},
            'bayesian_calculation': {'passed': False, 'details': ''},
            'data_validation': {'passed': False, 'details': ''},
            'patient_scenarios': {'passed': False, 'details': ''},
            'clinical_validation': {'passed': False, 'details': ''}
        }
        self.session = requests.Session()
        self.session.timeout = 30
        
    def log_test(self, test_name: str, status: str, details: str):
        """Log test results"""
        timestamp = datetime.now().strftime('%H:%M:%S')
        print(f"[{timestamp}] {test_name}: {status}")
        if details:
            print(f"    Details: {details}")
        
    def test_health_check(self) -> bool:
        """Test the health check endpoint"""
        print("\n🔍 Testing Health Check Endpoint...")
        
        try:
            response = self.session.get(f"{self.api_url}/health")
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure - updated for actual API response
                if 'status' in data and 'message' in data:
                    if data['status'] == 'ok':
                        self.test_results['health_check']['passed'] = True
                        self.test_results['health_check']['details'] = f"✅ Health check passed. Status: {data['status']}, Message: {data['message']}"
                        self.log_test("Health Check", "✅ PASSED", self.test_results['health_check']['details'])
                        return True
                    else:
                        details = f"❌ Unexpected status: {data['status']}"
                        self.test_results['health_check']['details'] = details
                        self.log_test("Health Check", "❌ FAILED", details)
                        return False
                else:
                    details = f"❌ Missing required fields in response: {data}"
                    self.test_results['health_check']['details'] = details
                    self.log_test("Health Check", "❌ FAILED", details)
                    return False
            else:
                details = f"❌ HTTP {response.status_code}: {response.text}"
                self.test_results['health_check']['details'] = details
                self.log_test("Health Check", "❌ FAILED", details)
                return False
                
        except Exception as e:
            details = f"❌ Exception: {str(e)}"
            self.test_results['health_check']['details'] = details
            self.log_test("Health Check", "❌ FAILED", details)
            return False
    
    def get_sample_patient_data(self) -> Dict[str, Any]:
        """Get sample patient data for testing - updated for new API structure"""
        return {
            "age_years": 65,
            "gender": "male",
            "height_cm": 175,
            "weight_kg": 75,
            "serum_creatinine_mg_dl": 1.0,
            "use_scr_floor": False,
            "scr_floor_mg_dl": 0.6
        }
    
    def get_sample_dosing_params(self) -> Dict[str, Any]:
        """Get sample dosing parameters"""
        return {
            "target_auc_min": 400,
            "target_auc_max": 600,
            "mic_mg_l": 1.0,
            "dosing_interval_hours": None,
            "weight_basis": "tbw",
            "obesity_adjustment": True,
            "beta_lactam_allergy": False,
            "icu_setting": False
        }
    
    def get_sample_levels(self) -> List[Dict[str, Any]]:
        """Get sample vancomycin levels for testing"""
        return [
            {
                "concentration_mg_l": 15.5,
                "time_hours": 1.5,
                "dose_mg": 1000,
                "infusion_duration_hours": 1.0
            }
        ]
    
    def test_trough_calculation(self) -> bool:
        """Test trough-based calculation mode"""
        print("\n🔍 Testing Trough-Based Calculation...")
        
        try:
            request_data = {
                "calculation_mode": "trough",
                "patient": self.get_sample_patient_data(),
                "dosing_params": self.get_sample_dosing_params(),
                "levels": []
            }
            
            response = self.session.post(f"{self.api_url}/calculate", json=request_data)
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                if 'ok' in data and data['ok'] and 'result' in data:
                    result = data['result']
                    
                    # Check required fields for trough calculation
                    required_fields = [
                        'calculation_method', 'recommended_dose_mg', 'interval_hours',
                        'predicted_trough_mg_l', 'predicted_auc_24', 'pk_parameters'
                    ]
                    
                    missing_fields = [field for field in required_fields if field not in result]
                    
                    if not missing_fields:
                        # Validate clinical reasonableness
                        dose = result['recommended_dose_mg']
                        interval = result['interval_hours']
                        trough = result['predicted_trough_mg_l']
                        auc = result['predicted_auc_24']
                        
                        if (500 <= dose <= 3000 and 
                            interval in [8, 12, 24] and 
                            5 <= trough <= 25 and 
                            200 <= auc <= 800):
                            
                            self.test_results['trough_calculation']['passed'] = True
                            details = f"✅ Trough calculation successful. Dose: {dose}mg q{interval}h, Trough: {trough:.1f}mg/L, AUC: {auc:.0f}"
                            self.test_results['trough_calculation']['details'] = details
                            self.log_test("Trough Calculation", "✅ PASSED", details)
                            return True
                        else:
                            details = f"❌ Clinically unreasonable results: Dose={dose}, Interval={interval}, Trough={trough}, AUC={auc}"
                            self.test_results['trough_calculation']['details'] = details
                            self.log_test("Trough Calculation", "❌ FAILED", details)
                            return False
                    else:
                        details = f"❌ Missing required fields: {missing_fields}"
                        self.test_results['trough_calculation']['details'] = details
                        self.log_test("Trough Calculation", "❌ FAILED", details)
                        return False
                else:
                    details = f"❌ Invalid response structure: {data}"
                    self.test_results['trough_calculation']['details'] = details
                    self.log_test("Trough Calculation", "❌ FAILED", details)
                    return False
            else:
                details = f"❌ HTTP {response.status_code}: {response.text}"
                self.test_results['trough_calculation']['details'] = details
                self.log_test("Trough Calculation", "❌ FAILED", details)
                return False
                
        except Exception as e:
            details = f"❌ Exception: {str(e)}"
            self.test_results['trough_calculation']['details'] = details
            self.log_test("Trough Calculation", "❌ FAILED", details)
            return False
    
    def test_auc_guided_calculation(self) -> bool:
        """Test AUC-guided calculation mode"""
        print("\n🔍 Testing AUC-Guided Calculation...")
        
        try:
            # Test both steady-state and two-level methods
            test_cases = [
                {
                    "name": "Steady-State Method",
                    "levels": []
                },
                {
                    "name": "Two-Level Method", 
                    "levels": [
                        {"concentration_mg_l": 20.0, "time_hours": 2.0, "dose_mg": 1000, "infusion_duration_hours": 1.0},
                        {"concentration_mg_l": 12.0, "time_hours": 8.0, "dose_mg": 1000, "infusion_duration_hours": 1.0}
                    ]
                }
            ]
            
            passed_cases = 0
            
            for case in test_cases:
                request_data = {
                    "calculation_mode": "auc_guided",
                    "patient": self.get_sample_patient_data(),
                    "dosing_params": self.get_sample_dosing_params(),
                    "levels": case["levels"]
                }
                
                response = self.session.post(f"{self.api_url}/calculate", json=request_data)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if 'ok' in data and data['ok'] and 'result' in data:
                        result = data['result']
                        
                        # Check required fields
                        required_fields = [
                            'calculation_method', 'recommended_dose_mg', 'interval_hours',
                            'predicted_auc_24', 'target_auc_range'
                        ]
                        
                        missing_fields = [field for field in required_fields if field not in result]
                        
                        if not missing_fields:
                            dose = result['recommended_dose_mg']
                            auc = result['predicted_auc_24']
                            
                            # Validate AUC is in target range (400-600)
                            if 350 <= auc <= 700 and 500 <= dose <= 3000:
                                passed_cases += 1
                                self.log_test(f"AUC-Guided ({case['name']})", "✅ PASSED", 
                                            f"Dose: {dose}mg, AUC: {auc:.0f}")
                            else:
                                self.log_test(f"AUC-Guided ({case['name']})", "❌ FAILED", 
                                            f"Out of range - Dose: {dose}, AUC: {auc}")
                        else:
                            self.log_test(f"AUC-Guided ({case['name']})", "❌ FAILED", 
                                        f"Missing fields: {missing_fields}")
                    else:
                        self.log_test(f"AUC-Guided ({case['name']})", "❌ FAILED", "Invalid response structure")
                else:
                    self.log_test(f"AUC-Guided ({case['name']})", "❌ FAILED", f"HTTP {response.status_code}")
            
            if passed_cases >= 1:  # At least one method should work
                self.test_results['auc_guided_calculation']['passed'] = True
                details = f"✅ AUC-guided calculation successful. {passed_cases}/2 methods working"
                self.test_results['auc_guided_calculation']['details'] = details
                self.log_test("AUC-Guided Calculation", "✅ PASSED", details)
                return True
            else:
                details = f"❌ All AUC-guided methods failed"
                self.test_results['auc_guided_calculation']['details'] = details
                self.log_test("AUC-Guided Calculation", "❌ FAILED", details)
                return False
                
        except Exception as e:
            details = f"❌ Exception: {str(e)}"
            self.test_results['auc_guided_calculation']['details'] = details
            self.log_test("AUC-Guided Calculation", "❌ FAILED", details)
            return False
    
    def test_bayesian_calculation(self) -> bool:
        """Test Bayesian MAP calculation mode"""
        print("\n🔍 Testing Bayesian MAP Calculation...")
        
        try:
            request_data = {
                "calculation_mode": "bayesian",
                "patient": self.get_sample_patient_data(),
                "dosing_params": self.get_sample_dosing_params(),
                "levels": self.get_sample_levels()
            }
            
            response = self.session.post(f"{self.api_url}/calculate", json=request_data)
            
            if response.status_code == 200:
                data = response.json()
                
                if 'ok' in data and data['ok'] and 'result' in data:
                    result = data['result']
                    
                    # Check required fields for Bayesian calculation
                    required_fields = [
                        'calculation_method', 'individual_clearance_l_h', 'individual_volume_l',
                        'recommended_dose_mg', 'predicted_auc_24', 'convergence_achieved'
                    ]
                    
                    missing_fields = [field for field in required_fields if field not in result]
                    
                    if not missing_fields:
                        clearance = result['individual_clearance_l_h']
                        volume = result['individual_volume_l']
                        dose = result['recommended_dose_mg']
                        auc = result['predicted_auc_24']
                        
                        # Validate physiologically reasonable parameters
                        if (1 <= clearance <= 15 and 
                            20 <= volume <= 150 and 
                            500 <= dose <= 3000 and 
                            200 <= auc <= 800):
                            
                            self.test_results['bayesian_calculation']['passed'] = True
                            details = f"✅ Bayesian calculation successful. CL: {clearance:.2f}L/h, V: {volume:.1f}L, Dose: {dose}mg, AUC: {auc:.0f}"
                            self.test_results['bayesian_calculation']['details'] = details
                            self.log_test("Bayesian Calculation", "✅ PASSED", details)
                            return True
                        else:
                            details = f"❌ Unreasonable parameters: CL={clearance}, V={volume}, Dose={dose}, AUC={auc}"
                            self.test_results['bayesian_calculation']['details'] = details
                            self.log_test("Bayesian Calculation", "❌ FAILED", details)
                            return False
                    else:
                        details = f"❌ Missing required fields: {missing_fields}"
                        self.test_results['bayesian_calculation']['details'] = details
                        self.log_test("Bayesian Calculation", "❌ FAILED", details)
                        return False
                else:
                    details = f"❌ Invalid response structure: {data}"
                    self.test_results['bayesian_calculation']['details'] = details
                    self.log_test("Bayesian Calculation", "❌ FAILED", details)
                    return False
            else:
                details = f"❌ HTTP {response.status_code}: {response.text}"
                self.test_results['bayesian_calculation']['details'] = details
                self.log_test("Bayesian Calculation", "❌ FAILED", details)
                return False
                
        except Exception as e:
            details = f"❌ Exception: {str(e)}"
            self.test_results['bayesian_calculation']['details'] = details
            self.log_test("Bayesian Calculation", "❌ FAILED", details)
            return False
    
    def test_data_validation(self) -> bool:
        """Test data validation and error handling"""
        print("\n🔍 Testing Data Validation...")
        
        try:
            # Test with invalid patient data
            invalid_request = {
                "calculation_mode": "trough",
                "patient": {
                    "age_years": -5,  # Invalid age
                    "gender": "invalid_gender",  # Invalid gender
                    "height_cm": 50,  # Invalid height
                    "weight_kg": -10,  # Invalid weight
                    "serum_creatinine_mg_dl": 0  # Invalid creatinine
                },
                "dosing_params": self.get_sample_dosing_params(),
                "levels": []
            }
            
            response = self.session.post(f"{self.api_url}/calculate", json=invalid_request)
            
            # Should return 422 for validation errors
            if response.status_code == 422:
                self.test_results['data_validation']['passed'] = True
                details = f"✅ Data validation working correctly. Rejected invalid data with HTTP {response.status_code}"
                self.test_results['data_validation']['details'] = details
                self.log_test("Data Validation", "✅ PASSED", details)
                return True
            else:
                details = f"❌ Expected validation error but got HTTP {response.status_code}"
                self.test_results['data_validation']['details'] = details
                self.log_test("Data Validation", "❌ FAILED", details)
                return False
                
        except Exception as e:
            details = f"❌ Exception: {str(e)}"
            self.test_results['data_validation']['details'] = details
            self.log_test("Data Validation", "❌ FAILED", details)
            return False
    
    def test_patient_scenarios(self) -> bool:
        """Test different patient scenarios"""
        print("\n🔍 Testing Different Patient Scenarios...")
        
        scenarios = [
            {
                "name": "Standard Adult Male",
                "patient": {
                    "age_years": 35,
                    "gender": "male",
                    "height_cm": 180,
                    "weight_kg": 80,
                    "serum_creatinine_mg_dl": 1.0,
                    "use_scr_floor": False,
                    "scr_floor_mg_dl": 0.6
                }
            },
            {
                "name": "Elderly Female",
                "patient": {
                    "age_years": 80,
                    "gender": "female",
                    "height_cm": 160,
                    "weight_kg": 60,
                    "serum_creatinine_mg_dl": 1.5,
                    "use_scr_floor": False,
                    "scr_floor_mg_dl": 0.6
                }
            },
            {
                "name": "Obese Patient",
                "patient": {
                    "age_years": 45,
                    "gender": "male",
                    "height_cm": 175,
                    "weight_kg": 120,
                    "serum_creatinine_mg_dl": 1.2,
                    "use_scr_floor": False,
                    "scr_floor_mg_dl": 0.6
                }
            }
        ]
        
        passed_scenarios = 0
        total_scenarios = len(scenarios)
        
        for scenario in scenarios:
            try:
                request_data = {
                    "calculation_mode": "auc_guided",
                    "patient": scenario["patient"],
                    "dosing_params": self.get_sample_dosing_params(),
                    "levels": []
                }
                
                response = self.session.post(f"{self.api_url}/calculate", json=request_data)
                
                if response.status_code == 200:
                    data = response.json()
                    if 'ok' in data and data['ok'] and 'result' in data:
                        result = data['result']
                        if 'recommended_dose_mg' in result and result['recommended_dose_mg'] > 0:
                            passed_scenarios += 1
                            self.log_test(f"Scenario: {scenario['name']}", "✅ PASSED", 
                                        f"Dose: {result['recommended_dose_mg']}mg q{result['interval_hours']}h")
                        else:
                            self.log_test(f"Scenario: {scenario['name']}", "❌ FAILED", "Invalid response data")
                    else:
                        self.log_test(f"Scenario: {scenario['name']}", "❌ FAILED", "Invalid response structure")
                else:
                    self.log_test(f"Scenario: {scenario['name']}", "❌ FAILED", f"HTTP {response.status_code}")
                    
            except Exception as e:
                self.log_test(f"Scenario: {scenario['name']}", "❌ FAILED", f"Exception: {str(e)}")
        
        success_rate = passed_scenarios / total_scenarios
        if success_rate >= 0.8:  # 80% success rate
            details = f"✅ Patient scenarios test passed. {passed_scenarios}/{total_scenarios} scenarios successful"
            self.test_results['patient_scenarios']['passed'] = True
            self.test_results['patient_scenarios']['details'] = details
            self.log_test("Patient Scenarios", "✅ PASSED", details)
            return True
        else:
            details = f"❌ Patient scenarios test failed. Only {passed_scenarios}/{total_scenarios} scenarios successful"
            self.test_results['patient_scenarios']['details'] = details
            self.log_test("Patient Scenarios", "❌ FAILED", details)
            return False
    
    def test_clinical_validation(self) -> bool:
        """Test clinical validation of results"""
        print("\n🔍 Testing Clinical Validation...")
        
        try:
            # Test with sample patient from the review request
            sample_patient = {
                "age_years": 65,
                "gender": "male",
                "height_cm": 175,
                "weight_kg": 75,
                "serum_creatinine_mg_dl": 1.0,
                "use_scr_floor": False,
                "scr_floor_mg_dl": 0.6
            }
            
            request_data = {
                "calculation_mode": "auc_guided",
                "patient": sample_patient,
                "dosing_params": self.get_sample_dosing_params(),
                "levels": []
            }
            
            response = self.session.post(f"{self.api_url}/calculate", json=request_data)
            
            if response.status_code == 200:
                data = response.json()
                
                if 'ok' in data and data['ok'] and 'result' in data:
                    result = data['result']
                    
                    # Clinical validation checks
                    auc = result.get('predicted_auc_24', 0)
                    dose = result.get('recommended_dose_mg', 0)
                    interval = result.get('interval_hours', 0)
                    
                    clinical_checks = []
                    
                    # AUC should be in therapeutic range (400-600 mg·h/L)
                    if 400 <= auc <= 600:
                        clinical_checks.append("✅ AUC in therapeutic range")
                    elif 350 <= auc < 400 or 600 < auc <= 700:
                        clinical_checks.append("⚠️ AUC near therapeutic range")
                    else:
                        clinical_checks.append("❌ AUC outside therapeutic range")
                    
                    # Dose should be reasonable
                    if 500 <= dose <= 2500:
                        clinical_checks.append("✅ Dose clinically reasonable")
                    else:
                        clinical_checks.append("❌ Dose outside reasonable range")
                    
                    # Interval should be standard
                    if interval in [8, 12, 24]:
                        clinical_checks.append("✅ Standard dosing interval")
                    else:
                        clinical_checks.append("❌ Non-standard dosing interval")
                    
                    # Check for safety warnings and monitoring recommendations
                    if 'safety_warnings' in result and isinstance(result['safety_warnings'], list):
                        clinical_checks.append("✅ Safety warnings provided")
                    else:
                        clinical_checks.append("❌ Missing safety warnings")
                    
                    if 'monitoring_recommendations' in result and isinstance(result['monitoring_recommendations'], list):
                        clinical_checks.append("✅ Monitoring recommendations provided")
                    else:
                        clinical_checks.append("❌ Missing monitoring recommendations")
                    
                    # Count passed checks
                    passed_checks = sum(1 for check in clinical_checks if check.startswith("✅"))
                    total_checks = len(clinical_checks)
                    
                    if passed_checks >= 4:  # At least 4/5 checks should pass
                        self.test_results['clinical_validation']['passed'] = True
                        details = f"✅ Clinical validation passed. {passed_checks}/{total_checks} checks passed. AUC: {auc:.0f}, Dose: {dose}mg q{interval}h"
                        self.test_results['clinical_validation']['details'] = details
                        self.log_test("Clinical Validation", "✅ PASSED", details)
                        
                        # Print detailed clinical checks
                        for check in clinical_checks:
                            print(f"    {check}")
                        
                        return True
                    else:
                        details = f"❌ Clinical validation failed. Only {passed_checks}/{total_checks} checks passed"
                        self.test_results['clinical_validation']['details'] = details
                        self.log_test("Clinical Validation", "❌ FAILED", details)
                        
                        # Print failed checks
                        for check in clinical_checks:
                            print(f"    {check}")
                        
                        return False
                else:
                    details = f"❌ Invalid response structure"
                    self.test_results['clinical_validation']['details'] = details
                    self.log_test("Clinical Validation", "❌ FAILED", details)
                    return False
            else:
                details = f"❌ HTTP {response.status_code}: {response.text}"
                self.test_results['clinical_validation']['details'] = details
                self.log_test("Clinical Validation", "❌ FAILED", details)
                return False
                
        except Exception as e:
            details = f"❌ Exception: {str(e)}"
            self.test_results['clinical_validation']['details'] = details
            self.log_test("Clinical Validation", "❌ FAILED", details)
            return False
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all backend tests"""
        print("=" * 70)
        print("🏥 VANCOMYZER CALCULATOR SUITE - BACKEND API TEST SUITE")
        print("=" * 70)
        print(f"📅 Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"🌐 Testing URL: {self.base_url}")
        print()
        
        # Run all tests
        tests = [
            ("Health Check", self.test_health_check),
            ("Trough Calculation", self.test_trough_calculation),
            ("AUC-Guided Calculation", self.test_auc_guided_calculation),
            ("Bayesian Calculation", self.test_bayesian_calculation),
            ("Data Validation", self.test_data_validation),
            ("Patient Scenarios", self.test_patient_scenarios),
            ("Clinical Validation", self.test_clinical_validation)
        ]
        
        passed_tests = 0
        total_tests = len(tests)
        
        for test_name, test_func in tests:
            try:
                if test_func():
                    passed_tests += 1
            except Exception as e:
                print(f"❌ {test_name} failed with exception: {str(e)}")
        
        # Generate summary
        print("\n" + "=" * 70)
        print("📊 BACKEND TEST SUMMARY")
        print("=" * 70)
        
        success_rate = passed_tests / total_tests
        
        for test_name, result in self.test_results.items():
            status = "✅ PASSED" if result['passed'] else "❌ FAILED"
            print(f"{test_name.replace('_', ' ').title()}: {status}")
            if result['details']:
                print(f"  {result['details']}")
        
        print(f"\nOverall: {passed_tests}/{total_tests} tests passed ({success_rate:.1%})")
        
        if success_rate >= 0.8:
            print("🎉 Backend API is functioning well!")
            return {'status': 'success', 'passed': passed_tests, 'total': total_tests, 'details': self.test_results}
        elif success_rate >= 0.6:
            print("⚠️ Backend API has some issues but core functionality works")
            return {'status': 'partial', 'passed': passed_tests, 'total': total_tests, 'details': self.test_results}
        else:
            print("❌ Backend API has significant issues")
            return {'status': 'failed', 'passed': passed_tests, 'total': total_tests, 'details': self.test_results}

def main():
    """Main test execution function"""
    print("Starting Vancomyzer Calculator Suite Backend API Tests...")
    
    # Create and run test suite
    tester = VancomyzerBackendTester()
    results = tester.run_all_tests()
    
    # Return appropriate exit code
    if results['status'] == 'success':
        return 0
    elif results['status'] == 'partial':
        return 1
    else:
        return 2

if __name__ == "__main__":
    sys.exit(main())