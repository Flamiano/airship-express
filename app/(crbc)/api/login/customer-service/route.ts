import { NextResponse } from "next/server";
import { createClient } from "../../../library/supabase/server";

//get cookies from request
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email = body.email?.trim();
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

    // Authenticate with Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError || !authData.user) {
      console.error("Staff login error:", authError);

      return NextResponse.json(
        {
          success: false,
          error: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    // Get staff profile
    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("id, email, role")
        .eq("id", authData.user.id)
        .maybeSingle();

    if (profileError) {
      console.error("Profile error:", profileError);

      await supabase.auth.signOut();

      return NextResponse.json(
        {
          success: false,
          error: "Unable to load staff profile",
        },
        { status: 500 }
      );
    }

    // Make sure this is a staff account
    if (!profile || profile.role !== "staff") {
      await supabase.auth.signOut();

      return NextResponse.json(
        {
          success: false,
          error: "Staff access required",
        },
        { status: 403 }
      );
    }

    // Login successful
    return NextResponse.json({
      success: true,
      message: "Staff login successful",

      user: {
        id: authData.user.id,
        email: authData.user.email,
      },

      profile: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
      },

      session: {
        expires_at: authData.session?.expires_at,
      },
    });
  } catch (error) {
    console.error("Customer service login API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
