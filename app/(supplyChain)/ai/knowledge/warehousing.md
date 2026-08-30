# Warehousing Module — Process Knowledge

## 1. Module Overview

The Warehousing module manages the movement of parcels through the warehouse from the moment they arrive until they are picked up and dispatched by a courier.

The module focuses on four main processes:

1. Inbound Receiving
2. Courier Sorting
3. Outgoing Dispatch
4. Warehouse Dashboard and Monitoring

The main goal is to ensure that parcels are received accurately, verified before processing, organized according to destination and courier, and properly handed over for delivery.

This document describes the business process and system behavior only. It does not contain credentials, API keys, passwords, private customer information, supplier information, or other sensitive system data.

---

# 2. Overall Warehousing Process

The complete warehouse process is:

```text
Parcel Arrives
      ↓
Inbound Receiving
      ↓
Barcode Scan / Manual Entry
      ↓
Duplicate Check
      ↓
Pending
      ↓
Parcel Verification
      ↓
 ┌───────────────┐
 │               │
Verified       Rejected
 │
 ↓
Courier Sorting
 ↓
Group by Destination
 ↓
Assign Courier
 ↓
Generate Bulk QR
 ↓
Ready for Pickup
 ↓
Outgoing Dispatch
 ↓
Scan Parcel / Select Batch
 ↓
Assign Driver
 ↓
Picked Up
 ↓
Dispatched
 ↓
Courier Delivery
 ↓
Delivered
```

Each stage has a specific responsibility and should only allow parcels to move forward when the required conditions are satisfied.

---

# 3. Inbound Receiving

## Purpose

Inbound Receiving is the first warehouse process.

It records parcels when they arrive at the warehouse and ensures that parcels are not accidentally received more than once.

## Process

```text
Parcel Arrives
      ↓
Scan Barcode
      ↓
Is Barcode Valid?
   ↙          ↘
 No            Yes
 ↓              ↓
Show Error    Check Duplicate
                ↓
          Already Exists?
            ↙       ↘
          Yes        No
           ↓          ↓
      Show Duplicate  Create Receiving Record
                         ↓
                       Pending
                         ↓
                   Staff Verification
                    ↙             ↘
                Verified        Rejected
                   ↓               ↓
             Move to Sorting    Stop Processing
```

## Receiving Methods

### Barcode Scanning

Staff can scan a parcel barcode using a supported camera/scanning device.

The system should:

1. Capture the barcode.
2. Validate the barcode.
3. Search for an existing parcel.
4. Prevent duplicate processing.
5. Add the parcel to the receiving process.
6. Set the appropriate receiving status.
7. Provide immediate feedback to the staff member.

### Manual Entry

Manual entry is used when:

- A barcode cannot be scanned.
- A parcel does not have a readable barcode.
- Scanner hardware is unavailable.
- Staff needs to enter parcel information manually.

Manual entries must go through the same validation and duplicate checks as scanned parcels.

---

# 4. Duplicate Prevention

Duplicate prevention is an important part of receiving.

The system should prevent the same parcel from being received multiple times.

## Duplicate Check Process

```text
Scan / Enter Parcel
       ↓
Search Existing Records
       ↓
 ┌─────────────────┐
 │ Existing Parcel?│
 └─────────────────┘
      ↙       ↘
    Yes        No
     ↓          ↓
  Reject       Continue
  Duplicate       ↓
              Receive
```

Potential identifiers used for duplicate detection include:

- Barcode
- Tracking number
- Existing parcel record
- Other identifiers defined by the business process

If a duplicate is detected, the system should:

- Stop the duplicate operation.
- Inform the staff member.
- Avoid creating another parcel record.
- Keep the original parcel record intact.

---

# 5. Receiving Verification

After a parcel is received, it enters a verification stage.

## Process

```text
Received
   ↓
Pending
   ↓
Staff Reviews Parcel
   ↓
Verify Information
   ↓
 ┌───────────────┐
 │               │
Valid           Invalid
 ↓                ↓
Verified        Rejected
 ↓
Sorting
```

Staff should verify the parcel information and physical parcel before it continues to sorting.

