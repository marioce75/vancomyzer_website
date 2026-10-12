import ContactClient from "./ContactClient";
import { accessAcknowledgementsEnabled } from "@/lib/contact/configuration";

// Read the same runtime switch as the mail handler, never a public build-time flag.
export const dynamic = "force-dynamic";

export default function ContactPage() {
  return <ContactClient acknowledgementEnabled={accessAcknowledgementsEnabled()} />;
}
