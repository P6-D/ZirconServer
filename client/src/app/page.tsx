"use client";

import { useOverlayServer } from "@/hooks/useOverlayServer";
import { useStreamServer, type StreamInfo } from "@/hooks/useStreamServer";
import { StreamPlayer } from "@/components/ui/StreamPlayer";
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
  Clock,
  Radio,
  MonitorPlay,
  Copy,
  Check,
  Tv2,
  Zap,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";

export default function Dashboard() {
  const [wsUrl, setWsUrl] = useState<string>("");
  const [mediaHost, setMediaHost] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const isDev = window.location.port === "3001";
    const host = isDev ? `${window.location.hostname}:3000` : window.location.host;
    setWsUrl(`${protocol}//${host}`);
    setMediaHost(`${window.location.hostname}:8000`);
  }, []);

  const { state: overlayState, errorToast, sendTap, sendSequence, clearEvents } = useOverlayServer(wsUrl);
  const { streams, wsConnected: streamWsConnected } = useStreamServer(wsUrl);

  const [filter, setFilter] = useState<"all" | "tap" | "window" | "sms" | "clipboard">("all");
  const [isLogsOpen, setIsLogsOpen] = useState(true);
  const [selectedStreamPath, setSelectedStreamPath] = useState<string | null>(null);

  const streamsWithUrls = useMemo(() => {
    return streams.map((s) => ({
      ...s,
      flvUrl: `http://${mediaHost}${s.streamPath}.flv`,
    }));
  }, [streams, mediaHost]);

  // Determine active stream: either the user-selected one, or the first available
  const activeStream = useMemo(() => {
    if (streamsWithUrls.length === 0) return null;
    const selected = streamsWithUrls.find(s => s.streamPath === selectedStreamPath);
    return selected || streamsWithUrls[0];
  }, [streamsWithUrls, selectedStreamPath]);

  // Auto-select a stream if none is selected but streams exist
  useEffect(() => {
    if (streamsWithUrls.length > 0 && !selectedStreamPath) {
      setSelectedStreamPath(streamsWithUrls[0].streamPath);
    }
  }, [streamsWithUrls, selectedStreamPath]);

  const formatUptime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h ? h + "h " : ""}${m ? m + "m " : ""}${s}s`;
  };

  const copyStreamUrl = () => {
    const rtmpUrl = `rtmp://${window.location.hostname}:1935/live/stream`;
    navigator.clipboard.writeText(rtmpUrl);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-950 font-sans text-white selection:bg-white/20">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[-10%] h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-[120px]" />
        {activeStream && (
          <div className="absolute top-[10%] left-[50%] h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-red-500/5 blur-[120px] transition-opacity duration-1000" />
        )}
      </div>

      {/* Header */}
      <header className="relative z-10 flex h-16 shrink-0 items-center gap-4 border-b border-white/10 bg-black/40 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white shadow-inner">
            <TerminalSquare size={18} />
          </div>
          <h1 className="text-sm font-semibold tracking-wide">Zircon Command Center</h1>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <StatusBadge
            status={overlayState.deviceConnected}
            label={overlayState.deviceConnected ? "Android Online" : "No Device"}
            icon={<Smartphone size={14} />}
          />
          <StatusBadge
            status={overlayState.wsConnected && streamWsConnected}
            label={overlayState.wsConnected ? "Server Active" : "Reconnecting..."}
            icon={<Server size={14} />}
          />
          {activeStream ? (
            <div className="flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400">
              <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)] animate-pulse" />
              Live
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full border border-white/5 bg-white/5 px-3 py-1.5 text-xs text-neutral-400">
              <Tv2 size={12} />
              No Streams
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-full border border-white/5 bg-white/5 px-3 py-1.5 text-xs text-neutral-400">
            <Clock size={12} />
            Uptime {formatUptime(overlayState.uptime)}
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="relative z-10 flex flex-1 overflow-hidden p-6 gap-6">

        {/* Left Sidebar - Stats & Status */}
        <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
          <AnimatedCard title="Active Window" delay={0.1}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
                <Layers className="h-5 w-5 text-blue-400 shrink-0" />
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[10px] uppercase text-neutral-500">Package</span>
                  <span className="truncate text-sm font-medium">{overlayState.activeWindow.package}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
                <Activity className="h-5 w-5 text-purple-400 shrink-0" />
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[10px] uppercase text-neutral-500">Activity</span>
                  <span className="truncate text-sm font-medium">
                    {overlayState.activeWindow.activity.split(".").pop()}
                  </span>
                </div>
              </div>
            </div>
          </AnimatedCard>

          <AnimatedCard title="Session Stats" delay={0.2}>
            <div className="flex flex-col gap-2">
              <StatRow label="Total Taps" value={overlayState.stats.taps} color="text-green-400" />
              <StatRow label="Window Changes" value={overlayState.stats.windows} color="text-yellow-400" />
              <StatRow label="SMS Read" value={overlayState.stats.sms} color="text-pink-400" />
              <StatRow label="Clipboard" value={overlayState.stats.clipboard} color="text-indigo-400" />
              <StatRow label="Events Logged" value={overlayState.events.length} color="text-neutral-200" />
            </div>
          </AnimatedCard>

          <AnimatedCard title="Last Tap" delay={0.3}>
            <div className="flex flex-col items-center justify-center py-4 text-3xl font-mono font-bold text-orange-400 tracking-tighter">
              {overlayState.lastTap ? `(${overlayState.lastTap.x}, ${overlayState.lastTap.y})` : "—"}
            </div>
          </AnimatedCard>

          {/* Stream Info Cards & Selector */}
          {streamsWithUrls.length > 0 && (
            <AnimatedCard title="Active Streams" delay={0.4}>
              <div className="flex flex-col gap-3">
                {streamsWithUrls.map((stream) => (
                  <button
                    key={stream.streamPath}
                    onClick={() => setSelectedStreamPath(stream.streamPath)}
                    className={`text-left w-full transition-all ${activeStream?.streamPath === stream.streamPath ? 'ring-2 ring-red-500/50 rounded-lg' : 'opacity-60 hover:opacity-100'}`}
                  >
                    <StreamInfoCard stream={stream} />
                  </button>
                ))}
              </div>
            </AnimatedCard>
          )}
        </aside>

        {/* Center - Stream & Event Feed */}
        <section className="flex flex-1 flex-col overflow-hidden min-w-[500px] relative rounded-xl border border-white/10 bg-black/40 shadow-2xl">
          
          {/* Full-Height Video Player or Waiting State */}
          <div className="absolute inset-0 z-0 flex flex-col">
            {activeStream ? (
              <StreamPlayer
                streamUrl={activeStream.flvUrl}
                streamName={activeStream.name}
                isLive={true}
                startedAt={activeStream.startedAt}
                clientIp={activeStream.clientIp}
              />
            ) : (
              <div className="flex h-full min-h-[250px] flex-col items-center justify-center p-8 text-center bg-white/[0.02]">
                <MonitorPlay size={42} className="mb-4 text-neutral-600" />
                <h2 className="text-lg font-semibold text-white mb-2">No Active Streams</h2>
                <p className="text-sm text-neutral-500 max-w-md mb-6">
                  Push an RTMP stream to the server from the Android device to see it here live in low latency.
                </p>
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2 backdrop-blur-sm">
                  <code className="px-3 py-1 text-left text-xs text-violet-400 font-mono">
                    rtmp://{typeof window !== "undefined" ? window.location.hostname : "server-ip"}:1935/live/&lt;key&gt;
                  </code>
                  <button
                    onClick={copyStreamUrl}
                    className="flex h-7 w-7 items-center justify-center rounded border border-white/10 bg-white/5 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {copiedKey ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Half: Sticky Touch Logs Drawer */}
          <div className={`absolute bottom-0 left-0 right-0 z-10 flex flex-col border-t border-white/10 bg-black/70 backdrop-blur-2xl transition-all duration-300 ease-in-out ${isLogsOpen ? 'h-[45%]' : 'h-[52px]'}`}>
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 h-[52px] bg-white/5 shadow-md">
              <div className="flex items-center gap-3 h-full">
                <button
                  onClick={() => setIsLogsOpen(!isLogsOpen)}
                  className="flex items-center justify-center rounded-md p-1.5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                >
                  {isLogsOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>

                {isLogsOpen && (
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
                )}
                {!isLogsOpen && <span className="text-sm font-medium">Touch Logs</span>}
              </div>

              <div className="flex items-center gap-4">
                <span className="text-xs text-neutral-500">{overlayState.events.length} events</span>
                <button
                  onClick={clearEvents}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 size={12} /> Clear
                </button>
              </div>
            </div>
            
            {/* The actual feed content, visible when open */}
            <div className={`flex-1 overflow-hidden p-4 transition-opacity duration-300 ${isLogsOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
              <EventFeed events={overlayState.events} filter={filter} />
            </div>
          </div>
        </section>

        {/* Right Sidebar - Commands */}
        <aside className="w-80 shrink-0 overflow-y-auto pr-2 custom-scrollbar">
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

function StreamInfoCard({ stream }: { stream: StreamInfo & { flvUrl: string } }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!stream.startedAt) return;
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(stream.startedAt).getTime()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(`${h > 0 ? h + ":" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [stream.startedAt]);

  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-medium text-white">{stream.name}</span>
        </div>
        <span className="text-[11px] font-mono text-red-400/80">{elapsed}</span>
      </div>
      <div className="flex flex-col gap-1 text-[11px] text-neutral-500">
        <span>Source: {stream.clientIp}</span>
        <span className="font-mono text-[10px] text-neutral-600 truncate">{stream.streamPath}</span>
      </div>
    </div>
  );
}
