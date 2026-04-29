"use client";

/**
 * Client-side feature gate hook. Reads the current user's subscription
 * tier from useAuth() and returns whether the requested feature is
 * available, plus the upgrade target if it isn't.
 *
 * Use for inline UI gating (button enable/disable, conditional rendering).
 * For declarative wrapping, prefer <FeatureGate> from @/components/FeatureGate.
 */

import { useAuth } from "@/contexts/AuthContext";
import { hasFeature, upgradeTargetFor, normalizeTier, type FeatureId, type TierConfig, type TierId } from "@/lib/tiers";

export interface UseFeatureResult {
  allowed: boolean;
  tier: TierId;
  upgradeTo: TierConfig;
}

export function useFeature(feature: FeatureId): UseFeatureResult {
  const { user } = useAuth();
  const tier = normalizeTier(user?.subscriptionTier);
  return {
    allowed: hasFeature(tier, feature),
    tier,
    upgradeTo: upgradeTargetFor(feature),
  };
}
