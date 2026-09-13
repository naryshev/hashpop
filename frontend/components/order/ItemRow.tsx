import { cn } from "@/lib/utils";
import { material } from "@/lib/materials";

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
  seller: React.ReactNode;
  priceHbar: string;
  priceUsd?: string | null;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        compact ? "" : cn(material.regular, "rounded-control p-3.5"),
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-bg",
          compact ? "h-11 w-11 text-[22px]" : "h-16 w-16 text-[30px]",
        )}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={title} className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden>📦</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("truncate font-semibold text-fg", compact ? "text-sm" : "text-[15px]")}>
          {title}
        </div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-muted">by {seller}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className={cn("font-bold text-chrome", compact ? "text-sm" : "text-base")}>
          {priceHbar} ℏ
        </div>
        {priceUsd && <div className="text-[10px] text-muted">{priceUsd}</div>}
      </div>
    </div>
  );
}
