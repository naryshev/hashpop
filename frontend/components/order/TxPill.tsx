import { cn } from "@/lib/utils";

function shorten(hash: string): string {
  if (hash.length <= 18) return hash;
  return `${hash.slice(0, 9)}…${hash.slice(-6)}`;
}

export function TxPill({
  hash,
  label = "On-chain",
  href,
  pulsing = false,
  onSelect,
}: {
  hash: string | null | undefined;
  label?: string;
  href?: string | null;
  pulsing?: boolean;
  /** If provided, the pill becomes a button and click is delegated here
   *  instead of navigating to `href`. The href can still be passed for
   *  consumers (like the in-app sheet) that show a fallback HashScan link. */
  onSelect?: () => void;
}) {
  if (!hash) return null;
  const interactive = !!(onSelect || href);
  const body = (
    <>
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full bg-chrome shadow-glow",
          pulsing && "animate-[hp-pulse_1.2s_ease-in-out_infinite]",
        )}
      />
      <span className="text-[9px] font-medium opacity-70">{label}</span>
      {shorten(hash)}
      {interactive ? <span className="opacity-50">›</span> : null}
    </>
  );

  const className =
    "inline-flex items-center gap-1.5 rounded-full border border-chrome/30 bg-chrome/[0.07] px-2.5 py-1 font-mono text-[10px] text-chrome no-underline";

  if (onSelect) {
    return (
      <button type="button" onClick={onSelect} className={cn(className, "cursor-pointer")}>
        {body}
      </button>
    );
  }

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {body}
      </a>
    );
  }
  return <div className={className}>{body}</div>;
}
