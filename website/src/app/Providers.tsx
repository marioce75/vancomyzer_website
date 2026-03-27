"use client";

import { MatrixSettingsProvider, useMatrixSettings } from "@/contexts/MatrixSettingsContext";
import VancomycinRain from "@/components/calculator/VancomycinRain";

function RainLayer() {
  const { settings } = useMatrixSettings();
  if (!settings.vancomycinRain) return null;
  return <VancomycinRain opacity={settings.rainOpacity} colorMode={settings.colorMode} />;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MatrixSettingsProvider>
      <RainLayer />
      <div id="app-root" style={{ minHeight: "100vh", position: "relative", zIndex: 2 }}>
        {children}
      </div>
    </MatrixSettingsProvider>
  );
}
