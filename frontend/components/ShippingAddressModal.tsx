"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Truck, X } from "lucide-react";
import { getApiUrl } from "../lib/apiUrl";

const STORAGE_KEY = "hashpop.shipping.address.v1";

export type ShippingAddressFields = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
};

const EMPTY: ShippingAddressFields = {
  name: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "US",
  phone: "",
};

function loadSaved(): ShippingAddressFields {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<ShippingAddressFields>) };
  } catch {
    return EMPTY;
  }
}

/** Mirrors the server-side checks so validation errors surface before submit. */
function validate(f: ShippingAddressFields): string | null {
  if (f.name.trim().length < 2) return "Full name is required.";
  if (f.line1.trim().length < 4) return "Street address is required.";
  if (f.city.trim().length < 2) return "City is required.";
  if (f.postalCode.trim().length < 3) return "Postal / ZIP code is required.";
  if (!/^[A-Za-z]{2}$/.test(f.country.trim())) return "Country must be a 2-letter code (e.g. US).";
  return null;
}

/**
 * Collects and saves the buyer's delivery address. Purchases (and offers,
 * which also escrow funds) are gated on this succeeding, so the seller
 * always has somewhere to ship before any payment is signed.
 */
export function ShippingAddressModal({
  open,
  listingId,
  listingIds,
  buyerAddress,
  ctaLabel = "Save & continue to payment",
  onConfirmed,
  onClose,
}: {
  open: boolean;
  listingId?: string;
  /** Cart checkout: save the same address against every listing being bought. */
  listingIds?: string[];
  buyerAddress: string;
  ctaLabel?: string;
  onConfirmed: () => void;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<ShippingAddressFields>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFields(loadSaved());
    setError(null);
    setSaving(false);
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const set = (key: keyof ShippingAddressFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    const invalid = validate(fields);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const targets = listingIds?.length ? listingIds : listingId ? [listingId] : [];
      if (targets.length === 0) throw new Error("Nothing to ship.");
      const payload = {
        buyerAddress,
        name: fields.name.trim(),
        line1: fields.line1.trim(),
        line2: fields.line2.trim() || undefined,
        city: fields.city.trim(),
        region: fields.region.trim() || undefined,
        postalCode: fields.postalCode.trim(),
        country: fields.country.trim().toUpperCase(),
        phone: fields.phone.trim() || undefined,
      };
      for (const id of targets) {
        const res = await fetch(
          `${getApiUrl()}/api/listing/${encodeURIComponent(id)}/shipping-address`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "Failed to save shipping address.");
        }
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
      } catch {
        // ignore — prefill is a convenience only
      }
      onConfirmed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save shipping address.");
      setSaving(false);
    }
  };

  const input = "input-frost w-full text-sm";

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Shipping address"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#12161f] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-chrome">
              <Truck size={17} />
            </span>
            <h2 className="text-base font-bold text-white">Where should this ship?</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-silver hover:bg-white/10 hover:text-white"
          >
            <X size={17} />
          </button>
        </div>
        <p className="mb-4 text-xs text-silver">
          A delivery address is required before you can pay. Only the seller sees it, and only for
          this order.
        </p>

        <div className="space-y-2.5">
          <input value={fields.name} onChange={set("name")} placeholder="Full name *" className={input} autoComplete="name" />
          <input value={fields.line1} onChange={set("line1")} placeholder="Street address *" className={input} autoComplete="address-line1" />
          <input value={fields.line2} onChange={set("line2")} placeholder="Apt, suite, unit (optional)" className={input} autoComplete="address-line2" />
          <div className="grid grid-cols-2 gap-2.5">
            <input value={fields.city} onChange={set("city")} placeholder="City *" className={input} autoComplete="address-level2" />
            <input value={fields.region} onChange={set("region")} placeholder="State / region" className={input} autoComplete="address-level1" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <input value={fields.postalCode} onChange={set("postalCode")} placeholder="Postal / ZIP *" className={input} autoComplete="postal-code" />
            <input value={fields.country} onChange={set("country")} placeholder="Country (US) *" maxLength={2} className={input} autoComplete="country" />
          </div>
          <input value={fields.phone} onChange={set("phone")} placeholder="Phone (optional, for the carrier)" className={input} autoComplete="tel" />
        </div>

        {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className="btn-frost-cta mt-4 w-full disabled:opacity-60"
        >
          {saving ? "Saving…" : ctaLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}
