import { cookies } from "next/headers";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  requiresMfa?: boolean;
}

export interface Session {
  userId: string;
  mfaVerified: boolean;
  createdAt: number;
}

// In-memory session store
const sessions = new Map<string, Session>();

// Pre-seeded test users
const USERS: Record<string, { password: string; user: User; requiresMfa?: boolean }> = {
  "demo@test.com": {
    password: "password123",
    user: { id: "u1", email: "demo@test.com", name: "Demo User", role: "user" },
  },
  "admin@test.com": {
    password: "admin123",
    user: { id: "u2", email: "admin@test.com", name: "Admin User", role: "admin" },
  },
  "mfa@test.com": {
    password: "password123",
    requiresMfa: true,
    user: { id: "u3", email: "mfa@test.com", name: "MFA User", role: "user", requiresMfa: true },
  },
};

const MFA_CODE = "123456";
const SESSION_COOKIE = "pwcli_session";

function generateSessionId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function validateCredentials(
  email: string,
  password: string,
): { success: false; error: string } | { success: true; user: User; requiresMfa: boolean } {
  const entry = USERS[email.toLowerCase()];
  if (!entry || entry.password !== password) {
    return { success: false, error: "Invalid email or password" };
  }
  return { success: true, user: entry.user, requiresMfa: !!entry.requiresMfa };
}

export function validateMfaCode(code: string): boolean {
  return code === MFA_CODE;
}

export function createSession(userId: string, mfaVerified: boolean): string {
  const sessionId = generateSessionId();
  sessions.set(sessionId, { userId, mfaVerified, createdAt: Date.now() });
  return sessionId;
}

export function getSession(sessionId: string): Session | null {
  return sessions.get(sessionId) ?? null;
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function getUserById(userId: string): User | null {
  for (const entry of Object.values(USERS)) {
    if (entry.user.id === userId) return entry.user;
  }
  return null;
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;
  const session = getSession(sessionId);
  if (!session) return null;
  // MFA users must have mfa verified
  const user = getUserById(session.userId);
  if (!user) return null;
  if (user.requiresMfa && !session.mfaVerified) return null;
  return user;
}

export { SESSION_COOKIE };
