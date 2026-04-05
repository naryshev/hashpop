"use client";

type TransactionStage = {
  label: string;
  description?: string;
};

const STAGES: TransactionStage[] = [
  { label: "Payment", description: "Buyer sends payment to escrow" },
  { label: "Shipment", description: "Seller provides proof of shipment" },
  { label: "Confirmation", description: "Buyer confirms receipt" },
  { label: "Complete", description: "Funds released to seller" },
];

function stageIndex(escrowState: string): number {
  switch (escrowState) {
    case "AWAITING_SHIPMENT":
      return 1; // payment done, waiting on shipment
    case "AWAITING_CONFIRMATION":
      return 2; // shipment done, waiting on confirmation
    case "COMPLETE":
      return 4; // all done
    default:
      return 0; // not started
  }
}

export function TransactionProgress({
  escrowState,
  compact = false,
}: {
  escrowState: string;
  compact?: boolean;
}) {
  const currentIdx = stageIndex(escrowState);
  const isComplete = currentIdx >= STAGES.length;

  return (
    <div className={compact ? "py-2" : "py-4"}>
      <div className="flex items-center w-full">
        {STAGES.map((stage, i) => {
          const isDone = i < currentIdx;
          const isActive = i === currentIdx && !isComplete;
          const isLast = i === STAGES.length - 1;

          return (
            <div key={stage.label} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
              {/* Circle */}
              <div className="flex flex-col items-center relative">
                <div
                  className={`
                    flex items-center justify-center rounded-full border-2 transition-all duration-300
                    ${compact ? "w-7 h-7" : "w-9 h-9"}
                    ${
                      isDone || (isLast && isComplete)
                        ? "border-emerald-400 bg-emerald-400/20"
                        : isActive
                          ? "border-blue-400 bg-blue-400/20 shadow-[0_0_12px_rgba(96,165,250,0.4)]"
                          : "border-white/20 bg-white/5"
                    }
                  `}
                >
                  {isDone || (isLast && isComplete) ? (
                    <svg
                      className={`${compact ? "w-3.5 h-3.5" : "w-4 h-4"} text-emerald-400`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isActive ? (
                    <div className={`${compact ? "w-2 h-2" : "w-2.5 h-2.5"} rounded-full bg-blue-400 animate-pulse`} />
                  ) : (
                    <div className={`${compact ? "w-2 h-2" : "w-2.5 h-2.5"} rounded-full bg-white/20`} />
                  )}
                </div>
                {/* Label below circle */}
                {!compact && (
                  <span
                    className={`absolute top-full mt-1.5 text-[10px] font-medium whitespace-nowrap ${
                      isDone || (isLast && isComplete)
                        ? "text-emerald-400"
                        : isActive
                          ? "text-blue-400"
                          : "text-white/40"
                    }`}
                  >
                    {stage.label}
                  </span>
                )}
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 mx-1.5">
                  <div
                    className={`h-0.5 w-full rounded-full transition-all duration-300 ${
                      i < currentIdx - 1 || (i < currentIdx && isDone)
                        ? "bg-emerald-400"
                        : isActive || i < currentIdx
                          ? "bg-gradient-to-r from-emerald-400 to-white/10"
                          : "bg-white/10"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Final arrow / checkmark indicator */}
        <div className="ml-1.5">
          {isComplete ? (
            <svg
              className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-emerald-400`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg
              className={`${compact ? "w-3 h-3" : "w-4 h-4"} text-white/30`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </div>

      {/* Stage descriptions (non-compact only) */}
      {!compact && (
        <div className="mt-8">
          {STAGES.map((stage, i) => {
            const isDone = i < currentIdx;
            const isActive = i === currentIdx && !isComplete;
            if (!isActive && !isDone) return null;
            return (
              <p
                key={stage.label}
                className={`text-xs ${isDone ? "text-emerald-400/70" : "text-blue-400"}`}
              >
                {isDone ? `✓ ${stage.label}` : `● ${stage.label}`}
                {stage.description ? ` — ${stage.description}` : ""}
              </p>
            );
          })}
          {isComplete && (
            <p className="text-xs text-emerald-400 font-medium mt-1">
              Transaction complete — funds released
            </p>
          )}
        </div>
      )}
    </div>
  );
}
