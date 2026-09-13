"use client";

import { useEffect, useState } from "react";
import { getApiUrl } from "../lib/apiUrl";
import { listingCta } from "../lib/materials";
import { Sheet } from "./ui/Sheet";

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
  }, [open]);

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

  return (
    <Sheet
      open={open}
      onClose={onClose}
      detent="medium"
      dismissible={!saving}
      title="Where should this ship?"
      footer={
        <div className="flex flex-col gap-2">
          {error && <p className="text-xs text-rose-300">{error}</p>}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className={listingCta.filled}
          >
            {saving ? "Saving\u2026" : ctaLabel}
          </button>
        </div>
      }
    >
      <p className="mb-4 text-xs text-silver">
        A delivery address is required before you can pay. Only the seller sees it, and only for
        this order.
      </p>

      <div className="space-y-2.5">
        <input
          value={fields.name}
          onChange={set("name")}
          placeholder="Full name *"
          className={input}
          autoComplete="name"
        />
        <input
          value={fields.line1}
          onChange={set("line1")}
          placeholder="Street address *"
          className={input}
          autoComplete="address-line1"
        />
        <input
          value={fields.line2}
          onChange={set("line2")}
          placeholder="Apt, suite, unit (optional)"
          className={input}
          autoComplete="address-line2"
        />
        <div className="grid grid-cols-2 gap-2.5">
          <input
            value={fields.city}
            onChange={set("city")}
            placeholder="City *"
            className={input}
            autoComplete="address-level2"
          />
          <input
            value={fields.region}
            onChange={set("region")}
            placeholder="State / region"
            className={input}
            autoComplete="address-level1"
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <input
            value={fields.postalCode}
            onChange={set("postalCode")}
            placeholder="Postal / ZIP *"
            className={input}
            autoComplete="postal-code"
          />
          <input
            value={fields.country}
            onChange={set("country")}
            placeholder="Country (US) *"
            maxLength={2}
            className={input}
            autoComplete="country"
          />
        </div>
        <input
          value={fields.phone}
          onChange={set("phone")}
          placeholder="Phone (optional, for the carrier)"
          className={input}
          autoComplete="tel"
        />
      </div>
    </Sheet>
  );
}
