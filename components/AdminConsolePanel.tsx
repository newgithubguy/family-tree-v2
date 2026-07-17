"use client";

import { useMemo, useState } from "react";
import { Shield } from "lucide-react";

type Member = {
  tree_id: string;
  user_id: string;
  role: "viewer" | "editor";
  display_name: string;
  email: string;
};

type User = {
  id: string;
  display_name: string;
  email: string;
};

interface AdminConsolePanelProps {
  treeId: string;
  users: User[];
  members: Member[];
  ownerUserId?: string;
  onRefresh: () => Promise<void>;
}

export function AdminConsolePanel({ treeId, users, members, ownerUserId, onRefresh }: AdminConsolePanelProps) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"none" | "viewer" | "editor">("viewer");

  const [selectedExistingUserId, setSelectedExistingUserId] = useState("");
  const [selectedExistingRole, setSelectedExistingRole] = useState<"viewer" | "editor">("viewer");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const memberByUserId = useMemo(() => {
    const map: Record<string, Member> = {};
    members.forEach((member) => {
      map[member.user_id] = member;
    });
    return map;
  }, [members]);

  const eligibleUsers = useMemo(() => {
    return users.filter((user) => !memberByUserId[user.id]);
  }, [memberByUserId, users]);

  async function createUser() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        treeId,
        displayName,
        email,
        password,
        role: newUserRole
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Failed to create user");
      setBusy(false);
      return;
    }

    setDisplayName("");
    setEmail("");
    setPassword("");
    setNewUserRole("viewer");
    await onRefresh();
    setBusy(false);
  }

  async function addExistingUser() {
    if (!selectedExistingUserId) {
      return;
    }

    setBusy(true);
    setError(null);
    const response = await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        treeId,
        userId: selectedExistingUserId,
        role: selectedExistingRole
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Failed to add member");
      setBusy(false);
      return;
    }

    setSelectedExistingUserId("");
    await onRefresh();
    setBusy(false);
  }

  async function updateRole(userId: string, role: "viewer" | "editor") {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ treeId, userId, role })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Failed to update role");
      setBusy(false);
      return;
    }

    await onRefresh();
    setBusy(false);
  }

  async function removeMember(userId: string) {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/admin/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ treeId, userId })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Failed to remove member");
      setBusy(false);
      return;
    }

    await onRefresh();
    setBusy(false);
  }

  return (
    <section className="panel mt-4 p-4">
      <div className="mb-4 flex items-center gap-2">
        <Shield className="h-5 w-5 text-sky-700" />
        <h2 className="text-lg font-semibold text-slate-800">Admin Console</h2>
      </div>

      {error && <p className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Create User</h3>
          <div className="space-y-2">
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Display name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={newUserRole}
              onChange={(event) => setNewUserRole(event.target.value as "none" | "viewer" | "editor")}
            >
              <option value="viewer">Add to tree as viewer</option>
              <option value="editor">Add to tree as editor</option>
              <option value="none">Create user only</option>
            </select>
            <button
              type="button"
              disabled={busy || !displayName || !email || password.length < 4}
              className="w-full rounded-md bg-sky-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={createUser}
            >
              Create User
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Add Existing User to Tree</h3>
          <div className="space-y-2">
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={selectedExistingUserId}
              onChange={(event) => setSelectedExistingUserId(event.target.value)}
            >
              <option value="">Select user</option>
              {eligibleUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.display_name} ({user.email})
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={selectedExistingRole}
              onChange={(event) => setSelectedExistingRole(event.target.value as "viewer" | "editor")}
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
            <button
              type="button"
              disabled={busy || !selectedExistingUserId}
              className="w-full rounded-md bg-sky-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={addExistingUser}
            >
              Add Member
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 p-3">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Tree Members</h3>
        <div className="space-y-2">
          {members.map((member) => {
            const isOwner = ownerUserId === member.user_id;
            return (
              <div key={member.user_id} className="grid items-center gap-2 rounded-md border border-slate-200 p-2 md:grid-cols-[1fr_140px_120px]">
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    {member.display_name}
                    {isOwner ? " (Owner)" : ""}
                  </div>
                  <div className="text-xs text-slate-500">{member.email}</div>
                </div>
                <select
                  className="rounded-md border px-2 py-1 text-sm"
                  value={member.role}
                  disabled={busy || isOwner}
                  onChange={(event) => updateRole(member.user_id, event.target.value as "viewer" | "editor")}
                >
                  <option value="viewer">viewer</option>
                  <option value="editor">editor</option>
                </select>
                <button
                  type="button"
                  className="rounded-md border border-rose-300 px-2 py-1 text-sm text-rose-700 disabled:opacity-40"
                  disabled={busy || isOwner}
                  onClick={() => removeMember(member.user_id)}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
