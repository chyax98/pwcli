import { NextRequest, NextResponse } from "next/server";
import { validateMfaCode, getSession, deleteSession, createSession, getUserById, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body as { code: string };

    const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
    if (!sessionId) {
      return NextResponse.json({ error: "No active session" }, { status: 401 });
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    if (!validateMfaCode(code)) {
      return NextResponse.json({ error: "Invalid MFA code" }, { status: 401 });
    }

    // Upgrade session to mfa verified
    deleteSession(sessionId);
    const newSessionId = createSession(session.userId, true);
    const user = getUserById(session.userId);

    const response = NextResponse.json({ success: true, user });
    response.cookies.set(SESSION_COOKIE, newSessionId, {
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
