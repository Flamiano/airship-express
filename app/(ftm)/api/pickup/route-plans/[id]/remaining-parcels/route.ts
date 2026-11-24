import { handlePickupRequest } from "../../../../../lib/server/ftmPickup";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return handlePickupRequest(request, `/route-plans/${encodeURIComponent(id)}/remaining-parcels`);
};