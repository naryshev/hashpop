import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Hashpop - Community marketplace on Hedera";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)",
          position: "relative",
        }}
      >
        {/* Gradient accent circles */}
        <div
          style={{
            position: "absolute",
            top: -100,
            right: -100,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -80,
            left: -80,
            width: 350,
            height: 350,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(234,88,12,0.12) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://hashpop.io/hashpop-cart-3d.PNG"
          alt="Hashpop Logo"
          width={220}
          height={220}
          style={{ objectFit: "contain", marginBottom: 24 }}
        />

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            background: "linear-gradient(90deg, #3b82f6, #22c55e, #eab308)",
            backgroundClip: "text",
            color: "transparent",
            letterSpacing: "-2px",
            display: "flex",
          }}
        >
          Hashpop
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: "#a1a1aa",
            marginTop: 12,
            display: "flex",
          }}
        >
          Buy and sell on the Hedera network
        </div>

        {/* Bottom bar accent */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6)",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
