import { NextRequest, NextResponse } from "next/server";
import { processReminderOutbox } from "@/database/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const results = await processReminderOutbox();
    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Reminder delivery is not configured or failed." }, { status: 503 });
  }
}
