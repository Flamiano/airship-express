export type CustomerStatus = "Active" | "Inactive";
type Source = "walk_in" | "call";

// Database customer type (from Supabase customers table and profiles table)
export type Customers = {
  id: string;
  customer_id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  source?: Source
  role: string;
  created_at: string;
};

// Mock data customer type (for backward compatibility)
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
