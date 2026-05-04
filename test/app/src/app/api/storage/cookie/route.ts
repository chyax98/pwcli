import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const all = cookieStore.getAll();
  const result: Record<string, string> = {};
  for (const c of all) {
    result[c.name] = c.value;
  }
  return NextResponse.json({ cookies: result });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { name: string; value: string; maxAge?: number };
    const { name, value, maxAge = 3600 } = body;
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const response = NextResponse.json({ success: true, name, value });
    response.cookies.set(name, value, {
      path: "/",
      maxAge,
      sameSite: "lax",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json() as { name: string };
    const { name } = body;
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const response = NextResponse.json({ success: true, deleted: name });
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
