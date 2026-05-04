import { NextRequest, NextResponse } from "next/server";

const ITEMS = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  name: `Item ${i + 1}`,
  value: Math.round(Math.random() * 1000),
  status: ["active", "pending", "archived"][i % 3],
  createdAt: new Date(Date.now() - i * 86400000).toISOString(),
}));

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const delay = parseInt(searchParams.get("delay") ?? "0", 10);

  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return NextResponse.json({ items: ITEMS, total: ITEMS.length, timestamp: Date.now() });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return NextResponse.json({ received: body, timestamp: Date.now() });
}
