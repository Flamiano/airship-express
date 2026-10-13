# Quality Control, Warehouse Defects & Supplier Returns SOP

## 1. Overview
The Airship Express Supply Chain system strictly enforces item quality control, damage inspection, defect logging, and supplier return resolution to eliminate financial loss and maintain uninterrupted warehouse logistics.

---

## 2. Inbound Receiving Inspection
1. **Intake Inspection**:
   - Every inbound delivery against a Purchase Order undergoes mandatory physical inspection at the unloading bay before being accepted into warehouse stock.
   - Staff verify item package seals, quantity counts, item descriptions, and barcode labels against PO line items.
2. **Flagging Discrepancies**:
   - If goods arrive crushed, broken, soaked, wrong specification, or expired, intake staff immediately flag the shipment.
   - Instead of logging the items as healthy stock in `inventory_items`, defective units are routed to `quarantine_stock` and logged in `warehouse_damage_incidents`.

---

## 3. Warehouse Damage Incidents (`warehouse_damage_incidents`)
Recorded whenever damages occur during transit, intake receiving, or warehouse material handling:
- **Incident Number**: Auto-generated format (e.g. `INC-2026-0012`).
- **Discrepancy & Defect Types**:
  - `Physical Damage`: Crushed boxes, cracked casings, punctured packaging, dented equipment.
  - `Functional Defect`: Non-responsive electronic scanners, broken pallet jack hydraulic seals.
  - `Wrong Specification`: Supplier delivered incorrect dimension boxes or wrong grade oils.
  - `Short Shipment`: Physical delivered count less than invoice quantity.
  - `Packaging Breach`: Moisture ingress, broken tamper-evident tape.
- **Severity Levels**:
  - `Minor`: Superficial cosmetic packaging damage; contents intact.
  - `Moderate`: Single units or partial lots damaged, requiring repair or supplier credit.
  - `Critical`: Hazardous fluid leaks, large-scale batch damage, total shipment rejection.
- **Financial Loss Calculation**:
  - `total_estimated_loss = quantity * unit_cost`.
  - Directly visualized in Executive dashboards under Defect & Replacement metrics.

---

## 4. Supplier Return Merchandise Authorization (RMA) (`supplier_return_requests`)
When vendor responsibility is identified:
1. **Initiate Return Request**:
   - Linked to `warehouse_damage_incidents.id` and original `purchase_orders.id`.
   - Generates `return_request_number` (e.g. `RET-2026-0045`).
   - Captures photos and delivery evidence in `evidence_urls`.
2. **Resolution Options**:
   - **Full Item Replacement**: Supplier delivers replacement goods at zero additional cost.
   - **Credit Note / Refund**: Financial deduction applied to future invoices or cash refund.
   - **Free Supplier Repair**: Specialized equipment sent for vendor servicing.
3. **Supplier Responsibility Confirmation**:
   - `supplier_responsibility`: `'Pending Supplier Confirmation'` → `'Supplier Confirmed'` or `'Disputed'`.
4. **Finance Verification**:
   - Once supplier confirms replacement or credit note, Finance verifies the adjustment (`finance_verified = true`).
5. **Supplier Messaging Trail** (`supplier_return_messages`):
   - Formal notifications, email dispatches, and delivery status tracking directly logged in the system.
