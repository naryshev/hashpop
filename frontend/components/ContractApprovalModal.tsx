"use client";

/**
 * Kabuto-style "Execute Smart Contract" confirmation modal.
 * Shown in-app before triggering the wallet (HashPack); matches the wallet approval layout:
 * dark theme, contract details, risk warning, Reject / Approve.
 */
export type ContractApprovalModalProps = {
  open: boolean;
  onReject: () => void;
  onApprove: () => void;
  /** e.g. "Buy Now", "Update listing price" */
  actionLabel?: string;
  /** Contract address (0x... or 0.0.xxxxx) */
  contractId: string;
  /** e.g. "1440.5" */
  requestedHbar: string;
  /** e.g. "~0.05" or "—" */
  maxGas?: string;
  /** e.g. "~0.01" or "—" */
  approxFee?: string;
  /** Optional short note (e.g. "Listing #abc...") */
  note?: string;
  /** Approve button loading (e.g. waiting for wallet) */
  approving?: boolean;
};

const DEFAULT_GAS = "~0.05";
const DEFAULT_FEE = "~0.01";

export function ContractApprovalModal({
  open,
  onReject,
  onApprove,
  actionLabel = "Execute Smart Contract",
  contractId,
  requestedHbar,
  maxGas = DEFAULT_GAS,
  approxFee = DEFAULT_FEE,
  note,
  approving = false,
}: ContractApprovalModalProps) {
  if (!open) return null;

  const dAppName =
    typeof window !== "undefined" && process.env.NEXT_PUBLIC_APP_URL
      ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname
      : "Marketplace";
  const dAppOrigin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !approving) onReject();
      }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-2xl overflow-hidden"
        role="dialog"
        aria-labelledby="contract-approval-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onReject}
          disabled={approving}
          className="absolute top-3 right-3 p-2 rounded-lg text-silver hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        {/* Icon / branding */}
        <div className="flex justify-center pt-8 pb-2">
          <div className="w-16 h-16 rounded-full border-2 border-amber-500/70 bg-black flex items-center justify-center">
            <span className="text-2xl text-amber-400" aria-hidden>
              ⚡
            </span>
          </div>
        </div>

        <h2
          id="contract-approval-title"
          className="text-center text-xl font-bold text-white px-4 pb-4"
        >
          Execute Smart Contract
        </h2>

        <div className="px-5 pb-2 space-y-3 text-sm">
          <p className="text-white/90">
            {dAppName} ({dAppOrigin}) would like you to execute a smart contract with your connected
            account.
            {actionLabel && actionLabel !== "Execute Smart Contract" && (
              <span className="block mt-1 text-zinc-400">Action: {actionLabel}</span>
            )}
          </p>

          <p className="text-red-400 text-xs leading-relaxed">
            Please be aware there is significant risk using smart contracts from places that you do
            not trust. Always ensure you are interacting with a reputable source when agreeing to
            smart contracts.
          </p>

          <div className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-1.5 text-white/90">
            <div className="flex justify-between gap-2">
              <span className="text-zinc-400">Contract</span>
              <span className="font-mono text-xs truncate max-w-[220px]" title={contractId}>
                {contractId}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-zinc-400">Requested HBAR</span>
              <span className="text-chrome font-medium">{requestedHbar} ħ</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-zinc-400">Max Gas</span>
              <span>{maxGas} HBAR</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-zinc-400">Approx. Network Fee</span>
              <span>{approxFee} HBAR</span>
            </div>
            {note && (
              <div className="flex justify-between gap-2 pt-1 border-t border-white/10">
                <span className="text-zinc-400">Note</span>
                <span className="text-xs">{note}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 p-5 pt-4">
          <button
            type="button"
            onClick={onReject}
            disabled={approving}
            className="flex-1 py-3 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={approving}
            className="flex-1 py-3 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {approving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Approving…
              </>
            ) : (
              "Approve"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
