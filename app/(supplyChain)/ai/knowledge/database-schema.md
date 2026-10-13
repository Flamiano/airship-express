# Supply Chain Database Schema & System Architecture Reference

## Overview
Airship Express Supply Chain Management is backed by PostgreSQL on Supabase. This document provides the complete schema reference, primary keys, relationships, status enums, and business logic definitions derived from `(supplyChain)/table.sql`.

---

## 1. Inventory & Warehouse Management

### `inventory_items`
Tracks catalogued warehouse supplies, packaging materials, spare parts, and equipment.
- **Primary Key**: `id` (bigint generated always as identity)
- **Unique**: `item_code` (varchar 50)
- **Key Columns**:
  - `item_name` (varchar 200)
  - `category` (varchar 100) — Packaging, MHE, Fleet Spare Parts, Consumables, Safety Equipment
  - `unit` (varchar 50) — rolls, boxes, pieces, sets, liters
  - `current_stock` (integer, >= 0)
  - `minimum_stock` (integer, >= 0) — Safety reorder threshold
  - `quarantine_stock` (numeric, default 0) — Damaged or uninspected items held separately
  - `storage_location` (varchar 200) — e.g. Rack A-02, Bay 4
  - `purchase_price` (numeric 10,2) — Unit acquisition price
  - `supplier` (varchar 200) — Preferred supplier name
  - `status` (varchar 20) — Checked constraint: `'available'`, `'low-stock'`, `'out-of-stock'`, `'reserved'`
  - `is_active` (boolean, default true)
  - `warehouse_storage_zone_id` (uuid) — References `warehouse_storage_zones.id`
  - `updated_by`, `force_updated_by`, `force_reason`, `force_updated_at`

### `stock_movements`
Immutable audit log recording every inventory transaction, transfer, or balance change.
- **Primary Key**: `id` (uuid default gen_random_uuid)
- **Key Columns**:
  - `item_code` (varchar 100), `item_name` (varchar 255)
  - `movement_type` (varchar 50) — Checked: `'Stock In'`, `'Stock Out'`, `'Adjustment'`
  - `quantity` (numeric)
  - `previous_stock` (numeric), `new_stock` (numeric)
  - `reference_number` (varchar 100) — Linked PO number, Requisition ID, or Incident ID
  - `reason` (text) — Explanation for adjustment or stock issuance
  - `department` (varchar 150) — Requesting department (Receiving, Sorting, Dispatch, Maintenance)
  - `performed_by` (varchar 150) — Staff member or operator name
  - `performed_by_id` (uuid)
  - `created_at` (timestamp with time zone)
  - `metadata` (jsonb)

### `stock_in_logs`
Logs items received into inventory specifically from Purchase Order deliveries.
- **Primary Key**: `id` (uuid)
- **Foreign Keys**:
  - `purchase_order_item_id` references `purchase_order_items(id)`
  - `inventory_item_id` references `inventory_items(id)`
- **Key Columns**:
  - `quantity_added` (integer > 0)
  - `exceeded_limit` (boolean)
  - `forced` (boolean), `forced_by` (uuid)
  - `performed_by` (uuid)

---

## 2. Procurement & Purchasing

### `purchase_requests`
Internal requisitions submitted by company departments before placing orders with vendors.
- **Key Columns**:
  - `id` (bigint / uuid), `request_number` (varchar 100, unique)
  - `department`, `type`, `supplier_name`, `amount`, `priority` (Normal, Urgent, Critical)
  - `status` ('Pending', 'Approved', 'Rejected', 'Ordered', 'Completed')

### `purchase_orders`
Official purchase orders issued to commercial suppliers.
- **Primary Key**: `id` (uuid)
- **Unique**: `po_number` (varchar 100)
- **Key Columns**:
  - `supplier_id` (bigint), `supplier_name` (varchar 255)
  - `total_amount` (numeric 12,2), `status` ('Draft', 'Sent', 'Confirmed', 'Delivered', 'Cancelled')
  - `is_paid` (boolean), `payment_terms`, `expected_delivery_date`
  - `created_at`, `notes`

### `purchase_order_items`
Individual line items associated with a purchase order.
- **Primary Key**: `id` (uuid)
- **Foreign Key**: `purchase_order_id` references `purchase_orders(id)`
- **Key Columns**: `item_name`, `item_code`, `quantity`, `unit_price`, `total_price`, `received_quantity`

### `purchase_orders_archive`
Trash / soft-deleted purchase orders for audit compliance and recovery.
- **Key Columns**: `po_number`, `deleted_at`, `deleted_by`, `reason`

### `document_verifications`
Automated AI and OCR receipt matching against purchase orders.
- **Primary Key**: `id` (uuid)
- **Foreign Key**: `purchase_order_id` references `purchase_orders(id)`
- **Key Columns**:
  - `uploaded_file_url` (text)
  - `extracted_json` (jsonb) — Data extracted by Gemini OCR (vendor, items, totals, date)
  - `compared_fields` (jsonb) — Field-by-field diff between PO line items and receipt
  - `match_result` (varchar 20) — Checked: `'pending'`, `'matched'`, `'mismatched'`, `'forced'`
  - `submitted_by` (uuid), `resolved_by` (uuid), `resolved_at`

