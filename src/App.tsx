import React from "react";
import "./App.css";
import PKCalculator from "./components/PKCalculator";

function App() {
  return (
    <div className="mx-auto max-w-xl p-4">
      <h1 className="text-2xl font-semibold mb-4">Vancomycin PK Calculator</h1>
      <PKCalculator />
      <div className="mt-6 text-sm text-gray-600">
        <a
          href="/static/references.html"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          References
        </a>
      </div>
    </div>
  );
}

export default App;
