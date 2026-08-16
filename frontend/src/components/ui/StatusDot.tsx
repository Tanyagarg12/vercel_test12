const TONE: Record<string, { color: string; label?: string }> = {
  ONLINE: { color: "var(--status-good)" },
  ACTIVE: { color: "var(--status-good)" },
  OFFLINE: { color: "var(--text-muted)" },
  FAULTY: { color: "var(--status-critical)" },
};

export function StatusDot({ status }: { status: string }) {
  const tone = TONE[status] ?? { color: "var(--text-muted)" };
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary">
      <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: tone.color }} />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
