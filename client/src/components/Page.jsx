export function PageHeader({ eyebrow, title, description, action }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 fade-in">
      <div>
        {eyebrow && <p className="label mb-3">{eyebrow}</p>}
        <h1 className="font-serif text-4xl leading-none tracking-tight text-fg sm:text-[44px]">{title}</h1>
        {description && <p className="mt-3 max-w-xl text-sm text-muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function Section({ title, aside, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || aside) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="label">{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
