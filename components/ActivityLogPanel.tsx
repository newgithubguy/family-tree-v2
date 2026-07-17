"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, History } from "lucide-react";

interface ActivityItem {
  id: string;
  actor_user_id: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  target_entity: string;
  target_id: string;
  old_values: string | null;
  new_values: string | null;
  created_at: string;
}

interface ActivityLogPanelProps {
  activity: ActivityItem[];
  userMap: Record<string, { display_name: string }>;
  peopleNameMap: Record<string, string>;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

const PAGE_SIZE = 8;

function safeParse(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return { raw: value };
  }
}

function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nameFromSnapshot(snapshot: Record<string, unknown> | null, peopleNameMap: Record<string, string>) {
  if (!snapshot) {
    return "someone";
  }

  const personId = asText(snapshot.person_id);
  if (personId && peopleNameMap[personId]) {
    return peopleNameMap[personId];
  }

  const firstName = asText(snapshot.first_name);
  const lastName = asText(snapshot.last_name);
  const fullName = `${firstName} ${lastName}`.trim();
  if (fullName) {
    return fullName;
  }

  return personId || "someone";
}

function relationshipText(snapshot: Record<string, unknown> | null, peopleNameMap: Record<string, string>) {
  if (!snapshot) {
    return "a relationship";
  }

  const partnerAId = asText(snapshot.partner_a_person_id);
  const partnerBId = asText(snapshot.partner_b_person_id);
  const partnerA = partnerAId ? peopleNameMap[partnerAId] ?? partnerAId : "someone";
  if (!partnerBId) {
    return `${partnerA} as a single parent`;
  }

  const partnerB = peopleNameMap[partnerBId] ?? partnerBId;
  return `${partnerA} and ${partnerB}`;
}

function describeActivity(item: ActivityItem, peopleNameMap: Record<string, string>, actorName: string) {
  const oldObject = safeParse(item.old_values);
  const newObject = safeParse(item.new_values);

  if (item.target_entity === "people") {
    if (item.action === "CREATE") {
      return `${actorName} added ${nameFromSnapshot(newObject, peopleNameMap)}.`;
    }
    if (item.action === "DELETE") {
      return `${actorName} deleted ${nameFromSnapshot(oldObject, peopleNameMap)}.`;
    }

    const oldName = nameFromSnapshot(oldObject, peopleNameMap);
    const newName = nameFromSnapshot(newObject, peopleNameMap);
    if (oldName !== newName) {
      return `${actorName} renamed ${oldName} to ${newName}.`;
    }
    return `${actorName} updated ${newName}.`;
  }

  if (item.target_entity === "unions") {
    const text = relationshipText(newObject ?? oldObject, peopleNameMap);
    if (item.action === "CREATE") {
      return `${actorName} connected ${text}.`;
    }
    if (item.action === "DELETE") {
      return `${actorName} removed the relationship between ${text}.`;
    }
    return `${actorName} updated the relationship between ${text}.`;
  }

  if (item.target_entity === "union_children") {
    const source = newObject ?? oldObject;
    const childId = asText(source?.child_person_id);
    const childName = childId ? peopleNameMap[childId] ?? childId : "a child";
    if (item.action === "CREATE") {
      return `${actorName} connected ${childName} to a parent relationship.`;
    }
    if (item.action === "DELETE") {
      return `${actorName} removed ${childName} from a parent relationship.`;
    }
    return `${actorName} updated how ${childName} is connected.`;
  }

  if (item.target_entity === "kinship_links") {
    const source = newObject ?? oldObject;
    const aId = asText(source?.person_a_id);
    const bId = asText(source?.person_b_id);
    const aName = aId ? peopleNameMap[aId] ?? aId : "someone";
    const bName = bId ? peopleNameMap[bId] ?? bId : "someone";
    const kinship = asText(source?.kinship_type) || "kinship";

    if (item.action === "CREATE") {
      return `${actorName} added a ${kinship} link between ${aName} and ${bName}.`;
    }
    if (item.action === "DELETE") {
      return `${actorName} removed a ${kinship} link between ${aName} and ${bName}.`;
    }
    return `${actorName} updated a ${kinship} link between ${aName} and ${bName}.`;
  }

  if (item.target_entity === "node_positions") {
    const source = newObject ?? oldObject;
    const personId = asText(source?.person_id);
    const name = personId ? peopleNameMap[personId] ?? personId : "someone";
    return `${actorName} moved ${name}.`;
  }

  const action = item.action.toLowerCase();
  return `${actorName} ${action} ${item.target_entity}.`;
}

