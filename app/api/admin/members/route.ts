import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest, isTreeAdmin } from "@/lib/auth";
import { currentTimestamp, getDb } from "@/lib/db";
import { logActivity } from "@/lib/audit";
import { publishRealtimeEvent } from "@/lib/realtime";

export const runtime = "nodejs";

const addSchema = z.object({
  treeId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(["viewer", "editor"])
});

const updateSchema = z.object({
  treeId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(["viewer", "editor"])
});

const deleteSchema = z.object({
  treeId: z.string().min(1),
  userId: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const actor = getCurrentUserFromRequest(request);
  if (!actor) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  if (!isTreeAdmin(parsed.data.treeId, actor.id)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const db = getDb();
  const userExists = db.data.users.some((row) => row.id === parsed.data.userId);
  if (!userExists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const existing = db.data.tree_members.find(
    (row) => row.tree_id === parsed.data.treeId && row.user_id === parsed.data.userId
  );
  if (existing) {
    return NextResponse.json({ error: "User is already a tree member" }, { status: 409 });
  }

  const created = {
    tree_id: parsed.data.treeId,
    user_id: parsed.data.userId,
    role: parsed.data.role,
    joined_at: currentTimestamp()
  };
  db.data.tree_members.push(created);
  db.save();

  logActivity({
    treeId: parsed.data.treeId,
    actorUserId: actor.id,
    action: "CREATE",
    targetEntity: "tree_members",
    targetId: `${created.tree_id}:${created.user_id}`,
    oldValues: null,
    newValues: created
  });

  publishRealtimeEvent({
    type: "tree-changed",
    treeId: parsed.data.treeId,
    entity: "tree_members",
    action: "CREATE",
    at: new Date().toISOString()
  });

  return NextResponse.json({ member: created });
}

export async function PATCH(request: NextRequest) {
  const actor = getCurrentUserFromRequest(request);
  if (!actor) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  if (!isTreeAdmin(parsed.data.treeId, actor.id)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const db = getDb();
  const member = db.data.tree_members.find(
    (row) => row.tree_id === parsed.data.treeId && row.user_id === parsed.data.userId
  );
  if (!member) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  const previous = { ...member };
  member.role = parsed.data.role;
  db.save();

  logActivity({
    treeId: parsed.data.treeId,
    actorUserId: actor.id,
    action: "UPDATE",
    targetEntity: "tree_members",
    targetId: `${member.tree_id}:${member.user_id}`,
    oldValues: previous,
    newValues: member
  });

  publishRealtimeEvent({
    type: "tree-changed",
    treeId: parsed.data.treeId,
    entity: "tree_members",
    action: "UPDATE",
    at: new Date().toISOString()
  });

  return NextResponse.json({ member });
}

export async function DELETE(request: NextRequest) {
  const actor = getCurrentUserFromRequest(request);
  if (!actor) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  if (!isTreeAdmin(parsed.data.treeId, actor.id)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const db = getDb();
  const tree = db.data.trees.find((row) => row.id === parsed.data.treeId);
  if (tree?.owner_user_id === parsed.data.userId) {
    return NextResponse.json({ error: "Cannot remove tree owner" }, { status: 400 });
  }

  const idx = db.data.tree_members.findIndex(
    (row) => row.tree_id === parsed.data.treeId && row.user_id === parsed.data.userId
  );
  if (idx < 0) {
    return NextResponse.json({ error: "Membership not found" }, { status: 404 });
  }

  const removed = db.data.tree_members[idx];
  db.data.tree_members.splice(idx, 1);
  db.save();

  logActivity({
    treeId: parsed.data.treeId,
    actorUserId: actor.id,
    action: "DELETE",
    targetEntity: "tree_members",
    targetId: `${removed.tree_id}:${removed.user_id}`,
    oldValues: removed,
    newValues: null
  });

  publishRealtimeEvent({
    type: "tree-changed",
    treeId: parsed.data.treeId,
    entity: "tree_members",
    action: "DELETE",
    at: new Date().toISOString()
  });

  return NextResponse.json({ ok: true });
}
