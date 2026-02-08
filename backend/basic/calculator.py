from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Any, Optional

from backend.basic.excel_engine import ExcelEngine


@dataclass
class BasicInputs:
    age: int
    sex: str
    weight_kg: float
    height_cm: float
    serum_creatinine: float
    dose_mg: float
    interval_hr: float
    infusion_hr: Optional[float] = None
    crcl_method: Optional[int] = None
    forced_crcl: Optional[float] = None


OUTPUT_CELLS = {
    "recommended_interval_hr": ("Vanco_InitialDose", "B5"),
    "recommended_dose_mg": ("Vanco_InitialDose", "B8"),
    "predicted_auc24": ("Vanco_InitialDose", "B11"),
    "predicted_trough": ("Vanco_InitialDose", "B12"),
    "predicted_peak": ("Vanco_InitialDose", "B13"),
    "recommended_loading_dose_mg": ("Vanco_InitialDose", "B15"),
    "half_life_hr": ("Vanco_InitialDose", "B18"),
    "crcl_tbw": ("Calculation_Details", "A12"),
    "crcl_abw": ("Calculation_Details", "B12"),
    "crcl_ibw": ("Calculation_Details", "C12"),
    "crcl_tbw_scr1": ("Calculation_Details", "D12"),
    "crcl_forced": ("Calculation_Details", "E12"),
    "crcl_lhr_tbw": ("Calculation_Details", "A14"),
    "crcl_lhr_abw": ("Calculation_Details", "B14"),
    "crcl_lhr_ibw": ("Calculation_Details", "C14"),
    "crcl_lhr_tbw_scr1": ("Calculation_Details", "D14"),
    "crcl_lhr_forced": ("Calculation_Details", "E14"),
    "vanco_cl": ("Calculation_Details", "B20"),
    "vanco_vd": ("Calculation_Details", "A20"),
}


def compute_basic(inputs: BasicInputs) -> Dict[str, Any]:
    engine = ExcelEngine()

    # Patient inputs
    engine.set_cell("Patient_Info", "B5", int(inputs.age))
    engine.set_cell("Patient_Info", "B6", "FEMALE" if inputs.sex.lower().startswith("f") else "MALE")
    engine.set_cell("Patient_Info", "B7", float(inputs.weight_kg))
    engine.set_cell("Patient_Info", "B8", float(inputs.height_cm))
    engine.set_cell("Patient_Info", "B9", float(inputs.serum_creatinine))
    if inputs.forced_crcl is not None:
        engine.set_cell("Patient_Info", "B23", float(inputs.forced_crcl))
    if inputs.crcl_method is not None:
        engine.set_cell("Patient_Info", "B25", int(inputs.crcl_method))

    # Regimen inputs
    engine.set_cell("Vanco_InitialDose", "B6", float(inputs.interval_hr))
    engine.set_cell("Vanco_InitialDose", "B9", float(inputs.dose_mg))

    if inputs.infusion_hr is not None:
        engine.set_cell("Calculation_Details", "E26", float(inputs.infusion_hr))

    outputs: Dict[str, Any] = {}
    for key, (sheet, cell) in OUTPUT_CELLS.items():
        outputs[key] = engine.get(sheet, cell)

    method = inputs.crcl_method or int(engine.get("Patient_Info", "B25") or 1)
    crcl_ml = {
        1: outputs.get("crcl_tbw"),
        2: outputs.get("crcl_abw"),
        3: outputs.get("crcl_ibw"),
        4: outputs.get("crcl_tbw_scr1"),
        5: outputs.get("crcl_forced"),
    }.get(method)
    crcl_lhr = {
        1: outputs.get("crcl_lhr_tbw"),
        2: outputs.get("crcl_lhr_abw"),
        3: outputs.get("crcl_lhr_ibw"),
        4: outputs.get("crcl_lhr_tbw_scr1"),
        5: outputs.get("crcl_lhr_forced"),
    }.get(method)

    outputs["crcl_selected_ml_min"] = crcl_ml
    outputs["crcl_selected_l_hr"] = crcl_lhr

    return outputs
