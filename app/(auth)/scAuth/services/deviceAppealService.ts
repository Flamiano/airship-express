import { supabase } from '@/app/(supplyChain)/lib/services/client/supabase';

export interface BlockedDevice {
    id: string;
    device_name?: string;
    reason?: string;
    status: string;
}

export interface Appeal {
    id: string;
    blocked_device_id: string;
    user_agent?: string;
    user_email?: string;
    user_name?: string;
    user_role?: string;
    appeal_message: string;
    status: 'pending' | 'approved' | 'rejected';
    response_message?: string;
    resolved_at?: string;
    resolved_by?: string;
    created_at: string;
    updated_at: string;
}

export interface SubmitAppealParams {
    blockedDeviceId: string;
    userAgent: string;
    userEmail: string;
    userName: string;
    userRole: string;
    appealMessage: string;
}

// check if a device is blocked for the user
export async function checkIfDeviceBlocked(userId: string, userAgent: string): Promise<BlockedDevice | null> {
    try {
        const { data: userData, error: userError } = await supabase
            .from('role_based_accounts')
            .select('role')
            .eq('id', userId)
            .maybeSingle();

        if (userError || userData?.role === 'Admin') {
            return null;
        }

        const { data, error } = await supabase
            .from('blocked_devices')
            .select('id, device_name, reason, status')
            .eq('user_id', userId)
            .eq('user_agent', userAgent)
            .eq('status', 'blocked')
            .maybeSingle();

        if (error) {
            return null;
        }

        return data as BlockedDevice | null;
    } catch {
        return null;
    }
}

// look up any existing appeal for a blocked device
export async function checkExistingAppeal(blockedDeviceId: string): Promise<Appeal | null> {
    try {
        const { data, error } = await supabase
            .from('appeals')
            .select('*')
            .eq('blocked_device_id', blockedDeviceId)
            .order('created_at', { ascending: false })
            .maybeSingle();

        if (error) {
            return null;
        }

        return data as Appeal | null;
    } catch {
        return null;
    }
}

// submit a new device unblock request
export async function submitAppeal(params: SubmitAppealParams): Promise<{ data: Appeal | null; error: any }> {
    const { data, error } = await supabase
        .from('appeals')
        .insert({
            blocked_device_id: params.blockedDeviceId,
            user_agent: params.userAgent,
            user_email: params.userEmail || '',
            user_name: params.userName || 'Unknown User',
            user_role: params.userRole || 'Employee',
            appeal_message: params.appealMessage.trim(),
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select();

    return { data: (data?.[0] as Appeal) || null, error };
}

// update appeal message
export async function updateAppeal(appealId: string, appealMessage: string): Promise<{ error: any }> {
    const { error } = await supabase
        .from('appeals')
        .update({
            appeal_message: appealMessage.trim(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', appealId);

    return { error };
}

// delete appeal record
export async function deleteAppeal(appealId: string): Promise<{ error: any }> {
    const { error } = await supabase
        .from('appeals')
        .delete()
        .eq('id', appealId);

    return { error };
}
