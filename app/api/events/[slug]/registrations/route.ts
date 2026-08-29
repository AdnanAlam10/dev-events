import { NextRequest, NextResponse } from "next/server";
import { cancelRegistration, registerForEvent } from "@/database/service";
import { apiError } from "@/lib/api";

type Context = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const result = await registerForEvent((await context.params).slug, await request.json());
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json({ registration: await cancelRegistration(body.registrationId ?? "", body.cancellationToken ?? "") });
  } catch (error) {
    return apiError(error);
  }
}
