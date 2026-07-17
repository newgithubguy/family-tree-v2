import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest, getRoleForUserInTree } from "@/lib/auth";
import { deletePerson, updatePerson } from "@/lib/tree-service";
import { publishRealtimeEvent } from "@/lib/realtime";

export const runtime = "nodejs";

const updateSchema = z.object({
  treeId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  sex: z.enum(["male", "female", "unknown"]),
  birthDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

const deleteSchema = z.object({
  treeId: z.string().min(1)
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const role = getRoleForUserInTree(parsed.data.treeId, user.id);
  if (role !== "editor") {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const person = updatePerson({
    id,
    treeId: parsed.data.treeId,
    actorUserId: user.id,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    sex: parsed.data.sex,
    birthDate: parsed.data.birthDate,
    notes: parsed.data.notes
  });

  if (!person) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  publishRealtimeEvent({
    type: "tree-changed",
    treeId: parsed.data.treeId,
    entity: "people",
    action: "UPDATE",
    at: new Date().toISOString()
  });

  return NextResponse.json({ person });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const role = getRoleForUserInTree(parsed.data.treeId, user.id);
  if (role !== "editor") {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const deleted = deletePerson({ id, treeId: parsed.data.treeId, actorUserId: user.id });
  if (!deleted) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  publishRealtimeEvent({
    type: "tree-changed",
    treeId: parsed.data.treeId,
    entity: "people",
    action: "DELETE",
    at: new Date().toISOString()
  });

  return NextResponse.json({ ok: true });
}
