'use client';

import React, { createContext, useContext, useState, type ReactNode } from 'react';

interface CricketEvent {
  timestamp: number;
  shot_type: string;
  ball_type: string;
  runs: number;
  confidence: number;
  vision_img: string;
  ocr_img: string;
  base_img?: string;
  ocr: string[];
  x?: number;
  y?: number;
  ball_speed?: number;
  direction?: string;
}

interface MatchInsights {
  summary: string;
  strengths: string;
  weaknesses: string;
}

interface MatchData {
  events: CricketEvent[];
  insights: MatchInsights;
}

interface MatchContextType {
  fileId: string | null;
  setFileId: (id: string | null) => void;
  data: MatchData | null;
  setData: React.Dispatch<React.SetStateAction<MatchData | null>>;
  selectedFrame: CricketEvent | null;
  setSelectedFrame: (frame: CricketEvent | null) => void;
  isTurboMode: boolean;
  setIsTurboMode: (val: boolean) => void;
}

const MatchContext = createContext<MatchContextType | undefined>(undefined);

export const MatchProvider = ({ children }: { children: ReactNode }) => {
  const [fileId, setFileId] = useState<string | null>(null);
  const [data, setData] = useState<MatchData | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<CricketEvent | null>(null);
  const [isTurboMode, setIsTurboMode] = useState(false);

  return (
    <MatchContext.Provider value={{ 
      fileId, setFileId, data, setData, selectedFrame, setSelectedFrame,
      isTurboMode, setIsTurboMode 
    }}>
      {children}
    </MatchContext.Provider>
  );
};

export const useMatch = () => {
  const context = useContext(MatchContext);
  if (!context) throw new Error('useMatch must be used within a MatchProvider');
  return context;
};
