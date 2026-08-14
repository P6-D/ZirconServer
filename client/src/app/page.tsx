"use client";

import { useOverlayServer } from "@/hooks/useOverlayServer";
import { AnimatedCard } from "@/components/ui/AnimatedCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EventFeed } from "@/components/ui/EventFeed";
import { Tabs } from "@/components/ui/Tabs";
import { CommandPane } from "@/components/layout/CommandPane";
import { AnimatePresence, motion } from "framer-motion";
import { 
  TerminalSquare, 
  Smartphone, 
  Server, 
  Layers, 
  Activity, 
  Trash2,
  Clock
} from "lucide-react";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const [wsUrl, setWsUrl] = useState<string>("");

  useEffect(() => {
    // Only set the WS URL on the client side
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // In dev (port 3001), connect to backend on 3000. In prod, connect to same host/port.
    const isDev = window.location.port === "3001";
    const host = isDev ? `${window.location.hostname}:3000` : window.location.host;
    setWsUrl(`${protocol}//${host}`);
  }, []);

  const { state, errorToast, sendTap, sendSequence, clearEvents } = useOverlayServer(wsUrl);
  const [filter, setFilter] = useState<"all" | "tap" | "window" | "sms" | "clipboard">("all");

  const formatUptime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h ? h + "h " : ""}${m ? m + "m " : ""}${s}s`;
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-950 font-sans text-white selection:bg-white/20">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] h-[500px] w-[500px] rounded-full bg-blue-500/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-purple-500/20 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex h-16 shrink-0 items-center gap-4 border-b border-white/10 bg-black/40 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white shadow-inner">
            <TerminalSquare size={18} />
          </div>
          <h1 className="text-sm font-semibold tracking-wide">Overlay Inspector</h1>
        </div>
        
        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <StatusBadge 
            status={state.deviceConnected} 
            label={state.deviceConnected ? "Android Online" : "No Device"} 
            icon={<Smartphone size={14} />} 
          />
          <StatusBadge 
            status={state.wsConnected} 
            label={state.wsConnected ? "Server Active" : "Reconnecting..."} 
            icon={<Server size={14} />} 
          />
          <div className="flex items-center gap-1.5 rounded-full border border-white/5 bg-white/5 px-3 py-1.5 text-xs text-neutral-400">
            <Clock size={12} />
            Uptime {formatUptime(state.uptime)}
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="relative z-10 flex flex-1 overflow-hidden p-6 gap-6">
        
        {/* Left Sidebar - Stats & Status */}
        <aside className="flex w-72 flex-col gap-4">
          <AnimatedCard title="Active Window" delay={0.1}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
                <Layers className="h-5 w-5 text-blue-400" />
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[10px] uppercase text-neutral-500">Package</span>
                  <span className="truncate text-sm font-medium">{state.activeWindow.package}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
                <Activity className="h-5 w-5 text-purple-400" />
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[10px] uppercase text-neutral-500">Activity</span>
                  <span className="truncate text-sm font-medium">
                    {state.activeWindow.activity.split(".").pop()}
                  </span>
                </div>
              </div>
            </div>
          </AnimatedCard>

          <AnimatedCard title="Session Stats" delay={0.2} className="flex-1">
            <div className="flex flex-col gap-2">
              <StatRow label="Total Taps" value={state.stats.taps} color="text-green-400" />
              <StatRow label="Window Changes" value={state.stats.windows} color="text-yellow-400" />
              <StatRow label="SMS Read" value={state.stats.sms} color="text-pink-400" />
              <StatRow label="Clipboard" value={state.stats.clipboard} color="text-indigo-400" />
              <StatRow label="Events Logged" value={state.events.length} color="text-neutral-200" />
            </div>
          </AnimatedCard>

          <AnimatedCard title="Last Tap" delay={0.3}>
            <div className="flex flex-col items-center justify-center py-4 text-3xl font-mono font-bold text-orange-400 tracking-tighter">
              {state.lastTap ? `(${state.lastTap.x}, ${state.lastTap.y})` : "—"}
            </div>
          </AnimatedCard>
        </aside>

        {/* Center - Event Feed */}
        <section className="flex flex-1 flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between">
            <Tabs 
              activeTab={filter} 
              onChange={(id) => setFilter(id as any)}
              tabs={[
                { id: "all", label: "All Events" },
                { id: "tap", label: "Taps" },
                { id: "window", label: "Windows" },
                { id: "sms", label: "SMS" },
                { id: "clipboard", label: "Clipboard" }
              ]} 
            />
            <div className="flex items-center gap-4">
              <span className="text-xs text-neutral-500">{state.events.length} events</span>
              <button 
                onClick={clearEvents}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 size={12} /> Clear Feed
              </button>
            </div>
          </div>
          
          <EventFeed events={state.events} filter={filter} />
        </section>

        {/* Right Sidebar - Commands */}
        <aside className="w-80 overflow-hidden">
          <CommandPane 
            onQuickTap={sendTap}
            onRunSequence={sendSequence}
          />
        </aside>

      </main>

      {/* Toasts */}
      <div className="absolute bottom-6 right-6 z-50">
        <AnimatePresence>
          {errorToast && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-xl border border-red-500/20 bg-red-950/80 px-4 py-3 text-sm font-medium text-red-400 shadow-xl backdrop-blur-md"
            >
              {errorToast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const StatRow = ({ label, value, color }: { label: string; value: number | string; color: string }) => (
  <div className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-white/5">
    <span className="text-neutral-500">{label}</span>
    <span className={`font-mono font-bold ${color}`}>{value}</span>
  </div>
);
