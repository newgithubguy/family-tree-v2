"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { NodePosition, Person, UnionChildLink, UnionRecord } from "@/lib/types";

interface TreeCanvasProps {
  people: Person[];
  unions: UnionRecord[];
  childrenLinks: UnionChildLink[];
  nodePositions?: NodePosition[];
  canEdit: boolean;
  selectedPersonId?: string;
  onSelectPerson?: (personId: string) => void;
  onPositionCommit: (personId: string, x: number, y: number) => Promise<void>;
}

type DragState =
  | {
      mode: "person";
      personId: string;
      offsetX: number;
      offsetY: number;
    }
  | {
      mode: "all";
      anchorX: number;
      anchorY: number;
      startPositions: Record<string, { x: number; y: number }>;
    }
  | null;

type ConnectionStyle = "curved" | "straight";

type SiblingPair = {
  key: string;
  aId: string;
  bId: string;
};

const BOARD_WIDTH = 900;
const BASE_BOARD_HEIGHT = 380;
const NODE_WIDTH = 120;
const NODE_HEIGHT = 44;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2;

function strokeColorForUnion(unionType: UnionRecord["union_type"]) {
  if (unionType === "married") {
    return "#0f766e";
  }
  if (unionType === "divorced") {
    return "#b45309";
  }
  return "#0369a1";
}

