import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest, getRoleForUserInTree } from "@/lib/auth";
import { deleteUnion } from "@/lib/tree-service";
import { publishRealtimeEvent } from "@/lib/realtime";

export const runtime = "nodejs";

const schema = z.object({
  treeId: z.string().min(1)
});

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const role = getRoleForUserInTree(parsed.data.treeId, user.id);
  if (role !== "editor") {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const deleted = deleteUnion({ id, treeId: parsed.data.treeId, actorUserId: user.id });
  if (!deleted) {
    return NextResponse.json({ error: "Union not found" }, { status: 404 });
  }

  publishRealtimeEvent({
    type: "tree-changed",
    treeId: parsed.data.treeId,
    entity: "unions",
    action: "DELETE",
    at: new Date().toISOString()
  });

  return NextResponse.json({ ok: true });
}
