"use client";

import { useState } from "react";
import { useFtmProfileAvatar } from "./FtmProfileAvatarProvider";

type FtmProfileAvatarProps = {
  name: string;
  className: string;
  /** An avatar supplied for another user (for example in a driver or user list). */
  src?: string | null;
  userId?: string | null;
  alt?: string;
};

/**
 * The one avatar renderer used throughout FTM. It always provides initials if
 * an image is unavailable, including when a remote image fails to load.
 */
export default function FtmProfileAvatar({ name, className, src, userId, alt }: FtmProfileAvatarProps) {
  const { avatarUrl, userId: currentUserId } = useFtmProfileAvatar();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = name
    .split(/[\s@.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "A";

  const imageUrl = src === undefined || (userId && userId === currentUserId) ? avatarUrl : src;
  const canShowImage = Boolean(imageUrl && imageUrl !== failedUrl);

  return canShowImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl!} alt={alt ?? `${name} profile`} onError={() => setFailedUrl(imageUrl)} className={`${className} object-cover`} />
  ) : (
    <span className={className}>{initials}</span>
  );
}
