import { NextResponse } from "next/server";
import { ftmSupabase } from "../../lib/services/client/ftmSupabase";

export async function GET() {
    const { data: courier, error } = await ftmSupabase
        .from('couriers')
        .select("*");

    if (error) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }

    return NextResponse.json(courier);
}
