import { NextResponse } from "next/server";
import { DomainError } from "@/database/repository";

export function apiError(error: unknown) {
  if (error instanceof DomainError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  console.error(error);
  return NextResponse.json({ error: "The request could not be completed." }, { status: 500 });
}
