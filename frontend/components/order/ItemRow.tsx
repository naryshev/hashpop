import { HP } from "./tokens";

export function ItemRow({
  title,
  image,
  seller,
  priceHbar,
  priceUsd,
  compact = false,
}: {
  title: string;
  image?: string | null;
  seller: string;
  priceHbar: string;
  priceUsd?: string | null;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: compact ? 0 : 14,
        borderRadius: 14,
        background: compact ? "transparent" : HP.glassCard,
        border: compact ? "none" : `1px solid ${HP.border}`,
      }}
    >
      <div
        style={{
          width: compact ? 44 : 64,
          height: compact ? 44 : 64,
          borderRadius: 12,
          background: "linear-gradient(135deg,#3b3b56,#1a1a2e)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: compact ? 22 : 30,
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span aria-hidden>📦</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: compact ? 14 : 15,
            color: HP.fg,
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 11,
            color: HP.muted,
            fontFamily: "ui-monospace,Menlo,monospace",
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          by {seller}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: compact ? 14 : 16, fontWeight: 700, color: HP.chrome }}>
          {priceHbar} ℏ
        </div>
        {priceUsd && <div style={{ fontSize: 10, color: HP.muted }}>{priceUsd}</div>}
      </div>
    </div>
  );
}
