"use client";

import { CardStack, CardStackItem } from "@/components/ui/card-stack";

const items: CardStackItem[] = [
  {
    id: 1,
    title: "Neon Artifact",
    description: "Mystery drop from the midnight collection",
    imageSrc: "https://images.unsplash.com/photo-1636955816868-fcb881e57954?auto=format&fit=crop&w=1200&q=80",
    href: "/marketplace",
  },
  {
    id: 2,
    title: "Retro Wave Figure",
    description: "Limited run with animated traits",
    imageSrc: "https://images.unsplash.com/photo-1618005198919-d3d4b5a92eee?auto=format&fit=crop&w=1200&q=80",
    href: "/marketplace",
  },
  {
    id: 3,
    title: "Cyber Forest Pack",
    description: "Bundle of stylized digital collectibles",
    imageSrc: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80",
    href: "/marketplace",
  },
];

export default function CardStackDemoPage() {
  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-5xl p-8">
        <CardStack
          items={items}
          initialIndex={0}
          autoAdvance
          intervalMs={2200}
          pauseOnHover
          showDots
        />
      </div>
    </div>
  );
}
