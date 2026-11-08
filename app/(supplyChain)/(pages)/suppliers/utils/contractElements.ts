// app/(supplyChain)/(pages)/suppliers/utils/contractElements.ts
/**
 * PMBOK / ISO 10845 Procurement Elements Specification
 * Defines the 20 required contract and SOW clauses, categorized into 4 operational pillars,
 * along with the auto-fill builder that parses supplier quotations into legally structured terms.
 */

export interface ContractTerms {
    sow_deliverables: string;
    schedule_baselines: string;
    performance_reporting: string;
    period_of_performance: string;
    roles_responsibilities: string;
    seller_place_of_performance: string;
    pricing: string;
    payment_terms: string;
    place_of_delivery: string;
    inspection_acceptance_criteria: string;
    warranty: string;
    product_support: string;
    limitation_of_liability: string;
    fees_retainer: string;
    penalties: string;
    incentives: string;
    insurance_performance_bonds: string;
    subcontractor_approvals: string;
    change_request_handling: string;
    termination_and_adr: string;
}

export interface ContractSignatories {
    buyer: {
        name: string;
        title: string;
        signed_at?: string | null;
    };
    seller: {
        name: string;
        title: string;
        signed_at?: string | null;
    };
}

export type ContractCategory =
    | "Scope & Schedule"
    | "Commercial & Financial"
    | "Quality & Risk Management"
    | "Governance & Legal";

export interface ContractElementDef {
    key: keyof ContractTerms;
    number: number;
    label: string;
    category: ContractCategory;
    description: string;
    iconName?: string;
}

export const CONTRACT_ELEMENTS: ContractElementDef[] = [
    // Category A: Scope & Schedule
    {
        key: "sow_deliverables",
        number: 1,
        label: "Statement of Work or Deliverables",
        category: "Scope & Schedule",
        description: "Exact specifications, line items, supply scope, and technical deliverables required from the supplier.",
    },
    {
        key: "schedule_baselines",
        number: 2,
        label: "Schedule Baselines",
        category: "Scope & Schedule",
        description: "Milestones, promised order fulfillment lead times, and planned delivery windows.",
    },
    {
        key: "performance_reporting",
        number: 3,
        label: "Performance Reporting",
        category: "Scope & Schedule",
        description: "Fulfillment reports, On-Time In-Full (OTIF) tracking, and periodic KPI status reviews.",
    },
    {
        key: "period_of_performance",
        number: 4,
        label: "Period of Performance",
        category: "Scope & Schedule",
        description: "Master agreement validity window, contract commencement date, and annual renewal terms.",
    },
    {
        key: "roles_responsibilities",
        number: 5,
        label: "Roles and Responsibilities",
        category: "Scope & Schedule",
        description: "Accountabilities of Buyer (Airship Express) and Seller (Supplier Account Manager / Dispatch).",
    },
    {
        key: "seller_place_of_performance",
        number: 6,
        label: "Seller's Place of Performance",
        category: "Scope & Schedule",
        description: "Supplier warehouse, manufacturing facility, or registered dispatch hub origin.",
    },

    // Category B: Commercial & Financial
    {
        key: "pricing",
        number: 7,
        label: "Pricing Structure",
        category: "Commercial & Financial",
        description: "Unit prices, VAT/tax breakdown, currency, and price lock/escalation clauses.",
    },
    {
        key: "payment_terms",
        number: 8,
        label: "Payment Terms",
        category: "Commercial & Financial",
        description: "Credit days (e.g. Net 30), payment method, invoice submission, and bank routing procedures.",
    },
    {
        key: "place_of_delivery",
        number: 9,
        label: "Place of Delivery",
        category: "Commercial & Financial",
        description: "Airship Express central hub / designated destination warehouse and Incoterms (e.g. DDP / FOB).",
    },
    {
        key: "fees_retainer",
        number: 10,
        label: "Fees and Retainer",
        category: "Commercial & Financial",
        description: "Handling, fuel surcharges, packaging, or standing retainer stipulations (if applicable).",
    },
    {
        key: "penalties",
        number: 11,
        label: "Penalties (Liquidated Damages)",
        category: "Commercial & Financial",
        description: "Liquidated damages for unexcused shipment delays or SLA delivery breaches (e.g. 0.5% per calendar day).",
    },
    {
        key: "incentives",
        number: 12,
        label: "Incentives",
        category: "Commercial & Financial",
        description: "Early delivery rebates, volume tiered discounts, or preferred supplier ranking bonuses.",
    },

    // Category C: Quality & Risk Management
    {
        key: "inspection_acceptance_criteria",
        number: 13,
        label: "Inspection and Acceptance Criteria",
        category: "Quality & Risk Management",
        description: "Receiving dock QA protocol, defect tolerance, and 48-72h return window for non-conforming items.",
    },
    {
        key: "warranty",
        number: 14,
        label: "Warranty",
        category: "Quality & Risk Management",
        description: "Standard manufacturer coverage, defect replacement guarantee, and RMA handling speed.",
    },
    {
        key: "product_support",
        number: 15,
        label: "Product Support",
        category: "Quality & Risk Management",
        description: "Technical customer support availability, SDS/datasheets, manuals, and RMA dispatch.",
    },
    {
        key: "limitation_of_liability",
        number: 16,
        label: "Limitation of Liability",
        category: "Quality & Risk Management",
        description: "Caps on indirect or consequential damages, preserving gross negligence exceptions.",
    },
    {
        key: "insurance_performance_bonds",
        number: 17,
        label: "Insurance and Performance Bonds",
        category: "Quality & Risk Management",
        description: "General commercial liability and transit cargo protection standards.",
    },

    // Category D: Governance & Legal
    {
        key: "subcontractor_approvals",
        number: 18,
        label: "Subordinate Subcontractor Approvals",
        category: "Governance & Legal",
        description: "Requirement for written Buyer consent prior to third-party subcontracting of manufacturing or delivery.",
    },
    {
        key: "change_request_handling",
        number: 19,
        label: "Change Request Handling",
        category: "Governance & Legal",
        description: "Formal written Change Order procedure for modifying quantities, pricing, or specifications.",
    },
    {
        key: "termination_and_adr",
        number: 20,
        label: "Termination Clause & Alternative Dispute Resolution (ADR)",
        category: "Governance & Legal",
        description: "Termination for convenience/cause, cure periods, and 3-tier ADR (Negotiation, Mediation, PDRCI/BANI Arbitration).",
    },
];

