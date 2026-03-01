import React, { useRef, useEffect } from "react";
import { Terminal, Trash2, Clock, Cpu, MemoryStick } from "lucide-react";

export interface ConsoleEntry {
  id: string;
  type: "stdout" | "stderr" | "info" | "success";
  content: string;
  timestamp: Date;
  executionTime?: number;
  memoryUsed?: number;
  status?: string;
}

interface ConsolePanelProps {
  entries: ConsoleEntry[];
  onClear: () => void;
  isRunning?: boolean;
}

const TYPE_CONFIG = {
  stdout: { color: "text-slate-300", prefix: ">" },
  stderr: { color: "text-red-400", prefix: "✗" },
  info: { color: "text-blue-400", prefix: "ℹ" },
  success: { color: "text-emerald-400", prefix: "✓" },
};

export const ConsolePanel: React.FC<ConsolePanelProps> = ({
  entries,
  onClear,
  isRunning,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300 font-mono text-xs">
      {/* Console Header */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-slate-800 bg-slate-900 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={13} className="text-slate-500" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Console
          </span>
          {isRunning && (
            <span className="flex items-center gap-1 text-yellow-400 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              Running...
            </span>
          )}
        </div>
        <button
          onClick={onClear}
          className="p-1 text-slate-600 hover:text-slate-400 rounded"
          title="Clear console"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Output */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-700 gap-3">
            <Terminal size={32} className="opacity-30" />
            <p className="text-[11px] italic">
              Press ▶ Run to execute your code
            </p>
          </div>
        ) : (
          entries.map((entry) => {
            const cfg = TYPE_CONFIG[entry.type];
            return (
              <div key={entry.id} className="group">
                {/* Timestamp + meta row */}
                <div className="flex items-center gap-3 mb-0.5 opacity-40 group-hover:opacity-70 transition-opacity">
                  <Clock size={9} />
                  <span className="text-[9px]">
                    {entry.timestamp.toLocaleTimeString()}
                  </span>
                  {entry.executionTime !== undefined && (
                    <>
                      <Cpu size={9} />
                      <span className="text-[9px]">
                        {entry.executionTime.toFixed(1)}ms
                      </span>
                    </>
                  )}
                  {entry.memoryUsed !== undefined && (
                    <>
                      <span className="text-[9px]">
                        Mem: {(entry.memoryUsed / 1024).toFixed(1)} KB
                      </span>
                    </>
                  )}
                  {entry.status && (
                    <span className="text-[9px] font-semibold">
                      {entry.status}
                    </span>
                  )}
                </div>
                {/* Content */}
                <pre
                  className={`whitespace-pre-wrap break-all leading-5 pl-4 border-l-2 ${
                    entry.type === "stderr"
                      ? "border-red-500/40 bg-red-950/20"
                      : entry.type === "success"
                        ? "border-emerald-500/40"
                        : entry.type === "info"
                          ? "border-blue-500/40"
                          : "border-slate-700"
                  } ${cfg.color}`}
                >
                  {entry.content || "(empty output)"}
                </pre>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
