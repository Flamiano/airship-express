# AI Procurement Recommendation Engine & Machine Learning Criteria

## Overview
Airship Express employs an AI & Machine Learning Multi-Criteria Decision Analysis (MCDA / AHP Weighted Utility) framework in **Procurement Stage 3 (Collect & Compare Quotations)** to rank, evaluate, and recommend optimal vendor quotations for purchase requisitions.

---

## 1. Multi-Criteria Scoring Model & Weights
The scoring algorithm evaluates all competitive vendor submissions across 4 standardized dimensions totaling a maximum composite score of **100 points**:

### Dimension 1: Pricing & Cost Efficiency (40% Weight - 40 Points Max)
- **Mathematical Formula**: `Price Score = min(40, round((Lowest Market Price / Supplier Quote Total) * 40))`
- **Logic**: Evaluates total financial commitment including base unit price, declared shipping fees, trade discounts, and tax classification (VAT / Non-VAT).
- **Price Delta**: Calculates absolute variance (`₱ Quoted - ₱ Lowest`) and percentage variance (`+X%`).
- **Benchmark**: The supplier offering the lowest valid price automatically receives the full 40 points in this dimension.

### Dimension 2: Fulfillment Speed & Turnaround (25% Weight - 25 Points Max)
- **Turnaround Days Tiers**:
  - `≤ 1 business day`: **25 points** (Immediate expedited fulfillment)
  - `2 - 3 business days`: **22 points** (Fast operational turnaround)
  - `4 - 5 business days`: **18 points** (Standard delivery window)
  - `6 - 7 business days`: **14 points** (Acceptable turnaround)
  - `> 7 business days`: **10 points** (Extended lead time)
- **Stock Readiness Bonus**: `+3 points` for verified on-hand stock or immediate dispatch readiness (zero indent delay).

### Dimension 3: Value-Added Service Coverage (20% Weight - 20 Points Max)
- **Base Score**: 5 points.
- **Service Bonuses**: `+4 points` per declared commercial value-add (up to 20 points max):
  - Replacement warranty / guarantee against shipping damage
  - Dedicated account manager & SLA support
  - Free logistics, delivery insurance, or on-site unboxing
  - Product calibration, testing certificates, or official brand distributorship

### Dimension 4: Logistics & Geographic Proximity (15% Weight - 15 Points Max)
- **Distance from Airship HQ (Binondo, Manila)**:
  - `≤ 3.0 km`: **15 points** (Immediate local vicinity, lowest transport risk)
  - `3.1 - 8.0 km`: **13 points** (Metro Manila central core)
  - `8.1 - 15.0 km`: **11 points** (Greater Metro Manila)
  - `> 15.0 km`: **8 points** (Provincial or regional delivery)

---

## 2. Historical Performance & Track Record Integration
In addition to the static quotation numbers, the machine learning system incorporates historical data from Supabase:

1. **Previous Winning Bid Record**:
   - Cross-references the requisition item code against `purchase_orders` and historical `supplier_quotations`.
   - If the supplier previously won and successfully fulfilled orders for the identical item at competitive rates, they receive a historical trust multiplier.

2. **Delivery Fulfillment & Reliability**:
   - Evaluates past Purchase Orders (`purchase_orders` status: `Delivered` vs `Cancelled` or `Delayed`).
   - Vendors with high delivery completion rates and zero cancellations receive positive ranking bias.

3. **Defect & Return Claim History**:
   - Cross-references `supplier_return_requests` (Return Merchandise Authorization records).
   - Suppliers with zero verified defect claims, or prompt replacement resolutions under `supplier_responsibility = 'Supplier Confirmed'`, maintain high composite integrity.
   - Suppliers with recurring unresolved defect claims or disputed claims are flagged with risk considerations.

---

## 3. Top 3 Ranked Recommendations Structure
When multiple vendors submit bids for a requisition, the engine produces ranked tiers:
1. **Rank #1 (Top Pick / Optimal Balance)**: The proposal providing the highest composite utility score balancing cost, turnaround, and reliability.
2. **Rank #2 (Strong Contender)**: Fast-fulfillment alternative or runner-up with competitive strengths.
3. **Rank #3 (Budget Alternative / Secondary Choice)**: Viable alternative for volume purchasing or contingency supply.

---

## 4. Chatbot Response Guidelines for Recommendation Queries
When users ask about recommendation criteria or historical performance in the chatbot:
- **State the 4 scoring weights clearly**: Pricing (40%), Speed & Stock (25%), Services (20%), Logistics (15%).
- **Explain the exact trade-offs**: Mention why the winning vendor scored highest (e.g. lowest price, faster turnaround, or proximity).
- **Cite historical performance**: Reference past bid awards, previous unit prices, delivery completion, and defect track records.
- **Provide actionable next steps**: Guide the user to award the bid, schedule a negotiation meeting, or compare proposal line items.

