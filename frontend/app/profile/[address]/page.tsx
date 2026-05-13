"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AddressDisplay } from "../../../components/AddressDisplay";
import { getApiUrl } from "../../../lib/apiUrl";
import { useHashpackWallet } from "../../../lib/hashpackWallet";

type ProfileStats = {
  address: string;
  totalSales?: number;
  activeListings?: number;
  reputation?: number;
  ratingCount?: number;
  ratingAverage?: number | null;
  successful?: number;
};

type Kyc = {
  status: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED" | string;
  submittedAt?: string | null;
  legalName?: string | null;
  dateOfBirth?: string | null;
  country?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
};

type ProfileData = {
  address: string;
  displayName?: string | null;
  bio?: string | null;
  kyc: Kyc;
};

const KYC_STATUS_STYLE: Record<string, string> = {
  UNVERIFIED: "border-white/15 text-silver",
  PENDING: "border-amber-400/60 text-amber-300",
  VERIFIED: "border-[#00ffa3]/60 text-[#00ffa3]",
  REJECTED: "border-rose-400/60 text-rose-300",
};

export default function ProfilePage() {
  const params = useParams();
  const address = params.address as string;
  const addressLower = address?.toLowerCase() ?? "";
  const { address: connectedAddress, accountId } = useHashpackWallet();
  const isSelf = useMemo(() => {
    const me = (connectedAddress ?? accountId ?? "").toLowerCase();
    return !!me && me === addressLower;
  }, [connectedAddress, accountId, addressLower]);

  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileData | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!address) return;
    const api = getApiUrl();
    fetch(`${api}/api/user/${address}`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
    fetch(`${api}/api/user/${address}/profile`)
      .then((r) => r.json())
      .then((p: ProfileData) => setProfile(p))
      .catch(() => setProfile(null));
  }, [address]);

  useEffect(() => {
    if (profile && !draft) setDraft(profile);
  }, [profile, draft]);

  const onSave = async () => {
    if (!draft || !isSelf) return;
    setSaving(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/user/${address}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: draft.displayName ?? "",
          bio: draft.bio ?? "",
          kyc: {
            legalName: draft.kyc.legalName ?? "",
            dateOfBirth: draft.kyc.dateOfBirth ?? "",
            country: draft.kyc.country ?? "",
            idType: draft.kyc.idType ?? "",
            idNumber: draft.kyc.idNumber ?? "",
            addressLine1: draft.kyc.addressLine1 ?? "",
            addressLine2: draft.kyc.addressLine2 ?? "",
            city: draft.kyc.city ?? "",
            region: draft.kyc.region ?? "",
            postalCode: draft.kyc.postalCode ?? "",
          },
        }),
      });
      if (!res.ok) throw new Error("save failed");
      const updated = (await res.json()) as ProfileData;
      setProfile(updated);
      setDraft(updated);
      setEditing(false);
    } catch {
      // keep edit mode open
    } finally {
      setSaving(false);
    }
  };

  const kyc = profile?.kyc ?? { status: "UNVERIFIED" };
  const statusClass = KYC_STATUS_STYLE[kyc.status] ?? KYC_STATUS_STYLE.UNVERIFIED;

  const setKyc = <K extends keyof Kyc>(k: K, v: Kyc[K]) =>
    setDraft((d) => (d ? { ...d, kyc: { ...d.kyc, [k]: v } } : d));

  return (
    <main className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              {profile?.displayName?.trim() || "Profile"}
            </h1>
            <p className="text-sm text-silver mt-1">
              <AddressDisplay address={address} />
            </p>
          </div>
          <Link href="/" className="text-sm text-chrome hover:text-white font-medium">
            Home
          </Link>
        </div>

        {stats ? (
          <div className="glass-card p-6 space-y-4 rounded-xl">
            <div>
              <p className="text-sm text-silver">Reputation Score</p>
              <p className="text-3xl font-semibold text-chrome mt-1">
                {stats.reputation ?? "N/A"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-silver">Average Rating</p>
                <p className="text-xl font-semibold text-white mt-1">
                  {stats.ratingAverage != null ? Number(stats.ratingAverage).toFixed(1) : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-silver">Ratings Count</p>
                <p className="text-xl font-semibold text-white mt-1">{stats.ratingCount ?? 0}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-silver">Total Sales</p>
                <p className="text-xl font-semibold text-white mt-1">{stats.totalSales ?? 0}</p>
              </div>
              <div>
                <p className="text-sm text-silver">Successful</p>
                <p className="text-xl font-semibold text-white mt-1">{stats.successful ?? 0}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-silver">Loading profile...</p>
        )}

        <div className="glass-card p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">About</h2>
              <p className="text-xs text-silver mt-0.5">Display name and short bio.</p>
            </div>
            {isSelf && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-sm text-chrome hover:text-white font-medium"
              >
                Edit
              </button>
            )}
          </div>

          {!editing ? (
            <>
              <div>
                <p className="text-xs uppercase tracking-wide text-silver">Display name</p>
                <p className="text-white mt-0.5">{profile?.displayName?.trim() || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-silver">Bio</p>
                <p className="text-white mt-0.5 whitespace-pre-wrap">{profile?.bio?.trim() || "—"}</p>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-silver">Display name</span>
                <input
                  className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={draft?.displayName ?? ""}
                  onChange={(e) => setDraft((d) => (d ? { ...d, displayName: e.target.value } : d))}
                  maxLength={80}
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-silver">Bio</span>
                <textarea
                  className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  rows={3}
                  value={draft?.bio ?? ""}
                  onChange={(e) => setDraft((d) => (d ? { ...d, bio: e.target.value } : d))}
                  maxLength={500}
                />
              </label>
            </div>
          )}
        </div>

        <div className="glass-card p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">KYC information</h2>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${statusClass}`}
              >
                {kyc.status}
              </span>
            </div>
          </div>
          <p className="text-xs text-silver">
            {isSelf
              ? "Only you can see and edit this section. Submitting marks your KYC as pending review."
              : "KYC details are private."}
          </p>

          {!isSelf ? (
            <p className="text-sm text-silver">
              Status: <span className="text-white">{kyc.status}</span>
            </p>
          ) : !editing ? (
            <KycReadOnly kyc={kyc} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <KycField label="Legal name" value={draft?.kyc.legalName ?? ""} onChange={(v) => setKyc("legalName", v)} />
              <KycField
                label="Date of birth"
                type="date"
                value={draft?.kyc.dateOfBirth ?? ""}
                onChange={(v) => setKyc("dateOfBirth", v)}
              />
              <KycField label="Country (ISO)" value={draft?.kyc.country ?? ""} onChange={(v) => setKyc("country", v)} placeholder="US" />
              <KycSelect
                label="ID type"
                value={draft?.kyc.idType ?? ""}
                onChange={(v) => setKyc("idType", v)}
                options={[
                  { value: "", label: "Select…" },
                  { value: "passport", label: "Passport" },
                  { value: "drivers_license", label: "Driver's license" },
                  { value: "national_id", label: "National ID" },
                ]}
              />
              <KycField
                label="ID number"
                value={draft?.kyc.idNumber ?? ""}
                onChange={(v) => setKyc("idNumber", v)}
              />
              <KycField label="Address line 1" value={draft?.kyc.addressLine1 ?? ""} onChange={(v) => setKyc("addressLine1", v)} />
              <KycField label="Address line 2" value={draft?.kyc.addressLine2 ?? ""} onChange={(v) => setKyc("addressLine2", v)} />
              <KycField label="City" value={draft?.kyc.city ?? ""} onChange={(v) => setKyc("city", v)} />
              <KycField label="State/Region" value={draft?.kyc.region ?? ""} onChange={(v) => setKyc("region", v)} />
              <KycField label="Postal code" value={draft?.kyc.postalCode ?? ""} onChange={(v) => setKyc("postalCode", v)} />
            </div>
          )}

          {isSelf && editing && (
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="rounded-md bg-[#00ffa3] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(profile);
                  setEditing(false);
                }}
                className="text-sm text-silver hover:text-white"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function KycReadOnly({ kyc }: { kyc: Kyc }) {
  const rows: { label: string; value?: string | null }[] = [
    { label: "Legal name", value: kyc.legalName },
    { label: "Date of birth", value: kyc.dateOfBirth },
    { label: "Country", value: kyc.country },
    { label: "ID type", value: kyc.idType },
    { label: "ID number", value: kyc.idNumber ? `••••${kyc.idNumber.slice(-4)}` : null },
    { label: "Address", value: [kyc.addressLine1, kyc.addressLine2].filter(Boolean).join(" · ") || null },
    { label: "City", value: kyc.city },
    { label: "Region", value: kyc.region },
    { label: "Postal code", value: kyc.postalCode },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.label}>
          <p className="text-xs uppercase tracking-wide text-silver">{r.label}</p>
          <p className="text-sm text-white mt-0.5">{r.value?.trim() || "—"}</p>
        </div>
      ))}
    </div>
  );
}

function KycField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-silver">{label}</span>
      <input
        type={type}
        className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function KycSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-silver">{label}</span>
      <select
        className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#0e1422]">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
