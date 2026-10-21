// SERVER ONLY. Used by lib/audit.ts (to save the device at login) and by the audit-logs API route
// (to show a device on every row). Do not import it from a "use client" file: the phone list below is
// large and would be added to the browser bundle.
//
// Needs, once:
//   npm i device-detector-js
//   lib/device-models.json   (Google Play's device list: model code -> { brand, name })

import DeviceDetector from "device-detector-js";
import devices from "./device-models.json";

export type DeviceInfo = {
  label: string; // e.g. "itel C671L · Android 13 · Chrome"
  type: "mobile" | "tablet" | "desktop";
  model: string | null;     // marketing name when known (e.g. "Realme 6"), otherwise the raw model code
  modelCode: string | null; // raw code the browser reported (e.g. "RMX2001"), only set when model was translated
  os: string | null;
  browser: string | null;
};

// The model hint comes from the browser, so keep it short and plain before storing it.
export function cleanDeviceModel(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[^\w .\-+()/]/g, "").trim().slice(0, 60);
  return s || null;
}

// getDeviceHint() returns "Windows 11" / "macOS" / "Android" when the browser has no model to give.
const OS_HINT = /^(windows|macos|linux|android|chrome ?os|ios|ipados)/i;

export function parseDevice(
  userAgent?: string | null,
  hint?: string | null,
  marketingName?: string | null // replaces the raw model code (see resolveMarketingName below)
): DeviceInfo {
  const ua = userAgent ?? "";
  let m: RegExpMatchArray | null;

  // OS (order matters: Android UAs contain "Linux", iPhone/iPad UAs contain "Mac OS X")
  let os: string | null = null;
  if ((m = ua.match(/Android ([\d.]+)/))) os = `Android ${m[1]}`;
  else if ((m = ua.match(/iPhone OS ([\d_]+)/))) os = `iOS ${m[1].replace(/_/g, ".")}`;
  else if ((m = ua.match(/CPU OS ([\d_]+)/))) os = `iPadOS ${m[1].replace(/_/g, ".")}`;
  else if (/Windows NT 10/.test(ua)) os = "Windows 10/11";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Linux/.test(ua)) os = "Linux";

  // Browser
  let browser: string | null = null;
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/SamsungBrowser\//.test(ua)) browser = "Samsung Internet";
  else if (/Firefox\/|FxiOS\//.test(ua)) browser = "Firefox";
  else if (/CriOS\/|Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";

  // Device type
  let type: DeviceInfo["type"] = "desktop";
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) type = "tablet";
  else if (/Mobi|iPhone|Android/.test(ua)) type = "mobile";

  // Model: the client hint wins (modern Chrome hides the real model in the UA and shows just "K").
  let model: string | null = null;
  if (hint && OS_HINT.test(hint)) {
    os = hint; // no model available, but the hint has a better OS name (e.g. "Windows 11")
  } else if (hint) {
    model = hint;
  } else if ((m = ua.match(/Android [\d.]+; ([^;)]+)/)) && !/^(K|Linux)$/.test(m[1].trim())) {
    model = m[1].trim();
  } else if (/iPhone/.test(ua)) {
    model = "iPhone";
  } else if (/iPad/.test(ua)) {
    model = "iPad";
  }

  const modelCode = marketingName && model && marketingName !== model ? model : null;
  if (marketingName) model = marketingName;

  const first = model ?? (type === "desktop" ? "Desktop" : type === "tablet" ? "Tablet" : "Mobile");
  const label = [first, os, browser].filter(Boolean).join(" · ");
  return { label, type, model, modelCode, os, browser };
}

// ---------- phone model code -> marketing name ----------

type Entry = { brand: string; name: string };

// Your own fixes, checked first. Use this for phones that are missing from the list or named wrongly.
// key = the model code exactly as it shows in your audit log (UPPERCASE), value = the name to show.
const OVERRIDES: Record<string, string> = {
  // "RMX2001": "realme 6",
  // "ITEL C671L": "itel City 100",
};

// Codes are compared without case, spaces, "-" or "_", so "itel C671L", "ITEL-C671L" and
// "itel_c671l" all find the same entry.
const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");

let index: Map<string, Entry> | null = null;
function getIndex() {
  if (!index) {
    index = new Map();
    for (const [code, entry] of Object.entries(devices as unknown as Record<string, Entry>)) {
      const key = norm(code);
      if (key && !index.has(key)) index.set(key, entry);
    }
  }
  return index;
}

// "Acer" + "Iconia One 10" -> "Acer Iconia One 10", but "TCL" + "TCL 60 XE" stays "TCL 60 XE".
function display(entry: Entry): string {
  const brand = entry.brand?.trim() ?? "";
  const name = entry.name?.trim() ?? "";
  if (!name) return brand;
  if (!brand || name.toLowerCase().startsWith(brand.toLowerCase())) return name;
  return `${brand} ${name}`;
}

const BRAND_PREFIX = /^(itel|infinix|tecno|realme|samsung|xiaomi|redmi|poco|oppo|vivo|huawei|honor|motorola|nokia|oneplus)[\s_-]*/i;

// When the browser has no model to give, getDeviceHint() returns just the OS ("Android", "Windows 11", ...).
// That is not a phone model, and "Android" even exists as a code in Google's list, so never look it up.
const GENERIC_HINT = /^(windows|macos|linux|android|chrome ?os|ios|ipados)\b/i;

const detector = new DeviceDetector();

export function resolveMarketingName(userAgent: string | null, rawHint: string | null): string | null {
  try {
    const hint = rawHint && !GENERIC_HINT.test(rawHint) ? rawHint : null;

    if (hint) {
      // 1. your own fixes
      const fixed = OVERRIDES[hint.toUpperCase()];
      if (fixed) return fixed;

      // 2. Google's device list (the model code is what the browser reports as the model)
      const idx = getIndex();
      const hit = idx.get(norm(hint)) ?? idx.get(norm(hint.replace(BRAND_PREFIX, "")));
      if (hit) return display(hit);
    }

    // 3. backup: device-detector-js, using the user agent with the real model put back in
    //    (modern Chrome shows just "K" there)
    let ua = userAgent ?? "";
    if (!ua) return null;
    if (hint) ua = ua.replace(/(Android [\d.]+; )[^)]*\)/, `$1${hint})`);

    const { brand, model } = detector.parse(ua).device ?? {};
    if (brand && model) return `${brand} ${model}`;
    return null;
  } catch (err) {
    console.error("Device name lookup failed:", err);
    return null;
  }
}


// One call that does everything: parse the user agent, clean the browser's model hint, and translate the
// model code into its marketing name. `rawHint` is the deviceModel value sent by the login page.
export function describeDevice(userAgent?: string | null, rawHint?: unknown): DeviceInfo {
  const hint = cleanDeviceModel(rawHint);
  return parseDevice(userAgent, hint, resolveMarketingName(userAgent ?? null, hint));
}