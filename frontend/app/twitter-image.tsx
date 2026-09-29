// Re-export the OpenGraph image for Twitter cards.
// `runtime` must be a string literal in this file — Next.js can't statically
// analyze a re-exported value and falls back to the default runtime.
export const runtime = "edge";
export { default, alt, size, contentType } from "./opengraph-image";