A verified parcel can proceed to the Courier Sorting process.

A rejected parcel should not proceed to sorting until the issue is resolved according to the application's business rules.

---

# 6. Courier Sorting

## Purpose

Courier Sorting organizes verified parcels according to destination and determines which courier should handle each parcel.

## Sorting Process

```text
Verified Parcels
      ↓
Group by Region
      ↓
Group by City / Destination
      ↓
Review Parcel Groups
      ↓
Assign Courier
      ↓
Generate Bulk QR
      ↓
Mark Ready for Pickup
```

## Destination Grouping

Parcels can be grouped using destination information such as:

- Region
- City
- Destination area
- Other supported destination classifications

Regions may include:

- Luzon
- Visayas
- Mindanao

Grouping allows warehouse staff to process large numbers of parcels efficiently instead of handling every parcel individually.

---

# 7. Courier Assignment

Once parcels have been organized by destination, they can be assigned to an appropriate courier.

The system supports multiple courier services.

Courier assignment should:

1. Identify the parcel or parcel group.
2. Determine the destination.
3. Select the appropriate courier.
4. Associate the courier with the parcel/group.
5. Update the parcel's processing state.
6. Prepare the parcel for pickup.

The exact courier selected depends on the operational rules of the business.

---

# 8. Bulk QR Code Process

Bulk QR codes allow multiple parcels to be processed as a group.

## QR Types

### Global Bulk QR

Used to identify a general parcel batch.

Example:

```text
BULK-XXXXXX
```

### City Bulk QR

Used to group parcels belonging to a specific destination city.

Example:

```text
BULK-CITY-XXXXXX
```

### Courier Bulk QR

Used to group parcels assigned to a particular courier.

Example:

```text
BULK-COURIER-XXXXXX
```

## Bulk QR Workflow

```text
Select Parcel Group
       ↓
Generate Bulk QR
       ↓
Associate Parcels
       ↓
Display / Scan QR
       ↓
Process Group
       ↓
Update Eligible Parcels
```

Bulk QR processing should not create duplicate parcels.

The system should also clearly indicate how many parcels are included in a batch.

---

# 9. Ready for Pickup

After sorting and courier assignment are complete, parcels become ready for courier pickup.

Typical process:

```text
Verified
   ↓
Sorted
   ↓
Courier Assigned
   ↓
Bulk QR Generated
   ↓
Ready for Pickup
```

A parcel should only become `ready_for_pickup` after the required sorting and assignment steps have been completed.

---

# 10. Outgoing Dispatch

## Purpose

Outgoing Dispatch handles the final warehouse stage before parcels leave the warehouse.

It ensures that the correct parcels are handed over to the correct courier or driver.

## Dispatch Process

```text
Courier Arrives
      ↓
Identify Pickup Batch
      ↓
Scan Parcels / Bulk QR
      ↓
Verify Eligible Parcels
      ↓
Assign Driver
      ↓
Confirm Pickup
      ↓
Picked Up
      ↓
Dispatched
```

---

# 11. Dispatch Verification

Before a parcel is marked as picked up, the system should verify that:

- The parcel exists.
- The parcel is eligible for pickup.
- The parcel belongs to the selected courier/batch when applicable.
- The parcel has not already been picked up.
- The parcel has not already been dispatched.

If validation fails, the system should prevent the pickup operation and display an appropriate message.

---

# 12. Driver Assignment

When a courier collects parcels, the responsible driver can be associated with the shipment.

The process is:

```text
Pickup Batch
    ↓
Identify Driver
    ↓
Assign Driver
    ↓
Confirm Pickup
```

Driver assignment helps identify who collected the parcels during the dispatch process.

---

# 13. Parcel Status Lifecycle

The general parcel lifecycle is:

```text
Received
   ↓
Pending
   ↓
Verified
   ↓
Sorted
   ↓
Ready for Pickup
   ↓
Picked Up
   ↓
Dispatched
   ↓
Delivered
```

A parcel may also enter:

```text
Rejected
```

when it fails receiving verification.

## Status Meaning

