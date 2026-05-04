import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Internal Server Error", code: "SIMULATED_ERROR", timestamp: Date.now() },
    { status: 500 },
  );
}
