import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized", hint: "Valid pwcli_session cookie required" }, { status: 401 });
  }
  return NextResponse.json({
    message: "Authenticated",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    timestamp: new Date().toISOString(),
  });
}
