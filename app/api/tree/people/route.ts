import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest, getRoleForUserInTree } from "@/lib/auth";
import { createPerson } from "@/lib/tree-service";
import { publishRealtimeEvent } from "@/lib/realtime";

export const runtime = "nodejs";

const schema = z.object({
  treeId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  sex: z.enum(["male", "female", "unknown"]),
  birthDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export async function POST(request: NextRequest) {
  const user = getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const role = getRoleForUserInTree(parsed.data.treeId, user.id);
  if (role !== "editor") {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const person = createPerson({
    treeId: parsed.data.treeId,
    actorUserId: user.id,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    sex: parsed.data.sex,
    birthDate: parsed.data.birthDate,
    notes: parsed.data.notes
  });

  publishRealtimeEvent({
    type: "tree-changed",
    treeId: parsed.data.treeId,
    entity: "people",
    action: "CREATE",
    at: new Date().toISOString()
  });

  return NextResponse.json({ person });
}
