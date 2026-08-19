// app/(supplyChain)/api/supplyChain/employees/route.ts

import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const role = searchParams.get('role');
        const loggedInEmail = searchParams.get('email');

        if (!role) {
            return NextResponse.json(
                { message: 'Role parameter is required' },
                { status: 400 }
            );
        }

        // Query mock_employees from Supabase database
        let query = supabase
            .from('mock_employees')
            .select('*')
            .ilike('role', role);

        const { data: dbEmployees, error: dbError } = await query;

        if (dbError) {
            console.error('Error fetching mock_employees from db:', dbError);
            return NextResponse.json(
                { message: 'Failed to fetch employees from database: ' + dbError.message },
                { status: 500 }
            );
        }

        const employees = dbEmployees || [];

        let rememberedEmails: string[] = [];
        let activeEmails: string[] = [];

        if (loggedInEmail) {
            try {
                const { data: sessions } = await supabase
                    .from('sessions')
                    .select('email, remember_me, expires_at, is_active')
                    .eq('email', loggedInEmail)
                    .maybeSingle();

                if (sessions) {
                    if (sessions.is_active && new Date(sessions.expires_at) > new Date()) {
                        activeEmails = [sessions.email];
                    }
                    if (sessions.remember_me && new Date(sessions.expires_at) > new Date()) {
                        rememberedEmails = [sessions.email];
                    }
                }
            } catch (error) {
                console.error('Session check error:', error);
            }
        }

        const employeesWithStatus = employees.map(emp => ({
            ...emp,
            has_hr_password: !!emp.password_hash,
            remembered: rememberedEmails.includes(emp.email),
            is_active: activeEmails.includes(emp.email)
        }));

        return NextResponse.json(employeesWithStatus);
    } catch (error) {
        console.error('Error fetching employees:', error);
        return NextResponse.json(
            { message: 'Failed to fetch employees from HR system' },
            { status: 500 }
        );
    }
}