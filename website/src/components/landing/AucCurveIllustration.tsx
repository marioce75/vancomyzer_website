/**
 * Decorative concentration–time illustration for the landing hero.
 *
 * NOT clinical output and NOT produced by the dosing engine: a hand-shaped,
 * unitless curve (four intermittent infusions, 12 h apart) generated once
 * offline and inlined as static SVG path data. It deliberately carries no
 * numbers, so it cannot be read as a dose, level or AUC for any patient.
 *
 * Server component. Colours are SVG presentation attributes and the legend
 * uses <span>/<div>, so the basic theme's forced heading/paragraph colours
 * inside `.manifesto-dark` don't repaint it.
 */

// viewBox 480×250 · plot x 44→464 (48 h) · baseline y 212
const CURVE =
  "M44 212 L45.8 172.4 L47.5 137.9 L49.3 107.3 L51 80.1 L52.8 55.6 L54.5 72.9 L56.3 87.1 L58 98.8 L59.8 108.4 L61.5 116.5 L63.3 123.2 L65 128.8 L66.8 133.6 L68.5 137.7 L70.3 141.2 L72 144.3 L73.8 147 L75.5 149.4 L77.3 151.6 L79 153.6 L80.8 155.3 L82.5 157 L84.3 158.5 L86 159.9 L87.8 161.3 L89.5 162.6 L91.3 163.8 L93 164.9 L94.8 166 L96.5 167.1 L98.3 168.1 L100 169.1 L101.8 170.1 L103.5 171.1 L105.3 172 L107 172.9 L108.8 173.7 L110.5 174.6 L112.3 175.4 L114 176.2 L115.7 177 L117.5 177.8 L119.3 178.5 L121 179.2 L122.8 180 L124.5 180.7 L126.3 181.3 L128 182 L129.8 182.7 L131.5 183.3 L133.3 183.9 L135 184.5 L136.8 185.1 L138.5 185.7 L140.3 186.3 L142 186.8 L143.8 187.4 L145.5 187.9 L147.3 188.5 L149 189 L150.8 149.9 L152.5 115.8 L154.3 85.8 L156 59 L157.8 35 L159.5 52.7 L161.3 67.4 L163 79.5 L164.8 89.5 L166.5 98 L168.3 105.1 L170 111.1 L171.8 116.3 L173.5 120.8 L175.3 124.7 L177 128.1 L178.8 131.2 L180.5 133.9 L182.3 136.4 L184 138.7 L185.8 140.8 L187.5 142.8 L189.3 144.6 L191 146.4 L192.8 148 L194.5 149.6 L196.3 151.1 L198 152.5 L199.8 153.9 L201.5 155.2 L203.3 156.5 L205 157.8 L206.8 159 L208.5 160.2 L210.3 161.3 L212 162.4 L213.7 163.5 L215.5 164.6 L217.2 165.6 L219 166.6 L220.8 167.6 L222.5 168.6 L224.3 169.6 L226 170.5 L227.8 171.4 L229.5 172.3 L231.3 173.1 L233 174 L234.8 174.8 L236.5 175.6 L238.3 176.4 L240 177.2 L241.8 178 L243.5 178.7 L245.3 179.4 L247 180.1 L248.8 180.8 L250.5 181.5 L252.3 182.2 L254 182.8 L255.8 143.9 L257.5 109.9 L259.3 80 L261 53.4 L262.8 29.5 L264.5 47.4 L266.3 62.1 L268 74.3 L269.8 84.5 L271.5 93 L273.3 100.3 L275 106.4 L276.8 111.7 L278.5 116.3 L280.3 120.3 L282 123.8 L283.8 127 L285.5 129.8 L287.3 132.4 L289 134.8 L290.8 137 L292.5 139 L294.3 140.9 L296 142.7 L297.8 144.4 L299.5 146.1 L301.3 147.7 L303 149.2 L304.8 150.6 L306.5 152 L308.3 153.4 L310 154.7 L311.8 156 L313.5 157.2 L315.3 158.5 L317 159.6 L318.8 160.8 L320.5 161.9 L322.3 163 L324 164.1 L325.8 165.1 L327.5 166.2 L329.3 167.2 L331 168.2 L332.8 169.1 L334.5 170 L336.3 171 L338 171.9 L339.8 172.7 L341.5 173.6 L343.3 174.4 L345 175.2 L346.8 176 L348.5 176.8 L350.3 177.6 L352 178.3 L353.8 179.1 L355.5 179.8 L357.2 180.5 L359 181.2 L360.8 142.3 L362.5 108.4 L364.2 78.5 L366 51.9 L367.8 28 L369.5 45.9 L371.3 60.7 L373 72.9 L374.8 83.2 L376.5 91.7 L378.3 99 L380 105.1 L381.8 110.5 L383.5 115.1 L385.3 119.1 L387 122.6 L388.8 125.8 L390.5 128.7 L392.3 131.3 L394 133.7 L395.8 135.9 L397.5 138 L399.3 139.9 L401 141.8 L402.8 143.5 L404.5 145.2 L406.3 146.8 L408 148.3 L409.7 149.8 L411.5 151.2 L413.3 152.6 L415 153.9 L416.7 155.2 L418.5 156.5 L420.3 157.7 L422 158.9 L423.8 160.1 L425.5 161.2 L427.3 162.3 L429 163.4 L430.8 164.5 L432.5 165.5 L434.3 166.5 L436 167.5 L437.8 168.5 L439.5 169.4 L441.3 170.4 L443 171.3 L444.8 172.2 L446.5 173 L448.3 173.9 L450 174.7 L451.8 175.5 L453.5 176.3 L455.3 177.1 L457 177.9 L458.8 178.6 L460.5 179.3 L462.2 180 L464 180.7";

