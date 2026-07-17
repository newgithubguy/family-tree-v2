import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest, isTreeAdmin } from "@/lib/auth";
import { currentTimestamp, getDb } from "@/lib/db";
import { logActivity } from "@/lib/audit";
import { publishRealtimeEvent } from "@/lib/realtime";

export const runtime = "nodejs";

const createSchema = z.object({
  treeId: z.string().min(1),
  displayName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(4),
  role: z.enum(["viewer", "editor", "none"]).default("none")
});

export async function POST(request: NextRequest) {
  const user = getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  if (!isTreeAdmin(parsed.data.treeId, user.id)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const db = getDb();
  const existing = db.data.users.find((row) => row.email.toLowerCase() === parsed.data.email.toLowerCase());
  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  const now = currentTimestamp();
  const createdUser = {
    id: randomUUID(),
    display_name: parsed.data.displayName,
    email: parsed.data.email.toLowerCase(),
    password: parsed.data.password,
    created_at: now
  };
  db.data.users.push(createdUser);

  if (parsed.data.role !== "none") {
    db.data.tree_members.push({
      tree_id: parsed.data.treeId,
      user_id: createdUser.id,
      role: parsed.data.role,
      joined_at: now
    });
  }

  db.save();

  logActivity({
    treeId: parsed.data.treeId,
    actorUserId: user.id,
    action: "CREATE",
    targetEntity: "users",
    targetId: createdUser.id,
    oldValues: null,
    newValues: {
      id: createdUser.id,
      display_name: createdUser.display_name,
      email: createdUser.email,
      role: parsed.data.role
    }
  });

  publishRealtimeEvent({
    type: "tree-changed",
    treeId: parsed.data.treeId,
    entity: "users",
    action: "CREATE",
    at: new Date().toISOString()
  });

  return NextResponse.json({
    user: {
      id: createdUser.id,
      display_name: createdUser.display_name,
      email: createdUser.email
    }
  });
}
