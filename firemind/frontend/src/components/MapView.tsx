"use client";

import { useEffect, useRef } from "react";
import type { FireData, WindData } from "@/lib/useWebSocket";

const GRID_SIZE = 50;
const CELL_PX = 10;
const CANVAS_SIZE = GRID_SIZE * CELL_PX;

const WIND_ARROWS: Record<string, string> = {
  N: "\u2191",
  S: "\u2193",
  E: "\u2192",
  W: "\u2190",
};

interface MapViewProps {
  fire: FireData | null;
  wind: WindData | null;
}

export default function MapView({ fire, wind }: MapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const burnedSetRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Track cumulative burned cells
    if (fire) {
      for (const [x, y] of fire.burning_cells) {
        burnedSetRef.current.add(`${x},${y}`);
      }
    }

    // Background — dark with tree color
    ctx.fillStyle = "#0d1a0d";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Grid lines (subtle)
    ctx.strokeStyle = "#1a2a1a";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_PX, 0);
      ctx.lineTo(i * CELL_PX, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_PX);
      ctx.lineTo(CANVAS_SIZE, i * CELL_PX);
      ctx.stroke();
    }

    if (!fire) return;

    // Draw ash (previously burned cells)
    const currentBurning = new Set(fire.burning_cells.map(([x, y]) => `${x},${y}`));
    for (const key of burnedSetRef.current) {
      if (!currentBurning.has(key)) {
        const [x, y] = key.split(",").map(Number);
        ctx.fillStyle = "#1a1210";
        ctx.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
      }
    }

    // Perimeter polygon fill
    if (fire.perimeter_polygon.length > 2) {
      ctx.beginPath();
      const [fx, fy] = fire.perimeter_polygon[0];
      ctx.moveTo(fx * CELL_PX + CELL_PX / 2, fy * CELL_PX + CELL_PX / 2);
      for (let i = 1; i < fire.perimeter_polygon.length; i++) {
        const [px, py] = fire.perimeter_polygon[i];
        ctx.lineTo(px * CELL_PX + CELL_PX / 2, py * CELL_PX + CELL_PX / 2);
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(255, 50, 0, 0.1)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 68, 0, 0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Burning cells with glow
    for (const [x, y] of fire.burning_cells) {
      const cx = x * CELL_PX + CELL_PX / 2;
      const cy = y * CELL_PX + CELL_PX / 2;

      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, CELL_PX);
      gradient.addColorStop(0, "rgba(255, 100, 0, 0.9)");
      gradient.addColorStop(0.5, "rgba(255, 30, 0, 0.4)");
      gradient.addColorStop(1, "rgba(255, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(cx - CELL_PX, cy - CELL_PX, CELL_PX * 2, CELL_PX * 2);

      ctx.fillStyle = "#ff3300";
      ctx.fillRect(x * CELL_PX + 1, y * CELL_PX + 1, CELL_PX - 2, CELL_PX - 2);
    }

    // Wind indicator
    if (wind) {
      ctx.fillStyle = "rgba(56, 189, 248, 0.9)";
      ctx.font = "bold 28px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const arrow = WIND_ARROWS[wind.direction] || "?";
      ctx.fillText(`${arrow} ${wind.speed}mph`, CANVAS_SIZE - 80, 30);

      ctx.fillStyle = "rgba(56, 189, 248, 0.5)";
      ctx.font = "12px monospace";
      ctx.fillText("WIND", CANVAS_SIZE - 80, 52);
    }

    // Step counter
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Step ${fire.step}`, 8, 8);
    ctx.fillText(`Burning: ${fire.total_burning}`, 8, 24);
    ctx.fillText(`Burned: ${fire.total_burned}`, 8, 40);
  }, [fire, wind]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-950">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="border border-gray-800 rounded-lg"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}
