import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("mock_user_id", "", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    expires: new Date(0)
  });
  return response;
}
