import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest, isTreeAdmin } from "@/lib/auth";
import { currentTimestamp, getDb } from "@/lib/db";
import { logActivity } from "@/lib/audit";
import { publishRealtimeEvent } from "@/lib/realtime";

export const runtime = "nodejs";

const transferSchema = z.object({
  treeId: z.string().min(1),
  newOwnerUserId: z.string().min(1)
});

export async function PATCH(request: NextRequest) {
  const actor = getCurrentUserFromRequest(request);
  if (!actor) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  if (!isTreeAdmin(parsed.data.treeId, actor.id)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const db = getDb();
  const tree = db.data.trees.find((record) => record.id === parsed.data.treeId);
  if (!tree) {
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });
  }

  if (tree.owner_user_id === parsed.data.newOwnerUserId) {
    return NextResponse.json({ ok: true, owner_user_id: tree.owner_user_id });
  }

  const targetUser = db.data.users.find((user) => user.id === parsed.data.newOwnerUserId);
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const previousTree = { ...tree };
  const previousOwnerUserId = tree.owner_user_id;
  tree.owner_user_id = parsed.data.newOwnerUserId;

  const newOwnerMember = db.data.tree_members.find(
    (member) => member.tree_id === parsed.data.treeId && member.user_id === parsed.data.newOwnerUserId
  );

  if (!newOwnerMember) {
    db.data.tree_members.push({
      tree_id: parsed.data.treeId,
      user_id: parsed.data.newOwnerUserId,
      role: "editor",
      joined_at: currentTimestamp()
    });
  } else if (newOwnerMember.role !== "editor") {
    newOwnerMember.role = "editor";
  }

  db.save();

  logActivity({
    treeId: parsed.data.treeId,
    actorUserId: actor.id,
    action: "UPDATE",
    targetEntity: "trees",
    targetId: parsed.data.treeId,
    oldValues: previousTree,
    newValues: tree
  });

  publishRealtimeEvent({
    type: "tree-changed",
    treeId: parsed.data.treeId,
    entity: "trees",
    action: "UPDATE",
    at: new Date().toISOString()
  });

  return NextResponse.json({
    ok: true,
    owner_user_id: tree.owner_user_id,
    previous_owner_user_id: previousOwnerUserId
  });
}