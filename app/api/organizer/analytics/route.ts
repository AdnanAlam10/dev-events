import { NextResponse } from "next/server";
import { organizerAnalytics } from "@/database/service";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  return NextResponse.json({ items: await organizerAnalytics(user) });
}
