import clsx from "clsx";

export function Panel({
  title,
  titleNote,
  action,
  footer,
  className,
  bodyClassName,
  children,
}: {
  title?: string;
  titleNote?: string;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={clsx(
        "flex flex-col rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-1)] p-4 transition-shadow hover:shadow-sm hover:shadow-black/5",
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-text-primary">
            {title}
            {titleNote && <span className="ml-1.5 text-[13px] font-normal text-text-muted">{titleNote}</span>}
          </h2>
          {action}
        </div>
      )}
      <div className={clsx("flex-1", bodyClassName)}>{children}</div>
      {footer && <div className="mt-3 border-t border-[var(--border-hairline)] pt-2.5">{footer}</div>}
    </section>
  );
}
