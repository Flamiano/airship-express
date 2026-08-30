
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';
import { toast } from 'sonner';
import { Parcel, GroupedParcels } from '../types';

export function useParcels() {
    const [parcels, setParcels] = useState<Parcel[]>([]);
    const [groupedParcels, setGroupedParcels] = useState<GroupedParcels[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchParcels = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('parcels')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setParcels(data || []);

            // Group parcels by date
            const grouped = (data || []).reduce((acc: GroupedParcels[], parcel: any) => {
                const date = new Date(parcel.created_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
                const existingGroup = acc.find(g => g.date === date);
                if (existingGroup) existingGroup.parcels.push(parcel);
                else acc.push({ date, parcels: [parcel] });
                return acc;
            }, []);
            setGroupedParcels(grouped);
        } catch (error) {
            console.error('Error fetching parcels:', error);
            toast.error('Failed to load parcels');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchParcels();
    }, [fetchParcels]);

    return {
        parcels,
        groupedParcels,
        loading,
        fetchParcels,
    };
}