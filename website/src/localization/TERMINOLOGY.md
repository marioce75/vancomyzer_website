# Regional terminology and review gates

Target locales: Spanish as used in Spain (es-ES), French as used in France (fr-FR). Language selection changes presentation only: number parsers, numeric values, units, model inputs, timestamps, defaults and clinical algorithms remain unchanged. Existing decimal examples intentionally retain the accepted source spelling. Dates retain the explicitly labelled source order.

## Primary references supplied by the research task, 2026-10-05

Terminology references only; their dosing recommendations are not imported into either calculator.

- Spain, AEMPS CIMA: https://cima.aemps.es/cima/dochtml/ft/67283/FichaTecnica_67283.html
- Spain, SEFH monitoring: https://formacion.sefh.es/dpc/sefh-curso-proa/modulo2/tema09_pagina03.php
- Spain, SEFH CMI: https://formacion.sefh.es/dpc/sefh-curso-proa/modulo2/tema08_pagina11.php
- France, ANSM RCP: https://base-donnees-publique.medicaments.gouv.fr/medicament/66193112/extrait
- France, CHU Lille: https://biologiepathologie.chu-lille.fr/catalogue-analyses/Detail.php?codeCatalogueAnalyses=5093
- France, CNPM: https://pharmacomedicale.org/pharmacologie/dosage-des-medicaments-suivi-therapeutique-pharmacologique/43-exemples-de-dosages-en-clinique
- France, SFPC: https://sfpc.eu/webinaire-pharmacie-clinique-et-anesthesie-sfar-et-sfpc-antibiotiques-en-reanimation/
- France, SFPT statistical terminology: https://sfpt-fr.org/livreblancmethodo/source/nouvelles%20methodo.pdf

| Concept | es-ES | fr-FR |
|---|---|---|
| Dosing regimen | pauta posológica | schéma posologique |
| Loading / maintenance dose | dosis de carga / mantenimiento | dose de charge / d’entretien |
| IV infusion | perfusión intravenosa | perfusion intraveineuse |
| Trough | concentración valle | concentration résiduelle (Cmin) |
| Peak | concentración pico | concentration maximale (Cmax, pic) |
| Creatinine clearance | aclaramiento de creatinina | clairance de la créatinine |
| Serum creatinine | creatinina sérica | créatinine sérique (créatininémie) |
| Therapeutic drug monitoring | monitorización farmacocinética | suivi thérapeutique pharmacologique (STP) |
| Steady state | estado estacionario | état d’équilibre |
| MIC in prose | CMI, concentración mínima inhibitoria | CMI, concentration minimale inhibitrice |
| Confidence / credible / prediction interval | intervalo de confianza / credibilidad / predicción | intervalle de confiance / crédibilité / prédiction |
| Renal replacement therapy | tratamiento renal sustitutivo | épuration extrarénale (EER) |

Never substitute a laboratory sampling peak for the modeled end-of-infusion Cmax. Preserve source timing definitions; do not invent a sampling protocol. CrCl in mL/min is distinct from indexed estimates in mL/min/1.73 m². Latent concentration is an underlying modeled estimate, not the true concentration. AUC24, AUC0–24, next-24h and steady-state windows are distinct. Clinical validation pending does not mean underway. Developer-run synthetic checks are not independent methods review or clinical validation. Not evaluated or not validated must not become contraindicated.

## Source claims requiring owner/clinical/legal review

- Dosys pilot metadata promises full access, onboarding, outcomes tracking and a published case study at zero cost; verify this offer against the actual evaluation programme.
- Dosys PN metadata mentions osmolarity although the current evaluation UI limits that capability; reconcile the English claim before publication, rather than silently inventing a different translated claim.
- Vancomyzer compliance metadata advertises SOC 2 documentation; verify availability and status.
- Source peak/trough sampling claims, claims of highest accuracy and fixed timing suggestions require clinical review; translation does not validate them.
- FDA/non-device CDS, warranty, liability, indemnification, privacy and consent wording require counsel review. No European regulatory status is implied by use of Spain/France terminology.
- Legal translations preserve the English source meaning and current acceptance version. Counsel must determine the release version/renewed-consent policy before publishing translated legal text.

Additional functional privacy disclosure: local draft pages now describe the site-language preference cookie (one year, language choice only, no patient values). Dosys English cookie-purpose text was updated to include language preference; counsel must review this wording before release.