| Status | Meaning |
|--------|---------|
| `received` | Parcel has arrived and has been received by the warehouse. |
| `pending` | Parcel has been entered/scanned and is waiting for verification. |
| `verified` | Staff has verified the parcel and it can continue processing. |
| `rejected` | Parcel failed verification and cannot continue normally. |
| `sorted` | Parcel has been organized during the sorting process. |
| `ready_for_pickup` | Parcel has been prepared and is waiting for courier pickup. |
| `picked_up` | Courier/driver has collected the parcel from the warehouse. |
| `dispatched` | Parcel has left the warehouse and entered courier delivery. |
| `delivered` | Parcel has reached its destination. |

---

# 14. Status Transition Rules

Status transitions should follow the defined business process.

Normal progression:

```text
received
  ↓
pending
  ↓
verified
  ↓
sorted
  ↓
ready_for_pickup
  ↓
picked_up
  ↓
dispatched
  ↓
delivered
```

Rejected parcels:

```text
pending
   ↓
rejected
```

The application should avoid invalid transitions such as:

```text
pending → picked_up
verified → delivered
rejected → dispatched
ready_for_pickup → pending
```

unless a specific business process explicitly supports the transition.

---

# 15. Warehouse Dashboard

## Purpose

The Warehouse Dashboard provides an overview of warehouse activity.

It allows staff and authorized users to monitor parcel activity without manually reviewing each individual parcel.

## Dashboard Process

```text
Parcel Activity
      ↓
Collect Operational Data
      ↓
Calculate Metrics
      ↓
Display Statistics
      ↓
Update When Data Changes
```

## Example Metrics

The dashboard may display:

- Total received parcels
- Total scanned parcels
- Pending parcels
- Verified parcels
- Rejected parcels
- Sorted parcels
- Ready-for-pickup parcels
- Picked-up parcels
- Dispatched parcels
- Delivered parcels
- Monthly parcel volume
- Peak operating hour
- Busiest day
- Courier performance
- Destination distribution

---

# 16. Real-Time Updates

The warehouse process is intended to support multiple users working at the same time.

When a parcel changes, relevant warehouse screens should reflect the update without requiring unnecessary manual refreshes.

Examples:

```text
Staff A receives parcel
        ↓
Receiving list updates
        ↓
Parcel becomes available for sorting
```

Another example:

```text
Staff B assigns courier
        ↓
Sorting data updates
        ↓
Parcel becomes ready for pickup
        ↓
Dispatch screen reflects the change
```

Real-time synchronization helps prevent staff from working with outdated parcel information.

---

# 17. Search and Filtering

Warehouse staff may need to locate parcels quickly.

Search/filter functionality can be based on:

- Barcode
- Tracking number
- Destination
- City
- Region
- Courier
- Status
- Date
- Bulk QR
- Other supported parcel attributes

Filtering should not modify parcel data. It should only change which records are displayed.

---

# 18. Pagination

Large parcel volumes should be displayed using pagination or another scalable data-loading strategy.

The purpose is to:

- Prevent loading unnecessary records.
- Improve screen performance.
- Make large parcel lists easier to navigate.
- Reduce unnecessary database requests.

Pagination should work together with:

- Search
- Filtering
- Sorting
- Real-time updates

---

# 19. Batch Operations

Batch operations allow warehouse staff to process multiple parcels at once.

Examples include:

- Receive multiple parcels
- Delete multiple eligible records
- Assign multiple parcels
- Generate a bulk QR
- Dispatch multiple parcels
- Process a courier batch

## Batch Operation Flow

```text
Select Multiple Parcels
        ↓
Validate Selected Parcels
        ↓
Confirm Operation
        ↓
Process Batch
        ↓
Update Successful Records
        ↓
Report Failed Records
```

Batch operations should avoid silently processing invalid or ineligible parcels.

---

# 20. Error and Exception Processes

The system should handle operational errors without breaking the warehouse workflow.

Common scenarios include:

### Invalid Barcode

```text
Scan Barcode
     ↓
Invalid
     ↓
Show Error
     ↓
Allow Rescan / Manual Entry
```

### Duplicate Parcel

```text
Scan Barcode
     ↓
Duplicate Detected
     ↓
Stop Processing
     ↓
Notify Staff
```

