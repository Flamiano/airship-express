/**
 * Server-side receipt OCR.
 *
 * Why server-side: on-device OCR (ML Kit, native Tesseract bindings, etc.)
 * needs a custom native module, which does NOT run in Expo Go - only in a
 * custom dev client / EAS build. Since the driver app must stay Expo-Go
 * compatible, the photo is captured on-device with expo-image-picker (pure
 * JS, works in Expo Go) and shipped as base64 to this backend. The backend
 * first tries Google Cloud Vision if configured, then optionally falls back to
 * Groq vision or local Tesseract OCR so the app can still auto-fill the expense form.
 *
 * ---------------------------------------------------------------------------
 * FIXES APPLIED (see chat for full explanation):
 * 1. CRITICAL: `liters` / `pricePerLiter` were read (inside the confidence
 *    check) before they were declared later in the function. Because they
 *    were declared with `let`, this threw a ReferenceError (temporal dead
 *    zone) whenever confidence was 'medium' and category was 'fuel' -
 *    silently killing that OCR provider's result. Fixed by moving the
 *    liters/price-per-liter detection block up, before it's referenced.
 * 2. Added `detectFuelType()` - a closed-vocabulary matcher for unlabeled
 *    fuel-type text on receipts (e.g. a receipt that just prints "DIESEL"
 *    or "RON95" with no "Fuel Type:" label).
 * 3. Added `isLikelyGarbledLine()` - rejects OCR lines with abnormal
 *    case-mixing (the "MAKATH omy" pattern) before they're allowed to
 *    become the Location or Description/note value.
 * 4. `fuelType` is now threaded through every provider path and into
 *    normalizeOcrResult so the frontend can bind it directly.
 * ---------------------------------------------------------------------------
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || 'llama-3.2-11b-vision-preview';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY || '';
const OCR_SPACE_URL = 'https://api.ocr.space/parse/image';
const AZURE_COMPUTER_VISION_KEY = process.env.AZURE_COMPUTER_VISION_KEY || '';
const AZURE_COMPUTER_VISION_ENDPOINT = process.env.AZURE_COMPUTER_VISION_ENDPOINT || '';
const GOOGLE_CLOUD_VISION_API_KEY = process.env.GOOGLE_CLOUD_VISION_API_KEY || '';
const GOOGLE_CLOUD_VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_CLOUD_VISION_API_KEY}`;
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS || 6000);
const OCR_DEBUG = process.env.OCR_DEBUG === 'true';

const EXTRACTION_PROMPT = `You are reading a photo of a fleet expense receipt (fuel, tolls, parking, or maintenance).
Return ONLY a JSON object, no markdown fences, no commentary, in exactly this shape:
{"amount": <number or null>, "currency": <string or null>, "amountText": <string or null>, "category": <one of "fuel","maintenance","toll","parking","other">, "vendor": <string or null>, "fuel_station": <string or null>, "fuel_type": <string or null>, "liters": <number or null>, "price_per_liter": <number or null>, "note": <short string or null>, "referenceNumber": <string or null>, "paymentMethod": <string or null>, "confidence": <"high"|"medium"|"low">}
If you cannot read a field confidently, use null for it rather than guessing.`;

// ---------------------------------------------------------------------------
// Closed-vocabulary matchers for fields that print WITHOUT a label on many
// receipts (e.g. a fuel type printed bare, with no "Fuel Type:" prefix).
// These don't need the OCR engine to "understand" the field - they just
// need the raw text to contain one of the known tokens.
// ---------------------------------------------------------------------------
const FUEL_TYPES = [
  'DIESEL', 'BIODIESEL', 'UNLEADED', 'PREMIUM', 'REGULAR', 'GASOLINE',
  'RON91', 'RON95', 'RON97', 'RON100', 'E10', 'E20', 'V-POWER', 'VPOWER',
];

function detectFuelType(input) {
  const lines = Array.isArray(input) ? input : String(input || '').split(/\n+/);
  for (const rawLine of lines) {
    const clean = String(rawLine || '').toUpperCase().replace(/[^A-Z0-9\- ]/g, ' ');
    for (const fuel of FUEL_TYPES) {
      const token = fuel.replace('-', '\\-?');
      if (new RegExp(`\\b${token}\\b`).test(clean)) {
        return fuel.replace('VPOWER', 'V-POWER');
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Garbled-line detector. Faded/skewed thermal receipts often produce OCR
// noise that looks like "MAKATH omy" - an all-caps word abruptly followed
// by a short lowercase fragment, or vice versa. This heuristic flags lines
// that are unlikely to be genuine address/description text so they don't
// get selected as the Location or Description value.
// ---------------------------------------------------------------------------
function isLikelyGarbledLine(line) {
  if (!line) return true;
  const trimmed = line.trim();
  if (trimmed.length < 4) return true;
  // an uppercase word directly followed by a 1-3 letter lowercase fragment
  // (e.g. "MAKATH omy", "GUADALUPE ta") is a strong OCR-noise signal
  if (/[A-Z]{3,}\s+[a-z]{1,3}\b/.test(trimmed) && !/\b(?:is|of|to|in|for|at|by)\b/.test(trimmed.toLowerCase())) {
    return true;
  }
  // too many isolated single characters ("A he IN BE Lo")
  const tokens = trimmed.split(/\s+/);
  const singleLetterTokens = tokens.filter((t) => /^[A-Za-z]$/.test(t)).length;
  if (tokens.length >= 4 && singleLetterTokens / tokens.length > 0.3) return true;
  // extremely low vowel ratio for its length (garbled character soup)
  const letters = trimmed.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 6) {
    const vowels = (letters.match(/[aeiouAEIOU]/g) || []).length;
    if (vowels / letters.length < 0.15) return true;
  }
  return false;
}

function cleanOcrLine(line) {
  return String(line || '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[^\w\s.,₱#/\-•]/g, '')
    .trim();
}

function parseReceiptText(text) {
  if (!text || !text.trim()) return { amount: null, category: null, vendor: null, note: null, referenceNumber: null, paymentMethod: null, fuelType: null };

  const cleanedText = text.replace(/\r/g, '').trim();
  const lines = cleanedText.split(/\n+/).map((line) => cleanOcrLine(line)).filter(Boolean);
  const normalizedLines = lines.map((line) => line.replace(/[ \t]+/g, ' ').trim());
  const flattened = normalizedLines.join(' ');
  const lower = flattened.toLowerCase();

  let category = null;
  let vendor = null;
  let location = null;
  let referenceNumber = null;
  let paymentMethod = null;
  let currency = null;
  let amountText = null;
  if (/(fuel|gas|diesel|petrol|blaze|unleaded|premium|price\/l|price per liter|quantity|qty|liters?)/i.test(lower)) category = 'fuel';
  else if (/(maintenance|service|repair|oil|tire)/i.test(lower)) category = 'maintenance';
  else if (/(toll|expressway)/i.test(lower)) category = 'toll';
  else if (/(parking)/i.test(lower)) category = 'parking';
  else if (/(receipt|invoice|expense)/i.test(lower)) category = 'other';

  // Unlabeled fuel type - dictionary match against every line, independent
  // of whether a "Fuel Type:" label exists on the receipt.
  const fuelType = detectFuelType(normalizedLines);
  if (fuelType && !category) category = 'fuel';

  const currencySymbols = '(?:php|₱|p|usd|us\\$|\\$|dollar|kwd|kd|د\\.ك|دك|eur|€|gbp|£|aud|cad|cny|cn\\¥|jpy|¥|krw|₩|inr|₹|rub|₽|brl|r\\$|mxn|mx\\$|zar|sek|nok|dkk|chf|sgd|hkd|aed|sar|bdt|vnd|₫|ngn|₦|pln|idr|rs|lkr|thb|฿)';
  const amountPattern = new RegExp(`(?<![\\d.,])(${currencySymbols})?\\s*(\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d{1,3})?|\\d+(?:[.,]\\d{1,3})?)(?![\\d.,])`, 'gi');
  const amountCandidates = [];
  const badAmountContext = /\b(?:qty|quantity|liters?|liter|ltrs?|ltr|price\/l|price per liter|unit price|rate|gallon|kg|km|mileage|odometer|plate|tel|tin|tax id|date|time|year|month|vat|vatable|fuel type|pump|per liter|per litre|per l)\b/i;
  const perUnitAmountContext = /\b(?:per\s*(?:l|litre|liter|ltr|ltrs?)|price\s*(?:\/|per)\s*(?:l|litre|liter|ltr|ltrs?)|unit price|price per liter|price per litre|per litre|per liter)\b/i;
  const invoiceContext = /\b(?:invoice|receipt|order|slip|transaction|tran|trx|ref|tin|tax|date|time|cashier|cashier no|receipt no|invoice no|order no)\b/i;
  const totalKeywords = /(?:total amount|grand total|net total|amount due|amount payable|amount paid|cash tendered|payment amount|balance due|change due|due amount|subtotal|total)\b/i;
  const vatLinePattern = /\b(?:vat|vatable|tax)\b/i;
  const dateLinePattern = /(^|\D)(?:[0-3]?\d[\/\-][0-1]?\d[\/\-](?:\d{2}|\d{4})|\d{4})(\D|$)/;

  normalizedLines.forEach((line, index) => {
    let match;
    const lineLower = line.toLowerCase();
    const lineHasTotal = totalKeywords.test(lineLower);
    const lineHasBadContext = badAmountContext.test(lineLower);
    const lineLooksInvoice = invoiceContext.test(lineLower);
    const isVatLine = vatLinePattern.test(lineLower);
    const isDateLine = dateLinePattern.test(line);
    while ((match = amountPattern.exec(line)) !== null) {
      const currencyMatchText = match[1] || '';
      const raw = match[2] || match[1] || '';
      const matchedText = match[0].trim();
      let numericText = raw.replace(/\s+/g, '');
      const hasComma = numericText.includes(',');
      const hasDot = numericText.includes('.');
      if (hasComma && hasDot) {
        const lastComma = numericText.lastIndexOf(',');
        const lastDot = numericText.lastIndexOf('.');
        if (lastComma > lastDot) {
          numericText = numericText.replace(/\./g, '').replace(/,/g, '.');
        } else {
          numericText = numericText.replace(/,/g, '');
        }
      } else if (hasComma && !hasDot) {
        const parts = numericText.split(',');
        const lastPart = parts[parts.length - 1] || '';
        if (parts.length > 1 && lastPart.length <= 2) {
          numericText = numericText.replace(/,/g, '.');
        } else {
          numericText = numericText.replace(/,/g, '');
        }
      } else {
        numericText = numericText.replace(/,/g, '');
      }
      let value = Number(numericText);
      if (!Number.isFinite(value) || value <= 0 || value >= 1000000) continue;
      const longDecimalMatch = /^\d+\.(\d{4,})$/.test(numericText);
      if (hasDot && !hasComma && longDecimalMatch && /(?:total|amount|sales|vatable|balance|subtotal)/i.test(lineLower)) {
        const parts = numericText.split('.');
        const dollars = parts[0] + parts[1].slice(0, -2);
        const cents = parts[1].slice(-2);
        const alt = Number(`${dollars}.${cents}`);
        if (Number.isFinite(alt) && alt !== value && alt < 10000) {
          value = alt;
        }
      }
      if (!numericText.includes('.') && ((/,/.test(raw || match[0] || '')) || currencyMatchText) && value >= 10000) {
        const s = String(numericText);
        if (s.length > 2) {
          const alt = Number(s.slice(0, -2) + '.' + s.slice(-2));
          if (Number.isFinite(alt) && alt < value && alt < 10000) {
            value = alt;
          }
        }
      }
      const hasCurrency = !!currencyMatchText || /(?:php|₱|usd|us\$|\$|dollar|kwd|kd|د\.ك|دك)/i.test(match[0]);
      const currencySymbolMatch = currencyMatchText || (match[0].match(new RegExp(currencySymbols, 'i')) || [null])[0];
      const currencyCode = currencySymbolMatch ? String(currencySymbolMatch).toUpperCase().replace(/^US\$/i, 'USD').replace(/^\$/i, '$').replace(/^₱/i, 'PHP').replace(/^P$/i, 'PHP').replace(/D\.K|DK|KWD/i, 'KWD').replace(/DOLLAR/i, '$') : null;
      const hasDecimal = /\d+[.,]\d{1,3}/.test(raw);
      const isIntegerOnly = /^\d+$/.test(numericText);
      const looksLikeInvoiceId = lineLooksInvoice && isIntegerOnly && numericText.length >= 5;
      const score =
        (lineHasTotal ? 250 : 0)
        + (hasCurrency ? 60 : 0)
        + (hasDecimal ? 35 : 0)
        + (lineLower.includes('amount paid') ? 40 : 0)
        + (lineLower.includes('payment') ? 20 : 0)
        - (lineHasBadContext ? 150 : 0)
        - (perUnitAmountContext.test(lineLower) ? 140 : 0)
        - (isVatLine ? 120 : 0)
        - (isDateLine ? 120 : 0)
        - (looksLikeInvoiceId ? 100 : 0)
        - (isIntegerOnly && !lineHasTotal && !hasCurrency ? 30 : 0);
      amountCandidates.push({ value, raw, line, index, score, lineHasTotal, hasCurrency, hasDecimal, lineHasBadContext, looksLikeInvoiceId, currency: currencyCode, amountText: matchedText });
    }
  });

  const totalMatches = amountCandidates.filter((candidate) => candidate.lineHasTotal && !candidate.lineHasBadContext && !candidate.looksLikeInvoiceId);
  const currencyMatches = amountCandidates.filter((candidate) => candidate.hasCurrency && !candidate.lineHasBadContext && !candidate.looksLikeInvoiceId);
  const cleanMatches = amountCandidates.filter((candidate) => !candidate.lineHasBadContext && !candidate.looksLikeInvoiceId);
  const nonVatTotalMatches = totalMatches.filter((candidate) => !vatLinePattern.test(candidate.line));
  const amountEntry = nonVatTotalMatches.length > 0
    ? nonVatTotalMatches[nonVatTotalMatches.length - 1]
    : currencyMatches.length > 0
      ? currencyMatches.sort((a, b) => b.score - a.score || b.value - a.value)[0]
      : cleanMatches.length > 0
        ? cleanMatches.sort((a, b) => b.score - a.score || b.value - a.value)[0]
        : amountCandidates.sort((a, b) => b.score - a.score || b.value - a.value)[0] || null;
  const amount = amountEntry?.value ?? null;
  if (amountEntry) {
    currency = amountEntry.currency || null;
    amountText = amountEntry.amountText || null;
  }

  // --- FIX: liters / price-per-liter detection now happens BEFORE the
  // confidence block below, since the confidence block reads both values. ---
  let liters = null;
  let pricePerLiter = null;
  const litersPattern = /(?:quantity|qty|qtty)?\s*[:\-]?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:l|liters?|ltr|litre)\b/i;
  const litersPatternLeading = /\b(?:liters?|litre|volume|qty|quantity|qtty)\s*[:\-]?\s*([0-9]+(?:[.,][0-9]+)?)(?:\b|[^0-9])/i;
  const combinedLitersPricePattern = /([0-9]+(?:[.,][0-9]+)?)\s*(?:l|liters?|ltr|litre)\s*(?:@|at)\s*[₱$]?\s*([0-9]+(?:[.,][0-9]+)?)/i;
  const pricePerLiterPattern = /(?:price\s*(?:\/|per)\s*(?:l|lit|ltr|litre|liter|liters?)|p\.?\s*\/\s*l|price\s*[:\-]?\s*\/?\s*l(?:itre|iter)?|price\/l|price per liter|price\s*per\s*liter|price\s*l)\s*[:\-]?\s*([₱$]?\s*[0-9]{1,4}(?:[.,][0-9]{1,3})?)/i;
  const directPricePattern = /([₱$]?\s*[0-9]{1,4}(?:[.,][0-9]{1,3})?)\s*(?:\/|per)\s*(?:l|lit|ltr|litre|liter|liters?)\b/i;
  for (const line of normalizedLines) {
    if (liters === null) {
      const m = line.match(litersPattern) || line.match(litersPatternLeading);
      if (m) liters = Number(m[1].replace(/,/g, '.'));
    }
    if (pricePerLiter === null) {
      const m0 = line.match(combinedLitersPricePattern);
      if (m0) {
        const litersRaw = m0[1].replace(/,/g, '.');
        const priceRaw = m0[2].replace(/,/g, '.');
        const litersNum = Number(litersRaw);
        const priceNum = Number(priceRaw);
        if (Number.isFinite(litersNum) && litersNum > 0 && litersNum < 1000) liters = litersNum;
        if (Number.isFinite(priceNum) && priceNum > 0 && priceNum < 10000) pricePerLiter = priceNum;
      }
      if (pricePerLiter === null) {
        const m2 = line.match(pricePerLiterPattern);
        if (m2) {
          const raw = m2[1].replace(/[^0-9.,]/g, '').replace(/,/g, '.');
          const num = Number(raw);
          if (Number.isFinite(num) && num > 0 && num < 10000) pricePerLiter = num;
        } else {
          const m3 = line.match(directPricePattern);
          if (m3) {
            const raw = m3[1].replace(/[^0-9.,]/g, '').replace(/,/g, '.');
            const num = Number(raw);
            if (Number.isFinite(num) && num > 0 && num < 10000) pricePerLiter = num;
          }
        }
      }
    }
    if (liters !== null && pricePerLiter !== null) break;
  }
  if (pricePerLiter === null && liters != null && Number.isFinite(amount) && amount > 0 && liters > 0) {
    const inferred = amount / liters;
    if (Number.isFinite(inferred) && inferred > 0 && inferred < 10000) {
      pricePerLiter = Number(inferred.toFixed(2));
      console.log('[receiptOcr] inferred pricePerLiter from amount and liters:', pricePerLiter);
    }
  }

  let confidence = 'low';
  if (amountEntry) {
    if (amountEntry.lineHasTotal || amountEntry.hasCurrency || amountEntry.hasDecimal) {
      confidence = 'high';
    } else {
      confidence = 'medium';
    }
  }
  if (confidence === 'medium' && category === 'fuel' && Number.isFinite(liters) && Number.isFinite(pricePerLiter)) {
    confidence = 'high';
  }
  if (fuelType && confidence === 'medium') {
    confidence = 'high';
  }
  if (amountEntry?.lineHasBadContext || amountEntry?.looksLikeInvoiceId) {
    confidence = 'low';
  }

  const stationBrandPattern = /\b(petron|shell|seaoil|caltex|phoenix|unioil|gulf|cleanfuel|puma|prime|valero|esso|mobil|bp|chevron|citgo|suncor|arco|petro|fuel station|service station)\b/i;
  const fuelStationLinePattern = /(?:fuel station|station name|service station|branch)\s*[:\-]?\s*(.+)$/i;
  const addressSignalPattern = /\b(blvd|boulevard|ave|avenue|st|street|road|rd|drive|dr|way|lane|ln|circle|sq|square|city|town|county|zip|postal|quezon|manila|makati|pasig|cavite|bulacan|cebu|davao|corner|parkway|place|no:\s*\d|#\d+)\b/i;
  const metadataPattern = /(official receipt|receipt|invoice|subtotal|balance|total|amount due|amount payable|payment method|mode of payment|plaintext|vendor:|reference:|ref\b|cash\b|card\b|payment\b|date:|time|transaction\b|trx\b|tran\b|qty\b|quantity\b|price\b|fuel type|amount|paid|tendered|vat\b|vatable|atable|vat-exempt|cashier:|driver:|plate no:|plate:)/i;
  const amountMetaPattern = /(?:total amount|total|grand total|net total|amount due|amount payable|balance|due amount|amount paid|subtotal|amount tendered|cash tendered|payment|change)\b/i;
  const thankYouPattern = /^(?:thank you|thanks|drive safely|come again|see you)/i;
  const fuelNotePattern = /\b(fuel|diesel|petrol|gas|unleaded|blaze|premium|quantity|liters|liter|price\/l|price per liter|fuel type|pump|station)\b/i;
  const transactionPattern = /\b(tran(?:saction)?|trx|tnx|trn|txn|tin|receipt no|invoice no|invoice number|receipt number)\b/i;

  const lineItems = normalizedLines.map((line, index) => {
    const lowerLine = line.toLowerCase();
    const hasBrand = stationBrandPattern.test(line);
    const hasAddress = addressSignalPattern.test(line) && !stationBrandPattern.test(line);
    const isMeta = metadataPattern.test(lowerLine) || thankYouPattern.test(lowerLine);
    const isAmountLine = amountMetaPattern.test(lowerLine);
    const isReferenceLine = /ref(?:erence)?|receipt|invoice|tran(?:saction)?|trx\b|order|slip|ticket/i.test(lowerLine);
    const isPaymentLine = /(?:mode of payment|cash|card|visa|mastercard|amex|credit|debit|gcash|paymaya|paypal|grabpay|e-wallet|ewallet)/i.test(lowerLine);
    const isLocationLine = /(edsa|corner|parkway|makati|guadalupe|city|town|avenue|road|street|ave|blvd|lane|place|ncr|quezon|cubao|alabang|province)/i.test(line);
    const words = line.trim().split(/\s+/).length;
    const alphaCount = (line.match(/[A-Za-z]/g) || []).length;
    const digitCount = (line.match(/\d/g) || []).length;
    const punctuationRatio = (line.match(/[^A-Za-z0-9 ]/g) || []).length / Math.max(line.length, 1);
    const garbled = isLikelyGarbledLine(line);
    return {
      line, lowerLine, index, hasBrand, hasAddress, isMeta, isAmountLine, isReferenceLine,
      isPaymentLine, isLocationLine, words, alphaCount, digitCount, punctuationRatio, garbled,
    };
  });

  const brandLineItem = lineItems.find((item) => item.hasBrand && !item.isMeta && !item.garbled);
  const vendorCandidates = lineItems
    .filter((item) => !item.isMeta && !item.hasAddress && !item.garbled && item.alphaCount >= 3 && item.digitCount < 4 && item.line.length > 5)
    .filter((item) => !/(?:total|amount|balance|subtotal|vat|cash|card|payment|receipt|invoice|official receipt|pump|station|liters?|liter|qty|quantity|price per liter|price\/l|price per litre|fuel type)/i.test(item.line))
    .sort((a, b) => {
      const aScore = (a.hasBrand ? 120 : 0) + (a.index < 3 ? 30 : 0) + a.alphaCount - a.punctuationRatio * 20;
      const bScore = (b.hasBrand ? 120 : 0) + (b.index < 3 ? 30 : 0) + b.alphaCount - b.punctuationRatio * 20;
      return bScore - aScore || a.index - b.index;
    });

  const topVendor = brandLineItem || vendorCandidates[0];
  if (brandLineItem) {
    vendor = brandLineItem.line.trim();
  } else if (topVendor) {
    vendor = topVendor.line
      .replace(/^(?:<[^>]*>\s*)?/, '')
      .replace(/[/|•].*$/, '')
      .replace(thankYouPattern, '')
      .replace(addressSignalPattern, '')
      .trim()
      .replace(/\b(OFFICIAL RECEIPT|RECEIPT|INVOICE)\b/i, '')
      .trim()
      .slice(0, 60);
  }

  if (vendor && /(?:total|amount|balance|subtotal|vat|cash|card|payment|receipt|invoice)/i.test(vendor)) {
    vendor = null;
  }

  const vendorLineIndex = topVendor?.index ?? -1;

  // FIX: reject garbled lines from Location candidates.
  const locationCandidates = lineItems
    .filter((item) => (item.hasAddress || item.isLocationLine) && !item.isMeta && !item.isReferenceLine && !item.garbled && item.index !== vendorLineIndex)
    .sort((a, b) => {
      const aScore = (/(city|town|province|manila|makati|pasig|cavite|bulacan|cebu|davao)/i.test(a.line) ? 30 : 0) + a.line.length;
      const bScore = (/(city|town|province|manila|makati|pasig|cavite|bulacan|cebu|davao)/i.test(b.line) ? 30 : 0) + b.line.length;
      return bScore - aScore || a.index - b.index;
    });
  if (locationCandidates.length > 0) {
    location = locationCandidates[0].line.trim().slice(0, 80);
  }

  const locationLineIndex = locationCandidates[0]?.index ?? -1;

  // FIX: reject garbled lines from note/description candidates too.
  const noteCandidates = lineItems
    .filter((item) => {
      if (item.isMeta || item.isAmountLine || item.isReferenceLine || item.isPaymentLine || item.hasBrand || item.hasAddress || item.garbled) return false;
      if (item.index === vendorLineIndex || item.index === locationLineIndex) return false;
      if (item.line.length < 6 || item.line.length > 120) return false;
      if (thankYouPattern.test(item.lowerLine)) return false;
      if (/\b(vat|vatable|vat-exempt|subtotal|total|amount|balance|cash|card|payment|invoice|receipt|tin|reg\.|tax|quantity|price per liter|price\/l|price per litre|pump|station|fuel type|liters?|liter)\b/i.test(item.lowerLine)) return false;
      return true;
    })
    .map((item) => {
      const fuelScore = fuelNotePattern.test(item.lowerLine) ? 60 : 0;
      const indexScore = item.index > vendorLineIndex ? 20 : 0;
      const lengthScore = Math.min(item.line.length, 50);
      return { line: item.line, score: fuelScore + indexScore + lengthScore, index: item.index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.line);

  // If we detected a fuel type by dictionary match, prefer it as the note
  // over whatever generic text lines happened to score highest.
  const note = fuelType
    ? fuelType
    : (noteCandidates.slice(0, 2).join(' • ').slice(0, 180) || null);

  // Decide fuel_station: prefer an explicit station-brand line first,
  // then vendor if it matches a fuel brand.
  const stationLine = normalizedLines.find((line) => stationBrandPattern.test(line) && !isLikelyGarbledLine(line));
  let fuelStation = stationLine ? lineItems.find((item) => stationBrandPattern.test(item.line))?.line.trim() : null;
  if (!fuelStation) {
    const stationNameLine = normalizedLines.find((line) => fuelStationLinePattern.test(line));
    if (stationNameLine) {
      const match = stationNameLine.match(fuelStationLinePattern);
      fuelStation = match ? match[1].trim().replace(/\b(receipt|invoice|no|number|qty|price|total|liters?|liter|pump)\b/gi, '').trim() : null;
    }
  }
  if (!fuelStation && vendor && stationBrandPattern.test(vendor)) {
    fuelStation = vendor;
  }
  if (fuelStation && /^(?:pump\s*\d+|liters?\s*\d+|price\s*per\s*l|price\/l|qty\s*\d+)/i.test(fuelStation)) {
    fuelStation = null;
  }

  const referencePatterns = [
    /ref(?:erence)?\s*#?\s*[:#-]?\s*([A-Za-z0-9-]{3,})/i,
    /(?:receipt|invoice)\s*(?:no|number|#)?\s*[:#-]?\s*([A-Za-z0-9-]{3,})/i,
    /(?:trx|transaction|tran)\s*#?\s*[:#-]?\s*([A-Za-z0-9-]{3,})/i,
    /order\s*#?\s*[:#-]?\s*([A-Za-z0-9-]{3,})/i,
    /(?:serial|slip)\s*#?\s*[:#-]?\s*([A-Za-z0-9-]{3,})/i,
  ];
  for (const pattern of referencePatterns) {
    for (const item of lineItems) {
      if (item.isAmountLine || item.isPaymentLine || item.isLocationLine) continue;
      const match = item.line.match(pattern);
      if (match) {
        const candidate = (match[1] || '').trim();
        if (candidate.length >= 3 && /\d/.test(candidate) && !/^0+$/.test(candidate)) {
          referenceNumber = candidate;
          break;
        }
      }
    }
    if (referenceNumber) break;
  }

  if (!referenceNumber) {
    for (const item of lineItems) {
      const match = item.line.match(/(?:tran(?:saction)?|trx|trn|tnx|txn)\s*[:#-]?\s*([A-Za-z0-9-]{3,})/i);
      if (match) {
        const candidate = (match[1] || '').trim();
        if (candidate.length >= 3 && /\d/.test(candidate)) {
          referenceNumber = candidate;
          break;
        }
      }
    }
  }

  if (!referenceNumber) {
    const fallbackReference = lineItems
      .filter((item) => !item.isMeta && /\d/.test(item.line))
      .map((item) => item.line.match(/([A-Za-z0-9-]{5,})/g) || [])
      .flat()
      .filter((candidate) => /\d/.test(candidate) && !/^(?:total|subtotal|vat|vatable|amount|balance|cash|card|payment|thank|come|again)$/i.test(candidate))
      .sort((a, b) => b.length - a.length);
    if (fallbackReference.length > 0) {
      referenceNumber = fallbackReference[0];
    }
  }

  if (/(fuel card|fleet card)/i.test(lower)) paymentMethod = 'fuel card';
  else if (/(cash|cashier)/i.test(lower)) paymentMethod = 'cash';
  else if (/(visa|mastercard|amex|credit|debit|card)/i.test(lower)) paymentMethod = 'card';
  else if (/(gcash|paymaya|paypal|grabpay|e-wallet|ewallet)/i.test(lower)) paymentMethod = 'e-wallet';

  return { amount, currency, amountText, category, vendor, fuelStation, fuelType, liters, pricePerLiter, location, note, referenceNumber, paymentMethod, confidence };
}

function normalizeOcrResult(parsed, source, rawText = null) {
  const liters = Number.isFinite(parsed.liters) ? parsed.liters : null;
  const pricePerLiter = Number.isFinite(parsed.pricePerLiter) ? Number(parsed.pricePerLiter) : (Number.isFinite(parsed.price_per_liter) ? Number(parsed.price_per_liter) : null);
  // fuel type may come from a provider directly (e.g. Groq's JSON schema)
  // or need to be inferred from whatever text we have available.
  const fuelType = parsed.fuelType || parsed.fuel_type
    || detectFuelType([parsed.note, parsed.vendor, rawText].filter(Boolean).join(' \n '));
  const result = {
    amount: Number.isFinite(parsed.amount) ? parsed.amount : null,
    currency: parsed.currency || null,
    amountText: parsed.amountText || null,
    category: parsed.category || (fuelType ? 'fuel' : null) || null,
    vendor: parsed.vendor || null,
    fuel_station: parsed.fuelStation || parsed.fuel_station || null,
    fuelStation: parsed.fuelStation || parsed.fuel_station || null,
    fuel_type: fuelType || null,
    fuelType: fuelType || null,
    liters,
    price_per_liter: pricePerLiter,
    pricePerLiter,
    location: parsed.location || null,
    note: parsed.note || null,
    referenceNumber: parsed.referenceNumber || null,
    paymentMethod: parsed.paymentMethod || null,
    confidence: parsed.confidence || 'low',
    source,
    rawText,
  };
  const useful = Boolean(
    Number.isFinite(result.amount)
    || result.category
    || result.note
    || result.referenceNumber
    || result.paymentMethod
    || Number.isFinite(result.liters)
    || Number.isFinite(result.price_per_liter)
    || result.fuelStation
    || result.fuelType
    || result.vendor
    || result.location
  );
  return { ok: useful, ...result };
}

async function scanWithGroq(photoBase64) {
  const fetchFn = typeof fetch === 'function' ? fetch : require('node-fetch');

  const response = await fetchFn(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      temperature: 0,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: EXTRACTION_PROMPT },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${photoBase64}` } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Groq request failed: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Groq returned an empty response');

  const cleaned = raw.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  const allowedCategories = new Set(['fuel', 'maintenance', 'toll', 'parking', 'other']);
  return normalizeOcrResult({
    amount: Number.isFinite(Number(parsed.amount)) ? Number(parsed.amount) : null,
    currency: parsed.currency || null,
    amountText: parsed.amountText || null,
    category: allowedCategories.has(parsed.category) ? parsed.category : null,
    vendor: parsed.vendor || null,
    fuel_station: parsed.fuel_station || null,
    fuel_type: parsed.fuel_type || null,
    liters: Number.isFinite(Number(parsed.liters)) ? Number(parsed.liters) : null,
    price_per_liter: Number.isFinite(Number(parsed.price_per_liter)) ? Number(parsed.price_per_liter) : null,
    note: parsed.note || null,
    referenceNumber: parsed.referenceNumber || null,
    paymentMethod: parsed.paymentMethod || null,
    confidence: parsed.confidence || 'low',
  }, 'groq', cleaned);
}

const fs = require('fs');
const path = require('path');

async function scanWithGoogleVision(photoBase64) {
  try {
    const vision = require('@google-cloud/vision');
    const candidates = [];
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) candidates.push(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    candidates.push(path.resolve(__dirname, '..', 'fleets-504201-ce5c04e0d241.json'));
    candidates.push(path.resolve(__dirname, '..', '..', 'fleets-504201-ce5c04e0d241.json'));
    let keyFile = null;
    for (const c of candidates) {
      try {
        if (c && fs.existsSync(c)) {
          keyFile = c;
          break;
        }
      } catch (e) {
        // ignore
      }
    }
    console.log('[receiptOcr] Google Vision using key file:', keyFile || 'default-credentials');
    const client = keyFile ? new vision.ImageAnnotatorClient({ keyFilename: keyFile }) : new vision.ImageAnnotatorClient();
    console.log('[receiptOcr] Google Vision request size:', photoBase64.length, 'chars');
    const [result] = await client.documentTextDetection({ image: { content: Buffer.from(photoBase64, 'base64') } });
    const text = result?.fullTextAnnotation?.text || '';
    if (!text.trim()) return { ok: false, reason: 'empty_response' };

    const parsed = parseReceiptText(text);
    return normalizeOcrResult({
      amount: parsed.amount,
      currency: parsed.currency || null,
      amountText: parsed.amountText || null,
      category: parsed.category,
      vendor: parsed.vendor || null,
      fuelStation: parsed.fuelStation || null,
      fuelType: parsed.fuelType || null,
      liters: Number.isFinite(parsed.liters) ? parsed.liters : null,
      pricePerLiter: Number.isFinite(parsed.pricePerLiter) ? Number(parsed.pricePerLiter) : null,
      location: parsed.location || null,
      note: parsed.note,
      referenceNumber: parsed.referenceNumber || null,
      paymentMethod: parsed.paymentMethod || null,
      confidence: parsed.confidence || (parsed.amount ? 'medium' : 'low'),
    }, 'google_vision', text);
  } catch (err) {
    console.warn('[receiptOcr] Google Vision client failed:', err.message || err);
    if (GOOGLE_CLOUD_VISION_API_KEY) {
      const fetchFn = typeof fetch === 'function' ? fetch : require('node-fetch');
      const response = await fetchFn(GOOGLE_CLOUD_VISION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: photoBase64 },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
            },
          ],
        }),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Google Vision request failed: ${response.status} ${errText}`);
      }
      const data = await response.json();
      const text = data?.responses?.[0]?.fullTextAnnotation?.text || '';
      if (!text.trim()) return { ok: false, reason: 'empty_response' };
      const parsed = parseReceiptText(text);
      return normalizeOcrResult({
        amount: parsed.amount,
        currency: parsed.currency || null,
        amountText: parsed.amountText || null,
        category: parsed.category,
        vendor: parsed.vendor || null,
        fuelStation: parsed.fuelStation || null,
        fuelType: parsed.fuelType || null,
        liters: Number.isFinite(parsed.liters) ? parsed.liters : null,
        pricePerLiter: Number.isFinite(parsed.pricePerLiter) ? Number(parsed.pricePerLiter) : null,
        location: parsed.location || null,
        note: parsed.note,
        referenceNumber: parsed.referenceNumber || null,
        paymentMethod: parsed.paymentMethod || null,
        confidence: parsed.confidence || (parsed.amount ? 'medium' : 'low'),
      }, 'google_vision', text);
    }
    throw err;
  }
}

async function scanWithOcrSpace(photoBase64) {
  if (!OCR_SPACE_API_KEY) return { ok: false, reason: 'ocr_space_not_configured' };
  const fetchFn = typeof fetch === 'function' ? fetch : require('node-fetch');
  const response = await fetchFn(OCR_SPACE_URL, {
    method: 'POST',
    headers: {
      apikey: OCR_SPACE_API_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      base64Image: `data:image/jpeg;base64,${photoBase64}`,
      language: 'eng',
      isOverlayRequired: 'false',
      OCREngine: '2',
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OCR.space request failed: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const parsedText = data?.ParsedResults?.[0]?.ParsedText || '';
  if (!parsedText.trim()) return { ok: false, reason: 'empty_response' };

  const parsed = parseReceiptText(parsedText);
  return normalizeOcrResult({
    amount: parsed.amount,
    currency: parsed.currency || null,
    amountText: parsed.amountText || null,
    category: parsed.category,
    vendor: parsed.vendor || null,
    fuelStation: parsed.fuelStation || null,
    fuelType: parsed.fuelType || null,
    liters: Number.isFinite(parsed.liters) ? parsed.liters : null,
    pricePerLiter: Number.isFinite(parsed.pricePerLiter) ? Number(parsed.pricePerLiter) : null,
    location: parsed.location || null,
    note: parsed.note,
    referenceNumber: parsed.referenceNumber || null,
    paymentMethod: parsed.paymentMethod || null,
    confidence: parsed.confidence || 'low',
  }, 'ocr_space', parsedText);
}

async function scanWithAzureVision(photoBase64) {
  if (!AZURE_COMPUTER_VISION_KEY || !AZURE_COMPUTER_VISION_ENDPOINT) {
    return { ok: false, reason: 'azure_not_configured' };
  }
  const fetchFn = typeof fetch === 'function' ? fetch : require('node-fetch');
  const endpoint = AZURE_COMPUTER_VISION_ENDPOINT.replace(/\/$/, '');
  const url = `${endpoint}/vision/v4.0/ocr?language=unk&detectOrientation=true`;

  const response = await fetchFn(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': AZURE_COMPUTER_VISION_KEY,
      'Content-Type': 'application/octet-stream',
    },
    body: Buffer.from(photoBase64, 'base64'),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Azure Computer Vision request failed: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const regions = data?.regions || [];
  const parsedText = regions
    .flatMap((region) => region.lines || [])
    .flatMap((line) => line.words || [])
    .map((word) => word.text)
    .join(' ')
    .trim();

  if (!parsedText) return { ok: false, reason: 'empty_response' };

  const parsed = parseReceiptText(parsedText);
  return normalizeOcrResult({
    amount: parsed.amount,
    currency: parsed.currency || null,
    amountText: parsed.amountText || null,
    category: parsed.category,
    vendor: parsed.vendor || null,
    fuelStation: parsed.fuelStation || null,
    fuelType: parsed.fuelType || null,
    liters: Number.isFinite(parsed.liters) ? parsed.liters : null,
    pricePerLiter: Number.isFinite(parsed.pricePerLiter) ? Number(parsed.pricePerLiter) : null,
    location: parsed.location || null,
    note: parsed.note,
    referenceNumber: parsed.referenceNumber || null,
    paymentMethod: parsed.paymentMethod || null,
    confidence: parsed.confidence || 'low',
  }, 'azure_vision', parsedText);
}

async function withOcrTimeout(fn, timeoutMs = OCR_TIMEOUT_MS) {
  let timer;
  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`OCR timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function scanWithTesseract(photoBase64) {
  let createWorker;
  try {
    ({ createWorker } = require('tesseract.js'));
  } catch (e) {
    console.warn('[receiptOcr] tesseract.js not installed:', e.message || e);
    return { ok: false, reason: 'tesseract_not_installed' };
  }
  const worker = await createWorker('eng');
  try {
    const imageBuffer = Buffer.from(photoBase64, 'base64');
    const result = await worker.recognize(imageBuffer);
    const text = result?.data?.text || '';
    if (!text.trim()) return { ok: false, reason: 'empty_response' };

    const parsed = parseReceiptText(text);
    return normalizeOcrResult({
      amount: parsed.amount,
      currency: parsed.currency || null,
      amountText: parsed.amountText || null,
      category: parsed.category,
      vendor: parsed.vendor || null,
      fuelStation: parsed.fuelStation || null,
      fuelType: parsed.fuelType || null,
      liters: Number.isFinite(parsed.liters) ? parsed.liters : null,
      pricePerLiter: Number.isFinite(parsed.pricePerLiter) ? Number(parsed.pricePerLiter) : null,
      location: parsed.location || null,
      note: parsed.note,
      referenceNumber: parsed.referenceNumber || null,
      paymentMethod: parsed.paymentMethod || null,
      confidence: parsed.confidence || 'low',
    }, 'tesseract', text);
  } finally {
    await worker.terminate();
  }
}

async function scanReceipt(photoBase64) {
  if (!photoBase64) return { ok: false, reason: 'no_photo' };

  const providers = [];

  const hasGoogleClient = !!(GOOGLE_CLOUD_VISION_API_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (hasGoogleClient) {
    providers.push({ name: 'google_vision', run: () => scanWithGoogleVision(photoBase64) });
  }

  if (GROQ_API_KEY) {
    providers.push({ name: 'groq', run: () => scanWithGroq(photoBase64) });
  }

  if (OCR_SPACE_API_KEY) {
    providers.push({ name: 'ocr_space', run: () => scanWithOcrSpace(photoBase64) });
  }

  if (AZURE_COMPUTER_VISION_KEY && AZURE_COMPUTER_VISION_ENDPOINT) {
    providers.push({ name: 'azure_vision', run: () => scanWithAzureVision(photoBase64) });
  }

  providers.push({ name: 'tesseract', run: () => scanWithTesseract(photoBase64) });

  const providerResults = [];
  const candidateResults = [];

  for (const provider of providers) {
    try {
      const result = await withOcrTimeout(provider.run);
      const summary = {
        name: provider.name,
        ok: !!result?.ok,
        reason: result?.reason || null,
        source: result?.source || null,
        rawText: result?.rawText ? String(result.rawText).slice(0, 1500) : null,
      };
      providerResults.push(summary);

      if (!result?.ok) {
        if (result?.reason) {
          console.warn(`[receiptOcr] ${provider.name} returned no usable result:`, result.reason);
        }
        continue;
      }

      const useful = result.amount != null || result.category || result.note || result.referenceNumber || result.paymentMethod || result.liters != null || result.price_per_liter != null || result.fuel_station || result.fuelType || result.vendor;
      const highConfidence = result.confidence === 'high' && useful;
      if (highConfidence) {
        return OCR_DEBUG ? { ...result, providerResults } : result;
      }

      candidateResults.push(result);
    } catch (err) {
      providerResults.push({ name: provider.name, ok: false, error: err.message || String(err) });
      console.warn(`[receiptOcr] ${provider.name} failed:`, err.message || err);
    }
  }

  if (candidateResults.length > 0) {
    const best = candidateResults.sort((a, b) => {
      const score = (value) => (value.confidence === 'high' ? 300 : value.confidence === 'medium' ? 200 : 100)
        + (value.amount != null ? 80 : 0)
        + (value.category ? 20 : 0)
        + (value.note ? 10 : 0)
        + (value.referenceNumber ? 10 : 0)
        + (value.paymentMethod ? 5 : 0)
        + (value.liters != null ? 15 : 0)
        + (value.price_per_liter != null ? 15 : 0)
        + (value.fuelType ? 15 : 0);
      return score(b) - score(a);
    })[0];
    return OCR_DEBUG ? { ...best, providerResults } : best;
  }

  return {
    ok: false,
    reason: 'ocr_not_configured',
    details: 'No OCR provider returned usable text or parseable fields',
    providerResults,
  };
}

module.exports = { scanReceipt, parseReceiptText, detectFuelType };