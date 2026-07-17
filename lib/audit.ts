import { randomUUID } from "node:crypto";
import { currentTimestamp, getDb } from "@/lib/db";
import type { ChangeAction } from "@/lib/types";

export function logActivity(params: {
  treeId: string;
  actorUserId: string;
  action: ChangeAction;
  targetEntity: string;
  targetId: string;
  oldValues?: unknown;
  newValues?: unknown;
}) {
  const db = getDb();
  db.data.activity_log.push({
    id: randomUUID(),
    tree_id: params.treeId,
    actor_user_id: params.actorUserId,
    action: params.action,
    target_entity: params.targetEntity,
    target_id: params.targetId,
    old_values: params.oldValues ? JSON.stringify(params.oldValues) : null,
    new_values: params.newValues ? JSON.stringify(params.newValues) : null,
    created_at: currentTimestamp()
  });
  db.save();
}
