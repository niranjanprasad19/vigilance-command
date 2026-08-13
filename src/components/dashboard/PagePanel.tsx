export function PagePanel({
  title,
  subtitle,
  children,
  scroll = true,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  return (
    <section className="flex-1 flex flex-col lg:min-h-0 bg-background">
      <header className="px-4 py-3 border-b border-border flex items-baseline gap-3">
        <h1 className="font-mono text-[11px] uppercase tracking-[0.25em] text-cyan">{title}</h1>
        {subtitle && (
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{subtitle}</p>
        )}
      </header>
      <div className={`flex-1 lg:min-h-0 ${scroll ? "lg:overflow-y-auto" : "flex flex-col"}`}>{children}</div>
    </section>
  );
}
