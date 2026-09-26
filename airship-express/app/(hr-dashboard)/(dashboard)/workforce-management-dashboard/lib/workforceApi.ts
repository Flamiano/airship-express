import { supabase } from '../../../supabase/client';

export const WORKFORCE_API_URL =
  process.env.NEXT_PUBLIC_WORKFORCE_API_URL ||
  process.env.NEXT_PUBLIC_FASTAPI_URL ||
  'https://wf.canefly.xyz';

/**
 * Resolves the active Supabase JWT session access token
 * and constructs standard Authorization Bearer headers.
 */
export async function getWorkforceAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  } catch (err) {
    console.warn('[WorkforceApi] Failed to resolve Supabase JWT session:', err);
  }

  return headers;
}

export interface RegistrationStatus {
  is_active: boolean;
  employee_id: string | null;
  full_name: string | null;
  department: string | null;
  position: string | null;
  captured_uid: string | null;
  last_scanned_raw?: string | null;
  started_at?: string | null;
}

export interface HealthTelemetry {
  gatewayOnline: boolean;
  deviceOnline: boolean;
  deviceId?: string;
  lastSeen?: string | null;
}

export const workforceApi = {
  /**
   * Check gateway and physical ESP32 device telemetry
   */
  async checkHealth(): Promise<HealthTelemetry> {
    try {
      const res = await fetch(`${WORKFORCE_API_URL}/health-check`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        return { gatewayOnline: false, deviceOnline: false };
      }
      const data = await res.json();
      return {
        gatewayOnline: true,
        deviceOnline: Boolean(data.device_online),
        deviceId: data.device?.device_id || 'esp32-node-01',
        lastSeen: data.device?.last_seen || null,
      };
    } catch {
      return { gatewayOnline: false, deviceOnline: false };
    }
  },

  /**
   * Get active RFID registration session status with Supabase JWT Bearer token
   */
  async getRegistrationStatus(): Promise<RegistrationStatus | null> {
    try {
      const headers = await getWorkforceAuthHeaders();
      const res = await fetch(`${WORKFORCE_API_URL}/api/v1/registration/status`, {
        headers,
        cache: 'no-store',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error('[WorkforceApi] Registration status poll error:', err);
      return null;
    }
  },

  /**
   * Put gateway reader in 'Tap Card to Register' enrollment mode with Supabase JWT
   */
  async startRegistration(employee: {
    id: string;
    full_name: string;
    department?: string;
    position?: string;
  }): Promise<{ ok: boolean; message?: string }> {
    try {
      const headers = await getWorkforceAuthHeaders();
      const params = new URLSearchParams({
        employee_id: employee.id,
        full_name: employee.full_name,
        department: employee.department || 'General',
        position: employee.position || 'Staff',
      });
      const res = await fetch(`${WORKFORCE_API_URL}/api/v1/registration/start?${params.toString()}`, {
        method: 'POST',
        headers,
      });
      return { ok: res.ok };
    } catch (err) {
      console.error('[WorkforceApi] Start registration error:', err);
      return { ok: false, message: 'Could not connect to Workforce API Gateway.' };
    }
  },

  /**
   * Cancel active RFID registration session
   */
  async cancelRegistration(): Promise<boolean> {
    try {
      const headers = await getWorkforceAuthHeaders();
      const res = await fetch(`${WORKFORCE_API_URL}/api/v1/registration/cancel`, {
        method: 'POST',
        headers,
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
