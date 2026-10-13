# Warehousing Module — Process & Schema Knowledge

## 1. Module Overview

The Warehousing module in Supply Chain Management handles warehouse operations for supplies, inventory stock-ins, department issue requests, storage location management, and damaged/missing supply reports.

The module focuses on four main processes:

1. **Receive Supplies** (`receive`): Inbound receiving of ordered goods from vendors and purchase orders.
2. **Issue Requests** (`issue`): Fulfilling internal inventory/supplies requests approved for company departments.
3. **Storage Locations** (`locations`): Managing aisles, racks, shelves, and bins across warehouse zones.
4. **Damaged / Missing Supplies** (`damages`): Recording damage incidents, short shipments, and reporting items for return or replacement.

---

## 2. Inbound Receiving Workflow

1. Inbound shipments arrive with a Purchase Order (PO) or supplier delivery receipt.
2. Warehouse staff verify items, quantities, and condition against the PO line items (`purchase_order_items`).
3. Staff confirm intake and stock items into the designated warehouse storage location.
4. Inserts audit records into `stock_in_logs` and `stock_movements`.
5. Inventory balances in `inventory_items` update automatically via database triggers.

---

## 3. Issue Requests Workflow

1. Departments submit internal inventory requests (e.g. tools, packaging, uniforms, consumables).
2. Approved requests appear in the **Issue Requests** tab.
3. Warehouse staff pick the items from their storage locations.
4. Staff mark the request as issued/dispatched to the requesting department.
5. System logs a `Stock Out` movement in `stock_movements`.

---

## 4. Storage Locations & Zone Hierarchy

1. Storage locations are structured hierarchically: Zone → Aisle → Rack → Shelf → Bin.
2. Storage zones correspond to `warehouse_storage_zones` and are linked via `inventory_items.warehouse_storage_zone_id`.
3. Locations maintain status indicators: Available, Occupied, Reserved, or Maintenance.
4. Items are mapped to their specific location codes for fast retrieval during fulfillment.

---

## 5. Damaged & Missing Supplies Reporting (`warehouse_damage_incidents`)

1. Any damaged goods, defects, or shortages identified during intake or stock audits are logged in `warehouse_damage_incidents`.
2. Captured details:
   - `incident_number`: Unique incident ID (e.g. `INC-2026-0001`).
   - `discrepancy_type`: Physical Damage, Packaging Breach, Wrong Item, Short Shipment.
   - `severity`: Minor, Moderate, Critical.
   - `unit_cost` & `total_estimated_loss`: Directly tracks financial loss.
   - `po_number` & `supplier_name`: Connects to origin purchase order.
   - `evidence_urls`: Photographic documentation of damaged items.
3. When supplier fault is determined, incident transitions to a formal return claim in `supplier_return_requests`.
