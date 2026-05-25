/**
 * Email-domain auto-detection for student discount eligibility.
 *
 * Returns 'student' if the email matches a known academic pattern,
 * null otherwise. Generous heuristic — catches most major academic TLDs
 * worldwide. Faculty and staff at universities will also auto-verify
 * (we accept that false-positive in exchange for low-friction student
 * onboarding; abuse can be addressed manually via the admin queue).
 *
 * Residents (who typically use hospital email like @stanfordhealthcare.org)
 * are NOT auto-detected here — they go through the manual application
 * form on /settings.
 */

const ACADEMIC_TLD_PATTERNS: RegExp[] = [
  // US universities
  /\.edu$/i,
  // Most academic TLDs worldwide
  /\.ac\.[a-z]{2,3}$/i,        // .ac.uk, .ac.jp, .ac.nz, .ac.kr, .ac.in, .ac.za, etc.
  /\.edu\.[a-z]{2,3}$/i,       // .edu.au, .edu.cn, .edu.sg, .edu.br, etc.
  /\.uni-[a-z]+\.[a-z]{2,3}$/i, // German universities (e.g. uni-muenchen.de)
];

const ADDITIONAL_KNOWN_ACADEMIC_DOMAINS: string[] = [
  // High-volume academic domains that don't match the patterns above.
  // Add to this list as Mario sees student-bypass cases.
  "ox.ac.uk", "cam.ac.uk", "imperial.ac.uk",
  "harvard.edu", "stanford.edu", "mit.edu", "yale.edu",
];

export function detectStudentEmail(email: string | null | undefined): "student" | null {
  if (!email) return null;
  const lower = email.trim().toLowerCase();
  const domain = lower.split("@")[1];
  if (!domain) return null;
  for (const pattern of ACADEMIC_TLD_PATTERNS) {
    if (pattern.test(domain)) return "student";
  }
  if (ADDITIONAL_KNOWN_ACADEMIC_DOMAINS.includes(domain)) return "student";
  return null;
}
