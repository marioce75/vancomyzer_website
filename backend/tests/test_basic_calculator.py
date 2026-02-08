import pytest

from backend.basic.calculator import compute_basic, BasicInputs


def test_basic_calculator_matches_excel_dump_defaults():
    inputs = BasicInputs(
        age=67,
        sex="male",
        weight_kg=183.5,
        height_cm=168,
        serum_creatinine=1.24,
        dose_mg=1000,
        interval_hr=12,
        infusion_hr=1.0,
        crcl_method=2,
        forced_crcl=None,
    )
    out = compute_basic(inputs)

    assert out["crcl_tbw"] == pytest.approx(150.0, rel=1e-3)
    assert out["crcl_abw"] == pytest.approx(91.4753776, rel=1e-3)
    assert out["crcl_selected_ml_min"] == pytest.approx(91.4753776, rel=1e-3)
    assert out["crcl_selected_l_hr"] == pytest.approx(5.48852265, rel=1e-3)
    assert out["recommended_interval_hr"] == pytest.approx(24.0, rel=1e-3)
    assert out["recommended_dose_mg"] == pytest.approx(903.583153, rel=1e-3)
    assert out["predicted_auc24"] == pytest.approx(485.862378, rel=1e-3)
    assert out["predicted_trough"] == pytest.approx(16.6005751, rel=1e-3)
    assert out["predicted_peak"] == pytest.approx(22.8717797, rel=1e-3)
    assert out["recommended_loading_dose_mg"] == pytest.approx(4495.75, rel=1e-3)
    assert out["half_life_hr"] == pytest.approx(21.6247263, rel=1e-3)
