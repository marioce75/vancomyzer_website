export default function CalculatorLoadingState() {
  return (
    <div
      className="flex min-h-[180px] w-full max-w-xl flex-col items-center justify-center p-8"
      style={{ border: "1px solid rgba(0,255,65,0.4)", background: "#050505" }}
    >
      <p
        className="text-lg font-bold tracking-[0.2em] uppercase"
        style={{ color: "#00ff41", fontFamily: "'Share Tech Mono', monospace" }}
      >
        {">"} RUNNING PK MODEL
        <span className="mx-blink" style={{ color: "#00ff41" }}>_</span>
      </p>
      <p
        className="mt-3 text-sm tracking-[0.12em]"
        style={{ color: "#1a5c1a", fontFamily: "'Share Tech Mono', monospace" }}
      >
        calculating exposure metrics and regimen guidance
      </p>
    </div>
  );
}
