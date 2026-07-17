import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";

export interface CurrentUser {
  id: string;
  display_name: string;
  email: string;
}

export function isTreeAdmin(treeId: string, userId: string) {
  const tree = getDb().data.trees.find((row) => row.id === treeId);
  return !!tree && tree.owner_user_id === userId;
}

export function authenticateByEmailPassword(email: string, password: string): CurrentUser | null {
  const user = getDb().data.users.find(
    (row) => row.email.toLowerCase() === email.toLowerCase() && row.password === password
  );

  return user
    ? {
        id: user.id,
        display_name: user.display_name,
        email: user.email
      }
    : null;
}

export function getCurrentUserFromRequest(request: NextRequest): CurrentUser | null {
  const cookieUserId = request.cookies.get("mock_user_id")?.value;
  if (!cookieUserId) {
    return null;
  }

  const user = getDb().data.users.find((row) => row.id === cookieUserId);

  return user
    ? {
        id: user.id,
        display_name: user.display_name,
        email: user.email
      }
    : null;
}

export async function getCurrentUserFromCookieStore(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const cookieUserId = cookieStore.get("mock_user_id")?.value;
  if (!cookieUserId) {
    return null;
  }

  const user = getDb().data.users.find((row) => row.id === cookieUserId);

  return user
    ? {
        id: user.id,
        display_name: user.display_name,
        email: user.email
      }
    : null;
}

export function getRoleForUserInTree(treeId: string, userId: string): "viewer" | "editor" | null {
  const row = getDb().data.tree_members.find((member) => member.tree_id === treeId && member.user_id === userId);

  return row?.role ?? null;
}
