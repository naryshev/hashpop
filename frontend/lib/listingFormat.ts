/**
 * Shared listing formatting and status utilities.
 */

export function formatListingId(id: string): string {
  if (!id || !id.startsWith("0x") || id.length !== 66) return id;
  try {
    const hex = id.slice(2).replace(/0+$/, "");
    if (hex.length % 2) return id;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    const str = new TextDecoder().decode(bytes);
    return /^[\x20-\x7e]+$/.test(str) ? str : `${id.slice(0, 10)}…`;
  } catch {
    return `${id.slice(0, 10)}…`;
  }
}

export function normalizeListingStatus(status?: string): string {
  return String(status || "").trim().toUpperCase();
}

export function isActiveStatus(status?: string): boolean {
  return normalizeListingStatus(status) === "LISTED";
}

export type StatusBadgeResult = {
  label: string;
  className: string;
  glowClass?: string;
  pulseDot?: boolean;
};

export function getStatusBadge(status?: string): StatusBadgeResult {
  const normalized = normalizeListingStatus(status);
  if (normalized === "LISTED") {
    return {
      label: "ACTIVE",
      className:
        "bg-green-500/10 text-green-600 border-green-500/20 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30",
      glowClass: "shadow-[0_0_24px_rgba(52,211,153,0.32)]",
      pulseDot: true,
    };
  }
  if (normalized === "LOCKED") {
    return {
      label: "LOCKED",
      className: "bg-amber-500/20 border-amber-400/40 text-amber-200",
      glowClass: "shadow-[0_0_24px_rgba(251,191,36,0.3)]",
    };
  }
  if (normalized === "CANCELLED") {
    return {
      label: "CANCELLED",
      className: "bg-zinc-500/20 border-zinc-300/40 text-zinc-200",
      glowClass: "shadow-[0_0_24px_rgba(161,161,170,0.28)]",
    };
  }
  return {
    label: "SOLD",
    className: "bg-rose-500/20 border-rose-400/40 text-rose-200",
    glowClass: "shadow-[0_0_24px_rgba(251,113,133,0.28)]",
  };
}
