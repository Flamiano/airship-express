"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const FTM_SETTINGS_STORAGE_KEY = "ftm-system-settings";
export const FTM_SETTINGS_CHANGED_EVENT = "ftm:settings-changed";

export type FtmSystemSettings = {
  version: 1;
  appearance: { theme: "light" | "dark"; reducedMotion: boolean; density: "comfortable" | "compact" };
  notifications: { dispatch: boolean; fleet: boolean; safety: boolean; system: boolean; email: boolean; sms: boolean; push: boolean };
  preferences: { language: string; timezone: string; dateFormat: string; timeFormat: string; landingPage: string };
  privacy: { profileVisibility: "Team" | "Private"; locationTracking: boolean; activeTripTracking: boolean };
  operations: { mapView: string; tripFilter: string; vehicleMarkers: boolean; driverMarkers: boolean; routeLines: boolean; courierWaypoints: boolean; autoCenter: boolean };
  dataBackups: {
    enabled: boolean;
    daily: boolean;
    weekly: boolean;
    monthly: boolean;
    yearly: boolean;
    retentionDays: number;
    lastRun: string;
    nextRun: string;
  };
  security: {
    rbacEnabled: boolean;
    passkeyMode: "software" | "hardware";
    otpLifetimeSeconds: number;
    hashFunction: "Argon2id" | "PBKDF2-HMAC-SHA256" | "bcrypt";
    sessionTimeoutMinutes: number;
    lockoutThreshold: number;
    lockoutDurationMinutes: number;
    maxUsersPerDevice: number;
  };
  system: { navigationPrefetch: boolean; networkNotices: boolean };
  updatedAt: string;
};

