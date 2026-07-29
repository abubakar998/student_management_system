import { redirect } from "next/navigation";

import { requireActor } from "@/lib/authz";

/** Send people to the right home for their role. */
export default async function Home() {
  const actor = await requireActor();
  redirect(actor.role === "STAFF" ? "/dashboard" : "/portal");
}
