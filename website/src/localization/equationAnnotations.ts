import type { Locale } from "./catalog";

/** Presentation-only equation annotations. */
const annotations: [string, string, string, string][] = [
  [
    "Typical values",
    "Valores típicos",
    "Valeurs types",
    "Valores típicos"
  ],
  [
    "Table 3",
    "Tabla 3",
    "Tableau 3",
    "Tabela 3"
  ],
  [
    "L/h per 70 kg",
    "L/h por 70 kg",
    "L/h pour 70 kg",
    "L/h por 70 kg"
  ],
  [
    "L per 70 kg",
    "L por 70 kg",
    "L pour 70 kg",
    "L por 70 kg"
  ],
  [
    "weeks (maturation half-point)",
    "semanas (punto medio de maduración)",
    "semaines (point médian de maturation)",
    "semanas (ponto médio de maturação)"
  ],
  [
    "(maturation Hill coefficient)",
    "(coeficiente de Hill de maduración)",
    "(coefficient de Hill de maturation)",
    "(coeficiente de Hill de maturação)"
  ],
  [
    "years (PMA at which ageing halves CL)",
    "años (PMA en la que el envejecimiento reduce CL a la mitad)",
    "ans (PMA à laquelle le vieillissement réduit CL de moitié)",
    "anos (PMA em que o envelhecimento reduz CL à metade)"
  ],
  [
    "(age-decline Hill coefficient)",
    "(coeficiente de Hill de disminución por edad)",
    "(coefficient de Hill de diminution liée à l’âge)",
    "(coeficiente de Hill de redução com a idade)"
  ],
  [
    "per mg/dL",
    "por mg/dL",
    "par mg/dL",
    "por mg/dL"
  ],
  [
    "Typical-adult reference check",
    "Comprobación de referencia para un adulto típico",
    "Vérification de référence pour un adulte type",
    "Verificação de referência para um adulto típico"
  ],
  [
    "Fat-free mass",
    "Masa libre de grasa",
    "Masse maigre",
    "Massa livre de gordura"
  ],
  [
    "Male:",
    "Hombre:",
    "Homme :",
    "Masculino:"
  ],
  [
    "Female:",
    "Mujer:",
    "Femme :",
    "Feminino:"
  ],
  [
    "Cockcroft-Gault CrCl, on TBW, adjusted body weight or FFM:",
    "CrCl de Cockcroft-Gault, con TBW, peso corporal ajustado o FFM:",
    "CrCl de Cockcroft-Gault, avec TBW, poids corporel ajusté ou FFM :",
    "CrCl de Cockcroft-Gault, com TBW, peso corporal ajustado ou FFM:"
  ],
  [
    "[× 0.85 if female]",
    "[× 0.85 si es mujer]",
    "[× 0.85 pour une femme]",
    "[× 0.85 se feminino]"
  ],
  [
    "50 kg (male) or 45.5 kg (female) + 2.3 kg per inch over 60 in",
    "50 kg (hombre) o 45.5 kg (mujer) + 2.3 kg por pulgada por encima de 60 in",
    "50 kg (homme) ou 45.5 kg (femme) + 2.3 kg par pouce au-delà de 60 in",
    "50 kg (masculino) ou 45.5 kg (feminino) + 2.3 kg por polegada acima de 60 in"
  ],
  [
    "Half-lives:",
    "Semividas:",
    "Demi-vies :",
    "Meias-vidas:"
  ],
  [
    "distribution half-life",
    "semivida de distribución",
    "demi-vie de distribution",
    "meia-vida de distribuição"
  ],
  [
    "terminal elimination half-life",
    "semivida de eliminación terminal",
    "demi-vie d’élimination terminale",
    "meia-vida de eliminação terminal"
  ],
  [
    "(infusion rate, mg/h)",
    "(velocidad de infusión, mg/h)",
    "(débit de perfusion, mg/h)",
    "(velocidade de infusão, mg/h)"
  ],
  [
    "During infusion",
    "Durante la infusión",
    "Pendant la perfusion",
    "Durante a infusão"
  ],
  [
    "After infusion",
    "Después de la infusión",
    "Après la perfusion",
    "Após a infusão"
  ],
  [
    "for k =",
    "para k =",
    "pour k =",
    "para k ="
  ],
  [
    "where t ≥",
    "donde t ≥",
    "où t ≥",
    "onde t ≥"
  ],
  [
    "Number of doses simulated:",
    "Número de dosis simuladas:",
    "Nombre de doses simulées :",
    "Número de doses simuladas:"
  ],
  [
    "This ensures the graph spans enough time for concentrations\nto approach steady state.",
    "Esto garantiza que el gráfico abarque tiempo suficiente para que las concentraciones\nse aproximen al estado estacionario.",
    "Cela garantit une durée suffisante sur le graphique pour que les concentrations\napprochent l’état d’équilibre.",
    "Isso garante que o gráfico cubra tempo suficiente para as concentrações\nse aproximarem do estado de equilíbrio."
  ],
  [
    "Dose times (dose 1 = loading dose, N doses given):",
    "Tiempos de administración (dosis 1 = dosis de carga, N dosis administradas):",
    "Horaires des administrations (dose 1 = dose de charge, N doses administrées) :",
    "Horários das doses (dose 1 = dose de ataque, N doses administradas):"
  ],
  [
    "loading dose,",
    "dosis de carga,",
    "dose de charge,",
    "dose de ataque,"
  ],
  [
    "loading infusion",
    "infusión de carga",
    "perfusion de charge",
    "infusão da dose de ataque"
  ],
  [
    "maintenance,",
    "mantenimiento,",
    "entretien,",
    "manutenção,"
  ],
  [
    "maintenance infusion",
    "infusión de mantenimiento",
    "perfusion d’entretien",
    "infusão de manutenção"
  ],
  [
    "(G = gap to first maintenance dose; default τ)",
    "(G = intervalo hasta la primera dosis de mantenimiento; predeterminado τ)",
    "(G = délai avant la première dose d’entretien ; valeur par défaut τ)",
    "(G = intervalo até a primeira dose de manutenção; padrão τ)"
  ],
  [
    "Predicted level drawn Δt after dose N started:",
    "Concentración predicha medida Δt después del inicio de la dosis N:",
    "Concentration prédite prélevée Δt après le début de la dose N :",
    "Concentração prevista para a coleta Δt após o início da dose N:"
  ],
  [
    "The steady-state projection of the maintenance regimen (section 5)\ndoes not depend on the loading dose.",
    "La proyección en estado estacionario de la pauta de mantenimiento (sección 5)\nno depende de la dosis de carga.",
    "La projection à l’état d’équilibre du schéma d’entretien (section 5)\nne dépend pas de la dose de charge.",
    "A projeção em estado de equilíbrio do esquema de manutenção (seção 5)\nnão depende da dose de ataque."
  ],
  [
    "Equivalently:",
    "De forma equivalente:",
    "De manière équivalente :",
    "De forma equivalente:"
  ],
  [
    "(TDD = total daily dose)",
    "(TDD = dosis diaria total)",
    "(TDD = dose quotidienne totale)",
    "(TDD = dose diária total)"
  ],
  [
    "This is exact under linear PK; peak and trough use the\ntwo-compartment steady-state superposition formula\n(not the multi-dose simulation) for maximum numerical accuracy.",
    "Esto es exacto con PK lineal; las concentraciones máxima y mínima utilizan la\nfórmula de superposición bicompartimental en estado estacionario\n(no la simulación de dosis múltiples) para lograr la máxima exactitud numérica.",
    "Ceci est exact en PK linéaire ; le pic et la concentration résiduelle utilisent la\nformule de superposition bicompartimentale à l’état d’équilibre\n(et non la simulation à doses multiples) pour une exactitude numérique maximale.",
    "Isso é exato sob farmacocinética linear; o pico e o vale utilizam a\nfórmula de superposição bicompartimental em estado de equilíbrio\n(não a simulação de doses múltiplas) para máxima precisão numérica."
  ],
  [
    "minimize",
    "minimizar",
    "minimiser",
    "minimizar"
  ],
  [
    "Assay error model:",
    "Modelo de error analítico:",
    "Modèle d’erreur analytique :",
    "Modelo de erro do ensaio:"
  ],
  [
    "Bounds: each fitted parameter is limited to between one-tenth and ten times its prior value.",
    "Límites: cada parámetro ajustado se limita a entre una décima parte y diez veces su valor previo.",
    "Bornes : chaque paramètre ajusté est limité entre un dixième et dix fois sa valeur a priori.",
    "Limites: cada parâmetro ajustado é limitado a um décimo até dez vezes seu valor a priori."
  ],
  [
    "Prior log-SDs (Vancomyzer settings, all adults):",
    "DE logarítmicas previas (ajustes de Vancomyzer, todos los adultos):",
    "Écarts-types logarithmiques a priori (paramètres de Vancomyzer, tous les adultes) :",
    "Desvios-padrão logarítmicos a priori (configurações do Vancomyzer, todos os adultos):"
  ],
  [
    "Proposal:",
    "Propuesta:",
    "Proposition :",
    "Proposta:"
  ],
  [
    "Hessian of the objective",
    "Hessiana de la función objetivo",
    "Hessienne de la fonction objectif",
    "Hessiana da função objetivo"
  ],
  [
    "Weight:",
    "Ponderación:",
    "Pondération :",
    "Peso:"
  ],
  [
    "Resample:",
    "Remuestreo:",
    "Rééchantillonnage :",
    "Reamostrar:"
  ],
  [
    "400 draws, systematic resampling",
    "400 extracciones, remuestreo sistemático",
    "400 tirages, rééchantillonnage systématique",
    "400 amostras, reamostragem sistemática"
  ],
  [
    "Band(t):    5th and 95th percentile of C(t) across the 400 draws",
    "Band(t):    percentiles 5 y 95 de C(t) en las 400 extracciones",
    "Band(t):    percentiles 5 et 95 de C(t) sur les 400 tirages",
    "Band(t):    percentis 5 e 95 de C(t) nas 400 amostras"
  ],
  [
    "(years)",
    "(años)",
    "(ans)",
    "(anos)"
  ],
  [
    "(≈1 for adults)",
    "(≈1 para adultos)",
    "(≈1 chez les adultes)",
    "(≈1 para adultos)"
  ],
  [
    "SCr in mg/dL",
    "SCr en mg/dL",
    "SCr en mg/dL",
    "SCr em mg/dL"
  ],
  [
    "Age 35 y, weight 70 kg, SCr 0.83 mg/dL",
    "Edad 35 años, peso 70 kg, SCr 0.83 mg/dL",
    "Âge 35 ans, poids 70 kg, SCr 0.83 mg/dL",
    "Idade 35 anos, peso 70 kg, SCr 0.83 mg/dL"
  ]
];

export function translateEquationAnnotations(source: string, locale: Locale): string {
  if (locale === "en") return source;
  // One pass over the original source: translated words can never match again.
  const alternatives = [...annotations].sort((a, b) => b[0].length - a[0].length);
  const escaped = alternatives.map(([key]) => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return source.replace(new RegExp(escaped.join("|"), "g"), match => alternatives.find(([key]) => key === match)![locale === "pt-BR" ? 3 : locale === "es" ? 1 : 2]);
}
