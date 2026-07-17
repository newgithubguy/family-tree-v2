"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Users } from "lucide-react";
import { TreeCanvas } from "@/components/TreeCanvas";
import { ActivityLogPanel } from "@/components/ActivityLogPanel";
import { EditorPanel } from "@/components/EditorPanel";
import { AdminConsolePanel } from "@/components/AdminConsolePanel";
import type { NodePosition, Person, UnionChildLink, UnionRecord } from "@/lib/types";

interface ApiState {
  tree: { id: string; name: string; owner_user_id?: string };
  users: { id: string; display_name: string; email: string }[];
  members: { tree_id: string; user_id: string; role: "viewer" | "editor"; display_name: string; email: string }[];
  people: Person[];
  unions: UnionRecord[];
  childrenLinks: UnionChildLink[];
  nodePositions: NodePosition[];
  activity: {
    id: string;
    actor_user_id: string;
    action: "CREATE" | "UPDATE" | "DELETE";
    target_entity: string;
    target_id: string;
    old_values: string | null;
    new_values: string | null;
    created_at: string;
  }[];
  me: { id: string; display_name: string; email: string };
  role: "viewer" | "editor";
  canEdit: boolean;
  isAdmin: boolean;
}

type ApiStatePayload = Partial<ApiState>;

const treeId = "tree-main";

export function Workspace() {
  const [state, setState] = useState<ApiState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("alex@example.com");
  const [password, setPassword] = useState("admin123");
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [activityCollapsed, setActivityCollapsed] = useState(false);
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [adminCollapsed, setAdminCollapsed] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  async function login() {
    setIsSubmittingLogin(true);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      setError("Invalid email or password");
      setIsSubmittingLogin(false);
      return;
    }

    await refresh();
    setIsSubmittingLogin(false);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState(null);
    setError(null);
  }

  async function refresh() {
    const response = await fetch(`/api/tree/state?treeId=${treeId}`, {
      cache: "no-store"
    });

    if (response.status === 401) {
      setState(null);
      return;
    }

    if (!response.ok) {
      setError("Failed to load state");
      return;
    }

    const payload = (await response.json()) as ApiStatePayload;
    if (!payload.tree || !payload.me || !payload.role || typeof payload.canEdit !== "boolean") {
      setError("Tree payload incomplete");
      return;
    }

    const normalized: ApiState = {
      tree: payload.tree,
      users: payload.users ?? [],
      members: payload.members ?? [],
      people: payload.people ?? [],
      unions: payload.unions ?? [],
      childrenLinks: payload.childrenLinks ?? [],
      nodePositions: payload.nodePositions ?? [],
      activity: payload.activity ?? [],
      me: payload.me,
      role: payload.role,
      canEdit: payload.canEdit,
      isAdmin: payload.isAdmin ?? false
    };

    setState(normalized);
    setError(null);
  }

  async function onPositionCommit(personId: string, x: number, y: number) {
    if (!state?.canEdit) {
      return;
    }
    await fetch("/api/tree/node-positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ treeId, personId, x, y })
    });
    await refresh();
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    if (!state?.me?.id) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsPort = Number(window.location.port || "3000") + 1;
    const socket = new WebSocket(`${protocol}://${window.location.hostname}:${wsPort}/ws?treeId=${treeId}`);
    wsRef.current = socket;

    socket.addEventListener("message", () => {
      void refresh();
    });

    return () => {
      socket.close();
      wsRef.current = null;
    };
  }, [state?.me?.id]);

  useEffect(() => {
    if (!selectedPersonId) {
      return;
    }

    const personStillExists = (state?.people ?? []).some((person) => person.id === selectedPersonId);
    if (!personStillExists) {
      setSelectedPersonId("");
    }
  }, [selectedPersonId, state?.people]);

  const userMap = useMemo(() => {
    const map: Record<string, { display_name: string }> = {};
    (state?.users ?? []).forEach((user) => {
      map[user.id] = { display_name: user.display_name };
    });
    return map;
  }, [state?.users]);

  const peopleNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (state?.people ?? []).forEach((person) => {
      map[person.id] = `${person.first_name} ${person.last_name}`.trim();
    });
    return map;
  }, [state?.people]);

  const allLeftPanelsCollapsed =
    editorCollapsed && activityCollapsed && (!state?.isAdmin || adminCollapsed);

  if (!state) {
    return (
      <main className="mx-auto max-w-md p-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-panel">
          <h1 className="mb-2 text-2xl font-bold text-slate-900">Family Tree Login</h1>
          <p className="mb-4 text-sm text-slate-500">Sign in to access the collaborative workspace.</p>
          <div className="space-y-3">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={isSubmittingLogin || !email || !password}
              onClick={login}
            >
              {isSubmittingLogin ? "Signing in..." : "Sign In"}
            </button>
            <p className="text-xs text-slate-500">Seed users: alex@example.com/admin123, sam@example.com/editor123, jo@example.com/viewer123</p>
          </div>
          {error && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1900px] p-4 md:p-6">
      <header className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-panel md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{state.tree.name}</h1>
          <p className="text-sm text-slate-500">
            Logged in as {state.me.display_name} ({state.role})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-500" />
          <button className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white" onClick={refresh}>
            Refresh
          </button>
          <button
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            onClick={logout}
          >
            Sign Out
          </button>
          {editorCollapsed && (
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              onClick={() => setEditorCollapsed(false)}
            >
              Show Edit Panel
            </button>
          )}
          {activityCollapsed && (
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              onClick={() => setActivityCollapsed(false)}
            >
              Show Activity
            </button>
          )}
          {state.isAdmin && adminCollapsed && (
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              onClick={() => setAdminCollapsed(false)}
            >
              Show Admin Console
            </button>
          )}
        </div>
      </header>

      {error && <p className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <section
        className={`grid gap-4 ${
          allLeftPanelsCollapsed ? "grid-cols-1" : "lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]"
        }`}
      >
        {!allLeftPanelsCollapsed && <div className="order-2 space-y-4 lg:order-1">
          {!editorCollapsed && (
            <EditorPanel
              treeId={treeId}
              canEdit={state.canEdit}
              people={state.people}
              unions={state.unions}
              childrenLinks={state.childrenLinks}
              selectedPersonId={selectedPersonId}
              onSelectedPersonChange={setSelectedPersonId}
              collapsed={editorCollapsed}
              onCollapsedChange={setEditorCollapsed}
              onRefresh={refresh}
            />
          )}

          {!activityCollapsed && (
            <ActivityLogPanel
              activity={state.activity}
              userMap={userMap}
              peopleNameMap={peopleNameMap}
              collapsed={activityCollapsed}
              onCollapsedChange={setActivityCollapsed}
            />
          )}

          {state.isAdmin && !adminCollapsed && (
            <AdminConsolePanel
              treeId={treeId}
              users={state.users}
              members={state.members}
              ownerUserId={state.tree.owner_user_id}
              onCollapsedChange={setAdminCollapsed}
              onRefresh={refresh}
            />
          )}
        </div>}

        <div className={allLeftPanelsCollapsed ? "order-1" : "order-1 lg:order-2"}>
          <TreeCanvas
            people={state.people}
            unions={state.unions}
            childrenLinks={state.childrenLinks}
            nodePositions={state.nodePositions ?? []}
            canEdit={state.canEdit}
            selectedPersonId={selectedPersonId}
            onSelectPerson={setSelectedPersonId}
            onPositionCommit={onPositionCommit}
          />
        </div>
      </section>
    </main>
  );
}