function childStrokeColorForUnion(unionType: UnionRecord["union_type"]) {
  if (unionType === "married") {
    return "#7c3aed";
  }
  if (unionType === "divorced") {
    return "#dc2626";
  }
  return "#2563eb";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function TreeCanvas({
  people,
  unions,
  childrenLinks,
  nodePositions,
  canEdit,
  selectedPersonId,
  onSelectPerson,
  onPositionCommit
}: TreeCanvasProps) {
  const peopleMap = new Map(people.map((person) => [person.id, person]));
  const nodePositionMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    (nodePositions ?? []).forEach((position) => map.set(position.person_id, { x: position.x, y: position.y }));
    return map;
  }, [nodePositions]);

  const basePositions = useMemo(() => {
    const next: Record<string, { x: number; y: number }> = {};
    people.forEach((person, index) => {
      const position = nodePositionMap.get(person.id) ?? {
        x: 30 + (index % 5) * 160,
        y: 40 + Math.floor(index / 5) * 100
      };
      next[person.id] = position;
    });
    return next;
  }, [people, nodePositionMap]);

  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({});
  const positions = useMemo(() => ({ ...basePositions, ...dragPositions }), [basePositions, dragPositions]);
  const [dragState, setDragState] = useState<DragState>(null);
  const [showPartnerConnections, setShowPartnerConnections] = useState(true);
  const [showChildConnections, setShowChildConnections] = useState(true);
  const [showSiblingConnections, setShowSiblingConnections] = useState(true);
  const [showHalfSiblingConnections, setShowHalfSiblingConnections] = useState(true);
  const [connectionStyle, setConnectionStyle] = useState<ConnectionStyle>("curved");
  const [relationshipDetailsCollapsed, setRelationshipDetailsCollapsed] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [moveAllMode, setMoveAllMode] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(BOARD_WIDTH);
  const [viewportHeight, setViewportHeight] = useState(BASE_BOARD_HEIGHT);

  const fitScale = viewportWidth / BOARD_WIDTH;
  const boardScale = fitScale * zoomLevel;
  const boardHeight = Math.max(BASE_BOARD_HEIGHT, viewportHeight / Math.max(boardScale, 0.001));
  const scaledBoardHeight = boardHeight * boardScale;

  const centers = useMemo(() => {
    const next: Record<string, { x: number; y: number }> = {};
    Object.entries(positions).forEach(([personId, point]) => {
      next[personId] = {
        x: point.x + NODE_WIDTH / 2,
        y: point.y + NODE_HEIGHT / 2
      };
    });
    return next;
  }, [positions]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const updateViewportWidth = () => {
      setViewportWidth(viewport.clientWidth || BOARD_WIDTH);
      setViewportHeight(viewport.clientHeight || BASE_BOARD_HEIGHT);
    };

    updateViewportWidth();

    const resizeObserver = new ResizeObserver(() => {
      updateViewportWidth();
    });

    resizeObserver.observe(viewport);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const currentDrag = dragState;

    function onMove(event: PointerEvent) {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }
      const bounds = viewport.getBoundingClientRect();
      const logicalX = (event.clientX - bounds.left + viewport.scrollLeft) / boardScale;
      const logicalY = (event.clientY - bounds.top + viewport.scrollTop) / boardScale;

      if (currentDrag.mode === "person") {
        const x = clamp(logicalX - currentDrag.offsetX, 8, BOARD_WIDTH - 120);
        const y = clamp(logicalY - currentDrag.offsetY, 8, boardHeight - 52);

        setDragPositions((current) => ({
          ...current,
          [currentDrag.personId]: { x, y }
        }));
        return;
      }

      const deltaX = logicalX - currentDrag.anchorX;
      const deltaY = logicalY - currentDrag.anchorY;
      const next: Record<string, { x: number; y: number }> = {};
      Object.entries(currentDrag.startPositions).forEach(([personId, start]) => {
        next[personId] = {
          x: clamp(start.x + deltaX, 8, BOARD_WIDTH - 120),
          y: clamp(start.y + deltaY, 8, boardHeight - 52)
        };
      });
      setDragPositions(next);
    }

    async function onUp() {
      if (currentDrag.mode === "person") {
        const latest = positions[currentDrag.personId];
        if (latest) {
          await onPositionCommit(currentDrag.personId, Math.round(latest.x), Math.round(latest.y));
        }
      } else {
        await Promise.all(
          people.map(async (person) => {
            const latest = positions[person.id];
            if (!latest) {
              return;
            }
            await onPositionCommit(person.id, Math.round(latest.x), Math.round(latest.y));
          })
        );
      }

      setDragPositions((current) => {
        const next = { ...current };
        if (currentDrag.mode === "person") {
          delete next[currentDrag.personId];
          return next;
        }

        return {};
      });
      setDragState(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [boardHeight, boardScale, dragState, onPositionCommit, people, positions]);

  const siblingPairs = useMemo(() => {
    const unionById = new Map(unions.map((union) => [union.id, union]));
    const childIds = Array.from(new Set(childrenLinks.map((link) => link.child_person_id)));
    const childToUnionIds = new Map<string, Set<string>>();
    const childToParents = new Map<string, Set<string>>();

    childrenLinks.forEach((link) => {
      const union = unionById.get(link.union_id);
      if (!union) {
        return;
      }

      const unionIds = childToUnionIds.get(link.child_person_id) ?? new Set<string>();
      unionIds.add(link.union_id);
      childToUnionIds.set(link.child_person_id, unionIds);

      const parentIds = childToParents.get(link.child_person_id) ?? new Set<string>();
      parentIds.add(union.partner_a_person_id);
      if (union.partner_b_person_id) {
        parentIds.add(union.partner_b_person_id);
      }
      childToParents.set(link.child_person_id, parentIds);
    });

    const full: SiblingPair[] = [];
    const half: SiblingPair[] = [];

    for (let i = 0; i < childIds.length; i += 1) {
      for (let j = i + 1; j < childIds.length; j += 1) {
        const aId = childIds[i];
        const bId = childIds[j];
        const aParents = childToParents.get(aId) ?? new Set<string>();
        const bParents = childToParents.get(bId) ?? new Set<string>();
        if (aParents.size === 0 || bParents.size === 0) {
          continue;
        }

        const sharedParentCount = Array.from(aParents).filter((parentId) => bParents.has(parentId)).length;
        if (sharedParentCount === 0) {
          continue;
        }

        const key = [aId, bId].sort().join("|");
        if (sharedParentCount >= 2) {
          full.push({ key, aId, bId });
          continue;
        }

        half.push({ key, aId, bId });
      }
    }

    return { full, half };
  }, [childrenLinks, unions]);

  const connectors = useMemo(() => {
    const elements: ReactElement[] = [];

    unions.forEach((union) => {
      const partnerA = centers[union.partner_a_person_id];
      const partnerB = union.partner_b_person_id ? centers[union.partner_b_person_id] : null;
      if (!partnerA) {
        return;
      }

      const stroke = strokeColorForUnion(union.union_type);
      const childStroke = childStrokeColorForUnion(union.union_type);
      const midpoint = {
        x: partnerB ? (partnerA.x + partnerB.x) / 2 : partnerA.x,
        y: partnerB ? (partnerA.y + partnerB.y) / 2 : partnerA.y
      };

      if (showPartnerConnections) {
        if (partnerB) {
          if (connectionStyle === "straight") {
            elements.push(
              <line
                key={`partner-${union.id}`}
                x1={partnerA.x}
                y1={partnerA.y}
                x2={partnerB.x}
                y2={partnerB.y}
                stroke={stroke}
                strokeWidth={3}
                strokeDasharray={union.union_type === "unmarried" ? "6 6" : undefined}
                opacity={0.8}
              />
            );
          } else {
            const controlX = midpoint.x;
            const controlY = midpoint.y - 28;
            elements.push(
              <path
                key={`partner-${union.id}`}
                d={`M ${partnerA.x} ${partnerA.y} Q ${controlX} ${controlY} ${partnerB.x} ${partnerB.y}`}
                fill="none"
                stroke={stroke}
                strokeWidth={3}
                strokeDasharray={union.union_type === "unmarried" ? "6 6" : undefined}
                opacity={0.8}
              />
            );
          }
        }

        elements.push(
          <circle key={`mid-${union.id}`} cx={midpoint.x} cy={midpoint.y} r={4} fill={stroke} opacity={0.85} />
        );
      }

      if (!showChildConnections) {
        return;
      }

      childrenLinks
        .filter((link) => link.union_id === union.id)
        .forEach((link) => {
          const child = centers[link.child_person_id];
          if (!child) {
            return;
          }

          if (connectionStyle === "straight") {
            elements.push(
              <line
                key={`child-${link.id}`}
                x1={midpoint.x}
                y1={midpoint.y}
                x2={child.x}
                y2={child.y}
                stroke={childStroke}
                strokeWidth={2}
                opacity={0.8}
              />
            );
          } else {
            const controlX = midpoint.x;
            const controlY = midpoint.y + Math.max(24, (child.y - midpoint.y) / 2);
            elements.push(
              <path
                key={`child-${link.id}`}
                d={`M ${midpoint.x} ${midpoint.y} Q ${controlX} ${controlY} ${child.x} ${child.y}`}
                fill="none"
                stroke={childStroke}
                strokeWidth={2}
                opacity={0.8}
              />
            );
          }
        });
    });

    if (showSiblingConnections) {
      siblingPairs.full.forEach((pair) => {
        const a = centers[pair.aId];
        const b = centers[pair.bId];
        if (!a || !b) {
          return;
        }

        if (connectionStyle === "straight") {
          elements.push(
            <line
              key={`sib-${pair.key}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#059669"
              strokeWidth={2}
              opacity={0.65}
            />
          );
          return;
        }

        const midpointX = (a.x + b.x) / 2;
        const midpointY = (a.y + b.y) / 2 - 18;
        elements.push(
          <path
            key={`sib-${pair.key}`}
            d={`M ${a.x} ${a.y} Q ${midpointX} ${midpointY} ${b.x} ${b.y}`}
            fill="none"
            stroke="#059669"
            strokeWidth={2}
            opacity={0.65}
          />
        );
      });
    }

    if (showHalfSiblingConnections) {
      siblingPairs.half.forEach((pair) => {
        const a = centers[pair.aId];
        const b = centers[pair.bId];
        if (!a || !b) {
          return;
        }

        if (connectionStyle === "straight") {
          elements.push(
            <line
              key={`half-sib-${pair.key}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#db2777"
              strokeWidth={2}
              strokeDasharray="4 4"
              opacity={0.7}
            />
          );
          return;
        }

        const midpointX = (a.x + b.x) / 2;
        const midpointY = (a.y + b.y) / 2 + 18;
        elements.push(
          <path
            key={`half-sib-${pair.key}`}
            d={`M ${a.x} ${a.y} Q ${midpointX} ${midpointY} ${b.x} ${b.y}`}
            fill="none"
            stroke="#db2777"
            strokeWidth={2}
            strokeDasharray="4 4"
            opacity={0.7}
          />
        );
      });
    }

    return elements;
  }, [
    centers,
    childrenLinks,
    connectionStyle,
    showChildConnections,
    showHalfSiblingConnections,
    showPartnerConnections,
    showSiblingConnections,
    siblingPairs,
    unions
  ]);

  return (
    <div className="panel canvas-grid flex h-full min-h-0 flex-col overflow-hidden p-6">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Family Canvas</h2>

      <div className="min-h-0 flex-1">
        <div className="relative flex h-full min-h-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Draggable People Board</div>
            <div className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-0.5"
                onClick={() => setZoomLevel((current) => clamp(Number((current - 0.1).toFixed(2)), MIN_ZOOM, MAX_ZOOM))}
              >
                -
              </button>
              <span className="w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-0.5"
                onClick={() => setZoomLevel((current) => clamp(Number((current + 0.1).toFixed(2)), MIN_ZOOM, MAX_ZOOM))}
              >
                +
              </button>
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-0.5"
                onClick={() => setZoomLevel(1)}
              >
                Reset
              </button>
            </div>
            <button
              type="button"
              onClick={() => setMoveAllMode((current) => !current)}
              className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                moveAllMode
                  ? "border-teal-700 bg-teal-700 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {moveAllMode ? "Move All Enabled" : "Move All Objects"}
            </button>
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showPartnerConnections}
                onChange={(event) => setShowPartnerConnections(event.target.checked)}
              />
              Partner lines
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showChildConnections}
                onChange={(event) => setShowChildConnections(event.target.checked)}
              />
              Parent-child lines
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showSiblingConnections}
                onChange={(event) => setShowSiblingConnections(event.target.checked)}
              />
              Sibling lines
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showHalfSiblingConnections}
                onChange={(event) => setShowHalfSiblingConnections(event.target.checked)}
              />
              Half-sibling lines
            </label>
            <select
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
              value={connectionStyle}
              onChange={(event) => setConnectionStyle(event.target.value as ConnectionStyle)}
            >
              <option value="curved">Curved lines</option>
              <option value="straight">Straight lines</option>
            </select>
            {relationshipDetailsCollapsed && (
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                onClick={() => setRelationshipDetailsCollapsed(false)}
              >
                Show Relationship Details
              </button>
            )}
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-8 border-t-2 border-teal-700" />
              Married union
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-8 border-t-2 border-sky-700 border-dashed" />
              Unmarried union
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-8 border-t-2 border-amber-700" />
              Divorced union
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-8 border-t-2 border-violet-600" />
              Child link (married)
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-8 border-t-2 border-blue-600" />
              Child link (unmarried)
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-8 border-t-2 border-red-600" />
              Child link (divorced)
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-8 border-t-2 border-emerald-600" />
              Sibling connection
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-8 border-t-2 border-dashed border-pink-600" />
              Half-sibling connection
            </span>
          </div>
          <div
            ref={viewportRef}
            className="relative min-h-0 w-full flex-1 overflow-auto rounded-lg border border-slate-300 bg-white"
            style={{ minHeight: scaledBoardHeight }}
            onPointerDown={(event) => {
              if (!canEdit || !moveAllMode || !viewportRef.current) {
                return;
              }

              if (event.target !== event.currentTarget) {
                return;
              }

              const bounds = viewportRef.current.getBoundingClientRect();
              const logicalX = (event.clientX - bounds.left + viewportRef.current.scrollLeft) / boardScale;
              const logicalY = (event.clientY - bounds.top + viewportRef.current.scrollTop) / boardScale;
              setDragState({
                mode: "all",
                anchorX: logicalX,
                anchorY: logicalY,
                startPositions: positions
              });
            }}
          >
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{ width: BOARD_WIDTH, height: boardHeight, transform: `scale(${boardScale})` }}
            >
              <svg className="pointer-events-none absolute inset-0 z-0" width={BOARD_WIDTH} height={boardHeight}>
                {connectors}
              </svg>
              {people.map((person) => {
                const position = positions[person.id] ?? { x: 20, y: 20 };
                const unselectedBubbleClass =
                  person.sex === "female"
                    ? "border-pink-300 bg-pink-100 text-pink-900"
                    : person.sex === "male"
                      ? "border-sky-300 bg-sky-100 text-sky-900"
                      : "border-teal-300 bg-teal-100 text-teal-900";
                const selectedBubbleClass =
                  person.sex === "female"
                    ? "border-pink-500 bg-pink-200 text-pink-950"
                    : person.sex === "male"
                      ? "border-sky-500 bg-sky-200 text-sky-950"
                      : "border-slate-900 bg-slate-900 text-white";
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => onSelectPerson?.(person.id)}
                    onPointerDown={(event) => {
                      if (!canEdit || !viewportRef.current) {
                        return;
                      }

                      event.stopPropagation();

                      const bounds = viewportRef.current.getBoundingClientRect();
                      const logicalX = (event.clientX - bounds.left + viewportRef.current.scrollLeft) / boardScale;
                      const logicalY = (event.clientY - bounds.top + viewportRef.current.scrollTop) / boardScale;

                      if (moveAllMode) {
                        setDragState({
                          mode: "all",
                          anchorX: logicalX,
                          anchorY: logicalY,
                          startPositions: positions
                        });
                        return;
                      }

                      const offsetX = logicalX - position.x;
                      const offsetY = logicalY - position.y;
                      setDragState({ mode: "person", personId: person.id, offsetX, offsetY });
                    }}
                    className={`absolute z-10 rounded-full border px-3 py-2 text-sm font-semibold shadow-sm ${
                      selectedPersonId === person.id ? selectedBubbleClass : unselectedBubbleClass
                    }`}
                    style={{ left: position.x, top: position.y, cursor: canEdit ? (moveAllMode ? "move" : "grab") : "default" }}
                  >
                    {person.first_name} {person.last_name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

          {!relationshipDetailsCollapsed && (
            <aside className="pointer-events-none absolute bottom-4 right-4 top-4 z-20 w-[340px] max-w-[calc(100%-2rem)]">
              <div className="pointer-events-auto flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">Relationship Details</h3>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                    onClick={() => setRelationshipDetailsCollapsed(true)}
                  >
                    Collapse
                  </button>
                </div>
                <div className="min-h-0 space-y-4 overflow-auto pr-1">
                  {unions.map((union) => {
                    const a = peopleMap.get(union.partner_a_person_id);
                    const b = union.partner_b_person_id ? peopleMap.get(union.partner_b_person_id) : null;
                    const kids = childrenLinks
                      .filter((link) => link.union_id === union.id)
                      .map((link) => peopleMap.get(link.child_person_id))
                      .filter(Boolean) as Person[];

                    return (
                      <div key={union.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="rounded-full bg-teal-100 px-3 py-1 font-medium text-teal-800">
                            {a ? `${a.first_name} ${a.last_name}` : "Unknown Partner"}
                          </span>
                          <span className="text-slate-500">{union.union_type.toUpperCase()}</span>
                          {b ? (
                            <span className="rounded-full bg-cyan-100 px-3 py-1 font-medium text-cyan-800">
                              {`${b.first_name} ${b.last_name}`}
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">Single Parent</span>
                          )}
                        </div>

                        <div className="mt-3">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Children tied to this union</div>
                          {kids.length === 0 ? (
                            <p className="text-sm text-slate-500">No children linked to this union yet.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {kids.map((kid) => (
                                <span key={kid.id} className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-800">
                                  {kid.first_name} {kid.last_name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>
          )}
      </div>
    </div>
  );
}
