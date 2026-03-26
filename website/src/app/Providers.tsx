"use client";

import { MatrixSettingsProvider } from "@/contexts/MatrixSettingsContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MatrixSettingsProvider>
      <div id="app-root" style={{ minHeight: "100vh" }}>
        {children}
      </div>
    </MatrixSettingsProvider>
  );
}
