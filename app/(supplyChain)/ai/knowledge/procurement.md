# Procurement Module & Purchasing Operations

## Overview
Manages supplier relationships, purchase requests, commercial purchase orders, vendor quotations, negotiation meetings, and automated receipt verification for Airship Express.

---

## Key Features & Database Tables

### 1. Supplier Directory & Portal Accounts (`suppliers`, `suppliers_account`)
- Add/Edit/Delete suppliers across categories: Tire Supplier, Auto Parts, Packaging, General Supplies.
- Contact information management (name, phone, email, location).
- **Supplier Portal Access** (`suppliers_account`):
  - Suppliers can be invited via secure invitation token.
  - Allows vendors to log in, view awarded purchase orders, submit price quotes, and exchange direct messages.

### 2. Purchase Requests (`purchase_requests`)
- Create multi-item requisitions from departments (Fleet, Warehouse, Operations, Office).
- Priority levels: Normal, Urgent, Critical.
- Status flow: `pending` → `approved` → `rejected` → `ordered` → `received`.
- Low stock items automatically trigger suggested requests.

### 3. Supplier Quotations & Bids (`supplier_quotations`)
- Vendors submit item bids with unit prices, quantity availability, shipping fee, discounts, and lead times.
- Procurement evaluates competitive quotes before awarding purchase orders.

### 4. Supplier Meetings & Conferences (`supplier_meetings`)
- Scheduled negotiation calls, vendor reviews, and contract discussions.
- Stores meeting links (Zoom/Google Meet), agenda, start/end time, and linked requisition IDs.

### 5. Purchase Orders (`purchase_orders`, `purchase_order_items`)
- **Direct AI Chat Creation**: Ask the AI assistant to "Create purchase order" to pull all pending purchase requests without POs.
- Auto-generate PO numbers.
- Status flow: `Draft` → `Sent` → `Confirmed` → `Delivered` → `Cancelled`.
- Line items tracked in `purchase_order_items`.
- Deleted POs preserved in `purchase_orders_archive` for audit compliance.

### 6. Automated Receipt OCR Verification (`document_verifications`)
- Warehouse managers upload vendor delivery receipts and invoices.
- **Gemini OCR** extracts line items, vendor name, totals, and invoice numbers.
- Automated comparison algorithm checks the extracted receipt against PO line items.
- Result recorded in `document_verifications`:
  - `matched`: All items, quantities, and pricing match within tolerance.
  - `mismatched`: Discrepancy detected (overbilling, missing item, price variance).
  - `pending`: Awaiting OCR processing or supervisor review.
  - `forced`: Supervisor manually overrides a mismatch with justified authorization.

### 7. Supplier Returns & Defect Claims (`supplier_return_requests`, `supplier_return_messages`)
- Formal claims filed against suppliers for damaged or non-conforming items.
- Financial resolution tracked: Replacement, Credit Note, or Refund.
- Requires Finance verification before closing.