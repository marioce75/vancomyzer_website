from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR.parent / "data"
PARSED_PATH = DATA_DIR / "parsed" / "basic_workbook.json"
FALLBACK_DIR = DATA_DIR / "xlsx_dump"


@dataclass
class SheetGrid:
    name: str
    grid: list[list[Any]]
    max_row: int
    max_col: int

    def get_cell(self, row: int, col: int) -> Any:
        if row <= 0 or col <= 0:
            return None
        try:
            return self.grid[row - 1][col - 1]
        except IndexError:
            return None


def _col_to_index(col: str) -> int:
    col = col.upper()
    idx = 0
    for ch in col:
        idx = idx * 26 + (ord(ch) - ord("A") + 1)
    return idx


def _cell_to_rc(cell: str) -> Tuple[int, int]:
    match = re.match(r"^([A-Z]+)(\d+)$", cell.upper())
    if not match:
        raise ValueError(f"Invalid cell ref: {cell}")
    col = _col_to_index(match.group(1))
    row = int(match.group(2))
    return row, col


def _load_sheet_from_json(path: Path) -> Dict[str, SheetGrid]:
    data = json.loads(path.read_text())
    sheets: Dict[str, SheetGrid] = {}
    for name, payload in data.get("sheets", {}).items():
        sheets[name] = SheetGrid(
            name=name,
            grid=payload.get("grid", []),
            max_row=int(payload.get("max_row", payload.get("max_row_dumped", 0)) or 0),
            max_col=int(payload.get("max_col", payload.get("max_col_dumped", 0)) or 0),
        )
    return sheets


def _load_fallback_dump() -> Dict[str, SheetGrid]:
    sheets: Dict[str, SheetGrid] = {}
    for path in FALLBACK_DIR.glob("*.json"):
        raw = json.loads(path.read_text())
        name = raw.get("sheet")
        if not name:
            continue
        sheets[name] = SheetGrid(
            name=name,
            grid=raw.get("grid", []),
            max_row=int(raw.get("max_row_dumped", 0) or 0),
            max_col=int(raw.get("max_col_dumped", 0) or 0),
        )
    return sheets


def load_workbook() -> Dict[str, SheetGrid]:
    if PARSED_PATH.exists():
        return _load_sheet_from_json(PARSED_PATH)
    return _load_fallback_dump()


class ExcelEngine:
    def __init__(self, sheets: Optional[Dict[str, SheetGrid]] = None) -> None:
        self.sheets = sheets or load_workbook()
        self.overrides: Dict[Tuple[str, str], Any] = {}
        self.cache: Dict[Tuple[str, str], Any] = {}

    def set_cell(self, sheet: str, cell: str, value: Any) -> None:
        self.overrides[(sheet, cell.upper())] = value
        self.cache.pop((sheet, cell.upper()), None)

    def get(self, sheet: str, cell: str) -> Any:
        key = (sheet, cell.upper())
        if key in self.cache:
            return self.cache[key]
        if key in self.overrides:
            val = self.overrides[key]
            self.cache[key] = val
            return val
        grid = self.sheets.get(sheet)
        if not grid:
            return None
        row, col = _cell_to_rc(cell)
        raw = grid.get_cell(row, col)
        val = self._eval_raw(raw, sheet)
        self.cache[key] = val
        return val

    def _eval_raw(self, raw: Any, sheet: str) -> Any:
        if raw is None:
            return 0.0
        if isinstance(raw, (int, float)):
            return float(raw)
        if isinstance(raw, str) and raw.startswith("="):
            return self._eval_formula(raw[1:], sheet)
        if isinstance(raw, str):
            try:
                return float(raw)
            except ValueError:
                return raw
        return raw

    def _eval_formula(self, expr: str, sheet: str) -> Any:
        expr = expr.replace("^", "**")
        expr = re.sub(r"<>", "!=", expr)
        expr = re.sub(r"(?<![<>=])=(?![=])", "==", expr)
        expr = re.sub(r"\bIF\(", "if_(", expr, flags=re.IGNORECASE)
        expr = re.sub(r"\bAND\(", "and_(", expr, flags=re.IGNORECASE)
        expr = re.sub(r"\bOR\(", "or_(", expr, flags=re.IGNORECASE)
        expr = re.sub(r"\bEXP\(", "exp(", expr, flags=re.IGNORECASE)
        expr = re.sub(r"\bLN\(", "ln(", expr, flags=re.IGNORECASE)
        expr = re.sub(r"\bMAX\(", "max_(", expr, flags=re.IGNORECASE)
        expr = re.sub(r"\bMIN\(", "min_(", expr, flags=re.IGNORECASE)

        def sheet_ref(match: re.Match) -> str:
            sheet_name = match.group(1)
            cell = match.group(2)
            return f'cell("{sheet_name}","{cell}")'

        def local_ref(match: re.Match) -> str:
            cell = match.group(1)
            return f'cell("{sheet}","{cell}")'

        expr = re.sub(r"([A-Za-z0-9_]+)!([A-Z]{1,3}\d+)", sheet_ref, expr)
        expr = re.sub(r'(?<!")\b([A-Z]{1,3}\d+)\b(?!")', local_ref, expr)

        def cell_fn(sheet_name: str, cell_ref: str) -> Any:
            return self.get(sheet_name, cell_ref)

        def if_(cond: Any, a: Any, b: Any = 0) -> Any:
            return a if cond else b

        def and_(*args: Any) -> bool:
            return all(args)

        def or_(*args: Any) -> bool:
            return any(args)

        def exp(x: Any) -> float:
            return math.exp(float(x))

        def ln(x: Any) -> float:
            return math.log(float(x))

        def max_(a: Any, b: Any) -> Any:
            return a if a >= b else b

        def min_(a: Any, b: Any) -> Any:
            return a if a <= b else b

        safe_globals = {
            "__builtins__": {},
            "cell": cell_fn,
            "if_": if_,
            "and_": and_,
            "or_": or_,
            "exp": exp,
            "ln": ln,
            "max_": max_,
            "min_": min_,
        }
        try:
            return eval(expr, safe_globals, {})
        except Exception:
            return 0.0
