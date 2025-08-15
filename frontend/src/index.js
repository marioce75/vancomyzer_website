import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import InteractiveTutorial from './components/InteractiveTutorial';
import './i18n';

// Remove local theme creation; moved to App for direction switching

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* Theme provider now handled inside App with direction awareness */}
    <BrowserRouter>
      <Routes>
        <Route path="/clinical-info/tutorial" element={<InteractiveTutorial />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);