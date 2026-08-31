import { NextResponse } from "next/server";
import { createClient } from "../../../library/supabase/server";

//login test
//get cookies from request
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email = body.email;
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: "Email and password are required",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Login through Supabase
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      console.error("Supabase login error:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 401 }
      );
    }

    if (!data.user || !data.session) {
      return NextResponse.json(
        {
          success: false,
          error: "Unable to authenticate",
        },
        { status: 401 }
      );
    }

    // Verify customer role
    const { data: profile, error: profileError } =
      await supabase
        .from("customers")
        .select("id, email, full_name, role")
        .eq("id", data.user.id)
        .single();

    if (
      profileError ||
      !profile ||
      profile.role !== "customer"
    ) {
      await supabase.auth.signOut();

      return NextResponse.json(
        {
          success: false,
          error: "Invalid customer account",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,

      user: {
        id: data.user.id,
        email: data.user.email,
      },
      customer: profile,
      session: {
        expires_at: data.session.expires_at,
      },
    });
  } catch (error) {
    console.error("Customer login API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
