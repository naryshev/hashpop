// Same v2 PNG as /opengraph-image. `runtime` must be a string literal here —
// Next.js can't statically analyze a re-exported value.
export const runtime = "nodejs";
export { default, alt, size, contentType } from "./opengraph-image";