// Same curve, closed to the baseline over the last 24 h (x 254 → 464).
const AUC_WINDOW =
  "M254 212 L254 182.8 L255.8 143.9 L257.5 109.9 L259.3 80 L261 53.4 L262.8 29.5 L264.5 47.4 L266.3 62.1 L268 74.3 L269.8 84.5 L271.5 93 L273.3 100.3 L275 106.4 L276.8 111.7 L278.5 116.3 L280.3 120.3 L282 123.8 L283.8 127 L285.5 129.8 L287.3 132.4 L289 134.8 L290.8 137 L292.5 139 L294.3 140.9 L296 142.7 L297.8 144.4 L299.5 146.1 L301.3 147.7 L303 149.2 L304.8 150.6 L306.5 152 L308.3 153.4 L310 154.7 L311.8 156 L313.5 157.2 L315.3 158.5 L317 159.6 L318.8 160.8 L320.5 161.9 L322.3 163 L324 164.1 L325.8 165.1 L327.5 166.2 L329.3 167.2 L331 168.2 L332.8 169.1 L334.5 170 L336.3 171 L338 171.9 L339.8 172.7 L341.5 173.6 L343.3 174.4 L345 175.2 L346.8 176 L348.5 176.8 L350.3 177.6 L352 178.3 L353.8 179.1 L355.5 179.8 L357.2 180.5 L359 181.2 L360.8 142.3 L362.5 108.4 L364.2 78.5 L366 51.9 L367.8 28 L369.5 45.9 L371.3 60.7 L373 72.9 L374.8 83.2 L376.5 91.7 L378.3 99 L380 105.1 L381.8 110.5 L383.5 115.1 L385.3 119.1 L387 122.6 L388.8 125.8 L390.5 128.7 L392.3 131.3 L394 133.7 L395.8 135.9 L397.5 138 L399.3 139.9 L401 141.8 L402.8 143.5 L404.5 145.2 L406.3 146.8 L408 148.3 L409.7 149.8 L411.5 151.2 L413.3 152.6 L415 153.9 L416.7 155.2 L418.5 156.5 L420.3 157.7 L422 158.9 L423.8 160.1 L425.5 161.2 L427.3 162.3 L429 163.4 L430.8 164.5 L432.5 165.5 L434.3 166.5 L436 167.5 L437.8 168.5 L439.5 169.4 L441.3 170.4 L443 171.3 L444.8 172.2 L446.5 173 L448.3 173.9 L450 174.7 L451.8 175.5 L453.5 176.3 L455.3 177.1 L457 177.9 L458.8 178.6 L460.5 179.3 L462.2 180 L464 180.7 L464 212 Z";

