"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sex, setSex] = useState<Person["sex"]>("unknown");
  const [birthDate, setBirthDate] = useState("");
  const [notes, setNotes] = useState("");
  const [personMessage, setPersonMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (!selectedPersonId) {
      setFirstName("");
      setLastName("");
      setSex("unknown");
      setBirthDate("");
      setNotes("");
      setPersonMessage(null);
      return;
    }

    const selectedPerson = people.find((person) => person.id === selectedPersonId);
    if (!selectedPerson) {
      setSelectedPersonId("");
      return;
    }

    setFirstName(selectedPerson.first_name);
    setLastName(selectedPerson.last_name);
    setSex(selectedPerson.sex);
    setBirthDate(selectedPerson.birth_date ?? "");
    setNotes(selectedPerson.notes ?? "");
    setPersonMessage(null);
  }, [people, selectedPersonId]);

  function unionDisplayName(union: UnionRecord) {
    const partnerAName = peopleNameMap[union.partner_a_person_id] ?? "Unknown parent";
    const partnerBName = peopleNameMap[union.partner_b_person_id] ?? "Unknown parent";
    return `${partnerAName} + ${partnerBName} (${union.union_type})`;
  }

  async function submitPerson() {
    if (!canEdit) return;
    const response = await fetch(selectedPersonId ? `/api/tree/people/${selectedPersonId}` : "/api/tree/people", {
      method: selectedPersonId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        treeId,
        firstName,
        lastName,
        sex,
        birthDate: birthDate || null,
        notes: notes || null
      })
    });

    if (!response.ok) {
      setPersonMessage(selectedPersonId ? "Failed to update person." : "Failed to create person.");
      return;
    }

    setPersonMessage(selectedPersonId ? "Person updated." : "Person created.");
    if (!selectedPersonId) {
      setFirstName("");
      setLastName("");
      setSex("unknown");
      setBirthDate("");
      setNotes("");
    }
    await onRefresh();
  }

  async function removePerson() {
    if (!canEdit || !selectedPersonId) return;
    const selectedPerson = people.find((person) => person.id === selectedPersonId);
    if (!selectedPerson) return;

    const confirmed = window.confirm(
      `Remove ${selectedPerson.first_name} ${selectedPerson.last_name}? This also removes related unions and child links.`
    );
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/tree/people/${selectedPersonId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ treeId })
    });

    if (!response.ok) {
      setPersonMessage("Failed to remove person.");
      return;
    }

    setSelectedPersonId("");
    setPersonMessage("Person removed.");
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
          Manage Person
        </h3>
        <select
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={selectedPersonId}
          onChange={(e) => setSelectedPersonId(e.target.value)}
        >
          <option value="">Create new person</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>
          ))}
        </select>
        <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        <select className="w-full rounded-md border px-3 py-2 text-sm" value={sex} onChange={(e) => setSex(e.target.value as Person["sex"])}>
          <option value="unknown">Unknown</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        <input
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Birth date"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
        <textarea
          className="min-h-24 w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {personMessage && <p className="text-xs text-slate-600">{personMessage}</p>}
        <button disabled={!canEdit || !firstName || !lastName} onClick={submitPerson} className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {selectedPersonId ? "Save Changes" : "Create Person"}
        </button>
        {selectedPersonId && (
          <button
            disabled={!canEdit}
            onClick={removePerson}
            className="w-full rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
          >
            Remove Person
          </button>
        )}
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
