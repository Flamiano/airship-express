"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getCurrentProfile, removeProfileAvatar, uploadProfileAvatar } from "../lib/api";
import { supabase } from "../lib/supabaseClient";

export const FTM_AVATAR_CHANGED_EVENT = "ftm:avatar-changed";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = 700_000;
const MAX_DIMENSION = 512;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type AvatarContextValue = {
  userId: string | null;
  avatarUrl: string | null;
  previewUrl: string | null;
  pendingImage: string | null;
  busy: boolean;
  progress: number;
  error: string | null;
  chooseFile: (file: File | null) => Promise<void>;
  save: () => Promise<string | null>;
  remove: () => Promise<void>;
  clearPreview: () => void;
  refresh: () => Promise<void>;
};

const AvatarContext = createContext<AvatarContextValue | undefined>(undefined);

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The photo could not be read. Please try another image."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error("The photo could not be processed. Please try another image."));
    image.onload = () => {
      const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Your browser could not prepare the photo."));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let quality = 0.78;
      let compressed = canvas.toDataURL("image/jpeg", quality);
      while (compressed.length > MAX_DATA_URL_LENGTH && quality > 0.25) {
        quality -= 0.08;
        compressed = canvas.toDataURL("image/jpeg", quality);
      }
      if (compressed.length > MAX_DATA_URL_LENGTH) return reject(new Error("This photo could not be reduced enough. Please choose a smaller image."));
      resolve(compressed);
    };
    image.src = dataUrl;
  });
}

export function FtmProfileAvatarProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const storageKey = (userId: string) => `ftm:avatar:${userId}`;

  const applyAvatar = useCallback((url: string | null, userId?: string) => {
    setAvatarUrl(url);
    if (typeof window !== "undefined") {
      if (userId) {
        if (url) window.localStorage.setItem(storageKey(userId), url);
        else window.localStorage.removeItem(storageKey(userId));
      }
      window.dispatchEvent(new CustomEvent(FTM_AVATAR_CHANGED_EVENT, { detail: url }));
    }
  }, []);

  const refresh = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    setUserId(userId || null);
    if (!session.session?.access_token || !userId) {
      applyAvatar(null);
      return;
    }
    const cachedAvatar = typeof window !== "undefined" && userId ? window.localStorage.getItem(storageKey(userId)) : null;
    try {
      const profile = await getCurrentProfile();
      // The profile record is canonical. Never retain a previous account's
      // local value after removal or a user switch.
      applyAvatar(profile.avatar_url || null, profile.id);
    } catch {
      const sessionUser = session.session?.user;
      const fallbackAvatar = sessionUser?.user_metadata?.avatar_url || cachedAvatar;
      applyAvatar(fallbackAvatar || null, sessionUser?.id);
    }
  }, [applyAvatar]);

  useEffect(() => {
    void refresh();
    const retryTimer = window.setTimeout(() => void refresh(), 1200);
    const onStorage = (event: StorageEvent) => {
      if (event.key?.startsWith("ftm:avatar:")) setAvatarUrl(event.newValue);
    };
    const { data: authSubscription } = supabase.auth.onAuthStateChange(() => void refresh());
    window.addEventListener("storage", onStorage);
    return () => {
      authSubscription.subscription.unsubscribe();
      window.clearTimeout(retryTimer);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  const chooseFile = useCallback(async (file: File | null) => {
    if (!file) return;
    setError(null);
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) return setError("Please choose a JPG, PNG, or WebP image.");
    if (file.size > MAX_FILE_SIZE) return setError("Please choose an image smaller than 10 MB.");
    try {
      const compressed = await compressImage(await readImage(file));
      setPendingImage(compressed);
      setPreviewUrl(compressed);
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : "The photo could not be prepared.");
    }
  }, []);

  const clearPreview = useCallback(() => {
    setPendingImage(null);
    setPreviewUrl(null);
    setError(null);
  }, []);

  const save = useCallback(async () => {
    if (!pendingImage) return avatarUrl;
    setBusy(true);
    setProgress(15);
    setError(null);
    try {
      setProgress(35);
      const result = await uploadProfileAvatar(pendingImage, setProgress);
      setProgress(80);
      const { data } = await supabase.auth.getUser();
      applyAvatar(result.avatar_url, data.user?.id);
      setPendingImage(null);
      setPreviewUrl(null);
      setProgress(100);
      return result.avatar_url;
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The photo could not be uploaded.");
      throw uploadError;
    } finally {
      setBusy(false);
      window.setTimeout(() => setProgress(0), 400);
    }
  }, [applyAvatar, avatarUrl, pendingImage]);

  const remove = useCallback(async () => {
    setBusy(true);
    setProgress(25);
    setError(null);
    try {
      await removeProfileAvatar();
      const { data } = await supabase.auth.getUser();
      applyAvatar(null, data.user?.id);
      setPendingImage(null);
      setPreviewUrl(null);
      setProgress(100);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "The photo could not be removed.");
      throw removeError;
    } finally {
      setBusy(false);
      window.setTimeout(() => setProgress(0), 400);
    }
  }, [applyAvatar]);

  const value = useMemo(() => ({ userId, avatarUrl, previewUrl, pendingImage, busy, progress, error, chooseFile, save, remove, clearPreview, refresh }), [userId, avatarUrl, previewUrl, pendingImage, busy, progress, error, chooseFile, save, remove, clearPreview, refresh]);
  return <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>;
}

export function useFtmProfileAvatar() {
  const context = useContext(AvatarContext);
  if (!context) throw new Error("useFtmProfileAvatar must be used inside FtmProfileAvatarProvider");
  return context;
}
