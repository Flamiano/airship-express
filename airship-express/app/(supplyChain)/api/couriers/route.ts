import { NextResponse } from "next/server";
import { ftmSupabase } from "../../lib/services/client/ftmSupabase";

export async function GET() {
    try {
        const { data: courier, error } = await ftmSupabase
            .from('couriers')
            .select("*")
            .order('name', { ascending: true });

        if (error) {
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json(courier || []);
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || "Failed to fetch couriers from FTM" },
            { status: 500 }
        );
    }
}

