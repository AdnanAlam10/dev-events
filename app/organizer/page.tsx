import OrganizerConsole from "@/components/OrganizerConsole";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OrganizerPage() {
  return <OrganizerConsole initialUser={await currentUser()} />;
}
