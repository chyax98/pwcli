import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized", hint: "Valid pwcli_session cookie required" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({
      error: "Forbidden",
      hint: "Admin role required. Login as admin@test.com to access this endpoint.",
      currentRole: user.role,
    }, { status: 403 });
  }
  return NextResponse.json({
    message: "Admin access granted",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    adminData: {
      totalUsers: 3,
      systemStatus: "healthy",
      lastAudit: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  });
}
