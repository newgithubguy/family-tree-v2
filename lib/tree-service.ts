import { randomUUID } from "node:crypto";
import { currentTimestamp, getDb } from "@/lib/db";
import { logActivity } from "@/lib/audit";

function defaultPosition(index: number) {
  return {
    x: 80 + (index % 4) * 180,
    y: 80 + Math.floor(index / 4) * 120
  };
}

export function getTreeState(treeId: string) {
  const db = getDb();
  const tree = db.data.trees.find((t) => t.id === treeId);
  if (!tree) {
    return null;
  }

  const users = [...db.data.users]
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
    .map((user) => ({
      id: user.id,
      display_name: user.display_name,
      email: user.email,
      created_at: user.created_at
    }));
  const members = db.data.tree_members
    .filter((m) => m.tree_id === treeId)
    .map((m) => {
      const u = db.data.users.find((user) => user.id === m.user_id);
      return {
        tree_id: m.tree_id,
        user_id: m.user_id,
        role: m.role,
        display_name: u?.display_name ?? m.user_id,
        email: u?.email ?? ""
      };
    })
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  const people = db.data.people.filter((p) => p.tree_id === treeId);
  const unions = db.data.unions.filter((u) => u.tree_id === treeId);
  const childrenLinks = db.data.union_children.filter((uc) => uc.tree_id === treeId);
  const nodePositions = db.data.node_positions.filter((np) => np.tree_id === treeId);
  const activity = db.data.activity_log
    .filter((a) => a.tree_id === treeId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return {
    tree,
    users,
    members,
    people,
    unions,
    childrenLinks,
    nodePositions,
    activity
  };
}

export function createPerson(input: {
  treeId: string;
  actorUserId: string;
  firstName: string;
  lastName: string;
  sex: "male" | "female" | "unknown";
  birthDate?: string | null;
  notes?: string | null;
}) {
  const db = getDb();
  const now = currentTimestamp();
  const created = {
    id: randomUUID(),
    tree_id: input.treeId,
    first_name: input.firstName,
    last_name: input.lastName,
    sex: input.sex,
    birth_date: input.birthDate ?? null,
    notes: input.notes ?? null,
    created_at: now,
    updated_at: now
  };

  db.data.people.push(created);

  const pos = defaultPosition(db.data.people.length - 1);
  const nodePosition = {
    id: randomUUID(),
    tree_id: input.treeId,
    person_id: created.id,
    x: pos.x,
    y: pos.y,
    updated_at: now
  };
  db.data.node_positions.push(nodePosition);
  db.save();

  logActivity({
    treeId: input.treeId,
    actorUserId: input.actorUserId,
    action: "CREATE",
    targetEntity: "people",
    targetId: created.id,
    oldValues: null,
    newValues: created
  });

  logActivity({
    treeId: input.treeId,
    actorUserId: input.actorUserId,
    action: "CREATE",
    targetEntity: "node_positions",
    targetId: nodePosition.id,
    oldValues: null,
    newValues: nodePosition
  });

  return created;
}

export function upsertNodePosition(input: {
  treeId: string;
  actorUserId: string;
  personId: string;
  x: number;
  y: number;
}) {
  const db = getDb();
  const existing = db.data.node_positions.find(
    (position) => position.tree_id === input.treeId && position.person_id === input.personId
  );

  if (existing) {
    const previous = { ...existing };
    existing.x = input.x;
    existing.y = input.y;
    existing.updated_at = currentTimestamp();
    db.save();

    logActivity({
      treeId: input.treeId,
      actorUserId: input.actorUserId,
      action: "UPDATE",
      targetEntity: "node_positions",
      targetId: existing.id,
      oldValues: previous,
      newValues: existing
    });

    return existing;
  }

  const created = {
    id: randomUUID(),
    tree_id: input.treeId,
    person_id: input.personId,
    x: input.x,
    y: input.y,
    updated_at: currentTimestamp()
  };
  db.data.node_positions.push(created);
  db.save();

  logActivity({
    treeId: input.treeId,
    actorUserId: input.actorUserId,
    action: "CREATE",
    targetEntity: "node_positions",
    targetId: created.id,
    oldValues: null,
    newValues: created
  });

  return created;
}

export function updatePerson(input: {
  id: string;
  treeId: string;
  actorUserId: string;
  firstName: string;
  lastName: string;
  sex: "male" | "female" | "unknown";
  birthDate?: string | null;
  notes?: string | null;
}) {
  const db = getDb();
  const person = db.data.people.find((p) => p.id === input.id && p.tree_id === input.treeId);
  if (!person) {
    return null;
  }

  const current = { ...person };
  person.first_name = input.firstName;
  person.last_name = input.lastName;
  person.sex = input.sex;
  person.birth_date = input.birthDate ?? null;
  person.notes = input.notes ?? null;
  person.updated_at = currentTimestamp();

  db.save();

  logActivity({
    treeId: input.treeId,
    actorUserId: input.actorUserId,
    action: "UPDATE",
    targetEntity: "people",
    targetId: input.id,
    oldValues: current,
    newValues: person
  });

  return person;
}

export function deletePerson(input: { id: string; treeId: string; actorUserId: string }) {
  const db = getDb();
  const personIndex = db.data.people.findIndex((p) => p.id === input.id && p.tree_id === input.treeId);
  if (personIndex < 0) {
    return false;
  }

  const person = db.data.people[personIndex];

  const relatedUnions = db.data.unions.filter(
    (u) =>
      u.tree_id === input.treeId &&
      (u.partner_a_person_id === input.id || u.partner_b_person_id === input.id)
  );

  for (const union of relatedUnions) {
    const removedLinks = db.data.union_children.filter((uc) => uc.tree_id === input.treeId && uc.union_id === union.id);
    db.data.union_children = db.data.union_children.filter((uc) => !(uc.tree_id === input.treeId && uc.union_id === union.id));
    for (const link of removedLinks) {
      logActivity({
        treeId: input.treeId,
        actorUserId: input.actorUserId,
        action: "DELETE",
        targetEntity: "union_children",
        targetId: link.id,
        oldValues: link,
        newValues: null
      });
    }

    db.data.unions = db.data.unions.filter((u) => u.id !== union.id);
    logActivity({
      treeId: input.treeId,
      actorUserId: input.actorUserId,
      action: "DELETE",
      targetEntity: "unions",
      targetId: union.id,
      oldValues: union,
      newValues: null
    });
  }

  const directLinks = db.data.union_children.filter((uc) => uc.tree_id === input.treeId && uc.child_person_id === input.id);
  db.data.union_children = db.data.union_children.filter(
    (uc) => !(uc.tree_id === input.treeId && uc.child_person_id === input.id)
  );
  for (const link of directLinks) {
    logActivity({
      treeId: input.treeId,
      actorUserId: input.actorUserId,
      action: "DELETE",
      targetEntity: "union_children",
      targetId: link.id,
      oldValues: link,
      newValues: null
    });
  }

  const position = db.data.node_positions.find((p) => p.tree_id === input.treeId && p.person_id === input.id);
  if (position) {
    db.data.node_positions = db.data.node_positions.filter((p) => !(p.tree_id === input.treeId && p.person_id === input.id));
    logActivity({
      treeId: input.treeId,
      actorUserId: input.actorUserId,
      action: "DELETE",
      targetEntity: "node_positions",
      targetId: position.id,
      oldValues: position,
      newValues: null
    });
  }

  db.data.people.splice(personIndex, 1);
  db.save();

  logActivity({
    treeId: input.treeId,
    actorUserId: input.actorUserId,
    action: "DELETE",
    targetEntity: "people",
    targetId: input.id,
    oldValues: person,
    newValues: null
  });

  return true;
}

export function createUnion(input: {
  treeId: string;
  actorUserId: string;
  partnerAPersonId: string;
  partnerBPersonId: string;
  unionType: "married" | "unmarried" | "divorced";
}) {
  const db = getDb();
  const now = currentTimestamp();
  const created = {
    id: randomUUID(),
    tree_id: input.treeId,
    partner_a_person_id: input.partnerAPersonId,
    partner_b_person_id: input.partnerBPersonId,
    union_type: input.unionType,
    start_date: null,
    end_date: null,
    created_at: now,
    updated_at: now
  };

  db.data.unions.push(created);
  db.save();

  logActivity({
    treeId: input.treeId,
    actorUserId: input.actorUserId,
    action: "CREATE",
    targetEntity: "unions",
    targetId: created.id,
    oldValues: null,
    newValues: created
  });

  return created;
}

export function deleteUnion(input: { id: string; treeId: string; actorUserId: string }) {
  const db = getDb();
  const union = db.data.unions.find((u) => u.id === input.id && u.tree_id === input.treeId);
  if (!union) {
    return false;
  }

  const removedLinks = db.data.union_children.filter((uc) => uc.tree_id === input.treeId && uc.union_id === input.id);
  db.data.union_children = db.data.union_children.filter((uc) => !(uc.tree_id === input.treeId && uc.union_id === input.id));
  for (const link of removedLinks) {
    logActivity({
      treeId: input.treeId,
      actorUserId: input.actorUserId,
      action: "DELETE",
      targetEntity: "union_children",
      targetId: link.id,
      oldValues: link,
      newValues: null
    });
  }

  db.data.unions = db.data.unions.filter((u) => !(u.id === input.id && u.tree_id === input.treeId));
  db.save();

  logActivity({
    treeId: input.treeId,
    actorUserId: input.actorUserId,
    action: "DELETE",
    targetEntity: "unions",
    targetId: input.id,
    oldValues: union,
    newValues: null
  });

  return true;
}

export function createChildLink(input: {
  treeId: string;
  actorUserId: string;
  unionId: string;
  childPersonId: string;
}) {
  const db = getDb();

  const existing = db.data.union_children.find(
    (uc) => uc.tree_id === input.treeId && uc.union_id === input.unionId && uc.child_person_id === input.childPersonId
  );
  if (existing) {
    return existing;
  }

  const created = {
    id: randomUUID(),
    tree_id: input.treeId,
    union_id: input.unionId,
    child_person_id: input.childPersonId,
    created_at: currentTimestamp()
  };

  db.data.union_children.push(created);
  db.save();

  logActivity({
    treeId: input.treeId,
    actorUserId: input.actorUserId,
    action: "CREATE",
    targetEntity: "union_children",
    targetId: created.id,
    oldValues: null,
    newValues: created
  });

  return created;
}

export function deleteChildLink(input: { id: string; treeId: string; actorUserId: string }) {
  const db = getDb();
  const link = db.data.union_children.find((uc) => uc.id === input.id && uc.tree_id === input.treeId);
  if (!link) {
    return false;
  }

  db.data.union_children = db.data.union_children.filter((uc) => !(uc.id === input.id && uc.tree_id === input.treeId));
  db.save();

  logActivity({
    treeId: input.treeId,
    actorUserId: input.actorUserId,
    action: "DELETE",
    targetEntity: "union_children",
    targetId: input.id,
    oldValues: link,
    newValues: null
  });

  return true;
}
