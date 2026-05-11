import { Fragment } from "react";
import { HP, OrderState } from "./tokens";

const STEPS: OrderState[] = ["paid", "shipped", "delivered", "released"];
const LABELS = ["Paid", "Shipped", "Delivered", "Released"];

export function Stepper({ state }: { state: OrderState }) {
  const idx = STEPS.indexOf(state);
  const isDisputed = state === "disputed";

  return (
    <div style={{ padding: "8px 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {STEPS.map((s, i) => {
          const active = i <= idx && !isDisputed;
          return (
            <Fragment key={s}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 9999,
                  flexShrink: 0,
                  background: active ? HP.chrome : "rgba(255,255,255,0.06)",
                  border: active
                    ? "1px solid rgba(0,255,163,0.6)"
                    : "1px solid rgba(255,255,255,0.12)",
                  color: active ? "#000" : HP.muted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 800,
                  boxShadow: active && i === idx ? HP.glow : "none",
                  transition: "all 200ms ease",
                }}
              >
                {active && i < idx ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    borderRadius: 2,
                    background: i < idx && !isDisputed ? HP.chrome : "rgba(255,255,255,0.08)",
                    transition: "background 200ms ease",
                  }}
                />
              )}
            </Fragment>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
          fontSize: 9,
          color: HP.muted,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {LABELS.map((label, i) => (
          <span key={label} style={{ color: idx >= i && !isDisputed ? HP.fg : undefined }}>
            {label}
          </span>
        ))}
      </div>
      {isDisputed && (
        <div
          style={{
            marginTop: 10,
            padding: 8,
            borderRadius: 8,
            background: "rgba(244,63,94,0.08)",
            border: "1px solid rgba(244,63,94,0.3)",
            fontSize: 11,
            color: "#fda4af",
            textAlign: "center",
          }}
        >
          Dispute opened — arbiter will respond within 24h
        </div>
      )}
    </div>
  );
}
