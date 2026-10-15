/** Shared loader/status contract; never include raw configuration in diagnostics. */
export function analyticsConfig(script: string | undefined, disabled: string | undefined) {
  if (disabled === "true") return { status: "disabled", src: null } as const;
  const src = script?.trim();
  if (!src) return { status: "missing", src: null } as const;
  if (!/^https:\/\/plausible\.io\/js\/pa-[A-Za-z0-9_-]+\.js$/.test(src)) return { status: "unsupported", src: null } as const;
  return { status: "configured", src } as const;
}
