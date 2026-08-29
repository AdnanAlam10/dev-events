import { NextRequest, NextResponse } from "next/server";
import { createEvent, listEvents, listManagedEvents } from "@/database/service";
import type { EventFilters } from "@/database/types";
import { apiError } from "@/lib/api";
import { currentUser, requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const managed = request.nextUrl.searchParams.get("managed") === "true";
  if (managed) {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    return NextResponse.json({ items: await listManagedEvents(user) });
  }
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const filters: EventFilters = {
    search: request.nextUrl.searchParams.get("search") ?? undefined,
    location: request.nextUrl.searchParams.get("location") ?? undefined,
    topic: request.nextUrl.searchParams.get("topic") ?? undefined,
    date: request.nextUrl.searchParams.get("date") ?? undefined,
    status: status === "past" || status === "upcoming" || status === "cancelled" || status === "all" ? status : undefined,
    page: Number(request.nextUrl.searchParams.get("page") || 1),
    pageSize: Number(request.nextUrl.searchParams.get("pageSize") || 6),
  };
  return NextResponse.json(await listEvents(filters));
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const event = await createEvent(user, await request.json());
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
