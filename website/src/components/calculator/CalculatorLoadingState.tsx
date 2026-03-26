export default function CalculatorLoadingState() {
  return (
    <div
      className="flex min-h-[180px] w-full max-w-xl flex-col items-center justify-center p-8"
      style={{ border: "1px solid var(--color-primary-a40)", background: "var(--color-card)" }}
    >
      <p
        className="text-lg font-bold tracking-[0.2em] uppercase"
        style={{ color: "var(--color-primary)", fontFamily: "'Share Tech Mono', monospace" }}
      >
        {">"} RUNNING PK MODEL
        <span className="mx-blink" style={{ color: "var(--color-primary)" }}>_</span>
      </p>
      <p
        className="mt-3 text-sm tracking-[0.12em]"
        style={{ color: "var(--color-dim)", fontFamily: "'Share Tech Mono', monospace" }}
      >
        calculating exposure metrics and regimen guidance
      </p>
    </div>
  );
}
