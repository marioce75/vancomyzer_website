export function Header() {
  return (
    <header className="py-8 bg-sky-50 border-b">
      <div className="container mx-auto px-4">
        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-sky-900">
            Vancomyzer®
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Aligned with current IDSA/ASHP vancomycin monitoring guidelines
          </p>
          <div className="text-sm font-medium text-sky-900">
            Hit that AUC target—fast
          </div>
        </div>
      </div>
    </header>
  );
}