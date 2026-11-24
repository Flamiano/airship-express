import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ signedOut: true });
  response.cookies.delete("ftm_access_token");
  response.cookies.delete("ftm_refresh_token");
  return response;
}