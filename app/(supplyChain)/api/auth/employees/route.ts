import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const role = searchParams.get('role');

        if (!role) {
            return NextResponse.json(
                { message: 'Role parameter is required' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('users')
            .select('id, display_name, email, role, department')
            .eq('role', role)
            .eq('status', 'Active')
            .order('display_name', { ascending: true });

        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json(
                { message: 'Failed to fetch employees' },
                { status: 500 }
            );
        }

        return NextResponse.json(data || []);
    } catch (error) {
        console.error('Error fetching employees:', error);
        return NextResponse.json(
            { message: 'Failed to fetch employees' },
            { status: 500 }
        );
    }
}