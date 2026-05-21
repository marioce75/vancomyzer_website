#!/usr/bin/env bash
#
# Safety-pattern check — fails CI if a new dose-emitting function in
# the recommendation engine is added without the SAFETY CONTRACT
# annotation. Catches the silent-fallback bug pattern that has shipped
# two Class I safety bugs (commits 915326e, aa7fb53).
#
# The contract: any function in src/lib/pk/recommend/ or
# src/lib/initialRegimen.ts that returns an AdjustmentRecommendation
# or InitialRegimenResult must either:
#   (a) carry an `@safety-checked-via: <fn>` JSDoc annotation, OR
#   (b) be the safety chokepoint itself (finalizeRecommendation,
#       buildAdjustmentRefusal, computeInitialRegimen, etc.)
#
# Crude grep — not a full AST analyzer, but cheap, transparent, and
# version-controllable. Annotated paths are allowlisted via the
# `@safety-checked-via:` token; missing annotations fail CI.

set -euo pipefail

EXIT_CODE=0
FILES_TO_CHECK=(
  "src/lib/pk/recommend/buildAdjustmentRecommendation.ts"
  "src/lib/initialRegimen.ts"
)

# Find functions whose return type names AdjustmentRecommendation or
# InitialRegimenResult — these are the dose-emitting functions. They
# MUST be preceded by `@safety-checked-via:` in the surrounding 25
# lines OR be one of the named safety chokepoints.
CHOKEPOINTS=(
  "finalizeRecommendation"
  "buildAdjustmentRefusal"
  "buildEmpiricRefusalResult"
  "computeInitialRegimen"
  "buildAdjustmentRecommendation"
)

for file in "${FILES_TO_CHECK[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "WARN: $file not found, skipping safety-pattern check"
    continue
  fi

  # Find function declarations whose signature mentions a return type
  # of AdjustmentRecommendation or InitialRegimenResult. The return type
  # may be on the same line as `function name(...)` OR on a later line if
  # the function signature wraps across multiple lines, so we search the
  # preceding 30 lines for the function-name declaration.
  while IFS=: read -r linenum _; do
    # Look at the 30 lines preceding the function declaration for the annotation
    start=$((linenum > 30 ? linenum - 30 : 1))
    context=$(sed -n "${start},${linenum}p" "$file")

    # Extract function name — look at the surrounding context, not just the
    # line with the return type (function name may be 10+ lines earlier in
    # a multi-line signature). Most recent `function NAME(` wins.
    fnname=$(echo "$context" | grep -oE 'function [A-Za-z_][A-Za-z0-9_]*' | tail -1 | sed 's/^function //')

    is_chokepoint=false
    for cp in "${CHOKEPOINTS[@]}"; do
      if [[ "$fnname" == "$cp" ]]; then
        is_chokepoint=true
        break
      fi
    done

    if [[ "$is_chokepoint" == "true" ]]; then
      continue
    fi

    if ! echo "$context" | grep -q "@safety-checked-via:"; then
      echo "SAFETY CONTRACT VIOLATION: $file:$linenum"
      echo "  Function \`$fnname\` returns AdjustmentRecommendation or InitialRegimenResult"
      echo "  but is missing the @safety-checked-via JSDoc annotation."
      echo ""
      echo "  Add a JSDoc comment naming the safety chokepoint this function"
      echo "  delegates to, e.g.:"
      echo ""
      echo "    /**"
      echo "     * @safety-checked-via: finalizeRecommendation"
      echo "     */"
      echo "    function ${fnname}(...): AdjustmentRecommendation { ... }"
      echo ""
      echo "  See the SAFETY CONTRACT block at the top of"
      echo "  src/lib/pk/recommend/buildAdjustmentRecommendation.ts"
      echo "  for the rationale (two Class I safety bugs prompted this)."
      EXIT_CODE=1
    fi
  done < <(grep -nE '\): (AdjustmentRecommendation|InitialRegimenResult)' "$file" || true)
done

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "Safety-pattern check passed: every dose-emitting function carries the @safety-checked-via annotation."
fi

exit $EXIT_CODE
