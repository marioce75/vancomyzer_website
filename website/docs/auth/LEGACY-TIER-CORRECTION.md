# Legacy tier selector correction

Production base: 6c4721146c8ef83243a36b1ef10ea9760cf48986. A synthetic enterprise account previously submitted enterprise unchanged, received HTTP 400 and kept its stored value. The selector now initializes and reopens as Hospital, matching existing entitlement normalization. Saving explicitly submits hospital; cancel leaves enterprise untouched. There is no automatic database migration or account change.

Strict API validation, authorization, clinical calculations and the separate MFA correction are unchanged. This release excludes the separate sign-in test follow-up. Synthetic HTTP/browser tier tests and TypeScript checks pass; before/after evidence is in legacy-tier-evidence.json. No real accounts were used.

Rollback: revert the release PR and deploy through the existing main-branch workflow.