export const DEFAULT_FTM_SETTINGS: FtmSystemSettings = {
  version: 1,
  appearance: { theme: "light", reducedMotion: false, density: "comfortable" },
  notifications: { dispatch: true, fleet: true, safety: true, system: true, email: true, sms: false, push: true },
  preferences: { language: "English", timezone: "Asia/Manila", dateFormat: "MM/DD/YYYY", timeFormat: "12-hour", landingPage: "Role dashboard" },
  privacy: { profileVisibility: "Team", locationTracking: false, activeTripTracking: false },
  operations: { mapView: "Active dispatch", tripFilter: "Active trips", vehicleMarkers: true, driverMarkers: true, routeLines: true, courierWaypoints: true, autoCenter: false },
  dataBackups: {
    enabled: true,
    daily: true,
    weekly: true,
    monthly: true,
    yearly: true,
    retentionDays: 365,
    lastRun: new Date().toISOString(),
    nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
  security: {
    rbacEnabled: true,
    passkeyMode: "software",
    otpLifetimeSeconds: 60,
    hashFunction: "Argon2id",
    sessionTimeoutMinutes: 5,
    lockoutThreshold: 5,
    lockoutDurationMinutes: 15,
    maxUsersPerDevice: 1,
  },
  system: { navigationPrefetch: true, networkNotices: true },
  updatedAt: "",
};

type SettingsContextValue = {
  settings: FtmSystemSettings;
  updateSettings: <K extends keyof Omit<FtmSystemSettings, "version" | "updatedAt">>(section: K, patch: Partial<FtmSystemSettings[K]>) => void;
  resetPersonalization: () => void;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

function parseRecord(value: string | null) {
  try { return value ? JSON.parse(value) as Record<string, unknown> : {}; } catch { return {}; }
}

export function readFtmSettings(): FtmSystemSettings {
  if (typeof window === "undefined") return DEFAULT_FTM_SETTINGS;
  const stored = parseRecord(window.localStorage.getItem(FTM_SETTINGS_STORAGE_KEY));
  const general = parseRecord(window.localStorage.getItem("ftm-general-preferences"));
  const advanced = parseRecord(window.localStorage.getItem("ftm-advanced-preferences"));
  const alerts = parseRecord(window.localStorage.getItem("ftm-alert-preferences"));
  const legacyNotifications = parseRecord(window.localStorage.getItem("ftm-notification-preferences"));
  const legacySecurity = parseRecord(window.localStorage.getItem("ftm-security-settings"));
  const appearance = stored.appearance as Record<string, unknown> | undefined;
  const notifications = stored.notifications as Record<string, unknown> | undefined;
  const preferences = stored.preferences as Record<string, unknown> | undefined;
  const privacy = stored.privacy as Record<string, unknown> | undefined;
  const operations = stored.operations as Record<string, unknown> | undefined;
  const dataBackups = stored.dataBackups as Record<string, unknown> | undefined;
  const system = stored.system as Record<string, unknown> | undefined;
  const security = stored.security as Record<string, unknown> | undefined;

  return {
    ...DEFAULT_FTM_SETTINGS,
    ...stored,
    appearance: { ...DEFAULT_FTM_SETTINGS.appearance, ...appearance, theme: window.localStorage.getItem("airship-theme") === "dark" ? "dark" : appearance?.theme === "dark" ? "dark" : "light", reducedMotion: window.localStorage.getItem("ftm-reduced-motion") === "true" || appearance?.reducedMotion === true },
    notifications: { ...DEFAULT_FTM_SETTINGS.notifications, ...legacyNotifications, ...notifications },
    preferences: { ...DEFAULT_FTM_SETTINGS.preferences, ...general, ...preferences },
    privacy: { ...DEFAULT_FTM_SETTINGS.privacy, profileVisibility: advanced.profileVisibility === "Private" ? "Private" : privacy?.profileVisibility === "Private" ? "Private" : "Team", locationTracking: advanced.locationTracking === true || privacy?.locationTracking === true, activeTripTracking: advanced.activeTripTracking === true || privacy?.activeTripTracking === true },
    operations: { ...DEFAULT_FTM_SETTINGS.operations, ...advanced, ...operations },
    dataBackups: {
      ...DEFAULT_FTM_SETTINGS.dataBackups,
      ...dataBackups,
      enabled: dataBackups?.enabled !== false,
      daily: dataBackups?.daily !== false,
      weekly: dataBackups?.weekly !== false,
      monthly: dataBackups?.monthly !== false,
      yearly: dataBackups?.yearly !== false,
      retentionDays: Number(dataBackups?.retentionDays ?? DEFAULT_FTM_SETTINGS.dataBackups.retentionDays),
    },
    security: { ...DEFAULT_FTM_SETTINGS.security, ...legacySecurity, ...security },
    system: { ...DEFAULT_FTM_SETTINGS.system, ...system, networkNotices: alerts.networkNotices === false ? false : system?.networkNotices !== false },
    updatedAt: typeof stored.updatedAt === "string" ? stored.updatedAt : "",
  };
}

export function persistFtmSettings(next: FtmSystemSettings) {
  if (typeof window === "undefined") return;
  const settings = { ...next, updatedAt: new Date().toISOString() };
  window.localStorage.setItem(FTM_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  window.localStorage.setItem("airship-theme", settings.appearance.theme);
  window.localStorage.setItem("ftm-reduced-motion", String(settings.appearance.reducedMotion));
  window.localStorage.setItem("ftm-notification-preferences", JSON.stringify(settings.notifications));
  window.localStorage.setItem("ftm-general-preferences", JSON.stringify(settings.preferences));
  window.localStorage.setItem("ftm-advanced-preferences", JSON.stringify({ ...settings.operations, ...settings.privacy }));
  window.localStorage.setItem("ftm-security-settings", JSON.stringify(settings.security));
  window.dispatchEvent(new CustomEvent(FTM_SETTINGS_CHANGED_EVENT, { detail: settings }));
}

function applySettings(settings: FtmSystemSettings) {
  const root = document.documentElement;
  root.lang = settings.preferences.language === "English" ? "en" : settings.preferences.language.toLowerCase().slice(0, 2);
  root.classList.toggle("dark", settings.appearance.theme === "dark");
  root.classList.toggle("ftm-reduced-motion", settings.appearance.reducedMotion);
  root.dataset.ftmDensity = settings.appearance.density;
  root.dataset.ftmTimezone = settings.preferences.timezone;
  root.dataset.ftmDateFormat = settings.preferences.dateFormat;
  root.dataset.ftmTimeFormat = settings.preferences.timeFormat;
}

export default function FtmSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<FtmSystemSettings>(DEFAULT_FTM_SETTINGS);

  useEffect(() => {
    const sync = (next?: FtmSystemSettings) => setSettings(next ?? readFtmSettings());
    sync();
    const onStorage = (event: StorageEvent) => {
      if (!event.key || [FTM_SETTINGS_STORAGE_KEY, "airship-theme", "ftm-reduced-motion"].includes(event.key)) sync();
    };
    const onSettingsChanged = (event: Event) => sync((event as CustomEvent<FtmSystemSettings>).detail);
    window.addEventListener("storage", onStorage);
    window.addEventListener(FTM_SETTINGS_CHANGED_EVENT, onSettingsChanged);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(FTM_SETTINGS_CHANGED_EVENT, onSettingsChanged);
    };
  }, []);

  useEffect(() => applySettings(settings), [settings]);

  const updateSettings = useCallback<SettingsContextValue["updateSettings"]>((section, patch) => {
    setSettings((current) => {
      const next = { ...current, [section]: { ...current[section], ...patch } } as FtmSystemSettings;
      persistFtmSettings(next);
      return { ...next, updatedAt: new Date().toISOString() };
    });
  }, []);

  const resetPersonalization = useCallback(() => {
    setSettings((current) => {
      const next = {
        ...current,
        appearance: DEFAULT_FTM_SETTINGS.appearance,
        notifications: DEFAULT_FTM_SETTINGS.notifications,
        preferences: DEFAULT_FTM_SETTINGS.preferences,
        privacy: DEFAULT_FTM_SETTINGS.privacy,
        operations: DEFAULT_FTM_SETTINGS.operations,
        dataBackups: DEFAULT_FTM_SETTINGS.dataBackups,
        security: DEFAULT_FTM_SETTINGS.security,
        system: DEFAULT_FTM_SETTINGS.system,
      };
      persistFtmSettings(next);
      return { ...next, updatedAt: new Date().toISOString() };
    });
  }, []);

  const value = useMemo(() => ({ settings, updateSettings, resetPersonalization }), [settings, updateSettings, resetPersonalization]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useFtmSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useFtmSettings must be used within FtmSettingsProvider");
  return context;
}
