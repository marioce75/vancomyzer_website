"use client";

/**
 * "Open Calculator" call to action for public pages.
 *
 * A plain link to /calculator that also records an "Open Calculator"
 * analytics event. The only event prop is a coarse label for where the
 * click came from (e.g. "landing_hero") — never patient data.
 *
 * Kept as a tiny client island so the landing page itself can stay a
 * server component (and keep exporting static metadata).
 */

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { track } from "@/lib/analytics";

interface OpenCalculatorButtonProps {
  /** Where the click happened, for the analytics event. */
  source?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export default function OpenCalculatorButton({
  source = "landing",
  className,
  style,
  children,
}: OpenCalculatorButtonProps) {
  return (
    <Link
      href="/calculator"
      className={className}
      style={style}
      onClick={() => track("Open Calculator", { source })}
    >
      {children ?? "Open Calculator"}
    </Link>
  );
}