export const CONTRACT_CATEGORIES: ContractCategory[] = [
    "Scope & Schedule",
    "Commercial & Financial",
    "Quality & Risk Management",
    "Governance & Legal",
];

export function getDefaultContractTerms(): ContractTerms {
    return {
        sow_deliverables: "The Seller shall furnish and deliver goods conforming in all respects with approved Purchase Orders and technical specifications.",
        schedule_baselines: "Standard delivery lead time of 3-5 business days upon issuance of Purchase Order.",
        performance_reporting: "Seller performance will be measured against On-Time In-Full (OTIF) targets (>=95%) and reported monthly.",
        period_of_performance: "Effective for one (1) year from execution date, automatically renewable upon mutual written agreement.",
        roles_responsibilities: "Buyer: Issue formal POs and remit payment according to terms. Seller: Maintain safety stocks, quality assurance, and deliver freight to designated docks.",
        seller_place_of_performance: "Seller's primary operating facility and authorized distribution hubs.",
        pricing: "Firm-fixed pricing as quoted. Any price escalation requires 60 days advance written justification.",
        payment_terms: "Net 30 Days via Bank Transfer upon issuance of verified billing invoice and signed receiving copy.",
        place_of_delivery: "Airship Express Central Logistics & Sorting Facility, Metro Manila, Philippines (DDP - Delivered Duty Paid).",
        inspection_acceptance_criteria: "Goods are subject to QA inspection within three (3) calendar days of arrival. Defective or non-compliant goods will be rejected.",
        warranty: "One (1) Year Standard Replacement Warranty against manufacturer defects.",
        product_support: "Seller shall provide technical documentation, spec sheets, and responsive customer support within 24 business hours.",
        limitation_of_liability: "Total aggregate liability of either party shall be limited to the total value of Purchase Orders issued during the preceding 12 months, excluding willful misconduct.",
        fees_retainer: "No standing retainer fees. All packaging and standard transport costs are included in quoted unit prices.",
        penalties: "Liquidated damages of 0.5% of delayed order value per calendar day of unexcused delay, capped at 10% total.",
        incentives: "Preferred vendor tier status and priority procurement allocation for quarterly OTIF scores exceeding 98%.",
        insurance_performance_bonds: "Seller maintains Comprehensive Commercial General Liability insurance covering products in transit.",
        subcontractor_approvals: "Seller shall not assign or subcontract any portion of the work without prior written authorization from Buyer.",
        change_request_handling: "All amendments to specifications, volume, or delivery schedules must be executed via written Purchase Order Amendment / Change Order.",
        termination_and_adr: "Termination for convenience with 30-day notice; immediate termination for material breach. Disputes shall be resolved amicably, followed by mediation and binding arbitration in Metro Manila.",
    };
}

/**
 * Auto-fill builder: transforms quotation data, supplier profile, and form inputs
 * into comprehensive, tailored clauses for the 20 procurement elements.
 */
