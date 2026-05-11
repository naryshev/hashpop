import { HP } from "./tokens";

function shorten(hash: string): string {
  if (hash.length <= 18) return hash;
  return `${hash.slice(0, 9)}…${hash.slice(-6)}`;
}

export function TxPill({
  hash,
  label = "On-chain",
  href,
  pulsing = false,
}: {
  hash: string | null | undefined;
  label?: string;
  href?: string | null;
  pulsing?: boolean;
}) {
  if (!hash) return null;
  const body = (
    <>
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: 9999,
          background: HP.chrome,
          boxShadow: "0 0 4px rgba(0,255,163,0.8)",
          animation: pulsing ? "hp-pulse 1.2s ease-in-out infinite" : undefined,
        }}
      />
      <span
        style={{
          opacity: 0.7,
          fontFamily: "system-ui",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontSize: 9,
        }}
      >
        {label}
      </span>
      {shorten(hash)}
      {href ? <span style={{ opacity: 0.5 }}>↗</span> : null}
    </>
  );

  const shared = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 9px",
    borderRadius: 9999,
    border: "1px solid rgba(0,255,163,0.3)",
    background: "rgba(0,255,163,0.07)",
    fontSize: 10,
    fontFamily: "ui-monospace,Menlo,monospace",
    color: HP.chrome,
    textDecoration: "none",
  } as const;

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" style={shared}>
        {body}
      </a>
    );
  }
  return <div style={shared}>{body}</div>;
}
