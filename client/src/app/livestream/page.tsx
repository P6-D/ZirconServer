"use client";

import { useStreamServer, type StreamInfo } from "@/hooks/useStreamServer";
import { StreamPlayer } from "@/components/ui/StreamPlayer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AnimatedCard } from "@/components/ui/AnimatedCard";
import { AnimatePresence, motion } from "framer-motion";
import {
  Radio,
  Server,
  Smartphone,
  MonitorPlay,
  ArrowLeft,
  RefreshCw,
  Copy,
  Check,
  Tv2,
  Zap,
  TerminalSquare,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

export default function LivestreamPage() {
  const [wsUrl, setWsUrl] = useState<string>("");
  const [mediaHost, setMediaHost] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const isDev = window.location.port === "3001";
    const host = isDev
      ? `${window.location.hostname}:3000`
      : window.location.host;
    setWsUrl(`${protocol}//${host}`);
    // Media server for FLV is on port 8000
    setMediaHost(`${window.location.hostname}:8000`);
  }, []);

  const { streams, wsConnected, deviceConnected, refreshStreams } =
    useStreamServer(wsUrl);

  // Build FLV URLs using the media host
  const streamsWithUrls = useMemo(() => {
    return streams.map((s) => ({
      ...s,
      flvUrl: `http://${mediaHost}${s.streamPath}.flv`,
    }));
  }, [streams, mediaHost]);

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
        <div className="absolute top-[-20%] left-[-10%] h-[500px] w-[500px] rounded-full bg-red-500/15 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-violet-500/15 blur-[120px]" />
        <div className="absolute top-[40%] left-[50%] h-[300px] w-[300px] rounded-full bg-orange-500/10 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex h-16 shrink-0 items-center gap-4 border-b border-white/10 bg-black/40 px-6 backdrop-blur-xl">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft size={14} />
          Dashboard
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 text-red-400 shadow-inner">
            <Radio size={18} />
          </div>
          <h1 className="text-sm font-semibold tracking-wide">
            Live Streams
          </h1>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <button
            onClick={refreshStreams}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
          <StatusBadge
            status={deviceConnected}
            label={
              deviceConnected ? "Android Online" : "No Device"
            }
            icon={<Smartphone size={14} />}
          />
          <StatusBadge
            status={wsConnected}
            label={
              wsConnected ? "Server Active" : "Reconnecting..."
            }
            icon={<Server size={14} />}
          />
          <div className="flex items-center gap-1.5 rounded-full border border-white/5 bg-white/5 px-3 py-1.5 text-xs text-neutral-400">
            <Tv2 size={12} />
            {streams.length} Stream{streams.length !== 1 ? "s" : ""}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-1 overflow-hidden">
        {/* Stream Grid */}
        <section className="flex-1 overflow-y-auto p-6">
          {streamsWithUrls.length > 0 ? (
            <div
              className={`grid gap-6 ${
                streamsWithUrls.length === 1
                  ? "grid-cols-1 max-w-4xl mx-auto"
                  : streamsWithUrls.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
              }`}
            >
              <AnimatePresence mode="popLayout">
                {streamsWithUrls.map((stream) => (
                  <motion.div
                    key={stream.streamPath}
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -20 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    layout
                  >
                    <StreamPlayer
                      streamUrl={stream.flvUrl}
                      streamName={stream.name}
                      isLive={true}
                      startedAt={stream.startedAt}
                      clientIp={stream.clientIp}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            /* Empty State */
            <div className="flex h-full items-center justify-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="flex max-w-md flex-col items-center gap-6 text-center"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
                  <MonitorPlay
                    size={36}
                    className="text-neutral-500"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-lg font-semibold text-white">
                    No Active Streams
                  </h2>
                  <p className="text-sm text-neutral-500">
                    Start streaming from your Android device using
                    RootEncoder. Push an RTMP stream to the server
                    and it will appear here automatically.
                  </p>
                </div>

                {/* RTMP URL card */}
                <div className="w-full rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-neutral-500">
                    RTMP Server URL
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg bg-black/40 px-3 py-2 text-left text-xs text-violet-400 font-mono">
                      rtmp://{typeof window !== "undefined" ? window.location.hostname : "server-ip"}:1935/live/
                      <span className="text-neutral-500">
                        &lt;stream-key&gt;
                      </span>
                    </code>
                    <button
                      onClick={copyStreamUrl}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      {copiedKey ? (
                        <Check
                          size={14}
                          className="text-green-400"
                        />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid w-full grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                    <Zap
                      size={16}
                      className="mx-auto mb-1.5 text-yellow-500"
                    />
                    <span className="text-[11px] text-neutral-500">
                      Low Latency
                    </span>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                    <Radio
                      size={16}
                      className="mx-auto mb-1.5 text-red-500"
                    />
                    <span className="text-[11px] text-neutral-500">
                      Real-time
                    </span>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                    <MonitorPlay
                      size={16}
                      className="mx-auto mb-1.5 text-blue-500"
                    />
                    <span className="text-[11px] text-neutral-500">
                      Auto-detect
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </section>

        {/* Right Sidebar — Stream Info */}
        {streamsWithUrls.length > 0 && (
          <aside className="w-80 shrink-0 overflow-y-auto border-l border-white/10 bg-black/20 p-4 backdrop-blur-sm">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Active Streams
            </h2>
            <div className="flex flex-col gap-3">
              {streamsWithUrls.map((stream, idx) => (
                <StreamInfoCard
                  key={stream.streamPath}
                  stream={stream}
                  index={idx}
                />
              ))}
            </div>

            <div className="mt-6">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Server Info
              </h2>
              <AnimatedCard title="Connection" delay={0.1}>
                <div className="flex flex-col gap-2 text-xs">
                  <InfoRow
                    label="RTMP Port"
                    value="1935"
                  />
                  <InfoRow
                    label="HTTP-FLV Port"
                    value="8000"
                  />
                  <InfoRow
                    label="WS Server"
                    value={wsConnected ? "Connected" : "Disconnected"}
                    valueColor={
                      wsConnected ? "text-green-400" : "text-red-400"
                    }
                  />
                  <InfoRow
                    label="Total Streams"
                    value={String(streams.length)}
                  />
                </div>
              </AnimatedCard>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}

function StreamInfoCard({
  stream,
  index,
}: {
  stream: StreamInfo & { flvUrl: string };
  index: number;
}) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!stream.startedAt) return;
    const tick = () => {
      const diff = Math.floor(
        (Date.now() - new Date(stream.startedAt).getTime()) / 1000
      );
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(
        `${h > 0 ? h + ":" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [stream.startedAt]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)] animate-pulse" />
          <span className="text-sm font-medium text-white">
            {stream.name}
          </span>
        </div>
        <span className="text-[11px] font-mono text-neutral-500">
          {elapsed}
        </span>
      </div>
      <div className="flex flex-col gap-1 text-[11px] text-neutral-500">
        <span>App: {stream.app}</span>
        <span>Source: {stream.clientIp}</span>
        <span className="truncate font-mono text-[10px] text-neutral-600">
          {stream.streamPath}
        </span>
      </div>
    </motion.div>
  );
}

function InfoRow({
  label,
  value,
  valueColor = "text-neutral-300",
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-white/5">
      <span className="text-neutral-500">{label}</span>
      <span className={`font-mono font-bold ${valueColor}`}>
        {value}
      </span>
    </div>
  );
}
