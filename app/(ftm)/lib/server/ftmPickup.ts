import "server-only";
import { NextResponse } from "next/server";
import { hasPermission } from "../permissions";
import { authenticateFtmRequest } from "./ftmRequestAuth";
import { initSupabase } from "./backend/config/db.mjs";
import { findPickupHandler } from "./backend/routes/pickupRoutes.mjs";

export async function handlePickupRequest(request: Request, explicitPath?: string) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  const action = request.method === "GET" ? "view" : "create";
  if (!hasPermission(auth.context.user.role, "vrds", action)) {
    return NextResponse.json({ error: `Permission denied: vrds.${action}` }, { status: 403 });
  }

  initSupabase();
  const url = new URL(request.url);
  const path = explicitPath || url.pathname.replace(/^\/api\/pickup/, "") || "/";
  const route = findPickupHandler(request.method, path);
  if (!route) return NextResponse.json({ success: false, error: "Pickup endpoint not found" }, { status: 404 });

  let body: Record<string, unknown> = {};
  if (request.method !== "GET" && request.method !== "HEAD") {
    try { body = await request.json(); } catch {
      return NextResponse.json({ success: false, error: "A valid JSON request body is required." }, { status: 400 });
    }
  }

  const req = {
    method: request.method,
    path,
    url: request.url,
    params: route.params,
    query: Object.fromEntries(url.searchParams.entries()),
    body,
    headers: request.headers,
    fleetUser: auth.context.user,
  };
  let status = 200;
  let responseBody: unknown;
  let sent = false;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      responseBody = value;
      sent = true;
      return this;
    },
  };

  try {
    await route.handler(req, res);
    if (!sent) return new Response(null, { status: 204 });
    return NextResponse.json(responseBody, { status });
  } catch (error) {
    console.error("Pickup request failed:", error);
    return NextResponse.json({ success: false, error: "Pickup request failed" }, { status: 500 });
  }
}