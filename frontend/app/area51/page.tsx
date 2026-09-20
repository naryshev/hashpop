import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Area 51 bookmarks land on the Phase 1 ops console. */
export default function Area51Page() {
  redirect("/admin");
}