export function ActivityLogPanel({
  activity,
  userMap,
  peopleNameMap = {},
  collapsed,
  onCollapsedChange
}: ActivityLogPanelProps) {
  const [actionFilter, setActionFilter] = useState<"ALL" | "CREATE" | "UPDATE" | "DELETE">("ALL");
  const [entityFilter, setEntityFilter] = useState("ALL");
  const [actorFilter, setActorFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = collapsed ?? internalCollapsed;

  function toggleCollapsed() {
    const next = !isCollapsed;
    if (onCollapsedChange) {
      onCollapsedChange(next);
      return;
    }
    setInternalCollapsed(next);
  }

  const entities = useMemo(() => {
    return Array.from(new Set(activity.map((item) => item.target_entity))).sort();
  }, [activity]);

  const actors = useMemo(() => {
    return Array.from(new Set(activity.map((item) => item.actor_user_id))).sort();
  }, [activity]);

  const filtered = useMemo(() => {
    return activity.filter((item) => {
      if (actionFilter !== "ALL" && item.action !== actionFilter) {
        return false;
      }
      if (entityFilter !== "ALL" && item.target_entity !== entityFilter) {
        return false;
      }
      if (actorFilter !== "ALL" && item.actor_user_id !== actorFilter) {
        return false;
      }
      return true;
    });
  }, [activity, actionFilter, entityFilter, actorFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <aside className="panel h-full min-h-[620px] overflow-auto p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-teal-700" />
          <h2 className="text-lg font-semibold text-slate-800">Recent Activity</h2>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          onClick={toggleCollapsed}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {isCollapsed ? "Expand" : "Collapse"}
        </button>
      </div>

      {isCollapsed && <p className="text-sm text-slate-500">Activity panel is collapsed.</p>}

      {!isCollapsed && (
        <>

      <div className="mb-4 grid gap-2">
        <select
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          value={actionFilter}
          onChange={(event) => {
            setActionFilter(event.target.value as "ALL" | "CREATE" | "UPDATE" | "DELETE");
            setPage(1);
          }}
        >
          <option value="ALL">All actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
        </select>

        <select
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          value={entityFilter}
          onChange={(event) => {
            setEntityFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All entities</option>
          {entities.map((entity) => (
            <option key={entity} value={entity}>
              {entity}
            </option>
          ))}
        </select>

        <select
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          value={actorFilter}
          onChange={(event) => {
            setActorFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All actors</option>
          {actors.map((actorId) => (
            <option key={actorId} value={actorId}>
              {userMap[actorId]?.display_name ?? actorId}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
        <span>
          Page {currentPage} / {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40"
            disabled={currentPage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            Next
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {pageItems.length === 0 && <p className="text-sm text-slate-500">No activity for the selected filters.</p>}
        {pageItems.map((item) => {
          const actorName = userMap[item.actor_user_id]?.display_name ?? item.actor_user_id;
          const sentence = describeActivity(item, peopleNameMap, actorName);

          return (
            <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="font-semibold text-slate-800">{sentence}</div>
              <div className="mt-1 text-xs text-slate-500">
                {item.target_entity} • {item.target_id}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">{item.created_at}</div>
            </div>
          );
        })}
      </div>
        </>
      )}
    </aside>
  );
}
