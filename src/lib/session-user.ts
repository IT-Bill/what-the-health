import "server-only";

import { getAuthCookie, verifyToken } from "@/lib/auth";

export type SessionUser = {
  userId: string;
  username: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await getAuthCookie();
  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return null;
  }

  return {
    userId: payload.userId,
    username: payload.username,
  };
}