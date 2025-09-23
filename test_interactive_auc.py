#!/usr/bin/env python3
"""
Test the Interactive AUC endpoint specifically for the dose scaling functionality
"""

import requests
import json
import sys

def test_interactive_auc_scaling():
    """Test the specific dose scaling mentioned in the review request"""
    
    base_url = "http://localhost:8001/api"
    
    print("🔍 Testing Interactive AUC Dose Scaling...")
    print(f"Testing endpoint: {base_url}/interactive/auc")
    
    # Test data - standard patient
    patient_data = {
        "age_years": 65,
        "weight_kg": 75,
        "height_cm": 175,
        "scr_mg_dl": 1.0,
        "gender": "male",
        "interval_hr": 12,
        "infusion_minutes": 60
    }
    
    # Test 1: 1000mg dose
    print("\n📊 Test 1: 1000mg dose")
    test1_data = {**patient_data, "dose_mg": 1000}
    
    try:
        response = requests.post(f"{base_url}/interactive/auc", json=test1_data, timeout=10)
        if response.status_code == 200:
            result1 = response.json()
            auc1 = result1.get("result", {}).get("metrics", {}).get("auc_24", 0)
            peak1 = result1.get("result", {}).get("metrics", {}).get("predicted_peak", 0)
            trough1 = result1.get("result", {}).get("metrics", {}).get("predicted_trough", 0)
            
            print(f"✅ 1000mg: AUC24 = {auc1:.1f} mg·h/L, Peak = {peak1:.1f} mg/L, Trough = {trough1:.1f} mg/L")
        else:
            print(f"❌ 1000mg test failed: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 1000mg test failed: {str(e)}")
        return False
    
    # Test 2: 1500mg dose
    print("\n📊 Test 2: 1500mg dose")
    test2_data = {**patient_data, "dose_mg": 1500}
    
    try:
        response = requests.post(f"{base_url}/interactive/auc", json=test2_data, timeout=10)
        if response.status_code == 200:
            result2 = response.json()
            auc2 = result2.get("result", {}).get("metrics", {}).get("auc_24", 0)
            peak2 = result2.get("result", {}).get("metrics", {}).get("predicted_peak", 0)
            trough2 = result2.get("result", {}).get("metrics", {}).get("predicted_trough", 0)
            
            print(f"✅ 1500mg: AUC24 = {auc2:.1f} mg·h/L, Peak = {peak2:.1f} mg/L, Trough = {trough2:.1f} mg/L")
        else:
            print(f"❌ 1500mg test failed: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 1500mg test failed: {str(e)}")
        return False
    
    # Analyze scaling
    print("\n📈 Dose Scaling Analysis:")
    dose_ratio = 1500 / 1000  # 1.5x
    auc_ratio = auc2 / auc1 if auc1 > 0 else 0
    peak_ratio = peak2 / peak1 if peak1 > 0 else 0
    trough_ratio = trough2 / trough1 if trough1 > 0 else 0
    
    print(f"Dose ratio: {dose_ratio:.2f}x")
    print(f"AUC ratio: {auc_ratio:.2f}x")
    print(f"Peak ratio: {peak_ratio:.2f}x")
    print(f"Trough ratio: {trough_ratio:.2f}x")
    
    # Expected behavior: AUC should scale proportionally, peak/trough less so
    auc_scaling_ok = 1.4 <= auc_ratio <= 1.6  # Should be close to 1.5x
    peak_scaling_ok = 1.0 <= peak_ratio <= 1.3  # Should scale less than AUC
    trough_scaling_ok = 1.0 <= trough_ratio <= 1.2  # Should scale least
    
    print(f"\n✅ AUC scaling appropriate: {auc_scaling_ok}")
    print(f"✅ Peak scaling appropriate: {peak_scaling_ok}")
    print(f"✅ Trough scaling appropriate: {trough_scaling_ok}")
    
    # Check if values are in expected ranges from review request
    expected_auc_1000 = 391  # ~391 mg·h/L for 1000mg
    expected_auc_1500 = 586  # ~586 mg·h/L for 1500mg
    
    auc1_close = abs(auc1 - expected_auc_1000) / expected_auc_1000 < 0.5  # Within 50%
    auc2_close = abs(auc2 - expected_auc_1500) / expected_auc_1500 < 0.5  # Within 50%
    
    print(f"\n📋 Expected vs Actual:")
    print(f"1000mg: Expected ~{expected_auc_1000}, Got {auc1:.1f} ({'✅' if auc1_close else '⚠️'})")
    print(f"1500mg: Expected ~{expected_auc_1500}, Got {auc2:.1f} ({'✅' if auc2_close else '⚠️'})")
    
    # Overall assessment
    all_tests_pass = (auc_scaling_ok and peak_scaling_ok and trough_scaling_ok and 
                     auc1 > 0 and auc2 > 0)
    
    if all_tests_pass:
        print("\n🎉 Interactive AUC dose scaling test PASSED!")
        print("✅ Backend AUC calculation bug appears to be fixed")
        print("✅ Dose scaling is working correctly")
        return True
    else:
        print("\n❌ Interactive AUC dose scaling test FAILED!")
        print("❌ Some scaling ratios are outside expected ranges")
        return False

def main():
    """Main test execution"""
    print("=" * 60)
    print("🧪 VANCOMYZER INTERACTIVE AUC SCALING TEST")
    print("=" * 60)
    
    success = test_interactive_auc_scaling()
    
    if success:
        print("\n✅ All tests passed - Interactive AUC is working correctly!")
        return 0
    else:
        print("\n❌ Tests failed - Issues found with Interactive AUC")
        return 1

if __name__ == "__main__":
    sys.exit(main())