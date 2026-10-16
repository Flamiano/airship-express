export interface Session {
    id: string;
    user_id: string;
    session_token: string;
    expires_at: string;
    ip_address: string;
    user_agent: string;
    created_at: string;
    is_active: boolean;
    email: string;
    hr_employee_name: string;
    remember_me: boolean;
    expires_at_remember: string | null;
    users?: {
        display_name: string;
        email: string;
        role: string;
        department?: string;
    };
    is_blocked?: boolean;
    blocked_device_id?: string;
    strikes?: number;
    is_locked_out?: boolean;
    lockout_remaining_seconds?: number;
    is_allow?: boolean;
    allowed_days?: string[];
    allowed_time_start?: string;
    allowed_time_end?: string;
    auth_requested?: boolean;
    auth_requested_at?: string | null;
    auth_request_message?: string | null;
}

export interface BlockedDevice {
    id: string;
    user_id: string;
    device_name: string;
    user_agent: string;
    ip_address: string;
    blocked_at: string;
    blocked_by: string;
    email: string;
    reason: string;
    status: 'blocked' | 'unblocked';
    unblocked_at: string | null;
    created_at: string;
    blocked_count?: number;
}

export interface Appeal {
    id: string;
    blocked_device_id: string;
    user_agent: string;
    user_email: string;
    user_name: string;
    user_role: string;
    appeal_message: string;
    response_message: string | null;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
    resolved_by: string | null;
}

export interface UserActivity {
    id: number;
    user_id: string;
    action: string;
    module: string;
    description: string;
    ip_address: string;
    user_agent: string;
    created_at: string;
    users: {
        display_name: string;
        email: string;
    };
}

export interface EmployeeAccount {
    id: string;
    employee_id: string;
    display_name: string;
    email: string;
    department: string;
    position: string;
    role: string;
    raw_employee_role?: string;
    status: string;
    has_account: boolean;
    user_id: string | null;
    account_status: string;
    account_created_at: string | null;
    password_hash: string | null;
    has_password: boolean;
}

export type ActivityTab = 'active_users' | 'sessions' | 'access_control' | 'blocked' | 'activity' | 'appeals' | 'create_account';

