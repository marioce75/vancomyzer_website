import React from 'react';

export default function References() {
  return (
    <ol className="space-y-2 list-decimal pl-6" style={{ paddingLeft: '1.25rem' }}>
      <li>
        Rybak MJ, Le J, Lodise TP, et al. Therapeutic Monitoring of Vancomycin for Serious MRSA Infections (2020).
        <a href="https://www.idsociety.org/practice-guideline/vancomycin/" target="_blank" rel="noreferrer"> Guideline</a>
      </li>
      <li>
        Johnson S, et al. 2021 Focused Update on CDI.
        <a href="https://www.idsociety.org/practice-guideline/clostridioides-difficile/" target="_blank" rel="noreferrer"> IDSA/SHEA</a>
      </li>
      <li>
        ASHP Vancomycin Monitoring Resources.
        <a href="https://www.ashp.org/" target="_blank" rel="noreferrer"> ASHP</a>
      </li>
      <li>Winter ME. Basic Clinical Pharmacokinetics. (Text)</li>
      <li>Primary PK sources cited within the 2020 consensus guideline.</li>
    </ol>
  );
}
