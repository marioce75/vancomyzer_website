"use client";

/**
 * Declarative feature gate. Renders children only when the current user's
 * tier grants the requested feature; otherwise renders the optional
 * fallback (or null).
 *
 *   <FeatureGate feature="history.calculation">
 *     <CalculationHistoryPanel />
 *   </FeatureGate>
 *
 *   <FeatureGate
 *     feature="org.invite_users"
 *     fallback={<UpgradeBanner feature="org.invite_users" />}
 *   >
 *     <InviteForm />
 *   </FeatureGate>
 *
 * For inline UI logic where you need both branches in the same render,
 * prefer the useFeature(feature) hook directly.
 */

import type { ReactNode } from "react";
import { useFeature } from "@/hooks/useFeature";
import type { FeatureId } from "@/lib/tiers";

interface FeatureGateProps {
  feature: FeatureId;
  children: ReactNode;
  fallback?: ReactNode;
}

export default function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const { allowed } = useFeature(feature);
  return <>{allowed ? children : fallback}</>;
}
