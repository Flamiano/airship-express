import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/services/client/supabase';
import { generateDispatchManifestExcel, DispatchParcelItem } from '../../../../lib/utils/dispatchManifest';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const driverName = searchParams.get('driver') || 'Assigned Driver';
        const idsParam = searchParams.get('ids') || '';
        const customFilename = searchParams.get('filename');

        let parcels: DispatchParcelItem[] = [];

        if (idsParam.trim()) {
            const parcelIds = idsParam
                .split(',')
                .map(id => id.trim())
                .filter(Boolean);

            if (parcelIds.length > 0) {
                const { data, error } = await supabase
                    .from('parcels')
                    .select('*')
                    .in('id', parcelIds);

                if (!error && data) {
                    parcels = data;
                }
            }
        }

        const safeDriverName = driverName.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = customFilename || `dispatch_manifest_${safeDriverName}_${Date.now()}.xlsx`;

        const excelBuffer = generateDispatchManifestExcel({
            driverName,
            parcels: parcels.length > 0 ? parcels : [
                {
                    barcode: 'N/A',
                    tracking_number: 'N/A',
                    destination: 'Batch Dispatched',
                    courier: 'Standard',
                    status: 'picked_up'
                }
            ]
        });

        return new NextResponse(new Uint8Array(excelBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store, max-age=0'
            }
        });

    } catch (error: any) {
        console.error('Error generating download manifest:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to download manifest' },
            { status: 500 }
        );
    }
}
