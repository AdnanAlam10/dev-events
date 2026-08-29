import { NextRequest, NextResponse } from "next/server";
import { clearSession, createDemoSession, currentUser } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ user: await currentUser() });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const account = body.account === "admin" ? "admin" : "organizer";
    const user = await createDemoSession(account, body.code ?? "");
    return user
      ? NextResponse.json({ user })
      : NextResponse.json({ error: "Invalid demo access code." }, { status: 401 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Demo sign-in is not configured." }, { status: 503 });
  }
}

export async function DELETE() {
  await clearSession();
  return new NextResponse(null, { status: 204 });
}
