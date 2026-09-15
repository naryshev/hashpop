"use client";

import { cn } from "../lib/utils";
import { material } from "../lib/materials";
import { newListingVariant, type ListingVariant } from "../lib/listingVariants";

export function ListingVariantsEditor({
  variants,
  onChange,
  mediaCount = 0,
  defaultPrice = "",
}: {
  variants: ListingVariant[];
  onChange: (next: ListingVariant[]) => void;
  mediaCount?: number;
  defaultPrice?: string;
}) {
  const updateAt = (index: number, patch: Partial<ListingVariant>) => {
    onChange(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  };

  const move = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= variants.length) return;
    const next = [...variants];
    const [row] = next.splice(index, 1);
    next.splice(to, 0, row);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-extrabold uppercase tracking-[0.12em] text-white">Options</h3>
        <p className="mt-1 text-xs leading-snug text-silver">
          Add SKUs (color, storage, condition). Buyers pick one; the listed price updates.
        </p>
      </div>
      {variants.length === 0 ? (
        <p className="text-xs text-silver/80">
          No options yet — this listing sells as a single item.
        </p>
      ) : (
        <ul className="space-y-2">
          {variants.map((v, index) => (
            <li key={v.id} className={cn(material.regular, "space-y-2 rounded-[14px] p-3")}>
              <div className="flex items-start gap-2">
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    aria-label={`Move option ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-hairline text-white/80 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move option ${index + 1} down`}
                    disabled={index === variants.length - 1}
                    onClick={() => move(index, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-hairline text-white/80 disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <label className="block">
                    <span className="text-[11px] font-semibold text-white/80">Name</span>
                    <input
                      value={v.label}
                      onChange={(e) => updateAt(index, { label: e.target.value })}
                      className="input-frost mt-1 w-full text-sm"
                      placeholder="e.g. Blue · 256GB · Like new"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-[11px] font-semibold text-white/80">Price</span>
                      <div className="relative mt-1">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={v.price}
                          onChange={(e) => updateAt(index, { price: e.target.value })}
                          className="input-frost w-full pr-8 font-mono text-sm"
                          placeholder={defaultPrice || "0"}
                        />
                        <span className="absolute inset-y-0 right-2 flex items-center text-xs text-silver">
                          ℏ
                        </span>
                      </div>
                    </label>
                    {mediaCount > 0 && (
                      <label className="block">
                        <span className="text-[11px] font-semibold text-white/80">Photo</span>
                        <select
                          value={v.mediaIndex ?? ""}
                          onChange={(e) =>
                            updateAt(index, {
                              mediaIndex: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          className="input-frost mt-1 w-full text-sm"
                        >
                          <option value="">Default</option>
                          {Array.from({ length: mediaCount }, (_, i) => (
                            <option key={i} value={i}>
                              Photo {i + 1}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Remove option ${v.label || index + 1}`}
                  onClick={() => onChange(variants.filter((_, i) => i !== index))}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/50 text-lg text-white hover:bg-rose-500"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...variants,
            newListingVariant({
              label: "",
              price: defaultPrice,
              mediaIndex: null,
            }),
          ])
        }
        className={cn(
          material.regular,
          "flex h-11 w-full items-center justify-center rounded-[14px] text-sm font-medium text-white/85 hover:bg-white/[0.12]",
        )}
      >
        + Add option
      </button>
    </div>
  );
}
