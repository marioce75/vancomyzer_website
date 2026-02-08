import numpy as np
import pytest

from backend.pk.sim import Event, concentration_time_series
from backend.pk.bayesian import map_fit, load_priors


def test_map_fit_recovers_known_params():
    true_cl = 4.0
    true_v = 50.0
    events = [
        Event(dose_mg=1000, start_hr=0.0, infusion_hr=1.0),
        Event(dose_mg=1000, start_hr=12.0, infusion_hr=1.0),
    ]
    obs_t = np.array([2.0, 10.0])
    obs_c = concentration_time_series(obs_t, events, cl_l_hr=true_cl, v_l=true_v)
    levels = [(float(t), float(c)) for t, c in zip(obs_t.tolist(), obs_c.tolist())]

    priors = load_priors()
    cl_map, v_map = map_fit(events, levels, cl_mean=4.5, v_mean=55.0, priors=priors)

    assert cl_map == pytest.approx(true_cl, rel=0.25)
    assert v_map == pytest.approx(true_v, rel=0.25)
