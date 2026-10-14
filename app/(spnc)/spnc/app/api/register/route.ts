// Save as: app/(spnc)/spnc/app/api/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { getSupabaseClient } from "../../../lib/supabase";
import { createSessionToken, SESSION_COOKIE_NAME } from "../../../lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { email, password, full_name, keep_current_session } = await req.json();

    // true when an admin creates an account from the Employee Activity pop-up:
    // the account is created, but the admin stays logged in as themselves.
    // (Safe: this only skips logging in — the new account is always an "employee".)
    const keepCurrentSession = keep_current_session === true;

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { message: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const supabase = getSupabaseClient();

    // Check if a user already exists with this email
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { message: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: user, error } = await supabase
      .from("users")
      .insert({
        id: randomUUID(), // users.id has no default in the database
        created_at: new Date().toISOString(), // same for created_at
        email: normalizedEmail,
        password: hashedPassword,
        full_name,
        // RBAC: public sign-up can never create an admin. Admins are created
        // from the admin "Create Account" page (api/users).
        role: "employee",
      })
      .select()
      .single();

    if (error || !user) {
      console.error("Signup error:", error);
      return NextResponse.json(
        { message: "Couldn't create account. Please try again.", error: error?.message },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
      },
    });

    // Created by an admin from the pop-up → don't replace the admin's login with the new account
    if (keepCurrentSession) return response;

    // Normal sign-up on the register page → log the new user in
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      full_name: user.full_name,
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err) {
    console.error("Register API error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: "Internal server error.", error: errorMessage }, { status: 500 });
  }
}