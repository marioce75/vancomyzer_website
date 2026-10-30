# Admin tier input investigation

Inspected production commit ee88ec92d06055a25a131b046638a483a65dc458. Public health confirms this version. No production user records, credentials or tiers were accessed or changed.

Both Change tier controls use a browser prompt asking for internal IDs. The POST /api/admin set_tier action calls normalizeTier, whose fallback silently returns free. Synthetic HTTP tests demonstrate that individual_pro, department, hospital and free save successfully; Individual Pro, pro, a whitespace-padded hospital value and null all return 200 and store free. Thus a plausible display name can appear to do nothing for a free account, or unintentionally downgrade another tier.

The narrow local fix replaces both free-text prompts with explicit tier selectors and rejects invalid write values with HTTP 400 before any mutation. Legacy read normalization stays unchanged. Cancel does not write. Existing role and session checks remain; anonymous, pharmacist and stale-admin fixtures are rejected (401/403). Adult clinical code and pediatric authorization are unchanged.

The existing action endpoint checks getServerSession and admin role; it does not reuse the pediatric endpoint's stricter fresh-role and MFA checks. That pre-existing difference is not changed by this input fix and merits separate security review. This investigation does not establish that Mario's permissions or MFA caused his symptom.

Validation: TypeScript and HTTP tier-validation tests pass. Synthetic browser detail-drawer selector save and cancel pass. The row-menu selector also saves successfully on a fresh page; all final tests pass. Results are recorded in admin-tier-evidence.json. An intermediate test exposed a pre-existing drawer refresh race: closing immediately after a save can reopen it when the pending refresh completes. That separate race is not changed. No real account mutations occurred.

Pending: Mario's exact UI symptom and entered value have not been supplied, so the reproduced input defect is not confirmed as his particular failure. Native prompt suppression and pre-existing menu clipping remain possible if no prompt appears. No deployment is authorized; this fix remains local for review.
