"use client";

import { useCallback, useState } from "react";
import MapView from "@/components/MapView";
import ChatSidebar from "@/components/ChatSidebar";
import { useWebSocket } from "@/lib/useWebSocket";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const { data, connected } = useWebSocket(WS_URL);
  const [speed, setSpeed] = useState(5.0);

  const handleTriggerWindShift = useCallback(async () => {
    try {
      await fetch(`${API_URL}/trigger-wind-shift`, { method: "POST" });
    } catch (err) {
      console.error("Failed to trigger wind shift:", err);
    }
  }, []);

  const handleSpeedChange = useCallback(async (seconds: number) => {
    setSpeed(seconds);
    try {
      await fetch(`${API_URL}/set-speed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval: seconds }),
      });
    } catch (err) {
      console.error("Failed to set speed:", err);
    }
  }, []);

  return (
    <div className="flex h-screen w-screen">
      <div className="flex-1 relative">
        <MapView
          fire={data?.fire ?? null}
          wind={data?.wind ?? null}
        />
        {!connected && (
          <div className="absolute top-4 left-4 bg-red-900/80 text-red-200 px-4 py-2 rounded-lg text-sm">
            Connecting to FireMind backend...
          </div>
        )}
      </div>
      <ChatSidebar
        analysis={data?.analysis ?? null}
        fire={data?.fire ?? null}
        wind={data?.wind ?? null}
        historical={data?.historical ?? null}
        connected={connected}
        onTriggerWindShift={handleTriggerWindShift}
        speed={speed}
        onSpeedChange={handleSpeedChange}
      />
    </div>
  );
}
