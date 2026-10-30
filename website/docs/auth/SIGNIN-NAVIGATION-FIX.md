# Sign In navigation: stale session redirect

Production `/api/health` identifies commit `9e2b376073d2b30787239f49a4ac5444b45c162a`. In a fresh in-app browser, the live homepage Sign In link reaches `/login` and displays the form. The Mac Chrome connection was unavailable. No real credentials or patient data were accessed.

On deployed-equivalent source, isolated browser fixtures reproduce the reported symptom: expired-admin and superseded-admin sessions return no session user, so the header displays Sign In. However, middleware decodes the still-signed cookie and redirects `/login` back to `/calculator`. Both fixtures had the login form absent after clicking and pediatric API status 403. An anonymous fixture correctly reached login.

The narrow fix removes only the cookie-based redirect away from the public `/login` route. The registration redirect remains. Login does not grant access or modify credentials; successful credential verification is still required. Admin, MFA, session binding and pediatric authorization guards are unchanged. Adult clinical code is unchanged. The separate MFA-navigation fix is not included.

Validation: TypeScript and whitespace checks pass. The initial fixed browser matrix passes anonymous, expired-admin, superseded-admin, valid-admin and pending-MFA cases, each reaching the visible login form. Unauthorized fixtures remain denied by the pediatric API (401/403). The final expanded regression passes all seven browser scenarios and covers navigation from calculator fixtures too (direct `/login` navigation when the fixture does not expose its header link; actual link clicks are verified on the homepage), magic-link form routing, and the retained registration redirect. Synthetic fixtures copy source and schema only, never existing DB or environment files.

Not pushed or deployed. This explains the reported behavior in stale-session states, but Mario's exact browser session has not been inspected. Report this proposed fix before any production release.