### Invalid QR Code

```text
Scan QR
   ↓
Validate QR
   ↓
Invalid
   ↓
Show Error
   ↓
Allow Another Scan
```

### Parcel Already Processed

If a parcel has already been picked up, dispatched, or otherwise processed, the system should prevent an operation that would duplicate or reverse the completed process.

---

# 21. Camera and Scanner Process

When camera scanning is used:

```text
Open Scanner
     ↓
Request Camera Access
     ↓
Start Camera
     ↓
Detect Barcode / QR
     ↓
Validate Result
     ↓
Process Parcel
     ↓
Provide Feedback
```

If camera permission is denied or the scanner cannot initialize, the system should provide an alternative such as manual entry when applicable.

---

# 22. Business Rules

The following rules should remain consistent across the Warehousing module:

1. A parcel should not be received more than once.
2. A parcel must be verified before normal sorting.
3. Only eligible parcels should be assigned to a courier.
4. Only eligible parcels should become ready for pickup.
5. A parcel should not be picked up more than once.
6. A dispatched parcel should not return to an earlier state without an explicit correction process.
7. Bulk operations must validate every selected parcel.
8. Bulk QR processing must not create duplicate parcel records.
9. Status values should remain consistent across all warehouse screens.
10. Search and filtering must not alter parcel records.
11. Destructive operations should require confirmation.
12. Failed operations should provide clear feedback.
13. Real-time changes should be reflected across relevant warehouse views.
14. The system should prevent invalid status transitions.
15. Staff should be able to identify the current state of a parcel at any point in its warehouse lifecycle.

---

# 23. End-to-End Example

A typical parcel moves through the system as follows:

```text
1. Parcel arrives at the warehouse.

2. Staff scans the barcode.

3. The system checks whether the parcel already exists.

4. No duplicate is found.

5. The parcel enters the receiving process as Pending.

6. Staff verifies the parcel.

7. The parcel becomes Verified.

8. The parcel enters Courier Sorting.

9. The system groups the parcel according to its destination.

10. Staff assigns the appropriate courier.

11. A bulk QR may be generated for the parcel group.

12. The parcel becomes Ready for Pickup.

13. The courier arrives.

14. Staff scans the parcel or the appropriate bulk QR.

15. The system verifies that the parcel is eligible for pickup.

16. The driver is assigned.

17. The parcel becomes Picked Up.

18. The parcel is marked as Dispatched.

19. The parcel continues through the courier's delivery process.

20. The parcel eventually becomes Delivered.
```

---

# 24. AI Development Rules

When modifying or extending the Warehousing module, the AI should follow these rules:

1. Understand the existing parcel lifecycle before changing any warehouse feature.
2. Do not bypass receiving verification.
3. Do not allow duplicate parcel creation.
4. Do not introduce a new status without considering its effect on the entire lifecycle.
5. Keep status values consistent across receiving, sorting, dispatch, filters, and dashboard calculations.
6. Do not allow users to perform operations on parcels that are not eligible for that operation.
7. Preserve the relationship between receiving, sorting, and dispatch.
8. Ensure bulk operations follow the same validation rules as individual operations.
9. Consider real-time updates when changing parcel-related data.
10. Preserve existing search, filtering, and pagination behavior when modifying warehouse lists.
11. Provide clear loading, success, empty, and error states.
12. Avoid creating duplicate functionality when an existing warehouse component already performs the required operation.
13. When changing a workflow, consider how the change affects every downstream process.
14. Do not remove validation merely to simplify the UI.
15. Keep the warehouse process understandable to staff who are processing parcels in real time.

---

# 25. Core Principle

The Warehousing module follows one central principle:

> Every parcel should have a clear and traceable state from receiving through dispatch.

The system should help warehouse staff answer these questions at any time:

- Has the parcel been received?
- Has it been verified?
- Has it been sorted?
- Which courier is assigned?
- Is it ready for pickup?
- Has it been picked up?
- Has it been dispatched?
- Has it been delivered?

The warehouse workflow should remain accurate, traceable, and resistant to duplicate or invalid processing.
