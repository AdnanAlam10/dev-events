import { NextResponse } from "next/server";
import { getPublicEvent } from "@/database/service";

type Context = { params: Promise<{ slug: string }> };

function icsDate(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export async function GET(_request: Request, context: Context) {
  const event = await getPublicEvent((await context.params).slug);
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DevEvent//Demo catalog//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.slug}@demo.devevent.local`,
    `DTSTAMP:${icsDate(event.updatedAt)}`,
    `DTSTART:${icsDate(event.startsAt)}`,
    `DTEND:${icsDate(event.endsAt)}`,
    `SUMMARY:${escapeIcs(`[DEMO] ${event.title}`)}`,
    `DESCRIPTION:${escapeIcs(`${event.overview}\n${event.sourceLabel}`)}`,
    `LOCATION:${escapeIcs(`${event.venue}, ${event.location}`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT24H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(`Reminder: [DEMO] ${event.title}`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
  return new NextResponse(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
