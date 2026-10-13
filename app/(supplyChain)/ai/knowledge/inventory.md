# Inventory Management, Equipment & Asset Control

## Overview
Tracks consumable packaging supplies, warehouse maintenance spare parts, material handling equipment (MHE), and logistics supplies for Airship Express.

---

## Database Schema & Table Reference
- **Primary Table**: `public.inventory_items`
  - `item_code`: Unique SKU identifier.
  - `current_stock`: Available healthy balance on hand.
  - `minimum_stock`: Safety reorder trigger threshold.
  - `quarantine_stock`: Items flagged damaged or uninspected, withheld from general issuance.
  - `warehouse_storage_zone_id`: Zone FK linking to storage layouts.
  - `status`: Enforced constraint: `'available'`, `'low-stock'`, `'out-of-stock'`, `'reserved'`.
- **Movement Audit Log**: `public.stock_movements`
  - Records every transaction: `'Stock In'`, `'Stock Out'`, `'Adjustment'`.
  - Captures `previous_stock`, `new_stock`, `reference_number`, `reason`, `department`, and `performed_by`.
- **Receiving Logs**: `public.stock_in_logs`
  - Specific receiving logs linked to `purchase_order_items.id`.

---

## Inventory Classifications & Categories
1. **Packaging Consumables**:
   - Poly Mailers (Small, Medium, Large, Extra Large)
   - Bubble Wrap (Single Bubble, Double Bubble rolls)
   - Packing Tape (Clear 2-inch, Heavy-duty Fragile printed tape)
   - Corrugated Boxes (Sizes S1 to S6)
   - Thermal Barcode Labels & RFID Tags
2. **Material Handling Equipment (MHE)**:
   - Hand Pallet Jacks (2.5T, 3.0T capacity)
   - Conveyor Rollers & Belt Sections
   - Barcode Scanners (Honeywell, Zebra RF Terminals)
   - Weighing & Volumetric Cubing Scales
   - Heavy-duty Duffle & Bulk Sorting Bags
3. **Fleet & Hub Maintenance**:
   - Vehicle tires (Commercial Van, Light Truck)
   - Engine oils, hydraulic fluids, and maintenance toolsets

---

## Stock Level Definitions & Thresholds
- **Available / Healthy**: Stock level > Minimum Threshold. Normal operations.
- **Low Stock**: Stock level <= Minimum Threshold. System triggers auto-replenishment alerts.
- **Out of Stock**: Quantity = 0. Urgent purchase request required.
- **Reserved / Quarantine**: Stock allocated for scheduled high-volume warehouse operations or quarantined due to quality defects (`quarantine_stock`).

---

## Stock In / Stock Out Workflows
### Stock Inwarding:
- Triggered upon delivery confirmation of Purchase Orders.
- Verified against PO number, vendor delivery receipts, and physical count.
- Inserts record into `stock_in_logs` and `stock_movements`, updates item unit cost, adds quantity to location rack, and logs user activity.

### Stock Outwarding / Consumption:
- Consumed by warehouse shifts (e.g. daily packaging tape, label rolls allocation).
- Requires logging Department (Receiving, Sorting, Dispatch, Maintenance) and Operator Name.
- Real-time stock decrement with audit trail in `stock_movements`.

---

## Restocking & Automated Suggestions
- Items falling below safety stock threshold trigger automated purchase request recommendations in the Procurement module.