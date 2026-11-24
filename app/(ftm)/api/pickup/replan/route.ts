import { handlePickupRequest } from "../../../lib/server/ftmPickup";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => handlePickupRequest(request, "/replan");