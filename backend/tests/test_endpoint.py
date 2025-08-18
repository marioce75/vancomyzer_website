from __future__ import annotations

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_health():
    r = client.get('/health')
    assert r.status_code == 200
    assert r.json().get('status') == 'ok'


def test_interactive_shape():
    payload = {
        "population_type": "adult",
        "age": 56,
        "gender": "male",
        "weight_kg": 79,
        "height_cm": 170,
        "serum_creatinine_mg_dl": 1.0,
        "levels": [ { "time_hr": 2.0, "concentration_mg_L": 22.0, "tag": "post" } ],
        "regimen": { "dose_mg": 1000, "interval_hours": 12, "infusion_minutes": 60 },
        "mic_mg_L": 1.0
    }
    r = client.post('/api/dose/interactive', json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    # Required keys
    assert 'series' in data and 'metrics' in data and 'posterior' in data
    s = data['series']
    assert isinstance(s.get('time_hours'), list) and isinstance(s.get('median'), list)
    m = data['metrics']
    assert 'auc_24' in m and 'predicted_peak' in m and 'predicted_trough' in m
    p = data['posterior']
    assert 'n_draws' in p and p['n_draws'] > 0
