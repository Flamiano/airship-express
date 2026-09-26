import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/app/(hr-dashboard)/supabase/admin-client";
import {
  ROLE_DASHBOARD_MAP,
  isValidHRRole,
} from "@/app/(hr-dashboard)/utils/roleValidation";

export async function POST(request: Request) {
  try {
    const { employeeId, password } = await request.json();

    console.log("=== HR Auth API Called ===");
    console.log("Employee ID:", employeeId);
    console.log(
      "Password provided:",
      password ? "Yes (length: " + password.length + ")" : "No"
    );

    if (!employeeId || !password) {
      console.log("Missing employeeId or password");
      return NextResponse.json(
        { message: "Employee ID and password are required." },
        { status: 400 }
      );
    }

    // Step 1: Get user details from hr_admin
    console.log("Looking up employee in hr_admin...");
    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("hr_admin")
      .select("id, email, role, full_name, employee_id")
      .eq("employee_id", employeeId)
      .single();

    if (employeeError || !employee) {
      console.error("Employee lookup error:", employeeError);
      return NextResponse.json(
        { message: "Employee ID not found. Please check your ID." },
        { status: 401 }
      );
    }

    console.log("Employee found:");
    console.log("- ID:", employee.id);
    console.log("- Email:", employee.email);
    console.log("- Role:", employee.role);
    console.log("- Full Name:", employee.full_name);

    // Step 2: Validate role
    if (!isValidHRRole(employee.role)) {
      console.log("Invalid role:", employee.role);
      return NextResponse.json(
        { message: "Invalid role. Please contact HR." },
        { status: 403 }
      );
    }

    // Step 3: Create Supabase client for authentication
    console.log("Creating Supabase client...");
    console.log("URL:", process.env.NEXT_PUBLIC_HR_SUPABASE_URL);
    console.log(
      "Anon Key provided:",
      process.env.NEXT_PUBLIC_HR_SUPABASE_ANON_KEY ? "Yes" : "No"
    );

    const supabase = createClient(
      process.env.NEXT_PUBLIC_HR_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_HR_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Step 4: Sign in with password
    console.log("Attempting to sign in with email:", employee.email);
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: employee.email,
        password: password,
      });

    if (authError) {
      console.error("Auth error details:");
      console.error("- Message:", authError.message);
      console.error("- Status:", authError.status);
      console.error("- Name:", authError.name);

      // Return specific error message
      let errorMessage = "Invalid employee ID or password.";
      if (authError.message.includes("Invalid login credentials")) {
        errorMessage = "Invalid password. Please try again.";
      } else if (authError.message.includes("Email not confirmed")) {
        errorMessage = "Please confirm your email address first.";
      } else if (authError.message) {
        errorMessage = authError.message;
      }

      return NextResponse.json({ message: errorMessage }, { status: 401 });
    }

    if (!authData.session) {
      console.error("No session returned from auth");
      return NextResponse.json(
        { message: "Authentication failed. No session created." },
        { status: 401 }
      );
    }

    console.log("Auth successful!");
    console.log("- User ID:", authData.user.id);
    console.log("- Session expires in:", authData.session.expires_in);

    // Step 5: Verify user ID matches
    if (authData.user.id !== employee.id) {
      console.error("User ID mismatch:");
      console.error("- Auth user ID:", authData.user.id);
      console.error("- Employee ID:", employee.id);
      return NextResponse.json(
        { message: "Authentication failed. User mismatch." },
        { status: 401 }
      );
    }

    // Step 6: Get dashboard URL for this role
    const dashboardUrl =
      ROLE_DASHBOARD_MAP[employee.role as keyof typeof ROLE_DASHBOARD_MAP];

    // Step 7: Return success response
    return NextResponse.json({
      session: authData.session,
      fullName: employee.full_name,
      role: employee.role,
      employeeId: employee.employee_id,
      redirectTo: dashboardUrl || "/hrAuth",
      message: `Welcome back, ${employee.full_name}!`,
    });
  } catch (error) {
    console.error("=== HR Auth Error ===");
    console.error("Error details:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return NextResponse.json(
      { message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
