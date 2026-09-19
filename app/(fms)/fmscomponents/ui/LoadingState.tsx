import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = "Loading data...", className = "" }: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-12 ${className}`}>
      <Loader2 
        className="w-8 h-8 text-[#e5167e] animate-spin mb-4" 
        aria-hidden="true" 
      />
      <p className="text-sm text-muted-foreground font-medium animate-pulse">
        {message}
      </p>
    </div>
  );
}