import { customers } from "../data/customers"
import { shipments } from "../data/shipments"
import { Customer, Customers } from "../types/customer"
import { Shipment } from "../types/shipment"
import { createClient } from "../library/supabase/server";

export async function getAllCustomers(): Promise<Customers[]> {
 const supabase = await createClient();

  const { data, error } = await supabase
        .from('customers')
        .select(
          `
          id,
          customer_id,
          full_name,
          email,
          phone,
          address,
          source,
          role,
          created_at
          `
        ).order('created_at',{ascending: false})

    if (error) {
      throw new Error("Failed to fetch customers");
    }

  return data;

}


export async function getCustomerById( id: string ): Promise<Customers | null> { 
  const customers = await getAllCustomers(); 
  return ( customers.find( (customer) => customer.customer_id === id ) ?? null );
 }





export async function getCustomers(): Promise<Customer[]> {
  
  return customers
    .map((customer) => ({
      ...customer,
      status: getCustomerStatus(customer),
    }))
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "Active" ? -1 : 1;
      }

      return (
        new Date(b.lastActivityDate).getTime() -
        new Date(a.lastActivityDate).getTime()
      );
    });
}



export async function getShipmentsByCustomerId(customerId: string): Promise<Shipment[]> {
  return shipments.filter((s) => s.customerId === customerId).sort((a, b) => (a.bookingDate < b.bookingDate ? 1 : -1))
}

export async function getAllShipments(): Promise<Shipment[]> {
  return shipments
}

export async function getDashboardMetrics() {
  const active = customers.filter((c) => c.status === "Active").length
  const activeShipments = shipments.filter((s) => s.status === "In Transit" || s.status === "Pending").length
  return {
    totalCustomers: customers.length,
    activeCustomers: active,
    activeShipments,
    newCustomersThisMonth: 2,
  }
}

export function getCustomerStatus(customer: Customer): "Active" | "Inactive" {
  const oneMonthAgo = new Date()
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

  return new Date(customer.lastActivityDate) >= oneMonthAgo
    ? "Active"
    : "Inactive"
}