export function buildContractFromQuotation(
    supplier: any,
    quote: any,
    formData: any,
    otherProducts: any[] = []
): ContractTerms {
    const supplierName = formData?.name || quote?.supplier_name || supplier?.name || "The Supplier";
    const contactPerson = formData?.contact_person || quote?.contact_person || supplier?.contact_person || "Authorized Representative";
    const sellerAddress = formData?.location || quote?.supplier_address || supplier?.location || "Supplier Registered Facility";
    const leadTime = formData?.lead_time || (quote?.lead_time_days ? `${quote.lead_time_days} Business Days` : "3-5 Business Days");
    const paymentMethod = formData?.payment_method || "Bank Transfer";
    const paymentTerms = formData?.payment_terms || quote?.payment_terms || "Net 30 Days";
    const warranty = formData?.warranty || quote?.warranty_terms || "1 Year Standard Replacement Warranty";
    const deliveryTerms = formData?.delivery_terms || quote?.delivery_terms || "FOB Destination / Direct Delivery";

    // 1. SOW & Deliverables synthesis
    let deliverablesSummary = "";
    if (otherProducts && otherProducts.length > 0) {
        const itemRows = otherProducts.map((p, idx) => {
            const unitPrice = Number(p.unit_price || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 });
            return `   ${idx + 1}. ${p.item_name} - ${p.unit || "unit"} @ PHP ${unitPrice} (Awarded: ${p.is_awarded_item ? "Yes" : "Standard Catalog"})`;
        }).join("\n");
        deliverablesSummary = `The Seller shall supply, package, and deliver the following authorized goods conforming with agreed specifications:\n${itemRows}`;
    } else if (supplier?.products || formData?.products) {
        deliverablesSummary = `The Seller shall supply and deliver ${supplier?.products || formData?.products} in accordance with purchase orders issued by Airship Express.`;
    } else if (quote?.items && Array.isArray(quote.items) && quote.items.length > 0) {
        const quoteItems = quote.items.map((it: any, idx: number) => {
            const up = Number(it.unit_price || it.price || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 });
            return `   ${idx + 1}. ${it.item_name || it.name || "Item"} (${it.quantity || 1} ${it.unit || "unit"}) @ PHP ${up}`;
        }).join("\n");
        deliverablesSummary = `The Seller shall deliver the items specified under Quotation Reference ${quote.request_number || quote.quotation_number || ""}:\n${quoteItems}`;
    } else {
        deliverablesSummary = `The Seller shall supply and deliver commercial supplies and logistics materials as detailed in subsequent Purchase Orders issued under this Agreement.`;
    }

    // 2. Pricing synthesis
    let pricingClause = "";
    if (quote?.total_price || quote?.total_amount) {
        const total = Number(quote.total_price || quote.total_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 });
        pricingClause = `Firm-fixed unit pricing established per formal quotation ${quote.request_number || "reference"}. Quoted package value: PHP ${total} (inclusive of applicable statutory taxes). Prices shall remain locked for the duration of the agreed validity period without unilateral escalation.`;
    } else if (otherProducts && otherProducts.length > 0) {
        pricingClause = `Firm-fixed pricing as itemized in the approved Product Schedule. All prices are stated in Philippine Pesos (PHP) inclusive of standard packaging and delivery unless otherwise stipulated. Prices remain fixed for 12 months.`;
    } else {
        pricingClause = `Firm-fixed unit pricing as documented in authorized Purchase Orders. Price changes require sixty (60) days prior written justification and mutual agreement.`;
    }

    // 3. Schedule baselines
    const scheduleClause = `Fulfillment lead time is established at ${leadTime} from the timestamp of Purchase Order acknowledgment. The Seller guarantees dispatch readiness and delivery compliance within agreed operating windows.`;

    // 4. Period of performance
    const validityDays = quote?.price_validity || "365 days";
    const periodClause = `This Agreement takes effect on the Execution Date and shall remain in full force and effect for an initial period of twelve (12) months (${validityDays} pricing validity baseline), subject to annual renewal upon satisfactory performance review.`;

    // 5. Roles & responsibilities
    const rolesClause = `• Buyer (Airship Express): Responsible for providing timely Purchase Orders, clear delivery access instructions, prompt inspection of received goods, and remittance within ${paymentTerms}.\n• Seller (${supplierName}): Represented by ${contactPerson}. Responsible for maintaining sufficient safety buffer stocks, product compliance, batch trace labels, and safe freight transit.`;

    // 6. Seller place of performance
    const placeOfPerfClause = `Primary manufacture, assembly, quality control, and dispatch shall take place at ${sellerAddress}. Any relocation or change of fulfillment hub must be reported to Buyer within 14 calendar days.`;

    // 7. Payment terms
    const paymentClause = `Payment shall be rendered under terms of ${paymentTerms} via ${paymentMethod}. Seller shall submit official Sales Invoices, Delivery Receipts, and receiving certificates for billing settlement.`;

    // 8. Place of delivery
    const placeOfDeliveryClause = `All shipments shall be consigned DDP (Delivered Duty Paid) to Airship Express Central Sorting & Distribution Hub, or secondary site explicitly designated on the individual Purchase Order. Receiving hours: Monday - Saturday 08:00 to 17:00 PHT.`;

    // 9. Inspection and acceptance
    const inspectionClause = `Delivered consignments are subject to physical inspection and quantity verification by Airship Express Quality Control within seventy-two (72) hours of arrival. Any non-conforming, expired, or damaged items will be held for Seller's immediate pickup and credit/replacement.`;

    // 10. Warranty
    const warrantyClause = `${warranty}. The Seller guarantees that all delivered goods are brand new, free of latent defects, and fit for intended commercial use. Defective units shall be replaced at zero cost to Buyer within seven (7) business days.`;

    // 11. Product support
    const productSupportClause = `The Seller shall provide continuous post-delivery technical and account support. Response to operational inquiries, product safety datasheets (SDS), or Return Merchandise Authorizations (RMA) shall be furnished within 24 business hours.`;

    // 12. Limitation of liability
    const liabilityClause = `Except for gross negligence, willful misconduct, or breach of confidentiality, either party's aggregate liability under this Agreement shall not exceed the aggregate amounts paid or payable by Buyer to Seller over the preceding twelve (12) months. Neither party shall be liable for indirect, incidental, or consequential damages.`;

    // 13. Fees & retainer
    const feesClause = `No retainer or subscription fees apply. Quoted unit pricing is inclusive of freight, palletization, and standard handling unless explicitly separated on the accepted Purchase Order.`;

    // 14. Performance reporting
    const reportingClause = `Monthly Supplier Performance Scorecard evaluating On-Time In-Full (OTIF) fulfillment rate (target: >= 95%), invoice accuracy, defect rate (< 0.5%), and customer responsiveness. Quarterly business reviews (QBR) may be convened for strategic suppliers.`;

    // 15. Penalties
    const penaltiesClause = `Liquidated damages of 0.5% of the affected Purchase Order line item value per calendar day of unexcused delivery delay, up to a maximum cap of 10% of the relevant Purchase Order value. Repeated delays may trigger default proceedings.`;

    // 16. Incentives
    const incentivesClause = `Suppliers maintaining an average quarterly OTIF score of 98% or higher with zero critical quality rejections will receive Preferred Supplier tier status, front-line priority for annual contract expansion, and accelerated invoice approval.`;

    // 17. Insurance & performance bonds
    const insuranceClause = `Seller warrants that it maintains Comprehensive General Liability and In-Transit Cargo Insurance adequate to cover full replacement value of all goods during transportation until formal dock acceptance.`;

    // 18. Subcontractor approvals
    const subconClause = `The Seller shall not assign, delegate, or subcontract the manufacture, assembly, or supply of deliverables without prior written authorization from Airship Express Procurement Management.`;

    // 19. Change request handling
    const changeClause = `Either party may request modifications to order scope, quantities, delivery locations, or timelines via formal written Change Order. No price or schedule variation shall be binding until executed by authorized signatories of both parties.`;

    // 20. Termination & ADR
    const terminationClause = `• Termination: Either party may terminate for convenience with thirty (30) calendar days prior written notice. Immediate termination is permitted upon material breach remaining uncured after fifteen (15) days written notice.\n• Alternative Dispute Resolution (ADR): All disputes shall initially be addressed through good-faith executive negotiation. If unresolved within thirty (30) days, disputes shall be submitted to mediation under PDRCI (Philippine Dispute Resolution Center, Inc.) rules, followed by final and binding arbitration in Metro Manila, Philippines.`;

    return {
        sow_deliverables: deliverablesSummary,
        schedule_baselines: scheduleClause,
        performance_reporting: reportingClause,
        period_of_performance: periodClause,
        roles_responsibilities: rolesClause,
        seller_place_of_performance: placeOfPerfClause,
        pricing: pricingClause,
        payment_terms: paymentClause,
        place_of_delivery: placeOfDeliveryClause,
        inspection_acceptance_criteria: inspectionClause,
        warranty: warrantyClause,
        product_support: productSupportClause,
        limitation_of_liability: liabilityClause,
        fees_retainer: feesClause,
        penalties: penaltiesClause,
        incentives: incentivesClause,
        insurance_performance_bonds: insuranceClause,
        subcontractor_approvals: subconClause,
        change_request_handling: changeClause,
        termination_and_adr: terminationClause,
    };
}

