import { redirect } from "next/navigation";

// The dedicated landing page has been retired — visitors go straight into the
// marketplace.
export default function Home() {
  redirect("/marketplace");
}
