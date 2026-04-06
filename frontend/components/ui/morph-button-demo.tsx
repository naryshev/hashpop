"use client";

import * as React from "react";
import { MorphButton } from "@/components/ui/morph-button";
import { Send, Trash2, Settings } from "lucide-react";

export default function MorphButtonIconsDemo() {
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  const handleAction = (id: string) => {
    setLoadingId(id);
    setTimeout(() => setLoadingId(null), 2000);
  };

  return (
    <div className="@container flex w-full flex-col items-center justify-center gap-6 p-8">
      <div className="flex w-full max-w-md flex-col items-center justify-center gap-4 @sm:flex-row">
        <MorphButton
          text="Send Message"
          icon={<Send className="h-4 w-4" />}
          isLoading={loadingId === "send"}
          onClick={() => handleAction("send")}
          className="w-full @sm:w-auto"
        />

        <MorphButton
          text="Delete"
          variant="secondary"
          icon={<Trash2 className="h-4 w-4 text-destructive" />}
          isLoading={loadingId === "delete"}
          onClick={() => handleAction("delete")}
          className="w-full @sm:w-auto hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
        />

        <MorphButton
          text="Configure"
          variant="ghost"
          icon={<Settings className="h-4 w-4" />}
          isLoading={loadingId === "config"}
          onClick={() => handleAction("config")}
          className="w-full @sm:w-auto"
        />
      </div>
    </div>
  );
}
