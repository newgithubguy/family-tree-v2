"use client";

import { useEffect, useMemo, useState } from "react";
import { PencilLine, Plus, Link2 } from "lucide-react";
import type { KinshipLink, KinshipType, Person, UnionChildLink, UnionRecord } from "@/lib/types";

interface EditorPanelProps {
  treeId: string;
  canEdit: boolean;
  people: Person[];
  unions: UnionRecord[];
  childrenLinks: UnionChildLink[];
  kinshipLinks: KinshipLink[];
  selectedPersonId: string;
  onSelectedPersonChange: (personId: string) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onRefresh: () => Promise<void>;
}

export function EditorPanel({
  treeId,
  canEdit,
  people,
  unions,
  childrenLinks,
  kinshipLinks,
  selectedPersonId,
  onSelectedPersonChange,
  collapsed,
  onCollapsedChange,
  onRefresh
}: EditorPanelProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sex, setSex] = useState<Person["sex"]>("unknown");
  const [birthDate, setBirthDate] = useState("");
  const [notes, setNotes] = useState("");
  const [personMessage, setPersonMessage] = useState<string | null>(null);
  const [selectedUnionId, setSelectedUnionId] = useState("");
  const [connectionPartnerId, setConnectionPartnerId] = useState("");
  const [unionType, setUnionType] = useState<UnionRecord["union_type"]>("married");
  const [unionMessage, setUnionMessage] = useState<string | null>(null);
  const [selectedChildLinkId, setSelectedChildLinkId] = useState("");
  const [connectionUnionId, setConnectionUnionId] = useState("");
  const [singleParentId, setSingleParentId] = useState("");
  const [childLinkMessage, setChildLinkMessage] = useState<string | null>(null);
  const [selectedKinshipLinkId, setSelectedKinshipLinkId] = useState("");
  const [kinshipPersonId, setKinshipPersonId] = useState("");
  const [kinshipType, setKinshipType] = useState<KinshipType>("sibling");
  const [kinshipMessage, setKinshipMessage] = useState<string | null>(null);

  const peopleNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    people.forEach((person) => {
      map[person.id] = `${person.first_name} ${person.last_name}`.trim();
    });
    return map;
  }, [people]);

  const selectedPerson = useMemo(
    () => people.find((person) => person.id === selectedPersonId) ?? null,
    [people, selectedPersonId]
  );

  const partnerUnions = useMemo(
    () =>
      selectedPersonId
        ? unions.filter(
            (union) => union.partner_a_person_id === selectedPersonId || union.partner_b_person_id === selectedPersonId
          )
        : [],
    [selectedPersonId, unions]
  );

  const childLinksForPerson = useMemo(
    () => (selectedPersonId ? childrenLinks.filter((link) => link.child_person_id === selectedPersonId) : []),
    [childrenLinks, selectedPersonId]
  );

  const selectablePartners = useMemo(
    () => people.filter((person) => person.id !== selectedPersonId),
    [people, selectedPersonId]
  );

  const parentUnionOptions = useMemo(
    () =>
      unions.filter(
        (union) =>
          union.partner_a_person_id !== selectedPersonId &&
          (!union.partner_b_person_id || union.partner_b_person_id !== selectedPersonId)
      ),
    [selectedPersonId, unions]
  );

  const parentPersonOptions = useMemo(
    () => people.filter((person) => person.id !== selectedPersonId),
    [people, selectedPersonId]
  );

  const kinshipLinksForPerson = useMemo(
    () =>
      selectedPersonId
        ? kinshipLinks.filter(
            (link) => link.person_a_id === selectedPersonId || link.person_b_id === selectedPersonId
          )
        : [],
    [kinshipLinks, selectedPersonId]
  );

  function unionDisplayName(union: UnionRecord) {
    const partnerAName = peopleNameMap[union.partner_a_person_id] ?? "Unknown parent";
    if (!union.partner_b_person_id) {
      return `${partnerAName} (single parent)`;
    }

    const partnerBName = peopleNameMap[union.partner_b_person_id] ?? "Unknown parent";
    return `${partnerAName} + ${partnerBName} (${union.union_type})`;
  }

  function childLinkDisplayName(link: UnionChildLink) {
    const union = unions.find((record) => record.id === link.union_id);
    return union ? unionDisplayName(union) : "Unknown parent union";
  }

  function kinshipOtherPersonId(link: KinshipLink) {
    return link.person_a_id === selectedPersonId ? link.person_b_id : link.person_a_id;
  }

  function kinshipDisplayName(link: KinshipLink) {
    const otherPersonId = kinshipOtherPersonId(link);
    const otherName = peopleNameMap[otherPersonId] ?? "Unknown person";
    return `${link.kinship_type.toUpperCase()}: ${otherName}`;
  }

  useEffect(() => {
    if (!selectedPerson) {
      setFirstName("");
      setLastName("");
      setSex("unknown");
      setBirthDate("");
      setNotes("");
      setPersonMessage(null);
      setSelectedUnionId("");
      setConnectionPartnerId("");
      setUnionType("married");
      setUnionMessage(null);
      setSelectedChildLinkId("");
      setConnectionUnionId("");
      setSingleParentId("");
      setChildLinkMessage(null);
      setSelectedKinshipLinkId("");
      setKinshipPersonId("");
      setKinshipType("sibling");
      setKinshipMessage(null);
      return;
    }

    setFirstName(selectedPerson.first_name);
    setLastName(selectedPerson.last_name);
    setSex(selectedPerson.sex);
    setBirthDate(selectedPerson.birth_date ?? "");
    setNotes(selectedPerson.notes ?? "");
    setPersonMessage(null);
  }, [selectedPerson]);

  useEffect(() => {
    if (!selectedUnionId) {
      setConnectionPartnerId("");
      setUnionType("married");
      return;
    }

    const selectedUnion = partnerUnions.find((union) => union.id === selectedUnionId);
    if (!selectedUnion) {
      setSelectedUnionId("");
      return;
    }

    const otherPartnerId =
      selectedUnion.partner_a_person_id === selectedPersonId
        ? selectedUnion.partner_b_person_id ?? ""
        : selectedUnion.partner_a_person_id;

    setConnectionPartnerId(otherPartnerId);
    setUnionType(selectedUnion.union_type);
    setUnionMessage(null);
  }, [partnerUnions, selectedPersonId, selectedUnionId]);

  useEffect(() => {
    if (!selectedChildLinkId) {
      setConnectionUnionId("");
      setSingleParentId("");
      return;
    }

    const selectedChildLink = childLinksForPerson.find((link) => link.id === selectedChildLinkId);
    if (!selectedChildLink) {
      setSelectedChildLinkId("");
      return;
    }

    const linkedUnion = unions.find((record) => record.id === selectedChildLink.union_id);
    if (linkedUnion?.partner_b_person_id) {
      setConnectionUnionId(selectedChildLink.union_id);
      setSingleParentId("");
    } else {
      setConnectionUnionId("");
      setSingleParentId(linkedUnion?.partner_a_person_id ?? "");
    }
    setChildLinkMessage(null);
  }, [childLinksForPerson, selectedChildLinkId, unions]);

  useEffect(() => {
    if (!selectedKinshipLinkId) {
      setKinshipPersonId("");
      setKinshipType("sibling");
      return;
    }

    const selectedLink = kinshipLinksForPerson.find((link) => link.id === selectedKinshipLinkId);
    if (!selectedLink) {
      setSelectedKinshipLinkId("");
      return;
    }

    setKinshipPersonId(kinshipOtherPersonId(selectedLink));
    setKinshipType(selectedLink.kinship_type);
    setKinshipMessage(null);
  }, [kinshipLinksForPerson, selectedKinshipLinkId]);

  async function submitPerson() {
    if (!canEdit) {
      return;
    }

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
    onSelectedPersonChange("");
    setFirstName("");
    setLastName("");
    setSex("unknown");
    setBirthDate("");
    setNotes("");
    await onRefresh();
  }

  async function removePerson() {
    if (!canEdit || !selectedPerson) {
      return;
    }

    const confirmed = window.confirm(
      `Remove ${selectedPerson.first_name} ${selectedPerson.last_name}? This also removes related unions and child links.`
    );
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/tree/people/${selectedPerson.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ treeId })
    });

    if (!response.ok) {
      setPersonMessage("Failed to remove person.");
      return;
    }

    onSelectedPersonChange("");
    setFirstName("");
    setLastName("");
    setSex("unknown");
    setBirthDate("");
    setNotes("");
    setPersonMessage("Person removed.");
    await onRefresh();
  }

  async function submitUnion() {
    if (!canEdit || !selectedPersonId || !connectionPartnerId) {
      return;
    }

    const response = await fetch(selectedUnionId ? `/api/tree/unions/${selectedUnionId}` : "/api/tree/unions", {
      method: selectedUnionId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        treeId,
        partnerAPersonId: selectedPersonId,
        partnerBPersonId: connectionPartnerId,
        unionType
      })
    });

    if (!response.ok) {
      setUnionMessage(selectedUnionId ? "Failed to update partner connection." : "Failed to create partner connection.");
      return;
    }

    const payload = (await response.json().catch(() => null)) as { union?: UnionRecord } | null;
    const nextUnionId = payload?.union?.id ?? selectedUnionId;
    setUnionMessage(selectedUnionId ? "Partner connection updated." : "Partner connection created.");
    await onRefresh();

    if (nextUnionId) {
      setSelectedUnionId(nextUnionId);
    }
  }

  async function removeUnion() {
    if (!canEdit || !selectedUnionId) {
      return;
    }

    const confirmed = window.confirm("Remove this partner connection and any child links tied to it?");
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/tree/unions/${selectedUnionId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ treeId })
    });

    if (!response.ok) {
      setUnionMessage("Failed to remove partner connection.");
      return;
    }

    setSelectedUnionId("");
    setUnionMessage("Partner connection removed.");
    await onRefresh();
  }

  async function submitChildLink() {
    if (!canEdit || !selectedPersonId || (!connectionUnionId && !singleParentId)) {
      return;
    }

    let resolvedUnionId = connectionUnionId;
    if (!resolvedUnionId && singleParentId) {
      const existingSingleParentUnion = unions.find(
        (union) => union.partner_a_person_id === singleParentId && !union.partner_b_person_id
      );

      if (existingSingleParentUnion) {
        resolvedUnionId = existingSingleParentUnion.id;
      } else {
        const unionResponse = await fetch("/api/tree/unions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            treeId,
            partnerAPersonId: singleParentId,
            partnerBPersonId: null,
            unionType: "unmarried"
          })
        });

        if (!unionResponse.ok) {
          setChildLinkMessage("Failed to create single-parent record.");
          return;
        }

        const unionPayload = (await unionResponse.json().catch(() => null)) as { union?: UnionRecord } | null;
        if (!unionPayload?.union?.id) {
          setChildLinkMessage("Failed to create single-parent record.");
          return;
        }

        resolvedUnionId = unionPayload.union.id;
      }
    }

    if (!resolvedUnionId) {
      setChildLinkMessage("Select a parent union or a single parent.");
      return;
    }

    const response = await fetch(
      selectedChildLinkId ? `/api/tree/children-links/${selectedChildLinkId}` : "/api/tree/children-links",
      {
        method: selectedChildLinkId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treeId, unionId: resolvedUnionId, childPersonId: selectedPersonId })
      }
    );

    if (!response.ok) {
      setChildLinkMessage(selectedChildLinkId ? "Failed to update parent link." : "Failed to create parent link.");
      return;
    }

    const payload = (await response.json().catch(() => null)) as { link?: UnionChildLink } | null;
    const nextLinkId = payload?.link?.id ?? selectedChildLinkId;
    setChildLinkMessage(selectedChildLinkId ? "Parent link updated." : "Parent link created.");
    await onRefresh();

    if (nextLinkId) {
      setSelectedChildLinkId(nextLinkId);
    }

    setConnectionUnionId(resolvedUnionId);
    setSingleParentId("");
  }

  async function removeChildLink() {
    if (!canEdit || !selectedChildLinkId) {
      return;
    }

    const response = await fetch(`/api/tree/children-links/${selectedChildLinkId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ treeId })
    });

    if (!response.ok) {
      setChildLinkMessage("Failed to remove parent link.");
      return;
    }

    setSelectedChildLinkId("");
    setChildLinkMessage("Parent link removed.");
    await onRefresh();
  }

  async function removeChildLinkById(linkId: string) {
    if (!canEdit || !linkId) {
      return;
    }

    const response = await fetch(`/api/tree/children-links/${linkId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ treeId })
    });

    if (!response.ok) {
      setChildLinkMessage("Failed to remove parent link.");
      return;
    }

    if (selectedChildLinkId === linkId) {
      setSelectedChildLinkId("");
      setConnectionUnionId("");
      setSingleParentId("");
    }

    setChildLinkMessage("Parent link removed.");
    await onRefresh();
  }

  async function submitKinshipLink() {
    if (!canEdit || !selectedPersonId || !kinshipPersonId) {
      return;
    }

    const response = await fetch(
      selectedKinshipLinkId ? `/api/tree/kinship-links/${selectedKinshipLinkId}` : "/api/tree/kinship-links",
      {
        method: selectedKinshipLinkId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treeId,
          personAId: selectedPersonId,
          personBId: kinshipPersonId,
          kinshipType
        })
      }
    );

    if (!response.ok) {
      setKinshipMessage(selectedKinshipLinkId ? "Failed to update kinship link." : "Failed to create kinship link.");
      return;
    }

    const payload = (await response.json().catch(() => null)) as { link?: KinshipLink } | null;
    const nextLinkId = payload?.link?.id ?? selectedKinshipLinkId;
    setKinshipMessage(selectedKinshipLinkId ? "Kinship link updated." : "Kinship link created.");
    await onRefresh();

    if (nextLinkId) {
      setSelectedKinshipLinkId(nextLinkId);
    }
  }

  async function removeKinshipLink() {
    if (!canEdit || !selectedKinshipLinkId) {
      return;
    }

    const response = await fetch(`/api/tree/kinship-links/${selectedKinshipLinkId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ treeId })
    });

    if (!response.ok) {
      setKinshipMessage("Failed to remove kinship link.");
      return;
    }

    setSelectedKinshipLinkId("");
    setKinshipMessage("Kinship link removed.");
    await onRefresh();
  }

  async function removeKinshipLinkById(linkId: string) {
    if (!canEdit || !linkId) {
      return;
    }

    const response = await fetch(`/api/tree/kinship-links/${linkId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ treeId })
    });

    if (!response.ok) {
      setKinshipMessage("Failed to remove kinship link.");
      return;
    }

    if (selectedKinshipLinkId === linkId) {
      setSelectedKinshipLinkId("");
      setKinshipPersonId("");
      setKinshipType("sibling");
    }

    setKinshipMessage("Kinship link removed.");
    await onRefresh();
  }

  return (
    <div className={`panel h-full overflow-auto p-4 ${collapsed ? "min-h-0" : "min-h-[520px]"}`}>
      <div className={`flex items-center justify-between gap-2 ${collapsed ? "mb-0" : "mb-4"}`}>
        <div className="flex items-center gap-2">
          <PencilLine className="h-5 w-5 text-teal-700" />
          {!collapsed && <h2 className="text-lg font-semibold text-slate-800">Edit Panel</h2>}
        </div>
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          onClick={() => onCollapsedChange(!collapsed)}
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>

      {collapsed ? null : (
        <>
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
            <p className="text-xs text-slate-500">Select a member from the tree or this list to edit them.</p>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={selectedPersonId}
              onChange={(event) => onSelectedPersonChange(event.target.value)}
            >
              <option value="">Create new person</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.first_name} {person.last_name}
                </option>
              ))}
            </select>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="First name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Last name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={sex}
              onChange={(event) => setSex(event.target.value as Person["sex"])}
            >
              <option value="unknown">Unknown</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              type="date"
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
            />
            <textarea
              className="min-h-24 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            {personMessage && <p className="text-xs text-slate-600">{personMessage}</p>}
            <button
              disabled={!canEdit || !firstName || !lastName}
              onClick={submitPerson}
              className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
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

          {selectedPersonId && (
            <section className="mb-5 space-y-2 rounded-xl border border-slate-200 p-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Link2 className="h-4 w-4" />
                Edit Partner Connection
              </h3>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={selectedUnionId}
                onChange={(event) => setSelectedUnionId(event.target.value)}
              >
                <option value="">Create new partner connection</option>
                {partnerUnions.map((union) => (
                  <option key={union.id} value={union.id}>
                    {unionDisplayName(union)}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={connectionPartnerId}
                onChange={(event) => setConnectionPartnerId(event.target.value)}
              >
                <option value="">Select partner</option>
                {selectablePartners.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.first_name} {person.last_name}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={unionType}
                onChange={(event) => setUnionType(event.target.value as UnionRecord["union_type"])}
              >
                <option value="married">Married</option>
                <option value="unmarried">Unmarried</option>
                <option value="divorced">Divorced</option>
              </select>
              {unionMessage && <p className="text-xs text-slate-600">{unionMessage}</p>}
              <button
                disabled={!canEdit || !connectionPartnerId}
                onClick={submitUnion}
                className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {selectedUnionId ? "Save Connection" : "Create Connection"}
              </button>
              {selectedUnionId && (
                <button
                  disabled={!canEdit}
                  onClick={removeUnion}
                  className="w-full rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
                >
                  Remove Connection
                </button>
              )}
            </section>
          )}

          {selectedPersonId && (
            <section className="space-y-2 rounded-xl border border-slate-200 p-3">
              <h3 className="text-sm font-semibold text-slate-800">Edit Parent Link</h3>
              <p className="text-xs text-slate-500">Use a parent union or choose a single parent for this person.</p>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Current parent links</p>
                {childLinksForPerson.length === 0 ? (
                  <p className="text-xs text-slate-500">No parent links yet.</p>
                ) : (
                  <div className="space-y-2">
                    {childLinksForPerson.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2 py-2"
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left text-xs text-slate-700"
                          onClick={() => setSelectedChildLinkId(link.id)}
                          title={childLinkDisplayName(link)}
                        >
                          {childLinkDisplayName(link)}
                        </button>
                        <button
                          type="button"
                          disabled={!canEdit}
                          className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 disabled:opacity-50"
                          onClick={() => void removeChildLinkById(link.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={selectedChildLinkId}
                onChange={(event) => setSelectedChildLinkId(event.target.value)}
              >
                <option value="">Create new parent link</option>
                {childLinksForPerson.map((link) => (
                  <option key={link.id} value={link.id}>
                    {childLinkDisplayName(link)}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={connectionUnionId}
                onChange={(event) => {
                  setConnectionUnionId(event.target.value);
                  if (event.target.value) {
                    setSingleParentId("");
                  }
                }}
              >
                <option value="">Select parent union</option>
                {parentUnionOptions.map((union) => (
                  <option key={union.id} value={union.id}>
                    {unionDisplayName(union)}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={singleParentId}
                onChange={(event) => {
                  setSingleParentId(event.target.value);
                  if (event.target.value) {
                    setConnectionUnionId("");
                  }
                }}
              >
                <option value="">Or select single parent</option>
                {parentPersonOptions.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.first_name} {person.last_name}
                  </option>
                ))}
              </select>
              {childLinkMessage && <p className="text-xs text-slate-600">{childLinkMessage}</p>}
              <button
                disabled={!canEdit || (!connectionUnionId && !singleParentId)}
                onClick={submitChildLink}
                className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {selectedChildLinkId ? "Save Parent Link" : "Create Parent Link"}
              </button>
              {selectedChildLinkId && (
                <button
                  disabled={!canEdit}
                  onClick={removeChildLink}
                  className="w-full rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
                >
                  Remove Parent Link
                </button>
              )}
            </section>
          )}

          {selectedPersonId && (
            <section className="mt-5 space-y-2 rounded-xl border border-slate-200 p-3">
              <h3 className="text-sm font-semibold text-slate-800">Manage Kinship Links</h3>
              <p className="text-xs text-slate-500">Create sibling, cousin, aunt, and uncle links for the selected person.</p>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Current kinship links</p>
                {kinshipLinksForPerson.length === 0 ? (
                  <p className="text-xs text-slate-500">No kinship links yet.</p>
                ) : (
                  <div className="space-y-2">
                    {kinshipLinksForPerson.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2 py-2"
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left text-xs text-slate-700"
                          onClick={() => setSelectedKinshipLinkId(link.id)}
                          title={kinshipDisplayName(link)}
                        >
                          {kinshipDisplayName(link)}
                        </button>
                        <button
                          type="button"
                          disabled={!canEdit}
                          className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 disabled:opacity-50"
                          onClick={() => void removeKinshipLinkById(link.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={selectedKinshipLinkId}
                onChange={(event) => setSelectedKinshipLinkId(event.target.value)}
              >
                <option value="">Create new kinship link</option>
                {kinshipLinksForPerson.map((link) => (
                  <option key={link.id} value={link.id}>
                    {kinshipDisplayName(link)}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={kinshipType}
                onChange={(event) => setKinshipType(event.target.value as KinshipType)}
              >
                <option value="sibling">Sibling</option>
                <option value="cousin">Cousin</option>
                <option value="aunt">Aunt</option>
                <option value="uncle">Uncle</option>
              </select>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={kinshipPersonId}
                onChange={(event) => setKinshipPersonId(event.target.value)}
              >
                <option value="">Select related person</option>
                {parentPersonOptions.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.first_name} {person.last_name}
                  </option>
                ))}
              </select>
              {kinshipMessage && <p className="text-xs text-slate-600">{kinshipMessage}</p>}
              <button
                disabled={!canEdit || !kinshipPersonId}
                onClick={submitKinshipLink}
                className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {selectedKinshipLinkId ? "Save Kinship Link" : "Create Kinship Link"}
              </button>
              {selectedKinshipLinkId && (
                <button
                  disabled={!canEdit}
                  onClick={removeKinshipLink}
                  className="w-full rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
                >
                  Remove Kinship Link
                </button>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
