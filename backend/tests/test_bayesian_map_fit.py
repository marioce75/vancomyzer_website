import numpy as np

from backend.pk import bayesian as bayes
from backend.pk.sim import Event, concentration_time_series


def test_bayesian_map_recovers_parameters():
    # Ground-truth parameters
    cl_true = 3.5
    v_true = 40.0
    dose_mg = 1000.0
    interval_hr = 12.0
    infusion_hr = 1.0

    # Build dosing history
    events = [
        Event(dose_mg=dose_mg, start_hr=0.0, infusion_hr=infusion_hr),
        Event(dose_mg=dose_mg, start_hr=interval_hr, infusion_hr=infusion_hr),
        Event(dose_mg=dose_mg, start_hr=2 * interval_hr, infusion_hr=infusion_hr),
    ]

    # Synthetic levels
    times = np.array([2.0, 11.0, 14.0])
    conc = concentration_time_series(times, events, cl_l_hr=cl_true, v_l=v_true)
    rng = np.random.default_rng(1)
    noisy = conc + rng.normal(0, 0.5, size=conc.shape)
    levels = [(float(t), float(c)) for t, c in zip(times, noisy)]

    cl_mean = 3.5
    v_mean = 45.0
    cl_map, v_map, _ = bayes.posterior_samples(events, levels, cl_mean, v_mean, n=60)

    # Expect reasonable recovery within 30%
    assert abs(cl_map - cl_true) / cl_true < 0.3
    assert abs(v_map - v_true) / v_true < 0.3
