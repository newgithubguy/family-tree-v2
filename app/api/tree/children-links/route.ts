import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest, getRoleForUserInTree } from "@/lib/auth";
import { createChildLink } from "@/lib/tree-service";
import { publishRealtimeEvent } from "@/lib/realtime";

export const runtime = "nodejs";

const schema = z.object({
  treeId: z.string().min(1),
  unionId: z.string().min(1),
  childPersonId: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const user = getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const role = getRoleForUserInTree(parsed.data.treeId, user.id);
  if (role !== "editor") {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const link = createChildLink({
    treeId: parsed.data.treeId,
    actorUserId: user.id,
    unionId: parsed.data.unionId,
    childPersonId: parsed.data.childPersonId
  });

  publishRealtimeEvent({
    type: "tree-changed",
    treeId: parsed.data.treeId,
    entity: "union_children",
    action: "CREATE",
    at: new Date().toISOString()
  });

  return NextResponse.json({ link });
}
