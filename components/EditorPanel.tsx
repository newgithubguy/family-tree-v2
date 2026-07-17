"use client";

import { useMemo, useState } from "react";
import { PencilLine, Plus, Link2 } from "lucide-react";
import type { Person, UnionRecord } from "@/lib/types";

interface EditorPanelProps {
  treeId: string;
  canEdit: boolean;
  people: Person[];
  unions: UnionRecord[];
  onRefresh: () => Promise<void>;
}

export function EditorPanel({ treeId, canEdit, people, unions, onRefresh }: EditorPanelProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sex, setSex] = useState<Person["sex"]>("unknown");

  const [partnerA, setPartnerA] = useState("");
  const [partnerB, setPartnerB] = useState("");
  const [unionType, setUnionType] = useState<UnionRecord["union_type"]>("married");

  const [mapParentA, setMapParentA] = useState("");
  const [mapParentB, setMapParentB] = useState("");
  const [unionId, setUnionId] = useState("");
  const [childId, setChildId] = useState("");

  const peopleNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    people.forEach((person) => {
      map[person.id] = `${person.first_name} ${person.last_name}`.trim();
    });
    return map;
  }, [people]);

  const filteredUnions = useMemo(() => {
    return unions.filter((union) => {
      const hasParentA = mapParentA
        ? union.partner_a_person_id === mapParentA || union.partner_b_person_id === mapParentA
        : true;
      const hasParentB = mapParentB
        ? union.partner_a_person_id === mapParentB || union.partner_b_person_id === mapParentB
        : true;
      return hasParentA && hasParentB;
    });
  }, [mapParentA, mapParentB, unions]);

  function unionDisplayName(union: UnionRecord) {
    const partnerAName = peopleNameMap[union.partner_a_person_id] ?? "Unknown parent";
    const partnerBName = peopleNameMap[union.partner_b_person_id] ?? "Unknown parent";
    return `${partnerAName} + ${partnerBName} (${union.union_type})`;
  }

  async function createPerson() {
    if (!canEdit) return;
    await fetch("/api/tree/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        treeId,
        firstName,
        lastName,
        sex
      })
    });
    setFirstName("");
    setLastName("");
    setSex("unknown");
    await onRefresh();
  }

  async function createUnion() {
    if (!canEdit) return;
    await fetch("/api/tree/unions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        treeId,
        partnerAPersonId: partnerA,
        partnerBPersonId: partnerB,
        unionType
      })
    });
    setPartnerA("");
    setPartnerB("");
    await onRefresh();
  }

  async function createChildLink() {
    if (!canEdit) return;
    await fetch("/api/tree/children-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ treeId, unionId, childPersonId: childId })
    });
    setUnionId("");
    setChildId("");
    await onRefresh();
  }

  return (
    <div className="panel h-full min-h-[520px] overflow-auto p-4">
      <div className="mb-4 flex items-center gap-2">
        <PencilLine className="h-5 w-5 text-teal-700" />
        <h2 className="text-lg font-semibold text-slate-800">Edit Panel</h2>
      </div>

      {!canEdit && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          You are a viewer. Editing is disabled.
        </p>
      )}

      <section className="mb-5 space-y-2 rounded-xl border border-slate-200 p-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Plus className="h-4 w-4" />
          Add Person
        </h3>
        <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        <select className="w-full rounded-md border px-3 py-2 text-sm" value={sex} onChange={(e) => setSex(e.target.value as Person["sex"])}>
          <option value="unknown">Unknown</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        <button disabled={!canEdit || !firstName || !lastName} onClick={createPerson} className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Create Person
        </button>
      </section>

      <section className="mb-5 space-y-2 rounded-xl border border-slate-200 p-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Link2 className="h-4 w-4" />
          Add Union
        </h3>
        <select className="w-full rounded-md border px-3 py-2 text-sm" value={partnerA} onChange={(e) => setPartnerA(e.target.value)}>
          <option value="">Partner A</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
          ))}
        </select>
        <select className="w-full rounded-md border px-3 py-2 text-sm" value={partnerB} onChange={(e) => setPartnerB(e.target.value)}>
          <option value="">Partner B</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
          ))}
        </select>
        <select className="w-full rounded-md border px-3 py-2 text-sm" value={unionType} onChange={(e) => setUnionType(e.target.value as UnionRecord["union_type"])}>
          <option value="married">Married</option>
          <option value="unmarried">Unmarried</option>
          <option value="divorced">Divorced</option>
        </select>
        <button disabled={!canEdit || !partnerA || !partnerB} onClick={createUnion} className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Create Union
        </button>
      </section>

      <section className="space-y-2 rounded-xl border border-slate-200 p-3">
        <h3 className="text-sm font-semibold text-slate-800">Map Child to Parents</h3>
        <p className="text-xs text-slate-500">Pick one or both parents to narrow the union list, then select the child.</p>
        <select
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={mapParentA}
          onChange={(e) => {
            setMapParentA(e.target.value);
            setUnionId("");
          }}
        >
          <option value="">Filter by parent (optional)</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
          ))}
        </select>
        <select
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={mapParentB}
          onChange={(e) => {
            setMapParentB(e.target.value);
            setUnionId("");
          }}
        >
          <option value="">Filter by second parent (optional)</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
          ))}
        </select>
        <select className="w-full rounded-md border px-3 py-2 text-sm" value={unionId} onChange={(e) => setUnionId(e.target.value)}>
          <option value="">Select parent union</option>
          {filteredUnions.map((u) => (
            <option key={u.id} value={u.id}>{unionDisplayName(u)}</option>
          ))}
        </select>
        {filteredUnions.length === 0 && <p className="text-xs text-amber-700">No union matches the selected parent filters.</p>}
        <select className="w-full rounded-md border px-3 py-2 text-sm" value={childId} onChange={(e) => setChildId(e.target.value)}>
          <option value="">Select child</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
          ))}
        </select>
        <button disabled={!canEdit || !unionId || !childId} onClick={createChildLink} className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Link Child
        </button>
      </section>
    </div>
  );
}
