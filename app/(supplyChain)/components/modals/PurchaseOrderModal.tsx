"use client";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/services/client/supabase";
import { user } from "../../lib/services/Class/user";
import { buildEmailTemplate } from "../../(pages)/procurement/api/send-email/template";
import { PurchaseRequestItem, PurchaseOrderModalProps } from "../../(pages)/procurement/types/index";
import { parseQuotationNotes } from "../../(pages)/suppliers/utils/termsParser";
import { AppButton } from "../ui/AppButton";
import Portal from "../client/Portal";
import { 
    MapPin, 
    Calendar, 
    CreditCard, 
    FileText, 
    Sparkles, 
    Building2, 
    Tag, 
    Percent, 
    DollarSign, 
    RefreshCw, 
    ShieldCheck, 
    Clock, 
    Truck, 
    Layers,
    Receipt,
    Maximize2,
    Package,
    ShoppingBag,
    ChevronDown,
    ChevronUp,
    Check,
    Info,
    X
} from "lucide-react";

export const DEFAULT_DELIVERY_LOCATION = "352 Escolta St, Binondo, Manila, 1006 Metro Manila";
export const DEFAULT_PAYMENT_TERMS = "Net 30 Days (Standard B2B)";
export const DEFAULT_WARRANTY_TERMS = "1-Year Replacement Warranty";
export const DEFAULT_PRICE_VALIDITY = "30 Days Validity";
export const DEFAULT_DELIVERY_TERMS = "Door-to-Door Delivery (Airship Manila DDP)";
export const DEFAULT_TERMS_AND_CONDITIONS = "1. All goods supplied are guaranteed brand new and authentic.\n2. Official BIR Invoice and Receipt must be provided upon delivery.\n3. Defective items will be replaced free of charge within 48 hours.";

