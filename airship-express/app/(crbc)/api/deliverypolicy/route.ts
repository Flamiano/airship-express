import { createClient } from "../../library/supabase/server";
import { adminCreateClient } from "../../library/supabase/admin";
import { mapDeliveryPolicyRow } from "../../types/delivery-policy";
import { NextRequest, NextResponse } from "next/server";
import { validatePolicyInput, validateId, getAuthenticatedClient } from "../../library/validation/delivery.policy.validate";

export async function GET() {
  const supabase = adminCreateClient();

  const { data, error } = await supabase
    .from("delivery_policies")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data.map(mapDeliveryPolicyRow));
}


export async function POST(request: NextRequest) {
  const supabase = await getAuthenticatedClient(createClient);

  if (!supabase) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json();

  const {
    policy,
    coverage,
    minDays,
    maxDays,
  } = body;

  const validationError = validatePolicyInput({
    policy,
    coverage,
    minDays,
    maxDays,
  });

  if (validationError) {
    return NextResponse.json(
      { error: validationError },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("delivery_policies")
    .insert({
      policy: policy.trim(),
      coverage: coverage.trim(),
      min_days: minDays,
      max_days: maxDays,
    })
    .select()
    .single();

  if (error) {
    console.error("Create delivery policy error:", error);

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    mapDeliveryPolicyRow(data),
    { status: 201 }
  );
}

export async function PATCH(request: NextRequest) {
  const supabase = await getAuthenticatedClient(createClient);

  if (!supabase) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json();

  const {
    id,
    policy,
    coverage,
    minDays,
    maxDays,
  } = body;

  const idError = validateId(id);

  if (idError) {
    return NextResponse.json(
      { error: idError },
      { status: 400 }
    );
  }

  const validationError = validatePolicyInput({
    policy,
    coverage,
    minDays,
    maxDays,
  });

  if (validationError) {
    return NextResponse.json(
      { error: validationError },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("delivery_policies")
    .update({
      policy: policy.trim(),
      coverage: coverage.trim(),
      min_days: minDays,
      max_days: maxDays,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Policy not found." },
        { status: 404 }
      );
    }

    console.error("Update delivery policy error:", error);

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    mapDeliveryPolicyRow(data)
  );
}

export async function DELETE(request: NextRequest) {
  const supabase = await getAuthenticatedClient(createClient);

  if (!supabase) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { id } = body;

  const idError = validateId(id);

  if (idError) {
    return NextResponse.json(
      { error: idError },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("delivery_policies")
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: "Policy not found." },
        { status: 404 }
      );
    }

    console.error("Delete delivery policy error:", error);

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "Delivery policy deleted successfully.",
    id: data.id,
  });
}