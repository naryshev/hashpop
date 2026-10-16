import { cn } from "../lib/utils";

/**
 * Mint ring-o, unchanged paths. ViewBox is only the ring so it can sit in
 * the word as the "o". A small side margin keeps it off the neighboring p.
 */
function RingO() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="117.95 7.19 20.64 20.76"
      aria-hidden
      className="ml-[0.1em] mr-[0.12em] h-[0.72em] w-[0.72em] shrink-0 translate-y-[0.06em]"
    >
      <g id="ring-o" data-testid="hashpop-ring-o" fill="var(--color-chrome)">
        <path d="M129.64 7.39 A10.28 10.28 0 0 1 138.39 16.14 L133.06 16.89 A4.9 4.9 0 0 0 128.89 12.72 Z" />
        <path d="M138.39 19.00 A10.28 10.28 0 0 1 129.64 27.75 L128.89 22.42 A4.9 4.9 0 0 0 133.06 18.25 Z" />
        <path d="M126.78 27.75 A10.28 10.28 0 0 1 120.11 23.90 L124.35 20.59 A4.9 4.9 0 0 0 127.53 22.42 Z" />
        <path d="M118.68 21.42 A10.28 10.28 0 0 1 118.15 15.43 L123.42 16.55 A4.9 4.9 0 0 0 123.67 19.41 Z" />
        <path d="M119.13 12.74 A10.28 10.28 0 0 1 126.78 7.39 L127.53 12.72 A4.9 4.9 0 0 0 123.88 15.27 Z" />
      </g>
    </svg>
  );
}

/**
 * Hashpop wordmark. Clash Display 600 at -0.02em. The ring-o stays the mint
 * mark; sizes stay 124px wide on the brand row and h-8 in the desktop bar.
 * Weight is 600, not 700.
 */
export function HashpopWordmark({
  className,
  size = "mobile",
}: {
  className?: string;
  size?: "mobile" | "header";
}) {
  return (
    <span
      role="img"
      aria-label="Hashpop"
      data-testid="marketplace-logo"
      className={cn(
        "inline-flex shrink-0 items-baseline justify-center whitespace-nowrap font-display font-semibold leading-none tracking-[-0.02em] text-white",
        size === "header" ? "h-8 w-auto text-[26px]" : "h-auto w-[124px] text-[20px]",
        className,
      )}
    >
      <span aria-hidden>Hashp</span>
      <RingO />
      <span aria-hidden>p</span>
    </span>
  );
}
