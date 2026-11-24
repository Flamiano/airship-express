import { NextResponse } from "next/server";
import { hasPermission } from "../../../lib/permissions";
import { authenticateFtmRequest } from "../../../lib/server/ftmRequestAuth";
import { belongsToAirshipCourier, getAirshipCouriers } from "../../../lib/server/ftmCourier";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "fvm", "view")) {
    return NextResponse.json({ error: "Permission denied: fvm.view" }, { status: 403 });
  }

  const vehicleId = new URL(request.url).searchParams.get("vehicle_id")?.trim();
  if (!vehicleId) return NextResponse.json({ error: "A vehicle_id is required." }, { status: 400 });

  const supabase = auth.context.serviceClient;
  let courierIds: Set<string>;
  try {
    courierIds = new Set((await getAirshipCouriers(supabase)).map((courier) => courier.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to verify vehicle scope." }, { status: 500 });
  }
  const { data: vehicle, error: vehicleError } = await supabase.from("vehicles").select("id,courier_id").eq("id", vehicleId).maybeSingle();
  if (vehicleError) return NextResponse.json({ error: `Unable to verify vehicle: ${vehicleError.message}` }, { status: 500 });
  if (!vehicle || !belongsToAirshipCourier(vehicle, courierIds)) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });

  const { data, error } = await supabase.from("vehicle_documents").select("*").eq("vehicle_id", vehicleId);
  if (error) return NextResponse.json({ error: `Unable to load vehicle documents: ${error.message}` }, { status: 500 });

  const documents = await Promise.all((data || []).map(async (document) => {
    const fileUrl = String(document.file_url || "");
    if (!fileUrl || /^https?:\/\//i.test(fileUrl)) return { ...document, signed_url: fileUrl || null };
    const { data: signed, error: signingError } = await supabase.storage.from("vehicle-documents").createSignedUrl(fileUrl, 3600);
    return { ...document, signed_url: signingError ? null : signed?.signedUrl || null };
  }));

  return NextResponse.json(documents);
}

export async function POST(request: Request) {
  const auth = await authenticateFtmRequest(request);
  if (!("context" in auth)) return auth.response;
  if (!hasPermission(auth.context.user.role, "fvm", "create")) return NextResponse.json({ error: "Permission denied: fvm.create" }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  if (!body.vehicle_id || !body.document_type || !body.file_url) {
    return NextResponse.json({ error: "vehicle_id, document_type, and file_url are required" }, { status: 400 });
  }
  const supabase = auth.context.serviceClient;
  let courierIds: Set<string>;
  try {
    courierIds = new Set((await getAirshipCouriers(supabase)).map((courier) => courier.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to verify vehicle scope." }, { status: 500 });
  }
  const { data: vehicle, error: vehicleError } = await supabase.from("vehicles").select("id,courier_id").eq("id", String(body.vehicle_id)).maybeSingle();
  if (vehicleError) return NextResponse.json({ error: `Unable to verify vehicle: ${vehicleError.message}` }, { status: 500 });
  if (!vehicle || !belongsToAirshipCourier(vehicle, courierIds)) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });

  const { data, error } = await supabase.from("vehicle_documents").insert({
    vehicle_id: String(body.vehicle_id),
    document_type: String(body.document_type),
    document_number: body.document_number || null,
    expiry_date: body.expiry_date || null,
    file_url: String(body.file_url),
    status: body.status || "Valid",
  }).select("*").single();
  if (error) return NextResponse.json({ error: "Unable to save vehicle document", details: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}