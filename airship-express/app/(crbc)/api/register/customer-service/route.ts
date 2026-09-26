import { NextResponse } from "next/server";
import { createClient } from "@/app/(crbc)/library/supabase/server";

//create staff account for testing onli
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

    //Create auth user
    const { data: authData, error: authError } =
      await supabase.auth.signUp({
        email,
        password,
      });

    if (authError || !authData.user) {
      console.error("Staff registration error:", authError);

      return NextResponse.json(
        {
          success: false,
          error:
            authError?.message === "User already registered"
              ? "Email already registered"
              : "Unable to create staff account",
        },
        { status: 400 }
      );
    }

    // Insert staff profile
    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .insert([
          {
            id: authData.user.id,
            email: authData.user.email,
            role: "staff",
          },
        ])
        .select()
        .single();

    if (profileError) {
      console.error("Profile insertion error:", profileError);
      return NextResponse.json(
        {
          success: false,
          error: "Unable to create staff profile",
        },
        { status: 500 }
      );
    }

    //Registration successful
    return NextResponse.json({
      success: true,
      message: "Staff registration successful",
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      profile: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
      },
    });
  } catch (error) {
    console.error("Customer service registration API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}