export function PurchaseOrderModal({
    isOpen,
    onClose,
    request,
    suppliers = [],
    onOrderCreated,
    defaultAdminApproval,
}: PurchaseOrderModalProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [submitting, setSubmitting] = useState(false);
    
    // Direct PO Supplier selection
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
    const [selectedSupplierName, setSelectedSupplierName] = useState<string>('');
    const [generatedPoNumber, setGeneratedPoNumber] = useState<string>('');

    // Email template mode: 'standard' | 'ai'
    const [emailMode, setEmailMode] = useState<'standard' | 'ai'>('standard');
    const [aiMessage, setAiMessage] = useState('');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    
    const [supplierEmail, setSupplierEmail] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [poCreated, setPoCreated] = useState(false);
    const [isLoadingSupplierData, setIsLoadingSupplierData] = useState(false);
    
    // Products to Supply (Catalog from Supplier Review & Activation)
    const [availableSupplierProducts, setAvailableSupplierProducts] = useState<any[]>([]);
    const [showProductCatalogPicker, setShowProductCatalogPicker] = useState(false);
    
    // Expand / Full View Modal state
    const [isFullPreviewOpen, setIsFullPreviewOpen] = useState(false);
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
    const [matchedQuoteId, setMatchedQuoteId] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            setGeneratedPoNumber((prev) => prev || `PO-${Date.now().toString().slice(-6)}`);
        } else {
            setGeneratedPoNumber('');
        }
    }, [isOpen, request?.id]);

    const poNumber = generatedPoNumber || 'PO-000000';

    const getAiCacheKey = (reqId?: string, poNum?: string) => {
        if (reqId) return `po_ai_compose_req_${reqId}`;
        if (poNum) return `po_ai_compose_po_${poNum}`;
        return 'po_ai_compose_temp';
    };

    const [dbDefaultTerms, setDbDefaultTerms] = useState<string>('');

    const [formData, setFormData] = useState({
        category: "",
        delivery_date: "",
        delivery_location: DEFAULT_DELIVERY_LOCATION,
        payment_terms: DEFAULT_PAYMENT_TERMS,
        warranty_terms: DEFAULT_WARRANTY_TERMS,
        price_validity: DEFAULT_PRICE_VALIDITY,
        delivery_terms: DEFAULT_DELIVERY_TERMS,
        terms_and_conditions: "",
        discount: 0,
        shipping_fee: 0,
        tax_rate: 12,
        notes: "",
        items: [] as Array<
            PurchaseRequestItem & {
                unit_price: number;
                total: number;
                unit?: string;
            }
        >,
    });

    // Pure Line Items Subtotal (without VAT or discount)
    const lineItemsSubtotal = useMemo(() => {
        return formData.items.reduce((sum, item) => {
            const qty = Number(item.quantity) || 1;
            const price = Number(item.unit_price ?? item.price ?? 0);
            return sum + (item.total ? Number(item.total) : qty * price);
        }, 0);
    }, [formData.items]);

    // Financial calculations performed strictly in Financial Summary & Tax Calculation
    const discountAmount = useMemo(() => {
        return Math.max(0, Number(formData.discount) || 0);
    }, [formData.discount]);

    const shippingFee = useMemo(() => {
        return Math.max(0, Number(formData.shipping_fee) || 0);
    }, [formData.shipping_fee]);

    const taxableAmount = useMemo(() => {
        return Math.max(0, lineItemsSubtotal - discountAmount);
    }, [lineItemsSubtotal, discountAmount]);

    const taxRate = useMemo(() => {
        return Math.max(0, Number(formData.tax_rate) || 0);
    }, [formData.tax_rate]);

    const taxAmount = useMemo(() => {
        return Number(((taxableAmount * taxRate) / 100).toFixed(2));
    }, [taxableAmount, taxRate]);

    const calculatedGrandTotal = useMemo(() => {
        return Number((taxableAmount + taxAmount + shippingFee).toFixed(2));
    }, [taxableAmount, taxAmount, shippingFee]);

    const totalAmount = calculatedGrandTotal > 0 ? calculatedGrandTotal : (Number(request?.amount) || 0);

    const activeSupplierName = request?.supplier_name || selectedSupplierName || 'Supplier';

    // Auto-fill form strictly based on the supplier's actual data in Supabase
    const autoFillSupplierDetails = useCallback(async (supplierId: string, currentReq?: any) => {
        if (!supplierId) return;
        setIsLoadingSupplierData(true);
        try {
            // 1. Fetch supplier record from suppliers table
            const { data: supplierData } = await supabase
                .from('suppliers')
                .select('*')
                .eq('id', supplierId)
                .maybeSingle();

            // 2. Fetch latest quotation if available
            let quoteData: any = null;
            try {
                const { data: qData } = await supabase
                    .from('supplier_quotations')
                    .select('*')
                    .eq('supplier_id', supplierId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                quoteData = qData;
                if (qData?.id) {
                    setMatchedQuoteId(Number(qData.id));
                }
            } catch (qErr) {
                console.warn('Could not query supplier quotation:', qErr);
            }

            // Sync supplier email and name
            if (supplierData) {
                setSelectedSupplierName(supplierData.name || '');
                setSupplierEmail(supplierData.email || '');
            }

            // Calculate auto-delivery date ONLY if supplier or quote has a lead time recorded
            let autoDeliveryDate = "";
            const leadTimeStr = quoteData?.lead_time_days || supplierData?.lead_time || supplierData?.lead_time_days || "";
            if (leadTimeStr) {
                const leadDaysMatch = String(leadTimeStr).match(/\d+/);
                const leadDays = leadDaysMatch ? parseInt(leadDaysMatch[0], 10) : 0;
                if (leadDays > 0) {
                    const targetDate = new Date();
                    targetDate.setDate(targetDate.getDate() + leadDays);
                    autoDeliveryDate = targetDate.toISOString().split("T")[0];
                }
            }

            // Extract structured terms and governing clauses directly from quotation notes and database
            const parsedQuote = quoteData?.notes ? parseQuotationNotes(quoteData.notes, quoteData) : null;
            const parsedSupplier = supplierData?.notes ? parseQuotationNotes(supplierData.notes) : null;

            let dbTermsForSupplier = parsedQuote?.clauses || parsedSupplier?.clauses || "";

            // Query purchase_orders table for previously agreed terms with this supplier
            if (!dbTermsForSupplier && supplierId) {
                try {
                    const { data: poForSupplier } = await supabase
                        .from('purchase_orders')
                        .select('terms_and_conditions')
                        .eq('supplier_id', supplierId)
                        .not('terms_and_conditions', 'is', null)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (poForSupplier?.terms_and_conditions) {
                        dbTermsForSupplier = poForSupplier.terms_and_conditions;
                    }
                } catch (poErr) {
                    console.warn('Could not query supplier PO terms from database:', poErr);
                }
            }

            // If not found yet, query the most recent purchase order in database
            if (!dbTermsForSupplier) {
                try {
                    const { data: globalPo } = await supabase
                        .from('purchase_orders')
                        .select('terms_and_conditions')
                        .not('terms_and_conditions', 'is', null)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (globalPo?.terms_and_conditions) {
                        dbTermsForSupplier = globalPo.terms_and_conditions;
                    }
                } catch (gErr) {
                    console.warn('Could not query latest PO terms from database:', gErr);
                }
            }

            // Populate category, payment terms, warranty, price validity, delivery terms from supplier or quote
            const autoCategory = supplierData?.category || quoteData?.category || "";
            const autoPaymentTerms = parsedQuote?.paymentTerms || supplierData?.payment_terms || quoteData?.payment_terms || DEFAULT_PAYMENT_TERMS;
            const autoWarrantyTerms = parsedQuote?.warrantyTerms || supplierData?.warranty || quoteData?.warranty_terms || DEFAULT_WARRANTY_TERMS;
            const autoPriceValidity = parsedQuote?.priceValidity || quoteData?.price_validity || DEFAULT_PRICE_VALIDITY;
            const autoDeliveryTerms = parsedQuote?.deliveryTerms || supplierData?.delivery_terms || quoteData?.delivery_terms || DEFAULT_DELIVERY_TERMS;
            const autoTermsAndConditions = dbTermsForSupplier || dbDefaultTerms || "";
            const autoNotes = parsedQuote?.cleanNotes || quoteData?.notes || supplierData?.notes || "";

            // Extract Products to Supply from Supplier Review & Activation (other_products_offer)
            const rawSupplierOther = Array.isArray(supplierData?.other_products_offer)
                ? supplierData.other_products_offer
                : (typeof supplierData?.other_products_offer === 'string'
                    ? (() => { try { return JSON.parse(supplierData.other_products_offer); } catch { return []; } })()
                    : []);

            const rawQuoteOther = Array.isArray(quoteData?.other_products_offer)
                ? quoteData.other_products_offer
                : (typeof quoteData?.other_products_offer === 'string'
                    ? (() => { try { return JSON.parse(quoteData.other_products_offer); } catch { return []; } })()
                    : []);

            const catalogProducts: any[] = [];
            const seenNames = new Set<string>();

            // 1. Add primary quotation item if available
            const primaryQuoteItem = (quoteData?.item_name || "").trim();
            if (primaryQuoteItem) {
                seenNames.add(primaryQuoteItem.toLowerCase());
                catalogProducts.push({
                    id: `quote_primary_${quoteData.id || 0}`,
                    item_name: primaryQuoteItem,
                    unit: quoteData.unit || "unit",
                    unit_price: Number(quoteData.unit_price) || 0,
                    discount: Number(quoteData.discount) || 0,
                    shipping_fee: Number(quoteData.shipping_fee) || 0,
                    tax_rate: quoteData.tax_rate !== undefined ? Number(quoteData.tax_rate) : 12,
                    notes: quoteData.notes || `Primary quotation product`,
                    source: 'Quotation Award',
                });
            }

            // 2. Add items from supplier's approved other_products_offer (Supplier Review & Activation: 3. Products to Supply)
            [...rawSupplierOther, ...rawQuoteOther].forEach((p: any, idx: number) => {
                const name = String(p.item_name || p.name || "").trim();
                if (!name || seenNames.has(name.toLowerCase())) return;
                seenNames.add(name.toLowerCase());
                catalogProducts.push({
                    id: p.id || `catalog_${idx}_${Date.now()}`,
                    item_name: name,
                    unit: p.unit || "unit",
                    unit_price: Number(p.unit_price ?? p.price ?? 0),
                    discount: Number(p.discount || 0),
                    shipping_fee: Number(p.shipping_fee || 0),
                    tax_rate: p.tax_rate !== undefined ? Number(p.tax_rate) : 12,
                    notes: p.notes || "",
                    source: '3. Products to Supply (Catalog)',
                });
            });

            // 3. Add any additional products listed as comma/newline separated in supplierData.products
            if (supplierData?.products) {
                const list = String(supplierData.products).split(/[,;\n]/).map((p: string) => p.trim()).filter(Boolean);
                list.forEach((pName: string, idx: number) => {
                    if (!seenNames.has(pName.toLowerCase())) {
                        seenNames.add(pName.toLowerCase());
                        catalogProducts.push({
                            id: `prod_str_${idx}_${Date.now()}`,
                            item_name: pName,
                            unit: "unit",
                            unit_price: 0,
                            discount: 0,
                            shipping_fee: 0,
                            tax_rate: 12,
                            notes: "",
                            source: 'Supplier Product List',
                        });
                    }
                });
            }

            setAvailableSupplierProducts(catalogProducts);

            // Populate items strictly if quoteData or supplierData actually has items/products recorded
            let autoItems: any[] = [];
            if (!currentReq) {
                if (quoteData?.item_name) {
                    const qQty = Number(quoteData.quantity) || 1;
                    const qPrice = Number(quoteData.unit_price) || 0;
                    autoItems = [{
                        name: quoteData.item_name,
                        item_name: quoteData.item_name,
                        quantity: qQty,
                        unit_price: qPrice,
                        total: qQty * qPrice,
                        unit: quoteData.unit || "units",
                    }];
                } else if (catalogProducts.length > 0) {
                    autoItems = catalogProducts.slice(0, 3).map((prod: any) => ({
                        name: prod.item_name,
                        item_name: prod.item_name,
                        quantity: 1,
                        unit_price: prod.unit_price || 0,
                        total: (prod.unit_price || 0) * 1,
                        unit: prod.unit || "units",
                    }));
                } else if (supplierData?.products) {
                    const productList = supplierData.products.split(/[,;\n]/).map((p: string) => p.trim()).filter(Boolean);
                    if (productList.length > 0) {
                        autoItems = productList.slice(0, 3).map((prod: string) => ({
                            name: prod,
                            item_name: prod,
                            quantity: 1,
                            unit_price: 0,
                            total: 0,
                        }));
                    }
                }
            }

            const autoDiscount = quoteData?.discount ? Number(quoteData.discount) : 0;
            const autoShippingFee = quoteData?.shipping_fee !== undefined && quoteData?.shipping_fee !== null 
                ? Number(quoteData.shipping_fee) 
                : (supplierData?.shipping_fee ? Number(supplierData.shipping_fee) : 0);
            const autoTaxRate = quoteData?.tax_rate !== undefined && quoteData?.tax_rate !== null ? Number(quoteData.tax_rate) : 12;

            setFormData(prev => ({
                ...prev,
                category: autoCategory || prev.category,
                delivery_location: DEFAULT_DELIVERY_LOCATION,
                delivery_date: autoDeliveryDate || prev.delivery_date,
                payment_terms: autoPaymentTerms,
                warranty_terms: autoWarrantyTerms,
                price_validity: autoPriceValidity,
                delivery_terms: autoDeliveryTerms,
                terms_and_conditions: autoTermsAndConditions,
                discount: autoDiscount,
                shipping_fee: autoShippingFee,
                tax_rate: autoTaxRate,
                notes: autoNotes || prev.notes,
                items: currentReq 
                    ? prev.items 
                    : (autoItems.length > 0 ? autoItems : [{ name: "", item_name: "", quantity: 1, unit_price: 0, total: 0 } as any]),
            }));

            } catch (err) {
                console.error('Error auto-filling supplier data:', err);
            } finally {
                setIsLoadingSupplierData(false);
            }
        }, [dbDefaultTerms]);

    const prevInitKeyRef = useRef<string>('');

    useEffect(() => {
        if (!isOpen) {
            prevInitKeyRef.current = '';
            return;
        }

        const currentInitKey = `${request?.id || 'direct'}_${request?.supplier_id || ''}_${request?.amount || 0}`;
        if (prevInitKeyRef.current === currentInitKey) {
            return;
        }
        prevInitKeyRef.current = currentInitKey;

        if (request) {
            setSelectedSupplierId(request.supplier_id || '');
            setSelectedSupplierName(request.supplier_name || '');
            const rawItems = request.items || [];
            const reqAmount = Number(request.amount) || 0;
            let mappedItems = rawItems.map((item: any) => {
                const itemName = item.item_name || item.name || item.description || request.description || request.type || 'Inventory Item';
                const quantity = Math.max(1, Number(item.quantity) || 1);
                let unit_price = Number(item.unit_price ?? item.price ?? item.purchase_price ?? 0);
                if (unit_price <= 0 && reqAmount > 0 && rawItems.length === 1) {
                    unit_price = reqAmount / quantity;
                }
                const total = unit_price > 0 ? unit_price * quantity : 0;
                return {
                    ...item,
                    name: itemName,
                    item_name: itemName,
                    quantity,
                    unit_price,
                    total,
                };
            });

            if (mappedItems.length === 0) {
                const defaultName = request.description || request.type || "General Request Item";
                mappedItems = [{
                    name: defaultName,
                    item_name: defaultName,
                    quantity: 1,
                    unit_price: reqAmount > 0 ? reqAmount : 0,
                    total: reqAmount > 0 ? reqAmount : 0,
                }];
            }

            const totalFromItems = mappedItems.reduce((sum, it) => sum + it.total, 0);
            if (totalFromItems === 0 && reqAmount > 0 && mappedItems.length > 0) {
                const perItemTotal = reqAmount / mappedItems.length;
                mappedItems.forEach((it) => {
                    it.unit_price = Number((perItemTotal / it.quantity).toFixed(2));
                    it.total = Number((it.unit_price * it.quantity).toFixed(2));
                });
            }

            const targetDelivery = new Date();
            targetDelivery.setDate(targetDelivery.getDate() + 3);

            setFormData({
                category: "",
                delivery_date: targetDelivery.toISOString().split("T")[0],
                delivery_location: DEFAULT_DELIVERY_LOCATION,
                payment_terms: DEFAULT_PAYMENT_TERMS,
                warranty_terms: DEFAULT_WARRANTY_TERMS,
                price_validity: DEFAULT_PRICE_VALIDITY,
                delivery_terms: DEFAULT_DELIVERY_TERMS,
                terms_and_conditions: dbDefaultTerms || "",
                discount: 0,
                shipping_fee: 0,
                tax_rate: 12,
                notes: "",
                items: mappedItems,
            });
            setStep(1);
            setSupplierEmail('');
            setPoCreated(false);

            // Check localStorage for previously composed AI content
            const cacheKey = getAiCacheKey(request.id, poNumber);
            const cachedAi = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null;
            if (cachedAi) {
                setAiMessage(cachedAi);
                setEmailMode('ai');
            } else {
                setAiMessage('');
                setEmailMode('standard');
            }

            if (request.supplier_id) {
                autoFillSupplierDetails(request.supplier_id, request);
            }
        } else {
            // Direct PO Creation Mode without request
            const initialSupplier = suppliers[0];
            const initialId = initialSupplier?.id || '';
            const initialName = initialSupplier?.name || '';
            setSelectedSupplierId(initialId);
            setSelectedSupplierName(initialName);

            const targetDelivery = new Date();
            targetDelivery.setDate(targetDelivery.getDate() + 3);

            setFormData({
                category: initialSupplier?.category || "",
                delivery_date: targetDelivery.toISOString().split("T")[0],
                delivery_location: DEFAULT_DELIVERY_LOCATION,
                payment_terms: DEFAULT_PAYMENT_TERMS,
                warranty_terms: DEFAULT_WARRANTY_TERMS,
                price_validity: DEFAULT_PRICE_VALIDITY,
                delivery_terms: DEFAULT_DELIVERY_TERMS,
                terms_and_conditions: dbDefaultTerms || "",
                discount: 0,
                shipping_fee: 0,
                tax_rate: 12,
                notes: "",
                items: [
                    {
                        name: "",
                        item_name: "",
                        quantity: 1,
                        unit_price: 0,
                        total: 0,
                    } as any,
                ],
            });
            setStep(1);
            setPoCreated(false);
            setAiMessage('');
            setEmailMode('standard');

            if (initialId) {
                autoFillSupplierDetails(initialId, null);
            } else if (initialSupplier?.email) {
                setSupplierEmail(initialSupplier.email);
            }
        }
    }, [isOpen, request?.id, request?.supplier_id, request?.amount, suppliers, dbDefaultTerms, autoFillSupplierDetails]);

    // Query active terms directly from the database (purchase_orders / quotation notes)
    useEffect(() => {
        let isMounted = true;
        async function fetchDbTerms() {
            try {
                // 1. Fetch from latest purchase order with terms in Supabase
                const { data: latestPo } = await supabase
                    .from('purchase_orders')
                    .select('terms_and_conditions')
                    .not('terms_and_conditions', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (latestPo?.terms_and_conditions && isMounted) {
                    setDbDefaultTerms(latestPo.terms_and_conditions);
                    setFormData(prev => {
                        if (!prev.terms_and_conditions) {
                            return { ...prev, terms_and_conditions: latestPo.terms_and_conditions };
                        }
                        return prev;
                    });
                    return;
                }

                // 2. Fetch from latest supplier quotation with clauses in Supabase
                const { data: latestQuote } = await supabase
                    .from('supplier_quotations')
                    .select('notes')
                    .not('notes', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (latestQuote?.notes && isMounted) {
                    const parsed = parseQuotationNotes(latestQuote.notes);
                    if (parsed.clauses) {
                        setDbDefaultTerms(parsed.clauses);
                        setFormData(prev => {
                            if (!prev.terms_and_conditions) {
                                return { ...prev, terms_and_conditions: parsed.clauses };
                            }
                            return prev;
                        });
                    }
                }
            } catch (err) {
                console.warn('Could not load terms from database:', err);
            }
        }
        if (isOpen) {
            fetchDbTerms();
        }
        return () => { isMounted = false; };
    }, [isOpen]);

    const handleSupplierSelect = (supplierId: string) => {
        setSelectedSupplierId(supplierId);
        const sup = suppliers.find(s => String(s.id) === String(supplierId));
        if (sup) {
            setSelectedSupplierName(sup.name);
            setSupplierEmail(sup.email || '');
        }
        autoFillSupplierDetails(supplierId, request);
    };

    const handleAddItem = () => {
        setFormData((prev) => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    name: "",
                    item_name: "",
                    quantity: 1,
                    unit_price: 0,
                    total: 0,
                } as any,
            ],
        }));
    };

    const handleRemoveItem = (index: number) => {
        if (formData.items.length <= 1) {
            toast.warning("A purchase order requires at least one item.");
            return;
        }
        setFormData((prev) => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index),
        }));
    };

    const handleSelectProductFromCatalog = (catalogItem: any, targetIndex?: number) => {
        const itemPrice = Number(catalogItem.unit_price) || 0;
        const itemName = catalogItem.item_name || catalogItem.name || '';
        const itemUnit = catalogItem.unit || 'units';

        setFormData((prev) => {
            const next = [...prev.items];
            if (targetIndex !== undefined && targetIndex >= 0 && targetIndex < next.length) {
                const qty = next[targetIndex].quantity || 1;
                next[targetIndex] = {
                    ...next[targetIndex],
                    name: itemName,
                    item_name: itemName,
                    unit_price: itemPrice,
                    unit: itemUnit,
                    total: Number((qty * itemPrice).toFixed(2)),
                };
            } else {
                // If the only item is blank with 0 price, overwrite it
                const isOnlyBlank = next.length === 1 && (!next[0].name && !next[0].item_name) && (!next[0].unit_price || next[0].unit_price === 0);
                const newItem = {
                    name: itemName,
                    item_name: itemName,
                    quantity: 1,
                    unit_price: itemPrice,
                    unit: itemUnit,
                    total: itemPrice,
                } as any;

                if (isOnlyBlank) {
                    next[0] = newItem;
                } else {
                    next.push(newItem);
                }
            }
            return { ...prev, items: next };
        });

        toast.success(`Selected "${itemName}" from Supplier's Products to Supply Catalog`);
    };

    const handleItemChange = (index: number, field: 'name' | 'quantity' | 'unit_price', val: any) => {
        setFormData((prev) => {
            const next = [...prev.items];
            const item = { ...next[index] };
            if (field === 'name') {
                item.name = val;
                item.item_name = val;
                // Auto-fill price if matched in supplier catalog
                const matched = availableSupplierProducts.find(
                    p => (p.item_name || '').trim().toLowerCase() === String(val).trim().toLowerCase()
                );
                if (matched && Number(matched.unit_price) > 0) {
                    item.unit_price = Number(matched.unit_price);
                    item.unit = matched.unit || item.unit || "units";
                    item.total = Number(((item.quantity || 1) * Number(matched.unit_price)).toFixed(2));
                }
            } else if (field === 'quantity') {
                const qty = Math.max(1, parseInt(val) || 1);
                item.quantity = qty;
                item.total = Number(((item.unit_price || 0) * qty).toFixed(2));
            } else if (field === 'unit_price') {
                const price = Math.max(0, parseFloat(val) || 0);
                item.unit_price = price;
                item.total = Number(((item.quantity || 1) * price).toFixed(2));
            }
            next[index] = item;
            return { ...prev, items: next };
        });
    };

    const handleAiTextChange = (text: string) => {
        setAiMessage(text);
        const reqKey = request ? request.id : undefined;
        const cacheKey = getAiCacheKey(reqKey, poNumber);
        if (typeof window !== 'undefined') {
            localStorage.setItem(cacheKey, text);
        }
    };

    const handleClearAiCache = () => {
        const reqKey = request ? request.id : undefined;
        const cacheKey = getAiCacheKey(reqKey, poNumber);
        if (typeof window !== 'undefined') {
            localStorage.removeItem(cacheKey);
        }
        setAiMessage('');
        setEmailMode('standard');
        toast.info('Cleared cached AI composition.');
    };

    const handleNext = () => {
        if (!request && !selectedSupplierId) {
            toast.warning("Please select a Supplier for this purchase order.");
            return;
        }
        if (formData.items.length === 0) {
            toast.warning("Please add at least one line item.");
            return;
        }
        const hasEmptyName = formData.items.some(it => !(it.name || it.item_name)?.trim());
        if (hasEmptyName) {
            toast.warning("Please enter a description/name for all line items.");
            return;
        }
        if (totalAmount <= 0) {
            toast.warning("Total order amount must be greater than ₱0.00.");
            return;
        }
        if (!formData.delivery_date) {
            toast.warning("Please select an Expected Delivery Date.");
            return;
        }
        if (!formData.delivery_location?.trim()) {
            toast.warning("Please specify a Delivery Location.");
            return;
        }
        setStep(2);
    };

    const handleBack = () => setStep(1);

    const generateAIMessage = async () => {
        setIsGeneratingAI(true);
        try {
            const response = await fetch('/procurement/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    supplier_name: activeSupplierName,
                    category: formData.category,
                    items: formData.items,
                    subtotal: lineItemsSubtotal,
                    discount: discountAmount,
                    shipping_fee: shippingFee,
                    tax_rate: taxRate,
                    tax_amount: taxAmount,
                    total_amount: totalAmount,
                    delivery_date: formData.delivery_date,
                    delivery_location: formData.delivery_location,
                    payment_terms: formData.payment_terms,
                    warranty_terms: formData.warranty_terms,
                    delivery_terms: formData.delivery_terms,
                    price_validity: formData.price_validity,
                    po_number: poNumber,
                    notes: formData.notes,
                    sender_name: user.getName(),
                    sender_position: user.getRole(),
                }),
            });

            const data = await response.json();
            if (data.success) {
                setAiMessage(data.message);
                setEmailMode('ai');
                const reqKey = request ? request.id : undefined;
                const cacheKey = getAiCacheKey(reqKey, poNumber);
                if (typeof window !== 'undefined') {
                    localStorage.setItem(cacheKey, data.message);
                }
                toast.success('AI message generated & saved locally!');
            } else {
                toast.error('Failed to generate AI message');
            }
        } catch (error) {
            console.error('Error generating AI message:', error);
            toast.error('Failed to generate AI message');
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const getFullMessage = () => {
        const APP_URL = process.env.NEXT_PUBLIC_SUPPLYCHAIN_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
        const CONFIRM_PATH = process.env.NEXT_PUBLIC_CONFIRM_PATH || '/procurement/confirm';
        const confirmLink = `${APP_URL}${CONFIRM_PATH}?po=${poNumber}`;

        if (emailMode === 'ai' && aiMessage) {
            return `${aiMessage}\n\n---\n\n **Confirm this order:** ${confirmLink}\n\nPlease click the link above to confirm this purchase order.`;
        }

        return `Hello ${activeSupplierName},\n\nPlease review Purchase Order #${poNumber} for a total of ₱${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.\nCategory: ${formData.category || 'General Procurement'}\nExpected Delivery: ${formData.delivery_date || 'Standard Timeline'}\nDelivery Location: ${formData.delivery_location || DEFAULT_DELIVERY_LOCATION}\nTerms: Payment=${formData.payment_terms} | Warranty=${formData.warranty_terms} | Validity=${formData.price_validity} | Delivery=${formData.delivery_terms}\n\n---\n\n Confirm this order: ${confirmLink}`;
    };

    const getSanitizedItems = () => {
        const itemsToProcess = formData.items.length > 0
            ? formData.items
            : [{
                name: request?.description || request?.type || "Purchase Order Item",
                item_name: request?.description || request?.type || "Purchase Order Item",
                quantity: 1,
                unit_price: totalAmount > 0 ? totalAmount : 0,
                total: totalAmount > 0 ? totalAmount : 0,
            }];

        return itemsToProcess.map((item: any) => {
            const itemName = item.item_name || item.name || item.description || request?.description || request?.type || "Inventory Item";
            const quantity = Math.max(1, Number(item.quantity) || 1);
            const unit_price = Number(item.unit_price ?? item.price ?? 0);
            const total = item.total ? Number(item.total) : Number((quantity * unit_price).toFixed(2));
            return {
                ...item,
                name: itemName,
                item_name: itemName,
                quantity,
                unit_price,
                total,
            };
        });
    };

    const createPurchaseOrder = async (status: 'Draft' | 'Sent' = 'Sent'): Promise<boolean> => {
        if (!formData.delivery_date) {
            toast.warning("Please select an Expected Delivery Date.");
            return false;
        }
        if (!request && !selectedSupplierId) {
            toast.warning("Please select a Supplier.");
            return false;
        }
        if (poCreated) return true;

        try {
            const sanitizedItems = getSanitizedItems();
            const targetSupplierId = request?.supplier_id || selectedSupplierId;
            const targetSupplierName = request?.supplier_name || selectedSupplierName || 'Supplier';

            // Compile all commercial terms into terms_and_conditions if needed
            const structuredTermsSummary = `Payment=${formData.payment_terms || DEFAULT_PAYMENT_TERMS} | Warranty=${formData.warranty_terms || DEFAULT_WARRANTY_TERMS} | Validity=${formData.price_validity || DEFAULT_PRICE_VALIDITY} | Delivery=${formData.delivery_terms || DEFAULT_DELIVERY_TERMS}`;
            const fullTerms = formData.terms_and_conditions 
                ? `${formData.terms_and_conditions}\n\n[Commercial Terms: ${structuredTermsSummary}]`
                : (dbDefaultTerms 
                    ? `${dbDefaultTerms}\n\n[Commercial Terms: ${structuredTermsSummary}]`
                    : `[Commercial Terms: ${structuredTermsSummary}]`);

            const orderData = {
                po_number: poNumber,
                request_id: request?.id || null,
                supplier_id: targetSupplierId,
                suppliers_qoutation_bid: matchedQuoteId || (request as any)?.suppliers_qoutation_bid || (request as any)?.quotation_id || null,
                supplier_name: targetSupplierName,
                category: formData.category,
                subtotal: lineItemsSubtotal,
                discount: discountAmount,
                shipping_fee: shippingFee,
                tax_rate: taxRate,
                tax_amount: taxAmount,
                total_amount: totalAmount,
                status: status,
                delivery_date: formData.delivery_date,
                delivery_location: formData.delivery_location || DEFAULT_DELIVERY_LOCATION,
                payment_terms: formData.payment_terms || DEFAULT_PAYMENT_TERMS,
                terms_and_conditions: fullTerms,
                notes: formData.notes,
                items: sanitizedItems,
                created_by: user.getName(),
                admin_approval: defaultAdminApproval || (request as any)?.admin_approval || 'Approved',
                financial_approval: (request as any)?.financial_approval || 'Pending',
            };

            await onOrderCreated?.(orderData);
            setPoCreated(true);
            return true;
        } catch (error) {
            console.error('Error creating PO:', error);
            toast.error('Failed to create Purchase Order');
            return false;
        }
    };

    const handleEmail = async () => {
        const emailTo = supplierEmail.trim();
        if (!emailTo) {
            toast.warning('Please enter a valid supplier email address.');
            return;
        }
        if (isSending) return;

        const toastId = toast.loading('Preparing email...', {
            duration: Infinity,
            position: 'top-center',
        });
        setIsSending(true);

        try {
            toast.loading('Creating Purchase Order...', {
                id: toastId,
                duration: Infinity,
            });
            const poCreatedSuccess = await createPurchaseOrder('Sent');
            if (!poCreatedSuccess) {
                toast.error('Failed to create Purchase Order', {
                    id: toastId,
                    duration: 5000,
                });
                setIsSending(false);
                return;
            }

            toast.info(`Sending email to ${emailTo}...`, {
                id: toastId,
                duration: Infinity,
            });

            const fullMessage = getFullMessage();
            const sanitizedItems = getSanitizedItems();
            const APP_URL = process.env.NEXT_PUBLIC_SUPPLYCHAIN_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
            const CONFIRM_PATH = process.env.NEXT_PUBLIC_CONFIRM_PATH || '/procurement/confirm';
            const confirmLink = `${APP_URL}${CONFIRM_PATH}?po=${poNumber}`;

            const emailHtml = buildEmailTemplate({
                poNumber: poNumber,
                supplierName: activeSupplierName,
                items: sanitizedItems,
                subtotal: lineItemsSubtotal,
                discount: discountAmount,
                shippingFee: shippingFee,
                taxRate: taxRate,
                taxAmount: taxAmount,
                totalAmount: totalAmount,
                deliveryDate: formData.delivery_date || 'As agreed in procurement contract',
                deliveryLocation: formData.delivery_location || DEFAULT_DELIVERY_LOCATION,
                paymentTerms: formData.payment_terms || DEFAULT_PAYMENT_TERMS,
                termsAndConditions: formData.terms_and_conditions || dbDefaultTerms || "",
                notes: formData.notes || 'None',
                confirmLink: confirmLink,
                customBodyText: emailMode === 'ai' && aiMessage ? aiMessage : undefined,
                senderName: user.getName(),
                senderRole: user.getRole(),
                senderEmail: process.env.EMAIL_SUPPLYCHAIN_USER || '',
            });

            const response = await fetch('/procurement/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: emailTo,
                    subject: `Purchase Order ${poNumber} - ${activeSupplierName}`,
                    html: emailHtml,
                    text: fullMessage,
                    po_number: poNumber,
                    supplier_name: activeSupplierName,
                }),
            });

            const data = await response.json();

            if (data.success) {
                toast.success(`PO Created & Email dispatched to ${emailTo}!`, {
                    id: toastId,
                    duration: 6000,
                });
                try {
                    await navigator.clipboard.writeText(fullMessage);
                } catch (clipError) {
                    console.warn('Could not copy to clipboard:', clipError);
                }
                setTimeout(() => {
                    setIsSending(false);
                    onClose();
                }, 1500);
            } else {
                throw new Error(data.error || 'Failed to send email');
            }
        } catch (error: any) {
            console.error('Error sending email:', error);
            toast.error(`${error.message || 'Failed to send email. Please try again.'}`, {
                id: toastId,
                duration: 8000,
            });
            setIsSending(false);
        }
    };

    const handleCreatePOOnly = async () => {
        if (isSending || submitting) return;
        setSubmitting(true);
        try {
            const success = await createPurchaseOrder('Draft');
            if (success) {
                toast.success('PO Created successfully as Draft!');
                setTimeout(() => {
                    setSubmitting(false);
                    onClose();
                }, 500);
            } else {
                setSubmitting(false);
            }
        } catch (error) {
            console.error('Error creating PO:', error);
            toast.error('Failed to create PO');
            setSubmitting(false);
        }
    };

    const handleCopyOnly = async () => {
        const fullMessage = getFullMessage();
        try {
            await navigator.clipboard.writeText(fullMessage);
            toast.success('Message copied to clipboard!');
        } catch (error) {
            console.error('Failed to copy:', error);
            toast.error('Failed to copy message');
        }
    };

    if (!isOpen) return null;

    const APP_URL = process.env.NEXT_PUBLIC_SUPPLYCHAIN_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const CONFIRM_PATH = process.env.NEXT_PUBLIC_CONFIRM_PATH || '/procurement/confirm';
    const confirmLink = `${APP_URL}${CONFIRM_PATH}?po=${poNumber}`;

    return (
        <Portal>
            <div className="fixed inset-0 bg-slate-950/70 dark:bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200" onClick={onClose}>
                <div className="bg-[#ebf0f7] dark:bg-[#151620] rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-none border border-slate-200/80 dark:border-white/[0.08] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                    
                    {/* Header */}
                    <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-200/60 dark:border-white/[0.06]">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="w-8 h-8 rounded-2xl bg-white dark:bg-[#1a1b26] border border-white/80 dark:border-white/[0.06] shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[2px_2px_6px_rgba(0,0,0,0.5)] text-pink-600 dark:text-pink-400 flex items-center justify-center">
                                    <i className="fas fa-file-invoice text-sm" />
                                </span>
                                Create Purchase Order
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {request ? (
                                    <>
                                        For request:{" "}
                                        <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                                            {request.request_number}
                                        </span>
                                    </>
                                ) : (
                                    <span>Direct procurement order issuance &amp; vendor contract</span>
                                )}
                            </p>
                        </div>
                        <AppButton type="button" variant="neutral" size="icon-sm" onClick={onClose} aria-label="Close modal">
                            <i className="fas fa-times text-xs" />
                        </AppButton>
                    </div>

                    {/* Step 1: Items & Delivery Details */}
                    {step === 1 && (
                        <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                            
                            {/* Top Info Bar */}
                            {request ? (
                                <div className="bg-[#e9eef6] dark:bg-[#13141d] rounded-2xl p-4 border border-white/60 dark:border-white/[0.04] shadow-[inset_2px_2px_4px_rgba(166,175,195,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6)]">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                                                Supplier
                                            </span>
                                            <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                                                {request.supplier_name}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                                                PO Number
                                            </span>
                                            <p className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                                                {poNumber}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                                                Priority
                                            </span>
                                            <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                                                {request.priority}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                                                Created By
                                            </span>
                                            <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                                                {user.getName()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                                    Select Supplier / Vendor <span className="text-pink-600 dark:text-pink-400 font-bold">*</span>
                                                </label>
                                                {isLoadingSupplierData && (
                                                    <span className="text-[10px] text-pink-600 dark:text-pink-400 flex items-center gap-1 font-semibold">
                                                        <RefreshCw className="w-3 h-3 animate-spin" /> Fetching details...
                                                    </span>
                                                )}
                                            </div>
                                            <div className="relative">
                                                <select
                                                    value={selectedSupplierId}
                                                    onChange={(e) => handleSupplierSelect(e.target.value)}
                                                    className="w-full bg-[#ebf0f7] dark:bg-[#13141d] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500 cursor-pointer"
                                                >
                                                    {suppliers.length === 0 && (
                                                        <option value="">No active suppliers found</option>
                                                    )}
                                                    {suppliers.map((s) => (
                                                        <option key={s.id} value={s.id}>
                                                            {s.name} {s.contact_person ? `(${s.contact_person})` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                                <Sparkles className="w-3 h-3 text-pink-500" />
                                                Selecting a supplier auto-populates their recorded category, address &amp; terms.
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                                                PO Number
                                            </label>
                                            <div className="w-full bg-[#e9eef6] dark:bg-[#13141d] border border-white/60 dark:border-white/[0.04] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-pink-600 dark:text-pink-400 flex items-center justify-between">
                                                <span>{poNumber}</span>
                                                <span className="text-[10px] font-normal text-slate-400">Auto-Generated</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Line Items & Pricing */}
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                            Line Items &amp; Pricing
                                        </label>
                                        {availableSupplierProducts.length > 0 && (
                                            <span className="text-[10px] font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/50 px-2 py-0.5 rounded-full border border-pink-200 dark:border-pink-900/40">
                                                {availableSupplierProducts.length} in Catalog
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {availableSupplierProducts.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setShowProductCatalogPicker(prev => !prev)}
                                                className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                                                    showProductCatalogPicker
                                                        ? "text-white bg-gradient-to-r from-pink-500 to-rose-500 shadow-[0_2px_8px_rgba(244,63,94,0.35)]"
                                                        : "text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40 hover:bg-pink-100 dark:hover:bg-pink-900/50 border border-pink-200 dark:border-pink-800/60"
                                                }`}
                                                title="Browse Products to Supply from Supplier Review & Activation"
                                            >
                                                <Package className="w-3.5 h-3.5" />
                                                <span>3. Products to Supply</span>
                                                {showProductCatalogPicker ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                            </button>
                                        )}
                                        {defaultAdminApproval === 'Pending' ? (
                                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/40 flex items-center gap-1">
                                                <Clock className="w-3 h-3 text-amber-500" /> Admin Approval: Pending
                                            </span>
                                        ) : request ? (
                                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1">
                                                <i className="fas fa-lock text-[9px]" /> Approved Pricing Locked
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleAddItem}
                                                className="px-2.5 py-1 text-xs font-bold text-pink-600 dark:text-pink-400 bg-[#ebf0f7] dark:bg-[#14151e] hover:bg-white dark:hover:bg-slate-800 border border-pink-200/80 dark:border-pink-900/40 shadow-[2px_2px_5px_rgba(166,175,195,0.35),-2px_-2px_5px_rgba(255,255,255,0.9)] rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                            >
                                                <i className="fas fa-plus text-[10px]" />
                                                <span>Add Item</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Supplier Products to Supply Catalog Browser */}
                                {showProductCatalogPicker && availableSupplierProducts.length > 0 && (
                                    <div className="mb-3 p-3.5 bg-pink-50/40 dark:bg-pink-950/20 rounded-2xl border border-pink-200/80 dark:border-pink-800/40 shadow-inner animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1.5">
                                                <ShoppingBag className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                    Supplier Registered Products Catalog (Products to Supply)
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                                Click an item to insert into PO
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                                            {availableSupplierProducts.map((prod, pIdx) => (
                                                <div
                                                    key={prod.id || pIdx}
                                                    onClick={() => handleSelectProductFromCatalog(prod)}
                                                    className="p-2.5 bg-white dark:bg-[#181a26] hover:bg-pink-50 dark:hover:bg-pink-900/30 border border-slate-200/80 dark:border-white/10 hover:border-pink-300 dark:hover:border-pink-700/60 rounded-xl cursor-pointer transition-all group flex flex-col justify-between"
                                                >
                                                    <div>
                                                        <div className="flex items-start justify-between gap-1">
                                                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors line-clamp-1">
                                                                {prod.item_name}
                                                            </span>
                                                            <span className="text-[9px] font-semibold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/60 px-1.5 py-0.5 rounded">
                                                                {prod.unit || "unit"}
                                                            </span>
                                                        </div>
                                                        {prod.notes && (
                                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-1 mt-0.5">
                                                                {prod.notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="mt-2 flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/5">
                                                        <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                                                            ₱{Number(prod.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-pink-600 dark:text-pink-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                                            + Add <Check className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Datalist for fast auto-complete on item inputs */}
                                <datalist id="supplier-products-catalog">
                                    {availableSupplierProducts.map((p, idx) => (
                                        <option key={p.id || idx} value={p.item_name}>
                                            ₱{Number(p.unit_price || 0).toFixed(2)} ({p.unit || 'units'})
                                        </option>
                                    ))}
                                </datalist>

                                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                                    {formData.items.map((item, index) => (
                                        <div
                                            key={index}
                                            className="p-3 bg-white dark:bg-[#1a1c27] rounded-xl border border-white dark:border-white/[0.06] shadow-[3px_3px_8px_rgba(166,175,195,0.3),-3px_-3px_8px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.5)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                                        >
                                            {(request && !(request as any)?.allowEditItems) ? (
                                                <>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 block truncate">
                                                            {item.name || item.item_name || "Item"}
                                                        </span>
                                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                                            Qty: <strong className="text-slate-700 dark:text-slate-300">{item.quantity} {item.unit || "units"}</strong>
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                                                        <div className="text-right">
                                                            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Unit Price</span>
                                                            <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                                                                ₱{Number(item.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                        <div className="w-24 text-right">
                                                            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Item Total</span>
                                                            <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                                                                ₱{item.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="w-full grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                                                    <div className="sm:col-span-5">
                                                        <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Item Name / Description</label>
                                                        <input
                                                            type="text"
                                                            list="supplier-products-catalog"
                                                            placeholder="e.g. Michelin 195/65 R15 Tire"
                                                            value={item.name || item.item_name || ''}
                                                            onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                                                            className="w-full bg-[#ebf0f7] dark:bg-[#13141d] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500"
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-2">
                                                        <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Qty</label>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            value={item.quantity || 1}
                                                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                                            className="w-full bg-[#ebf0f7] dark:bg-[#13141d] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] rounded-lg px-2 py-1.5 text-xs text-center font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500"
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-2">
                                                        <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Unit (₱)</label>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step="any"
                                                            value={item.unit_price || ''}
                                                            placeholder="0.00"
                                                            onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                                                            className="w-full bg-[#ebf0f7] dark:bg-[#13141d] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] rounded-lg px-2 py-1.5 text-xs text-right font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500"
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-2 text-right">
                                                        <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Item Total</label>
                                                        <span className="text-xs font-mono font-bold text-slate-900 dark:text-white block py-1">
                                                            ₱{(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                    <div className="sm:col-span-1 flex justify-end items-end pt-3 sm:pt-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveItem(index)}
                                                            className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors cursor-pointer"
                                                            title="Delete Item"
                                                        >
                                                            <i className="fas fa-trash-alt text-xs" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Raw Items Subtotal Bar (Before VAT / Discount) */}
                                <div className="mt-2.5 p-3 rounded-xl bg-slate-100 dark:bg-[#12131c] border border-slate-200/80 dark:border-white/5 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                                        <Receipt className="w-3.5 h-3.5" />
                                        <span>Items Subtotal (Raw Total before Discount &amp; VAT):</span>
                                    </div>
                                    <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                                        ₱{lineItemsSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            {/* Category & Commercial Terms */}
                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-slate-300/80 dark:border-white/10 space-y-3.5">
                                <div className="flex items-center justify-between border-b border-slate-300/60 dark:border-white/10 pb-2">
                                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                        <Layers className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                                        Category &amp; Commercial Terms
                                    </h4>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        Auto-fills from supplier profile
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                    {/* Category */}
                                    <div className="sm:col-span-6">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                            <Tag className="w-3 h-3 text-pink-500" />
                                            Category
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.category}
                                            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                            placeholder="e.g. Tires & Automotive Supply"
                                            className="w-full bg-white dark:bg-[#10121a] border border-slate-200/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500 font-medium"
                                        />
                                    </div>

                                    {/* Payment Terms */}
                                    <div className="sm:col-span-6">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                            <CreditCard className="w-3 h-3 text-pink-500" />
                                            Payment Terms
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.payment_terms}
                                            onChange={(e) => setFormData(prev => ({ ...prev, payment_terms: e.target.value }))}
                                            placeholder="e.g. Net 30 Days (Standard B2B)"
                                            className="w-full bg-white dark:bg-[#10121a] border border-slate-200/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500"
                                        />
                                    </div>

                                    {/* Warranty Terms */}
                                    <div className="sm:col-span-4">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                            <ShieldCheck className="w-3 h-3 text-pink-500" />
                                            Warranty Terms
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.warranty_terms}
                                            onChange={(e) => setFormData(prev => ({ ...prev, warranty_terms: e.target.value }))}
                                            placeholder="e.g. 1-Year Replacement Warranty"
                                            className="w-full bg-white dark:bg-[#10121a] border border-slate-200/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500"
                                        />
                                    </div>

                                    {/* Price Validity */}
                                    <div className="sm:col-span-4">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-pink-500" />
                                            Price Validity
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.price_validity}
                                            onChange={(e) => setFormData(prev => ({ ...prev, price_validity: e.target.value }))}
                                            placeholder="e.g. 30 Days Validity"
                                            className="w-full bg-white dark:bg-[#10121a] border border-slate-200/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500"
                                        />
                                    </div>

                                    {/* Delivery Terms */}
                                    <div className="sm:col-span-4">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                            <Truck className="w-3 h-3 text-pink-500" />
                                            Delivery Terms
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.delivery_terms}
                                            onChange={(e) => setFormData(prev => ({ ...prev, delivery_terms: e.target.value }))}
                                            placeholder="e.g. Door-to-Door Delivery (Airship Manila DDP)"
                                            className="w-full bg-white dark:bg-[#10121a] border border-slate-200/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500"
                                        />
                                    </div>

                                    {/* Terms and Conditions Textarea with Full View & Increased Height */}
                                    <div className="sm:col-span-12 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                                <FileText className="w-3.5 h-3.5 text-pink-500" />
                                                <span>Governing Terms and Conditions</span>
                                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                                    Database Linked
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-normal">
                                                    ({formData.terms_and_conditions.split('\n').filter(Boolean).length} clauses · {formData.terms_and_conditions.length} chars)
                                                </span>
                                            </label>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, terms_and_conditions: dbDefaultTerms }))}
                                                    className="text-[11px] text-slate-500 hover:text-pink-600 dark:text-slate-400 dark:hover:text-pink-400 flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                                    title="Reset to terms from database"
                                                >
                                                    <RefreshCw className="w-3 h-3" />
                                                    <span>Reset from DB</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsTermsModalOpen(true)}
                                                    className="text-[11px] font-bold text-pink-600 hover:text-pink-700 dark:text-pink-400 dark:hover:text-pink-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pink-50 dark:bg-pink-950/40 border border-pink-200/80 dark:border-pink-800/40 hover:bg-pink-100 dark:hover:bg-pink-950/70 transition-all cursor-pointer shadow-xs"
                                                    title="Expand editor to view and edit in full screen"
                                                >
                                                    <Maximize2 className="w-3 h-3" />
                                                    <span>View &amp; Edit in Full</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <textarea
                                                value={formData.terms_and_conditions}
                                                onChange={(e) => setFormData((prev) => ({ ...prev, terms_and_conditions: e.target.value }))}
                                                rows={5}
                                                placeholder="Governing clauses and terms loaded from database..."
                                                className="w-full min-h-[140px] max-h-[350px] bg-white dark:bg-[#10121a] border border-slate-200/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] rounded-xl p-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500 font-mono resize-y leading-relaxed"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Delivery Schedule & Destination Address */}
                            <div className="p-4 rounded-2xl bg-[#ebf0f7] dark:bg-[#161826] border border-slate-300/80 dark:border-white/10 space-y-3">
                                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                                    Delivery Schedule &amp; Destination Address
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                    <div className="sm:col-span-5">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Expected Delivery Date <span className="text-pink-600 dark:text-pink-400 font-bold">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            min={new Date().toISOString().split("T")[0]}
                                            className="w-full bg-white dark:bg-[#10121a] border border-slate-200/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500"
                                            value={formData.delivery_date}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, delivery_date: e.target.value }))}
                                        />
                                    </div>

                                    <div className="sm:col-span-7">
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                            Delivery Location <span className="text-pink-600 dark:text-pink-400 font-bold">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.delivery_location}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, delivery_location: e.target.value }))}
                                            placeholder="352 Escolta St, Binondo, Manila, 1006 Metro Manila(Airship Express)"
                                            className="w-full bg-white dark:bg-[#10121a] border border-slate-200/80 dark:border-white/10 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500 font-medium"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Financial Summary & Tax Calculation - Strictly View Only */}
                            <div className="p-4 rounded-2xl bg-white dark:bg-[#161826] border border-pink-500/30 dark:border-pink-500/20 space-y-3">
                                <div className="flex items-center justify-between border-b border-pink-500/20 pb-2">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                                            <DollarSign className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400" />
                                            Financial Summary &amp; Tax Calculation
                                        </h4>
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                                            View Only
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-pink-600 dark:text-pink-400 font-bold">
                                        Philippine Peso (PHP / ₱)
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                                    <div className="p-2.5 rounded-xl bg-[#f4f7fb] dark:bg-black/30 border border-slate-200/70 dark:border-white/5 space-y-0.5">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Subtotal</span>
                                        <p className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                                            ₱{lineItemsSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-[#f4f7fb] dark:bg-black/30 border border-slate-200/70 dark:border-white/5 space-y-0.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Discount (₱)</span>
                                            <span className="text-[9px] text-slate-400 font-medium">From Quote</span>
                                        </div>
                                        <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                                            {discountAmount > 0 ? `-₱${discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₱0.00'}
                                        </p>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-[#f4f7fb] dark:bg-black/30 border border-slate-200/70 dark:border-white/5 space-y-0.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase block">Shipping (₱)</span>
                                            <span className="text-[9px] text-slate-400 font-medium">From Quote</span>
                                        </div>
                                        <p className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                                            {shippingFee > 0 ? `+₱${shippingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₱0.00'}
                                        </p>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-[#f4f7fb] dark:bg-black/30 border border-slate-200/70 dark:border-white/5 space-y-0.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase block">VAT / Tax Rate</span>
                                            <span className="text-[9px] text-slate-400 font-medium">Standard</span>
                                        </div>
                                        <p className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                                            {formData.tax_rate ?? 12}%
                                        </p>
                                    </div>

                                    <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-pink-100/60 dark:bg-pink-950/40 border border-pink-500/30 space-y-0.5">
                                        <span className="text-[10px] text-pink-700 dark:text-pink-300 font-bold uppercase block">Grand Total</span>
                                        <p className="font-mono font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
                                            ₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                        <div className="text-[9px] text-pink-600 dark:text-pink-400 font-medium flex flex-wrap gap-x-1">
                                            <span>Tax: +₱{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            {shippingFee > 0 && <span>• Ship: +₱{shippingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Notes & Instructions */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    Notes &amp; Instructions
                                </label>
                                <textarea
                                    className="w-full bg-[#ebf0f7] dark:bg-[#13141d] border border-slate-200/60 dark:border-white/[0.08] shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.3)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)] rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-pink-500 transition-all resize-none"
                                    rows={2}
                                    placeholder="Add any specific instructions, gate pass requirements or delivery guidelines..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/60 dark:border-white/[0.06]">
                                <AppButton type="button" variant="neutral" size="md" onClick={onClose}>
                                    Cancel
                                </AppButton>
                                <AppButton type="button" variant="primary" size="md" onClick={handleNext}>
                                    <span>Next: Dispatch &amp; Review</span>
                                    <i className="fas fa-arrow-right text-xs" />
                                </AppButton>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Email Template, AI Compose & Dispatch Options */}
                    {step === 2 && (
                        <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                            
                            {/* Email Mode Selector & Status Indicator */}
                            <div className="bg-slate-50/80 dark:bg-[#13141d] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-none">
                                            Email Dispatch Content
                                        </h4>
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                                            Standard formal layout or AI customized explanation
                                        </span>
                                    </div>

                                    {/* Minimalist Active Mode Indicator & Full View */}
                                    <div className="flex items-center gap-2">
                                        {emailMode === 'ai' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/40">
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                <span>AI Content Active</span>
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                <span>Standard Template</span>
                                            </span>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => setIsFullPreviewOpen(true)}
                                            className="px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-[#181924] border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
                                            title="View Full Expanded Text & Email Preview"
                                        >
                                            <span>Full View</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Mode Switcher Tabs */}
                                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/60 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setEmailMode('standard')}
                                        className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                            emailMode === 'standard'
                                                ? 'bg-white dark:bg-[#1c1e2b] text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        <span>Standard</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEmailMode('ai');
                                            if (!aiMessage && !isGeneratingAI) {
                                                generateAIMessage();
                                            }
                                        }}
                                        className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                            emailMode === 'ai'
                                                ? 'bg-white dark:bg-[#1c1e2b] text-indigo-600 dark:text-indigo-400 shadow-xs border border-indigo-200 dark:border-indigo-800/40'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                                        }`}
                                    >
                                        <span>AI Content</span>
                                    </button>
                                </div>

                                {/* Content Preview Area */}
                                {emailMode === 'standard' ? (
                                    <div className="bg-white dark:bg-[#181924] rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed shadow-xs space-y-2">
                                        <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                                            "Hello <strong>{activeSupplierName}</strong>, please review and accept this official purchase order for the item(s) listed below. Confirm availability and expected delivery schedule to <strong>{formData.delivery_location}</strong> under {formData.payment_terms} at your earliest convenience."
                                        </p>
                                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
                                            <span>Includes item table, category ({formData.category || 'General'}), financial breakdown (₱{totalAmount.toLocaleString()}), and confirmation CTA.</span>
                                            <button
                                                type="button"
                                                onClick={() => setIsFullPreviewOpen(true)}
                                                className="text-slate-600 dark:text-slate-300 hover:underline font-medium cursor-pointer"
                                            >
                                                View all
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white dark:bg-[#181924] rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed shadow-xs">
                                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                                                AI Generated Text
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <AppButton
                                                    type="button"
                                                    variant="neutral"
                                                    size="xs"
                                                    onClick={generateAIMessage}
                                                    disabled={isGeneratingAI || isSending}
                                                >
                                                    {isGeneratingAI ? (
                                                        <i className="fas fa-spinner fa-spin text-[10px]" />
                                                    ) : (
                                                        <i className="fas fa-arrows-rotate text-[10px]" />
                                                    )}
                                                    <span>{isGeneratingAI ? 'Generating...' : 'Regenerate'}</span>
                                                </AppButton>
                                                {aiMessage && (
                                                    <>
                                                        <AppButton
                                                            type="button"
                                                            variant="neutral"
                                                            size="xs"
                                                            onClick={handleCopyOnly}
                                                            disabled={isSending}
                                                        >
                                                            <i className="fas fa-copy text-[10px]" />
                                                            <span>Copy</span>
                                                        </AppButton>
                                                        <button
                                                            type="button"
                                                            onClick={handleClearAiCache}
                                                            className="w-6 h-6 rounded-md text-slate-400 hover:text-rose-500 flex items-center justify-center text-[10px] transition-colors cursor-pointer"
                                                            title="Clear Cache"
                                                        >
                                                            <i className="fas fa-trash-alt" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {isGeneratingAI ? (
                                            <div className="flex flex-col items-center justify-center h-24 text-slate-500 gap-2">
                                                <i className="fas fa-spinner fa-spin text-base" />
                                                <span className="text-xs">Drafting supplier message...</span>
                                            </div>
                                        ) : aiMessage ? (
                                            <div className="space-y-2">
                                                <textarea
                                                    value={aiMessage}
                                                    onChange={(e) => handleAiTextChange(e.target.value)}
                                                    rows={5}
                                                    className="w-full bg-slate-50 dark:bg-[#13141d] p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-slate-400 font-sans transition-all resize-y leading-relaxed"
                                                    placeholder="Edit AI message..."
                                                />
                                                <div className="flex items-center justify-between text-[11px] text-slate-400">
                                                    <span>Saved locally in browser</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsFullPreviewOpen(true)}
                                                        className="text-slate-600 dark:text-slate-300 hover:underline font-medium cursor-pointer"
                                                    >
                                                        Expand view
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-5">
                                                <p className="text-slate-400 text-xs mb-2">
                                                    No AI content generated yet.
                                                </p>
                                                <AppButton
                                                    type="button"
                                                    variant="primary"
                                                    size="xs"
                                                    onClick={generateAIMessage}
                                                >
                                                    <span>Generate with AI</span>
                                                </AppButton>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Supplier Email Input & Verification */}
                                <div className="pt-1">
                                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                                        Supplier Email Address (Gmail / Direct)
                                    </label>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">
                                            <i className="fas fa-envelope text-xs" />
                                        </div>
                                        <input
                                            type="email"
                                            value={supplierEmail}
                                            onChange={(e) => setSupplierEmail(e.target.value)}
                                            placeholder="supplier@company.com"
                                            className="w-full pl-9 pr-3.5 py-2.5 bg-white dark:bg-[#1a1c27] rounded-xl border border-white dark:border-white/[0.08] shadow-[3px_3px_8px_rgba(166,175,195,0.3),-3px_-3px_8px_rgba(255,255,255,0.9)] dark:shadow-[3px_3px_8px_rgba(0,0,0,0.5)] text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-pink-500 font-mono transition-all"
                                        />
                                    </div>
                                    {!supplierEmail && (
                                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 font-medium">
                                            <i className="fas fa-info-circle text-[9px]" />
                                            Enter the recipient's email address above to enable sending via Gmail.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-200/60 dark:border-white/[0.06]">
                                <div className="flex items-center gap-2">
                                    <AppButton
                                        type="button"
                                        variant="neutral"
                                        size="md"
                                        onClick={handleBack}
                                        disabled={isSending || submitting}
                                    >
                                        <i className="fas fa-arrow-left text-xs" />
                                        <span>Back</span>
                                    </AppButton>

                                    <AppButton
                                        type="button"
                                        variant="neutral"
                                        size="md"
                                        onClick={handleCreatePOOnly}
                                        disabled={isSending || submitting}
                                        title="Create PO in system without sending email"
                                    >
                                        {submitting ? (
                                            <i className="fas fa-spinner fa-spin text-xs" />
                                        ) : (
                                            <i className="fas fa-save text-xs" />
                                        )}
                                        <span>Save as Draft</span>
                                    </AppButton>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleEmail}
                                        disabled={isSending || submitting || !supplierEmail.trim()}
                                        className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 border border-pink-400/80 rounded-xl shadow-[0_4px_12px_rgba(236,72,153,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                                    >
                                        {isSending ? (
                                            <i className="fas fa-spinner fa-spin text-white" />
                                        ) : (
                                            <i className="fas fa-paper-plane text-white text-xs" />
                                        )}
                                        <span>{isSending ? 'Dispatching...' : 'Send PO via Gmail'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Expanded Full View Modal for Email Template & AI Text */}
            {isFullPreviewOpen && (
                <Portal>
                    <div
                        className="fixed inset-0 bg-slate-950/80 dark:bg-black/90 backdrop-blur-md flex items-center justify-center z-[110] p-4 overflow-y-auto animate-in fade-in duration-200"
                        onClick={() => setIsFullPreviewOpen(false)}
                    >
                        <div
                            className="bg-[#ebf0f7] dark:bg-[#151620] rounded-3xl max-w-3xl w-full my-auto shadow-none border border-slate-200/80 dark:border-white/[0.08] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Full View Header */}
                            <div className="px-6 py-4 border-b border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between bg-[#e5ebf5]/90 dark:bg-[#12131b]/90 backdrop-blur-sm">
                                <div className="flex items-center gap-2.5">
                                    <span className="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-950/60 text-pink-600 dark:text-pink-300 border border-pink-200/80 dark:border-pink-900/40 flex items-center justify-center text-sm shadow-xs">
                                        <i className="fas fa-file-invoice-dollar" />
                                    </span>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                                            Full Email &amp; Content Preview
                                        </h3>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                            Exact layout and text dispatched to supplier ({emailMode === 'ai' ? 'AI Content Active' : 'Standard Template Active'})
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <AppButton type="button" variant="neutral" size="xs" onClick={handleCopyOnly}>
                                        <i className="fas fa-copy text-[10px]" />
                                        <span>Copy Text</span>
                                    </AppButton>
                                    <button
                                        type="button"
                                        onClick={() => setIsFullPreviewOpen(false)}
                                        className="w-7 h-7 rounded-xl bg-[#ebf0f7] dark:bg-[#1a1b26] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center border border-white/80 dark:border-white/[0.06] shadow-xs cursor-pointer ml-1"
                                        aria-label="Close Preview"
                                    >
                                        <i className="fas fa-times text-xs" />
                                    </button>
                                </div>
                            </div>

                            {/* Full Content Body */}
                            <div className="p-6 overflow-y-auto space-y-6 flex-1">
                                
                                {/* Email Meta Bar */}
                                <div className="bg-[#e9eef6] dark:bg-[#13141d] p-3.5 rounded-xl border border-white/60 dark:border-white/[0.04] text-xs space-y-1.5 shadow-[inset_1.5px_1.5px_3px_rgba(166,175,195,0.25)] dark:shadow-[inset_1.5px_1.5px_3px_rgba(0,0,0,0.6)]">
                                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                        <span><strong>To:</strong> {supplierEmail || activeSupplierName}</span>
                                        <span><strong>From:</strong> AirshipExpress Supply Chain ({user.getName()})</span>
                                    </div>
                                    <div className="text-slate-800 dark:text-slate-200 font-semibold truncate">
                                        <strong>Subject:</strong> Purchase Order {poNumber} - {activeSupplierName}
                                    </div>
                                </div>

                                {/* Formatted Letter View */}
                                <div className="bg-[#f6f9fc] dark:bg-[#191b26] p-6 rounded-2xl border border-white dark:border-white/[0.08] shadow-[6px_6px_16px_rgba(166,175,195,0.35),-6px_-6px_16px_rgba(255,255,255,0.95)] dark:shadow-[6px_6px_20px_rgba(0,0,0,0.5)] space-y-5">
                                    
                                    {/* Letterhead */}
                                    <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.08] pb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-pink-600 text-white font-black text-xs flex items-center justify-center">
                                                AE
                                            </div>
                                            <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                                                Airship<span className="text-pink-600 dark:text-pink-400">Express</span>
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">{poNumber}</span>
                                        </div>
                                    </div>

                                    {/* Text Body: AI or Standard */}
                                    <div className="space-y-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                                        {emailMode === 'ai' && aiMessage ? (
                                            <div className="whitespace-pre-wrap font-sans bg-indigo-50/50 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                                                {aiMessage}
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <p>Dear <strong>{activeSupplierName}</strong>,</p>
                                                <p>
                                                    Please review and process the following official purchase order on behalf of AirshipExpress Supply Chain &amp; Procurement Department. Kindly confirm item availability and estimated delivery schedule.
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Full Itemized Table */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs border-collapse">
                                            <thead>
                                                <tr className="border-b-2 border-slate-200/80 dark:border-white/[0.1] text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                                                    <th className="py-2 text-left">Item Description</th>
                                                    <th className="py-2 text-center w-16">Qty</th>
                                                    <th className="py-2 text-right w-24">Unit Price</th>
                                                    <th className="py-2 text-right w-28">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200/50 dark:divide-white/[0.05] text-slate-700 dark:text-slate-300">
                                                {formData.items.map((item, idx) => (
                                                    <tr key={idx}>
                                                        <td className="py-2.5 font-medium text-slate-900 dark:text-slate-100">
                                                            {item.name || item.item_name || 'Procurement Item'}
                                                        </td>
                                                        <td className="py-2.5 text-center font-semibold">
                                                            {item.quantity} {item.unit || "units"}
                                                        </td>
                                                        <td className="py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                                                            ₱{(item.unit_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="py-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                                                            ₱{(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Total, Discounts, Tax & Delivery Breakdown */}
                                    <div className="border-t border-slate-200/80 dark:border-white/[0.08] pt-3 space-y-1.5 text-xs">
                                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                            <span>Subtotal:</span>
                                            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                                ₱{lineItemsSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        {discountAmount > 0 && (
                                            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                                                <span>Discount:</span>
                                                <span className="font-mono font-semibold">
                                                    -₱{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )}

                                        {shippingFee > 0 && (
                                            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                                <span>Shipping Fee:</span>
                                                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                                    +₱{shippingFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )}

                                        {taxAmount > 0 && (
                                            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                                <span>VAT ({taxRate}%):</span>
                                                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                                    +₱{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-white/[0.06]">
                                            <span className="font-bold text-slate-800 dark:text-slate-200">Grand Total:</span>
                                            <span className="text-base font-mono font-extrabold text-pink-600 dark:text-pink-400">
                                                ₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Logistics & Commercial Metadata */}
                                    <div className="p-3 bg-[#e9eef6] dark:bg-[#13141d] rounded-xl border border-white/60 dark:border-white/[0.04] text-[11px] space-y-1 text-slate-600 dark:text-slate-400">
                                        <div><strong>Category:</strong> {formData.category || 'General Procurement'}</div>
                                        <div><strong>Expected Delivery Date:</strong> {formData.delivery_date || 'Standard Timeline'}</div>
                                        <div><strong>Delivery Location:</strong> {formData.delivery_location || DEFAULT_DELIVERY_LOCATION}</div>
                                        <div><strong>Commercial Terms:</strong> Payment={formData.payment_terms} | Warranty={formData.warranty_terms} | Validity={formData.price_validity} | Delivery={formData.delivery_terms}</div>
                                    </div>

                                    {/* Confirmation Link CTA */}
                                    <div className="bg-[#e9eef6] dark:bg-[#13141d] p-3 rounded-xl border border-white/60 dark:border-white/[0.04] flex items-center justify-between gap-3 text-xs">
                                        <span className="text-slate-600 dark:text-slate-400 truncate">
                                            <i className="fas fa-link mr-1.5 text-pink-500" />
                                            {confirmLink}
                                        </span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300">
                                            Supplier CTA Button
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Full View Footer */}
                            <div className="px-6 py-3.5 border-t border-slate-200/70 dark:border-white/[0.06] bg-[#e5ebf5]/90 dark:bg-[#12131b]/90 flex items-center justify-end gap-2">
                                <AppButton type="button" variant="primary" size="sm" onClick={() => setIsFullPreviewOpen(false)}>
                                    Done &amp; Return
                                </AppButton>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}

            {/* Full Governing Terms & Conditions Editor Modal */}
            {isTermsModalOpen && (
                <Portal>
                    <div
                        className="fixed inset-0 z-[999999] bg-slate-950/70 dark:bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
                        onClick={() => setIsTermsModalOpen(false)}
                    >
                        <div
                            className="bg-[#f0f3f8] dark:bg-[#161722] rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-white/90 dark:border-white/[0.08] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-4.5 border-b border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between bg-[#e5ebf5]/80 dark:bg-[#12131b]/80">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-pink-500/15 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 flex items-center justify-center border border-pink-500/20">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                            Governing Terms &amp; Conditions — Full Editor
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Review, modify, and format legal clauses and commercial obligations attached to this Purchase Order.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsTermsModalOpen(false)}
                                    className="w-8 h-8 rounded-xl bg-slate-200/70 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                                    aria-label="Close"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 overflow-y-auto space-y-4 flex-1">
                                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                    <span className="font-semibold">Clauses &amp; Special Provisions:</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, terms_and_conditions: dbDefaultTerms }))}
                                            className="text-xs text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            <span>Reset to Database Terms</span>
                                        </button>
                                        <span>•</span>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, terms_and_conditions: "" }))}
                                            className="text-xs text-rose-500 hover:underline font-semibold cursor-pointer"
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                </div>

                                <textarea
                                    value={formData.terms_and_conditions}
                                    onChange={(e) => setFormData(prev => ({ ...prev, terms_and_conditions: e.target.value }))}
                                    rows={12}
                                    placeholder="Enter terms and conditions, warranty policies, inspection guidelines..."
                                    className="w-full min-h-[260px] h-[40vh] bg-white dark:bg-[#10121a] border border-slate-300 dark:border-white/10 rounded-2xl p-4 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-pink-500 font-mono resize-y leading-relaxed shadow-inner"
                                    autoFocus
                                />

                                {/* Formatted Preview Box */}
                                <div className="p-4 rounded-2xl bg-[#e5ebf5]/60 dark:bg-[#12131b]/60 border border-slate-200 dark:border-white/[0.04] space-y-2">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                        Live Document Preview
                                    </span>
                                    <div className="text-xs text-slate-800 dark:text-slate-200 font-mono whitespace-pre-line leading-relaxed bg-white/70 dark:bg-[#0c0d14]/70 p-3.5 rounded-xl border border-slate-200/60 dark:border-white/[0.04]">
                                        {formData.terms_and_conditions || "(No terms and conditions specified)"}
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 border-t border-slate-200/70 dark:border-white/[0.06] bg-[#e5ebf5]/90 dark:bg-[#12131b]/90 flex items-center justify-between">
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                    {formData.terms_and_conditions.split('\n').filter(Boolean).length} lines · {formData.terms_and_conditions.length} characters
                                </span>
                                <AppButton
                                    type="button"
                                    variant="primary"
                                    size="md"
                                    onClick={() => setIsTermsModalOpen(false)}
                                >
                                    Save &amp; Return to PO Form
                                </AppButton>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </Portal>
    );
}
