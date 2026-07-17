import path from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

type Role = "viewer" | "editor";

type UserRow = {
  id: string;
  display_name: string;
  email: string;
  password: string;
  created_at: string;
};

type TreeRow = {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
};

type TreeMemberRow = {
  tree_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
};

type PersonRow = {
  id: string;
  tree_id: string;
  first_name: string;
  last_name: string;
  sex: "male" | "female" | "unknown";
  birth_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type UnionRow = {
  id: string;
  tree_id: string;
  partner_a_person_id: string;
  partner_b_person_id: string | null;
  union_type: "married" | "unmarried" | "divorced";
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

type UnionChildRow = {
  id: string;
  tree_id: string;
  union_id: string;
  child_person_id: string;
  created_at: string;
};

type ActivityRow = {
  id: string;
  tree_id: string;
  actor_user_id: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  target_entity: string;
  target_id: string;
  old_values: string | null;
  new_values: string | null;
  created_at: string;
};

type NodePositionRow = {
  id: string;
  tree_id: string;
  person_id: string;
  x: number;
  y: number;
  updated_at: string;
};

export type RelationalMockData = {
  users: UserRow[];
  trees: TreeRow[];
  tree_members: TreeMemberRow[];
  people: PersonRow[];
  unions: UnionRow[];
  union_children: UnionChildRow[];
  activity_log: ActivityRow[];
  node_positions: NodePositionRow[];
};

export type RelationalMockDb = {
  data: RelationalMockData;
  save: () => void;
};

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "relational-mock.json");

let db: RelationalMockDb | null = null;

function nowIso() {
  return new Date().toISOString();
}

function defaultPosition(index: number) {
  return {
    x: 80 + (index % 4) * 180,
    y: 80 + Math.floor(index / 4) * 120
  };
}

function createSeedData(): RelationalMockData {
  const now = nowIso();
  const treeId = "tree-main";
  const people = [
    {
      id: "p-john",
      tree_id: treeId,
      first_name: "John",
      last_name: "Miller",
      sex: "male" as const,
      birth_date: null,
      notes: null,
      created_at: now,
      updated_at: now
    },
    {
      id: "p-sarah",
      tree_id: treeId,
      first_name: "Sarah",
      last_name: "Miller",
      sex: "female" as const,
      birth_date: null,
      notes: null,
      created_at: now,
      updated_at: now
    },
    {
      id: "p-elena",
      tree_id: treeId,
      first_name: "Elena",
      last_name: "Miller",
      sex: "female" as const,
      birth_date: null,
      notes: null,
      created_at: now,
      updated_at: now
    },
    {
      id: "p-emma",
      tree_id: treeId,
      first_name: "Emma",
      last_name: "Miller",
      sex: "female" as const,
      birth_date: null,
      notes: null,
      created_at: now,
      updated_at: now
    },
    {
      id: "p-luke",
      tree_id: treeId,
      first_name: "Luke",
      last_name: "Miller",
      sex: "male" as const,
      birth_date: null,
      notes: null,
      created_at: now,
      updated_at: now
    }
  ];

  return {
    users: [
      { id: "u-admin", display_name: "Alex Owner", email: "alex@example.com", password: "admin123", created_at: now },
      { id: "u-editor", display_name: "Sam Editor", email: "sam@example.com", password: "editor123", created_at: now },
      { id: "u-viewer", display_name: "Jo Viewer", email: "jo@example.com", password: "viewer123", created_at: now }
    ],
    trees: [{ id: treeId, name: "Collaborative Family Tree", owner_user_id: "u-admin", created_at: now }],
    tree_members: [
      { tree_id: treeId, user_id: "u-admin", role: "editor", joined_at: now },
      { tree_id: treeId, user_id: "u-editor", role: "editor", joined_at: now },
      { tree_id: treeId, user_id: "u-viewer", role: "viewer", joined_at: now }
    ],
    people,
    unions: [
      {
        id: "union-john-sarah",
        tree_id: treeId,
        partner_a_person_id: "p-john",
        partner_b_person_id: "p-sarah",
        union_type: "married",
        start_date: null,
        end_date: null,
        created_at: now,
        updated_at: now
      },
      {
        id: "union-john-elena",
        tree_id: treeId,
        partner_a_person_id: "p-john",
        partner_b_person_id: "p-elena",
        union_type: "unmarried",
        start_date: null,
        end_date: null,
        created_at: now,
        updated_at: now
      }
    ],
    union_children: [
      {
        id: "uc-emma",
        tree_id: treeId,
        union_id: "union-john-sarah",
        child_person_id: "p-emma",
        created_at: now
      },
      {
        id: "uc-luke",
        tree_id: treeId,
        union_id: "union-john-elena",
        child_person_id: "p-luke",
        created_at: now
      }
    ],
    node_positions: people.map((person, index) => {
      const pos = defaultPosition(index);
      return {
        id: `np-${person.id}`,
        tree_id: treeId,
        person_id: person.id,
        x: pos.x,
        y: pos.y,
        updated_at: now
      };
    }),
    activity_log: [
      {
        id: "seed-log-1",
        tree_id: treeId,
        actor_user_id: "u-admin",
        action: "CREATE",
        target_entity: "seed",
        target_id: treeId,
        old_values: null,
        new_values: JSON.stringify({ initialized: true }),
        created_at: now
      }
    ]
  };
}

function saveData(data: RelationalMockData) {
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
}

function coerceDataShape(input: RelationalMockData | Record<string, unknown>): RelationalMockData {
  const now = nowIso();
  const raw = input as Partial<RelationalMockData>;
  const data: RelationalMockData = {
    users: raw.users ?? [],
    trees: raw.trees ?? [],
    tree_members: raw.tree_members ?? [],
    people: raw.people ?? [],
    unions: raw.unions ?? [],
    union_children: raw.union_children ?? [],
    activity_log: raw.activity_log ?? [],
    node_positions: raw.node_positions ?? []
  };

  data.users = data.users.map((user) => ({
    ...user,
    password: user.password || "password123"
  }));

  data.unions = data.unions.map((union) => ({
    ...union,
    partner_b_person_id:
      typeof union.partner_b_person_id === "string" && union.partner_b_person_id.trim().length > 0
        ? union.partner_b_person_id
        : null
  }));

  for (const person of data.people) {
    const exists = data.node_positions.some(
      (position) => position.tree_id === person.tree_id && position.person_id === person.id
    );
    if (!exists) {
      const personIndex = data.people.findIndex((p) => p.id === person.id);
      const pos = defaultPosition(personIndex);
      data.node_positions.push({
        id: `np-${person.id}`,
        tree_id: person.tree_id,
        person_id: person.id,
        x: pos.x,
        y: pos.y,
        updated_at: now
      });
    }
  }

  return data;
}

function loadData(): RelationalMockData {
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  if (!existsSync(DB_PATH)) {
    const seed = createSeedData();
    saveData(seed);
    return seed;
  }

  const parsed = JSON.parse(readFileSync(DB_PATH, "utf8")) as RelationalMockData;
  const shaped = coerceDataShape(parsed);
  saveData(shaped);
  return shaped;
}

export function ensureDatabase(): RelationalMockDb {
  const data = loadData();
  const instance: RelationalMockDb = {
    data,
    save: () => saveData(data)
  };
  db = instance;
  return instance;
}

export function getDb(): RelationalMockDb {
  if (!db) {
    db = ensureDatabase();
  }
  return db;
}

export function exportDatabase(): RelationalMockData {
  const snapshot = getDb().data;
  return JSON.parse(JSON.stringify(snapshot)) as RelationalMockData;
}

export function replaceDatabase(input: RelationalMockData | Record<string, unknown>) {
  const nextData = coerceDataShape(input);
  const instance = getDb();

  instance.data.users = nextData.users;
  instance.data.trees = nextData.trees;
  instance.data.tree_members = nextData.tree_members;
  instance.data.people = nextData.people;
  instance.data.unions = nextData.unions;
  instance.data.union_children = nextData.union_children;
  instance.data.activity_log = nextData.activity_log;
  instance.data.node_positions = nextData.node_positions;

  instance.save();
  return instance.data;
}

export function currentTimestamp() {
  return nowIso();
}
