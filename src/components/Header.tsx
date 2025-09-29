import { DisclaimerBanner } from "./DisclaimerBanner";

export function Header() {
  return (
    <header className="py-8 bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">
      <div className="container mx-auto px-4">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Vancomyzer
          </h1>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
            Professional vancomycin dosing calculator with advanced pharmacokinetic modeling
          </p>
          <div className="text-sm opacity-75">
            Evidence-based dosing • Population pharmacokinetics • Clinical decision support
          </div>
        </div>
      </div>
    </header>
  );
}