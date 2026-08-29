import { NextRequest, NextResponse } from "next/server";
import { cancelEvent, deleteEvent, getPublicEvent, reviewEvent, updateEvent } from "@/database/service";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const event = await getPublicEvent((await context.params).slug);
  return event ? NextResponse.json({ event }) : NextResponse.json({ error: "Event not found." }, { status: 404 });
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const user = await requireUser();
    const slug = (await context.params).slug;
    const body = await request.json();
    if (body.action === "review") {
      return NextResponse.json({ event: await reviewEvent(user, slug, body.decision) });
    }
    if (body.action === "cancel") {
      return NextResponse.json({ event: await cancelEvent(user, slug, body.reason ?? "") });
    }
    return NextResponse.json({ event: await updateEvent(user, slug, body) });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    await deleteEvent(await requireUser(), (await context.params).slug);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
