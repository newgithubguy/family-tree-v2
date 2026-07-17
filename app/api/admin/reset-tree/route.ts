import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest, isTreeAdmin } from "@/lib/auth";
import { currentTimestamp, getDb } from "@/lib/db";
import { publishRealtimeEvent } from "@/lib/realtime";

export const runtime = "nodejs";

const schema = z.object({
  treeId: z.string().min(1)
});

export async function PATCH(request: NextRequest) {
  const actor = getCurrentUserFromRequest(request);
  if (!actor) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
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

  const peopleRemoved = db.data.people.filter((row) => row.tree_id === parsed.data.treeId).length;
  const unionsRemoved = db.data.unions.filter((row) => row.tree_id === parsed.data.treeId).length;
  const linksRemoved = db.data.union_children.filter((row) => row.tree_id === parsed.data.treeId).length;
  const kinshipRemoved = db.data.kinship_links.filter((row) => row.tree_id === parsed.data.treeId).length;
  const positionsRemoved = db.data.node_positions.filter((row) => row.tree_id === parsed.data.treeId).length;

  db.data.people = db.data.people.filter((row) => row.tree_id !== parsed.data.treeId);
  db.data.unions = db.data.unions.filter((row) => row.tree_id !== parsed.data.treeId);
  db.data.union_children = db.data.union_children.filter((row) => row.tree_id !== parsed.data.treeId);
  db.data.kinship_links = db.data.kinship_links.filter((row) => row.tree_id !== parsed.data.treeId);
  db.data.node_positions = db.data.node_positions.filter((row) => row.tree_id !== parsed.data.treeId);
  db.data.activity_log = db.data.activity_log.filter((row) => row.tree_id !== parsed.data.treeId);

  db.data.activity_log.push({
    id: `reset-${Date.now()}`,
    tree_id: parsed.data.treeId,
    actor_user_id: actor.id,
    action: "DELETE",
    target_entity: "tree_reset",
    target_id: parsed.data.treeId,
    old_values: JSON.stringify({
      people: peopleRemoved,
      unions: unionsRemoved,
      union_children: linksRemoved,
      kinship_links: kinshipRemoved,
      node_positions: positionsRemoved
    }),
    new_values: JSON.stringify({ reset_at: currentTimestamp() }),
    created_at: currentTimestamp()
  });

  db.save();

  publishRealtimeEvent({
    type: "tree-changed",
    treeId: parsed.data.treeId,
    entity: "tree_reset",
    action: "DELETE",
    at: new Date().toISOString()
  });

  return NextResponse.json({
    ok: true,
    removed: {
      people: peopleRemoved,
      unions: unionsRemoved,
      unionChildren: linksRemoved,
      kinshipLinks: kinshipRemoved,
      nodePositions: positionsRemoved
    }
  });
}