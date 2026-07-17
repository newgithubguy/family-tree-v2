import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateByEmailPassword } from "@/lib/auth";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const user = authenticateByEmailPassword(parsed.data.email, parsed.data.password);
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, user });
  response.cookies.set("mock_user_id", user.id, {
    httpOnly: false,
    sameSite: "lax",
    path: "/"
  });

  return response;
}
