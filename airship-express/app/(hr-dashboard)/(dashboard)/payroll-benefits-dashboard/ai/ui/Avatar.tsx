'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../shared/utils';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
type AvatarStatus = 'idle' | 'thinking' | 'speaking' | 'greeting';
type AvatarShape = 'circle' | 'rounded';

interface AiryAvatarProps {
    size?: AvatarSize;
    className?: string;
    animated?: boolean;
    video?: boolean;
    videoSrc?: string;
    videoLoop?: boolean;
    trimStart?: number;
    trimEnd?: number;
    showRing?: boolean;
    shape?: AvatarShape;
    status?: AvatarStatus;
}

const SIZE_MAP: Record<AvatarSize, string> = {
    xs: 'h-6 w-6',
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
    xl: 'h-20 w-20',
    hero: 'h-20 w-20 sm:h-28 sm:w-28 lg:h-36 lg:w-36',
};

const IMAGE_MAP: Record<AvatarSize, string> = {
    xs: '/images/airy-ai/hi-full.png',
    sm: '/images/airy-ai/hi.png',
    md: '/images/airy-ai/hi.png',
    lg: '/images/airy-ai/hi-full.png',
    xl: '/images/airy-ai/hi-full.png',
    hero: '/images/airy-ai/hi-full.png',
};

const STATUS_VIDEO_MAP: Partial<Record<AvatarStatus, string>> = {
    thinking: '/images/airy-ai/hi-run.mp4',
    speaking: '/images/airy-ai/the_video_that_you_give_previo.mp4',
    greeting: '/images/airy-ai/the_video_that_you_give_previo.mp4',
};

export const AiryAvatar: React.FC<AiryAvatarProps> = ({
    size = 'md',
    className,
    animated = false,
    video = false,
    videoSrc,
    videoLoop = true,
    trimStart,
    trimEnd,
    showRing = false,
    shape,
    status = 'idle',
}) => {
    const [videoFailed, setVideoFailed] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const resolvedShape: AvatarShape = shape ?? (size === 'hero' ? 'rounded' : 'circle');
    const resolvedVideoSrc = videoSrc ?? STATUS_VIDEO_MAP[status] ?? '/images/airy-ai/hi-run.mp4';
    const useVideo = video && !videoFailed && size !== 'xs' && size !== 'sm';
    const isTrimmed = trimStart !== undefined || trimEnd !== undefined;

    const sizeClass = SIZE_MAP[size];
    const imagePath = IMAGE_MAP[size];

    const ringClass = showRing
        ? status === 'thinking'
            ? 'ring-2 ring-amber-400/60 ring-offset-2 ring-offset-paper'
            : status === 'speaking' || status === 'greeting'
                ? 'ring-2 ring-emerald-400/60 ring-offset-2 ring-offset-paper'
                : 'ring-1 ring-accent/20'
        : 'ring-1 ring-accent/15';

    const shapeClass = resolvedShape === 'circle' ? 'rounded-full' : 'rounded-[28px]';

    useEffect(() => {
        setVideoFailed(false);
    }, [resolvedVideoSrc]);

    useEffect(() => {
        if (useVideo && videoRef.current) {
            videoRef.current.play().catch(() => setVideoFailed(true));
        }
    }, [useVideo, resolvedVideoSrc]);

    const handleLoadedMetadata = () => {
        if (trimStart !== undefined && videoRef.current) {
            videoRef.current.currentTime = trimStart;
        }
    };

    const handleTimeUpdate = () => {
        if (trimEnd !== undefined && videoRef.current && videoRef.current.currentTime >= trimEnd) {
            videoRef.current.currentTime = trimStart ?? 0;
        }
    };

    return (
        <div
            className={cn(
                'relative shrink-0 overflow-hidden bg-accent/5',
                shapeClass,
                sizeClass,
                ringClass,
                className
            )}
        >
            {useVideo ? (
                <video
                    ref={videoRef}
                    src={resolvedVideoSrc}
                    autoPlay
                    loop={isTrimmed ? false : videoLoop}
                    muted
                    playsInline
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={isTrimmed ? handleTimeUpdate : undefined}
                    onError={() => setVideoFailed(true)}
                    className="h-full w-full object-cover"
                />
            ) : (
                <img
                    src={imagePath}
                    alt="Airy"
                    className={cn('h-full w-full object-cover', animated && 'animate-pulse')}
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = '/images/airy-ai/hi.png';
                    }}
                />
            )}

            {status !== 'idle' && (
                <span
                    className={cn(
                        'absolute bottom-1 right-1 block rounded-full border-2 border-paper',
                        size === 'hero' || size === 'xl' ? 'h-4 w-4' : 'h-2.5 w-2.5',
                        status === 'thinking' && 'bg-amber-400 animate-pulse',
                        (status === 'speaking' || status === 'greeting') && 'bg-emerald-500'
                    )}
                />
            )}
        </div>
    );
};