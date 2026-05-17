import type { Metadata } from "next";
import UpgradeDepartmentClient from "./UpgradeDepartmentClient";

export const metadata: Metadata = {
  title: "Department — Vancomyzer™",
  description:
    "Activate Vancomyzer Department for your pharmacy team. Two flat plans, 14-day free trial, self-serve.",
};

export default function UpgradeDepartmentPage() {
  return <UpgradeDepartmentClient />;
}
