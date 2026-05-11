"use client";

import { useMemo } from "react";

type Point = { t: number; balance: number };

/**
 * Mint-tinted area chart used by the dashboard wallet card. Renders a smooth
 * polyline + bottom-fading area. Empty data yields a single flat baseline so
 * the card still has visual weight while history is loading.
 */
export function Sparkline({
  points,
  height = 140,
  color = "#00ffa3",
}: {
  points: Point[];
  height?: number;
  color?: string;
}) {
  const { line, area } = useMemo(() => {
    if (!points.length) {
      const mid = height * 0.6;
      return {
        line: `M0,${mid} L600,${mid}`,
        area: `M0,${mid} L600,${mid} L600,${height} L0,${height} Z`,
      };
    }
    const xs = points.map((p) => p.t);
    const ys = points.map((p) => p.balance);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const xRange = maxX - minX || 1;
    const yRange = maxY - minY || 1;
    const pad = 10;
    const proj = points.map((p) => {
      const x = ((p.t - minX) / xRange) * 600;
      const y = pad + ((maxY - p.balance) / yRange) * (height - pad * 2);
      return [x, y] as const;
    });
    const line = proj
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
    const last = proj[proj.length - 1];
    const first = proj[0];
    const area = `${line} L${last[0].toFixed(1)},${height} L${first[0].toFixed(1)},${height} Z`;
    return { line, area };
  }, [points, height]);

  const gradId = useMemo(() => `hp-sl-${Math.random().toString(36).slice(2, 9)}`, []);

  return (
    <svg viewBox={`0 0 600 ${height}`} preserveAspectRatio="none" style={{ width: "100%", height }}>
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} stroke={color} strokeWidth={2} fill="none" />
    </svg>
  );
}
