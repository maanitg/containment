"use client";

import type { AnalysisData, FireData, WindData, HistoricalData } from "@/lib/useWebSocket";

interface ChatSidebarProps {
  analysis: AnalysisData | null;
  fire: FireData | null;
  wind: WindData | null;
  historical: HistoricalData | null;
  connected: boolean;
  onTriggerWindShift: () => void;
  speed: number;
  onSpeedChange: (seconds: number) => void;
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

export default function ChatSidebar({
  analysis,
  fire,
  wind,
  historical,
  connected,
  onTriggerWindShift,
  speed,
  onSpeedChange,
}: ChatSidebarProps) {
  const escapeColor =
    analysis && analysis.escape_probability > 0.6
      ? "text-red-400"
      : analysis && analysis.escape_probability > 0.3
        ? "text-yellow-400"
        : "text-green-400";

  const confidenceColor =
    analysis && analysis.confidence > 0.7
      ? "text-green-400"
      : analysis && analysis.confidence > 0.4
        ? "text-yellow-400"
        : "text-red-400";

  return (
    <div className="w-96 bg-gray-900 border-l border-gray-800 flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-orange-400">FireMind</h1>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-xs text-gray-400">
              {connected ? "Live" : "Disconnected"}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">AI Incident Commander Assistant</p>
      </div>

      <div className="p-4 space-y-4 flex-1">
        <div>
          <h2 className="text-sm font-semibold text-gray-300 mb-2">Situation Overview</h2>
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label="Burning Cells"
              value={fire ? String(fire.total_burning) : "--"}
              color="text-red-400"
            />
            <StatCard
              label="Total Burned"
              value={fire ? String(fire.total_burned) : "--"}
              color="text-orange-400"
            />
            <StatCard
              label="Wind"
              value={wind ? `${wind.direction} ${wind.speed}mph` : "--"}
              color="text-sky-400"
            />
            <StatCard
              label="Step"
              value={fire ? String(fire.step) : "--"}
              color="text-gray-300"
            />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-300 mb-2">AI Assessment</h2>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <StatCard
              label="Escape Probability"
              value={analysis ? `${(analysis.escape_probability * 100).toFixed(0)}%` : "--"}
              color={escapeColor}
            />
            <StatCard
              label="Time to Impact"
              value={analysis ? `${analysis.time_to_impact_minutes} min` : "--"}
              color="text-yellow-400"
            />
            <StatCard
              label="Confidence"
              value={analysis ? `${(analysis.confidence * 100).toFixed(0)}%` : "--"}
              color={confidenceColor}
            />
            <StatCard
              label="Failure Prob"
              value={historical ? `${(historical.failure_probability * 100).toFixed(0)}%` : "--"}
              color="text-orange-400"
            />
          </div>
        </div>

        {analysis && (
          <div>
            <h2 className="text-sm font-semibold text-gray-300 mb-2">Recommendation</h2>
            <div className="bg-gray-800 rounded-lg p-3 border-l-4 border-orange-500">
              <p className="text-sm text-gray-200">{analysis.recommendation}</p>
            </div>
          </div>
        )}

        {analysis && (
          <div>
            <h2 className="text-sm font-semibold text-gray-300 mb-2">Reasoning</h2>
            <div className="bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-400 leading-relaxed">{analysis.reasoning}</p>
            </div>
          </div>
        )}

        {historical && historical.similar_fires.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-300 mb-2">Historical Analogs</h2>
            <div className="bg-gray-800 rounded-lg p-3 space-y-1">
              {historical.similar_fires.map((name) => (
                <div key={name} className="text-xs text-gray-400 flex items-center gap-2">
                  <span className="text-orange-400">&#x25CF;</span> {name}
                </div>
              ))}
              <div className="text-xs text-gray-500 mt-2">
                Avg acres burned: {historical.avg_acres_burned.toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-800 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-400 uppercase tracking-wide">
              Sim Speed
            </label>
            <span className="text-xs text-gray-300 font-mono">{speed.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="5"
            step="0.1"
            value={speed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>Fast</span>
            <span>Slow</span>
          </div>
        </div>
        <button
          onClick={onTriggerWindShift}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-sm"
        >
          Trigger Wind Shift (Radio Event)
        </button>
        <p className="text-xs text-gray-500 text-center">
          Simulates radio: &ldquo;Winds shifting east, gusts to 25 mph&rdquo;
        </p>
      </div>
    </div>
  );
}
