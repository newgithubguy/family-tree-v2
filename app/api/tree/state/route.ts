import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, getRoleForUserInTree, isTreeAdmin } from "@/lib/auth";
import { getTreeState } from "@/lib/tree-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const treeId = request.nextUrl.searchParams.get("treeId") || "tree-main";
  const user = getCurrentUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const role = getRoleForUserInTree(treeId, user.id);
  if (!role) {
    return NextResponse.json({ error: "No access to this tree" }, { status: 403 });
  }

  const state = getTreeState(treeId);
  if (!state) {
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...state,
    me: user,
    role,
    canEdit: role === "editor",
    isAdmin: isTreeAdmin(treeId, user.id)
  });
}
