import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  userId: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const user = getDb().data.users.find((row) => row.id === parsed.data.userId);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true, user });
  response.cookies.set("mock_user_id", parsed.data.userId, {
    httpOnly: false,
    sameSite: "lax",
    path: "/"
  });

  return response;
}
