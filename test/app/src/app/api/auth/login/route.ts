import { NextRequest, NextResponse } from "next/server";
import { validateCredentials, createSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body as { email: string; password: string };

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const result = validateCredentials(email, password);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    if (result.requiresMfa) {
      // Create a partial session (mfaVerified = false)
      const sessionId = createSession(result.user.id, false);
      const response = NextResponse.json({ requiresMfa: true, userId: result.user.id });
      response.cookies.set(SESSION_COOKIE, sessionId, {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24,
      });
      return response;
    }

    const sessionId = createSession(result.user.id, true);
    const response = NextResponse.json({ success: true, user: result.user });
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
