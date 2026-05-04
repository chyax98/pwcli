import { NextResponse } from "next/server";

export async function GET() {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return NextResponse.json({ message: "Slow response after 3 seconds", timestamp: Date.now() });
}
