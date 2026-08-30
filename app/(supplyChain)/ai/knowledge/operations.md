# Daily Operations & Warehouse Standard Operating Procedures (SOP)

## Overview
Airship Express operates a multi-courier fulfillment and distribution hub. The system coordinates inbound cargo acceptance, barcode verification, regional sortation, inventory reconciliation, and fleet dispatching.

---

## Inbound Receiving Workflow (Stage 1)
1. **Intake & Unloading**: Shipments arriving at unloading bays are counted and inspected for packaging integrity.
2. **Barcode Scanning**: Parcels are scanned via handheld scanners or manual code entry.
3. **Validation & De-duplication**: 
   - Tracking codes and custom barcodes are verified against manifest records.
   - The system flags duplicate scans, corrupted barcodes, or unassigned parcels immediately.
4. **Receiving Queue**: Valid items enter the staging queue marked with status `Received` or `Pending Verification`.

---

## Sortation & Courier Staging (Stage 2)
1. **Regional Grouping**: Parcels are classified by destination hub (Metro Manila, North Luzon, South Luzon, Visayas, Mindanao, International).
2. **Courier Carrier Assignment**: Items are segregated into carrier lanes (e.g., J&T Express, Ninja Van, Flash Express, Lalamove, 2GO).
3. **Bulk QR Generation**: Multi-item lots heading to the same regional hub can be bundled with bulk QR codes for expedited truck loading.
4. **Sorting Verification**: Area status (Lanes 1 to 4) is monitored in real-time.

---

## Outgoing Dispatch & Fleet Handover (Stage 3)
1. **Manifest Assembly**: System compiles parcel lists into driver run sheets.
2. **Driver Assignment**: Specific drivers and vehicles (Vans, 4-Wheeler Trucks, 6-Wheeler Wings) are mapped to carrier batches.
3. **Departure Verification**: Parcels update status from `Ready for Pickup` → `Picked Up` → `In Transit`.
4. **Exceptions**: Flagged damages or missing waybills are routed to the exception bay for supervisor review.

---

## Operating Schedules & Capacity
- **Hub Shifts**: 
  - Morning Sort & Receiving: 06:00 AM – 02:00 PM
  - Afternoon Primary Dispatch: 02:00 PM – 10:00 PM
  - Night Inbound Staging: 10:00 PM – 06:00 AM
- **Peak Scanning Volume Hours**: 10:00 AM – 12:00 PM and 04:00 PM – 06:00 PM.
- **Sorting Lane Throughput**: Up to 3,500 parcels/hour across active conveyor lanes.

---

## Exception Handling Protocols
- **Duplicate Barcode**: Segregate parcel; confirm with vendor sender ID before force-updating.
- **Damaged Goods**: Photograph parcel, document via Document Tracking module, place in hold inventory.
- **Undeliverable / Return-to-Sender (RTS)**: Marked as RTS in database, stored in RTS holding rack for 7 business days.