---

## 3. Supplier Management & Collaborations

### `suppliers`
Directory of approved commercial vendor partners.
- **Key Columns**: `name`, `category`, `contact_person`, `phone`, `email`, `location`, `is_active`, `products`

### `suppliers_account`
Vendor portal accounts allowing suppliers to log in, view POs, submit quotes, and send messages.
- **Primary Key**: `id` (uuid)
- **Foreign Key**: `supplier_id` references `suppliers(id)`
- **Key Columns**: `email` (unique), `contact_name`, `status` ('Invited', 'Accepted'), `invitation_token`, `invited_by`

### `supplier_quotations`
Price bids and formal proposals submitted by suppliers for specific purchase requests.
- **Primary Key**: `id` (bigint)
- **Foreign Keys**:
  - `request_number` references `purchase_requests(request_number)`
  - `supplier_id` references `suppliers(id)`
- **Key Columns**:
  - `supplier_name`, `item_name`, `quantity`, `unit`, `unit_price`, `total_amount`
  - `availability`, `lead_time_days`, `services_offered` (text[])
  - `subtotal`, `shipping_fee`, `discount`, `tax_type`, `tax_rate`, `tax_amount`
  - `status` ('pending', 'approved', 'rejected')

### `supplier_meetings`
Scheduled negotiation meetings, video conferences, or facility audits with suppliers.
- **Primary Key**: `id` (uuid)
- **Foreign Key**: `supplier_id` references `suppliers(id)`
- **Key Columns**:
  - `supplier_name`, `supplier_email`, `title`, `meeting_type` ('Video Conference', 'In-Person')
  - `meeting_date`, `start_time`, `end_time`, `duration`, `timezone`, `meeting_link`, `agenda`
  - `status` ('Scheduled', 'Completed', 'Cancelled'), `requisition_id`, `request_number`

---

## 4. Damages, Quality Defects & Supplier Returns

### `warehouse_damage_incidents`
Incident logs for damaged, broken, or short-shipped goods detected during intake or storage audits.
- **Primary Key**: `id` (uuid)
- **Unique**: `incident_number` (varchar 100)
- **Key Columns**:
  - `item_code`, `item_name`, `category`, `quantity`, `unit`
  - `discrepancy_type` (varchar 150) — Physical Damage, Packaging Breach, Wrong Item, Expiration
  - `severity` (varchar 50) — Minor, Moderate, Critical
  - `unit_cost` (numeric 12,2), `total_estimated_loss` (numeric 12,2)
  - `detected_at_location`, `reported_by`, `status` ('Under Investigation', 'Resolved', etc.)
  - `action_taken` ('Stock Deducted / Disposed', 'Supplier Return Initiated')
  - `po_number`, `supplier_name`, `evidence_urls` (jsonb)

### `supplier_return_requests`
Formal Return Merchandise Authorization (RMA) claims filed against suppliers for defective goods.
- **Primary Key**: `id` (uuid)
- **Unique**: `return_request_number` (varchar 100)
- **Foreign Keys**:
  - `incident_id` references `warehouse_damage_incidents(id)`
  - `purchase_order_id` references `purchase_orders(id)`
- **Key Columns**:
  - `po_number`, `supplier_name`, `supplier_email`
  - `item_code`, `item_name`, `defective_quantity`, `defect_type`, `defect_description`
  - `requested_resolution` ('Replacement', 'Credit Note / Refund', 'Repair')
  - `status` ('Pending Review', 'Supplier Approved', 'Under Negotiation', 'Resolved')
  - `supplier_responsibility` ('Pending Confirmation', 'Supplier Confirmed', 'Disputed')
  - `finance_verified` (boolean), `finance_verified_by`, `finance_verified_at`

### `supplier_return_messages`
Communication trail between warehouse managers and suppliers regarding defect claims.
- **Primary Key**: `id` (uuid)
- **Foreign Key**: `return_request_id` references `supplier_return_requests(id)`
- **Key Columns**: `po_number`, `supplier_name`, `subject`, `message_body`, `delivery_status`, `attachments`

---

## 5. Security, Sessions & User Activity

### `user_activity`
Audit trail of user actions across all supply chain modules.
- **Primary Key**: `id` (bigint)
- **Foreign Key**: `user_id` references `users(id)`
- **Key Columns**: `action`, `module`, `description`, `ip_address`, `user_agent`, `created_at`

### `sessions`
Tracks active user authentication sessions.
- **Key Columns**: `user_id`, `email`, `is_active`, `ip_address`, `user_agent`, `created_at`

### `blocked_devices` & `appeals`
Security mechanism for detecting unauthorized or compromised devices and handling reinstatement appeals.
- **`blocked_devices`**: `user_id`, `device_name`, `user_agent`, `ip_address`, `status` ('blocked', 'unblocked'), `reason`
- **`appeals`**: `blocked_device_id`, `user_email`, `appeal_message`, `status` ('pending', 'approved', 'rejected')
