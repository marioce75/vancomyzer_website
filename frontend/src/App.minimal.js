import React, { useState } from 'react';
import './App.css';

function App() {
  const [message, setMessage] = useState('Vancomyzer Web App Loading...');

  return (
    <div className="App">
      <header className="App-header">
        <h1>Vancomyzer</h1>
        <p>{message}</p>
        <button onClick={() => setMessage('App is working!')}>
          Test App
        </button>
      </header>
    </div>
  );
}

export default App;