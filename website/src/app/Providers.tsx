"use client";

import { MatrixSettingsProvider } from "@/contexts/MatrixSettingsContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <MatrixSettingsProvider>{children}</MatrixSettingsProvider>;
}
