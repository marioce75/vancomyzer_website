// src/App.js
import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route
} from 'react-router-dom';

import PatientInputForm from './components/PatientInputForm';
import DosingResults from './components/DosingResults';
import InteractiveAUCVisualization from './components/InteractiveAUCVisualization';
import ClinicalInfo from './components/ClinicalInfo';
import ApiHealthBadge from './components/ApiHealthBadge';
import './styles/disclaimer.css';

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <header style={{ 
          padding: '1rem', 
          background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)', 
          color: 'white',
          marginBottom: '1rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '600' }}>
              Vancomyzer
              <span style={{ fontSize: '0.8rem', fontWeight: '400', opacity: '0.8', marginLeft: '0.5rem' }}>
                Evidence-based vancomycin dosing
              </span>
            </h1>
            
            <div style={{ marginLeft: 'auto' }}>
              <ApiHealthBadge />
            </div>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<PatientInputForm />} />
          <Route path="/results" element={<DosingResults />} />
          <Route path="/auc" element={<InteractiveAUCVisualization />} />
          <Route path="/info" element={<ClinicalInfo />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
