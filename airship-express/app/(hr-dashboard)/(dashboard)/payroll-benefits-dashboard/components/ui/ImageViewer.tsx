'use client';

import React, { useState } from 'react';
import { ZoomIn, ZoomOut, Maximize, Minimize } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ImageViewerProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string;
    title?: string;
}

export const ImageViewer = ({ isOpen, onClose, imageUrl, title = 'Receipt Image' }: ImageViewerProps) => {
    const [scale, setScale] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
    const handleReset = () => setScale(1);
    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
        setScale(1);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                onClose();
                setScale(1);
                setIsFullscreen(false);
            }}
            title={title}
            className="max-w-4xl"
            footer={
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleZoomOut}
                            className="p-1.5"
                            title="Zoom Out"
                        >
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-muted font-rethink min-w-[40px] text-center">
                            {Math.round(scale * 100)}%
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleZoomIn}
                            className="p-1.5"
                            title="Zoom In"
                        >
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleReset}
                            className="text-xs"
                        >
                            Reset
                        </Button>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={toggleFullscreen}
                        className="p-1.5"
                        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    >
                        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                    </Button>
                </div>
            }
        >
            <div className={`relative flex items-center justify-center ${isFullscreen ? 'h-[80vh]' : 'max-h-[70vh]'}`}>
                <div
                    className="relative overflow-auto w-full h-full flex items-center justify-center bg-paper/50 rounded-lg"
                    style={{ minHeight: '200px' }}
                >
                    <img
                        src={imageUrl}
                        alt="Receipt"
                        className="object-contain transition-transform duration-200 max-w-full max-h-full"
                        style={{
                            transform: `scale(${scale})`,
                            transformOrigin: 'center center',
                        }}
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const parent = (e.target as HTMLImageElement).parentElement;
                            if (parent) {
                                const errorMsg = document.createElement('p');
                                errorMsg.className = 'text-sm text-muted font-rethink';
                                errorMsg.textContent = 'Failed to load image';
                                parent.appendChild(errorMsg);
                            }
                        }}
                    />
                </div>
            </div>
        </Modal>
    );
};