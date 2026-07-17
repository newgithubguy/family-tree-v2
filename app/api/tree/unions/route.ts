import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserFromRequest, getRoleForUserInTree } from "@/lib/auth";
import { createUnion } from "@/lib/tree-service";
import { publishRealtimeEvent } from "@/lib/realtime";

export const runtime = "nodejs";

const schema = z.object({
  treeId: z.string().min(1),
  partnerAPersonId: z.string().min(1),
  partnerBPersonId: z.string().min(1),
  unionType: z.enum(["married", "unmarried", "divorced"])
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

  if (parsed.data.partnerAPersonId === parsed.data.partnerBPersonId) {
    return NextResponse.json({ error: "Union requires two distinct partners" }, { status: 400 });
  }

  const union = createUnion({
    treeId: parsed.data.treeId,
    actorUserId: user.id,
    partnerAPersonId: parsed.data.partnerAPersonId,
    partnerBPersonId: parsed.data.partnerBPersonId,
    unionType: parsed.data.unionType
  });

  publishRealtimeEvent({
    type: "tree-changed",
    treeId: parsed.data.treeId,
    entity: "unions",
    action: "CREATE",
    at: new Date().toISOString()
  });

  return NextResponse.json({ union });
}
