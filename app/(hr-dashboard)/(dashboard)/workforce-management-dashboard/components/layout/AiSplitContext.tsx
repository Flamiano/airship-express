'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AiSplitContextType {
  isAiSplitOpen: boolean;
  initialQuery: string;
  openAiSplit: (query?: string) => void;
  closeAiSplit: () => void;
  toggleAiSplit: () => void;
}

const AiSplitContext = createContext<AiSplitContextType | undefined>(undefined);

export function AiSplitProvider({ children }: { children: ReactNode }) {
  const [isAiSplitOpen, setIsAiSplitOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState('');

  const openAiSplit = (query?: string) => {
    if (query) setInitialQuery(query);
    setIsAiSplitOpen(true);
  };

  const closeAiSplit = () => {
    setIsAiSplitOpen(false);
    setInitialQuery('');
  };

  const toggleAiSplit = () => setIsAiSplitOpen((prev) => !prev);

  return (
    <AiSplitContext.Provider
      value={{
        isAiSplitOpen,
        initialQuery,
        openAiSplit,
        closeAiSplit,
        toggleAiSplit,
      }}
    >
      {children}
    </AiSplitContext.Provider>
  );
}

export function useAiSplit() {
  const context = useContext(AiSplitContext);
  if (!context) {
    throw new Error('useAiSplit must be used within an AiSplitProvider');
  }
  return context;
}
