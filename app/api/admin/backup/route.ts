import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest, isTreeAdmin } from "@/lib/auth";
import { currentTimestamp, exportDatabase, replaceDatabase } from "@/lib/db";
import { publishRealtimeEvent } from "@/lib/realtime";

export const runtime = "nodejs";

const restoreSchema = z.object({
  treeId: z.string().min(1),
  backup: z.object({
    users: z.array(z.record(z.string(), z.unknown())),
    trees: z.array(z.record(z.string(), z.unknown())),
    tree_members: z.array(z.record(z.string(), z.unknown())),
    people: z.array(z.record(z.string(), z.unknown())),
    unions: z.array(z.record(z.string(), z.unknown())),
    union_children: z.array(z.record(z.string(), z.unknown())),
    activity_log: z.array(z.record(z.string(), z.unknown())),
    node_positions: z.array(z.record(z.string(), z.unknown()))
  })
});

function ensureAdmin(request: NextRequest, treeId: string) {
  const actor = getCurrentUserFromRequest(request);
  if (!actor) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  if (!isTreeAdmin(treeId, actor.id)) {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }

  return { actor };
}

export async function GET(request: NextRequest) {
  const treeId = request.nextUrl.searchParams.get("treeId") || "tree-main";
  const auth = ensureAdmin(request, treeId);
  if (auth.error) {
    return auth.error;
  }

  const backup = exportDatabase();

  return NextResponse.json({
    exportedAt: currentTimestamp(),
    treeId,
    backup
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = restoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const auth = ensureAdmin(request, parsed.data.treeId);
  if (auth.error) {
    return auth.error;
  }

  const restored = replaceDatabase(parsed.data.backup);
  restored.activity_log.push({
    id: `restore-${randomUUID()}`,
    tree_id: parsed.data.treeId,
    actor_user_id: auth.actor.id,
    action: "UPDATE",
    target_entity: "backup_restore",
    target_id: parsed.data.treeId,
    old_values: null,
    new_values: JSON.stringify({ restored_at: currentTimestamp() }),
    created_at: currentTimestamp()
  });

  publishRealtimeEvent({
    type: "tree-changed",
    treeId: parsed.data.treeId,
    entity: "backup_restore",
    action: "UPDATE",
    at: new Date().toISOString()
  });

  return NextResponse.json({ ok: true, restoredAt: currentTimestamp() });
}