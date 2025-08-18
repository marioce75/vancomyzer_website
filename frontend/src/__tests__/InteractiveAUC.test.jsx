import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock react-chartjs-2 Line to inspect datasets easily
jest.mock('react-chartjs-2', () => ({
  Line: ({ data }) => <pre data-testid="chart-data">{JSON.stringify(data)}</pre>
}));

// Mock jsPDF used by the component
jest.mock('jspdf', () => ({
  jsPDF: jest.fn().mockImplementation(() => ({ setFontSize: jest.fn(), text: jest.fn(), addImage: jest.fn(), save: jest.fn() }))
}));

// Mock API
const mockResponse = {
  series: {
    time_hours: Array.from({ length: 5 }, (_, i) => i * 6),
    median: [30, 22, 16, 12, 9],
    p05:   [24, 18, 13,  9, 7],
    p95:   [36, 26, 19, 15, 11],
  },
  metrics: { auc_24: 500, predicted_peak: 30, predicted_trough: 12, auc24_over_mic: 500 },
  posterior: { n_draws: 600, CL_median_L_per_h: 4.1, V_median_L: 55 },
  diagnostics: { rhat_ok: true, predicted_levels: [] }
};

const calcMock = jest.fn().mockResolvedValue(mockResponse);
jest.mock('../services/interactiveApi', () => ({ calculateInteractiveAUC: (...args) => calcMock(...args) }));

import InteractiveAUC from '../components/InteractiveAUC.jsx';

// Use fake timers to control the 400ms debounce in the component
jest.useFakeTimers();

function flushDebounce(ms = 450) {
  act(() => { jest.advanceTimersByTime(ms); });
}

describe('InteractiveAUC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders metrics and Bayesian badge after API response', async () => {
    render(<InteractiveAUC />);
    flushDebounce();

    // AUC chip visible
    expect(await screen.findByText(/AUC24/i)).toBeInTheDocument();
    expect(screen.getByText(/500 mg·h\/L/)).toBeInTheDocument();
    // Peak/trough
    expect(screen.getByText(/Predicted trough/i)).toBeInTheDocument();
    expect(screen.getByText(/Predicted peak/i)).toBeInTheDocument();
    // Bayesian badge
    expect(screen.getByText(/Bayesian \(n=600\)/)).toBeInTheDocument();
  });

  test('debounces regimen changes before calling API again', async () => {
    render(<InteractiveAUC />);
    flushDebounce();
    expect(calcMock).toHaveBeenCalledTimes(1);

    // Change dose numeric input
    const mgInputs = screen.getAllByLabelText('mg');
    const doseInput = mgInputs[0];

    // Change value triggers debounce
    fireEvent.change(doseInput, { target: { value: '1250' } });
    // Before debounce window ends, no new call
    act(() => { jest.advanceTimersByTime(300); });
    expect(calcMock).toHaveBeenCalledTimes(1);
    // After full debounce
    act(() => { jest.advanceTimersByTime(200); });
    expect(calcMock).toHaveBeenCalledTimes(2);
  });

  test('shows single measured markers (not repeated) when two levels entered', async () => {
    render(<InteractiveAUC />);
    flushDebounce();

    // Select Mode = Two levels
    const modeSelect = screen.getByLabelText('Mode');
    fireEvent.change(modeSelect, { target: { value: 'two' } });

    // Enter Peak and Hours after end
    fireEvent.change(screen.getByLabelText('Peak/random (mg/L)'), { target: { value: '22' } });
    fireEvent.change(screen.getByLabelText('Hours after infusion end'), { target: { value: '1' } });
    // Enter Trough
    fireEvent.change(screen.getByLabelText('Trough (mg/L)'), { target: { value: '12' } });

    flushDebounce();

    // Inspect mocked Line data
    const pre = screen.getByTestId('chart-data');
    const chartData = JSON.parse(pre.textContent);
    const measured = chartData.datasets.find(d => d.label === 'Measured level(s)');
    expect(measured).toBeTruthy();
    // Expect exactly 2 markers (peak and trough once)
    expect(measured.data.length).toBe(2);

    // Ensure their x values are within first interval (0..tau)
    for (const pt of measured.data) {
      expect(typeof pt.x).toBe('number');
      expect(pt.x).toBeGreaterThanOrEqual(0);
      expect(pt.x).toBeLessThanOrEqual(48);
    }
  });
});
