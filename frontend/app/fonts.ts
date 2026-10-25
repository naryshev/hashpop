import localFont from "next/font/local";

/**
 * Direction C faces. next/font/local self-hosts the files in frontend/fonts
 * and exposes each family as a CSS variable. The ℏ glyph (U+210F) is a
 * Noto Sans Mono subset stacked immediately after every family — Clash,
 * General Sans, and Plex do not include it.
 * Licenses: frontend/fonts/README.txt.
 */

export const clashDisplay = localFont({
  src: "../fonts/ClashDisplay-Variable.woff2",
  weight: "200 700",
  style: "normal",
  display: "swap",
  variable: "--font-display",
  adjustFontFallback: false,
  preload: true,
});

export const generalSans = localFont({
  src: "../fonts/GeneralSans-Variable.woff2",
  weight: "200 700",
  style: "normal",
  display: "swap",
  variable: "--font-sans",
  adjustFontFallback: false,
  preload: true,
});

export const plexMono = localFont({
  src: [
    { path: "../fonts/IBMPlexMono-500.woff2", weight: "400", style: "normal" },
    { path: "../fonts/IBMPlexMono-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/IBMPlexMono-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/IBMPlexMono-600.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-mono",
  adjustFontFallback: false,
  // Secondary face. Preloading it competes with the LCP image on mobile.
  preload: false,
});

/**
 * Single-glyph face. unicode-range keeps it from painting any other character.
 * size-adjust pulls the subset down to about 0.9em so ℏ sits with the digits.
 * The italic src is the same file so an existing italic ℏ does not get a faux slant.
 */
export const hbarGlyph = localFont({
  src: [
    { path: "../fonts/NotoSansMono-U210F.woff2", weight: "100 900", style: "normal" },
    { path: "../fonts/NotoSansMono-U210F.woff2", weight: "100 900", style: "italic" },
  ],
  display: "swap",
  variable: "--font-hbar",
  adjustFontFallback: false,
  preload: false,
  declarations: [
    { prop: "unicode-range", value: "U+210F" },
    { prop: "size-adjust", value: "90%" },
  ],
});
