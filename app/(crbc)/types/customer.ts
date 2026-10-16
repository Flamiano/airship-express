export type CustomerStatus = "Active" | "Inactive";

export type CustomerAddress = {
  province: string | null;
  city: string | null;
  barangay: string | null;
  full_address: string | null;
};

export type Customers = {
  id: string;
  customer_id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  province?: string | null;
  city?: string | null;
  barangay?: string | null;
  full_address?: string | null;
  role: string;
  created_at: string;
  updated_at: string;
  profile_id?: string | null;
  auth_user_id?: string | null;
  /** Number of unread messages from this customer (staff side only) */
  unread_count?: number;
  /** ISO timestamp of the latest message in this conversation (for sorting) */
  latest_message_at?: string;
};

export interface Customer {
  customerId: string;
  fullName: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  status: CustomerStatus;
  registeredDate: string;
  lastActivityDate: string;
}