const DOSE_X = [44, 149, 254, 359];

const LEVELS: { x: number; y: number; label: string; lx: number; ly: number; anchor: "start" | "end" }[] = [
  { x: 380.9, y: 107.9, label: "Level 1", lx: 392, ly: 102, anchor: "start" },
  { x: 459.6, y: 179, label: "Level 2", lx: 456, ly: 202, anchor: "end" },
];

// Draw-on animation for the curve, gated on reduced-motion preference.
const CSS = `
@media (prefers-reduced-motion: no-preference) {
  .vz-curve { stroke-dasharray: 1; stroke-dashoffset: 1; animation: vz-draw 1.8s ease-out 0.35s forwards; }
  .vz-auc { opacity: 0; animation: vz-fade 0.9s ease-out 1.7s forwards; }
}
@keyframes vz-draw { to { stroke-dashoffset: 0; } }
@keyframes vz-fade { to { opacity: 1; } }
`;

export default function AucCurveIllustration() {
  return (
    <figure className="m-0">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div
        className="relative overflow-hidden rounded-lg border p-4 sm:p-5"
        style={{
          borderColor: "#334155",
          background: "rgba(15,23,42,0.6)",
          boxShadow: "0 30px 60px -30px rgba(0,0,0,0.65)",
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#1f5e96" }}>
            AUC-guided dosing
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "#64748b" }}>
            Illustration
          </span>
        </div>

        <svg
          viewBox="0 0 480 250"
          role="img"
          aria-labelledby="vz-auc-illustration-title"
          className="block h-auto w-full"
        >
          <title id="vz-auc-illustration-title">
            Illustration of vancomycin concentration over time with repeated doses, the area under the curve over one 24-hour window shaded, and two measured levels marked
          </title>

          {[72, 122, 172].map((y) => (
            <line key={y} x1={44} x2={464} y1={y} y2={y} stroke="#1e293b" strokeWidth={1} />
          ))}

          <path d={AUC_WINDOW} fill="#1f5e96" fillOpacity={0.16} className="vz-auc" />
          <line x1={254} x2={254} y1={18} y2={212} stroke="#1f5e96" strokeOpacity={0.45} strokeDasharray="4 4" />
          <line x1={464} x2={464} y1={18} y2={212} stroke="#1f5e96" strokeOpacity={0.45} strokeDasharray="4 4" />

          <line x1={44} x2={464} y1={212} y2={212} stroke="#475569" strokeWidth={1.5} />
          <line x1={44} x2={44} y1={14} y2={212} stroke="#475569" strokeWidth={1.5} />

          <path
            d={CURVE}
            fill="none"
            stroke="#1f5e96"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
            className="vz-curve"
          />

          {DOSE_X.map((x) => (
            <path key={x} d={`M${x - 4} 225 L${x + 4} 225 L${x} 218 Z`} fill="#1f5e96" fillOpacity={0.75} />
          ))}

          {LEVELS.map((l) => (
            <g key={l.label}>
              <circle cx={l.x} cy={l.y} r={5.5} fill="#0f172a" stroke="#fbbf24" strokeWidth={2.5} />
              <text x={l.lx} y={l.ly} fontSize={11} fontWeight={600} fill="#fbbf24" textAnchor={l.anchor}>
                {l.label}
              </text>
            </g>
          ))}

          <text x={305} y={202} fontSize={13} fontWeight={700} fill="#5eead4" textAnchor="middle">
            AUC₂₄
          </text>
          <text x={14} y={114} fontSize={11} fill="#94a3b8" textAnchor="middle" transform="rotate(-90 14 114)">
            Concentration
          </text>
          <text x={44} y={242} fontSize={11} fill="#94a3b8">
            Time · ▲ dose
          </text>
          <text x={359} y={242} fontSize={11} fill="#94a3b8" textAnchor="middle">
            24-hour window
          </text>
        </svg>

        <div className="mt-3 space-y-1 text-xs leading-relaxed" style={{ color: "#94a3b8" }}>
          <span className="block">Shaded area: AUC₂₄, the area under the concentration–time curve over 24 hours.</span>
          <span className="block">Amber points: measured levels used to individualize the estimate.</span>
        </div>
      </div>
    </figure>
  );
}
