"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface FireData {
  burning_cells: number[][];
  perimeter_polygon: number[][];
  total_burning: number;
  total_burned: number;
  step: number;
}

export interface WindData {
  direction: string;
  speed: number;
}

export interface AnalysisData {
  escape_probability: number;
  time_to_impact_minutes: number;
  recommendation: string;
  confidence: number;
  reasoning: string;
}

export interface HistoricalData {
  similar_fires: string[];
  failure_probability: number;
  avg_acres_burned: number;
}

export interface FireMindPayload {
  fire: FireData;
  wind: WindData;
  analysis: AnalysisData;
  historical: HistoricalData;
}

export function useWebSocket(url: string) {
  const [data, setData] = useState<FireMindPayload | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data) as FireMindPayload;
      setData(payload);
    };

    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 2000);
    };

    ws.onerror = () => ws.close();
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return { data, connected };
}
