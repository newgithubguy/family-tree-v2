import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest, getRoleForUserInTree } from "@/lib/auth";
import { createKinshipLink } from "@/lib/tree-service";
import { publishRealtimeEvent } from "@/lib/realtime";

export const runtime = "nodejs";

const schema = z.object({
  treeId: z.string().min(1),
  personAId: z.string().min(1),
  personBId: z.string().min(1),
  kinshipType: z.enum(["sibling", "cousin", "aunt", "uncle"])
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

  if (parsed.data.personAId === parsed.data.personBId) {
    return NextResponse.json({ error: "Select two different people" }, { status: 400 });
  }

  const role = getRoleForUserInTree(parsed.data.treeId, user.id);
  if (role !== "editor") {
    return NextResponse.json({ error: "Editor role required" }, { status: 403 });
  }

  const link = createKinshipLink({
    treeId: parsed.data.treeId,
    actorUserId: user.id,
    personAId: parsed.data.personAId,
    personBId: parsed.data.personBId,
    kinshipType: parsed.data.kinshipType
  });

  publishRealtimeEvent({
    type: "tree-changed",
    treeId: parsed.data.treeId,
    entity: "kinship_links",
    action: "CREATE",
    at: new Date().toISOString()
  });

  return NextResponse.json({ link });
}
