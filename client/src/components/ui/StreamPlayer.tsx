"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  RefreshCw,
  Wifi,
  WifiOff,
  Radio,
} from "lucide-react";

type StreamPlayerProps = {
  streamUrl: string;
  streamName: string;
  isLive: boolean;
  startedAt?: string;
  clientIp?: string;
  onFullscreen?: () => void;
  onVideoClick?: (x: number, y: number) => void;
  remoteTaps?: { x: number; y: number; ts: number }[];
  deviceWidth?: number;
  deviceHeight?: number;
};

export function StreamPlayer({
  streamUrl,
  streamName,
  isLive,
  startedAt,
  clientIp,
  onVideoClick,
  remoteTaps,
  deviceWidth,
  deviceHeight,
}: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<
    "loading" | "playing" | "error" | "idle"
  >("idle");
  const [muted, setMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [elapsed, setElapsed] = useState("");
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Elapsed time counter
  useEffect(() => {
    if (!startedAt) return;
    const tick = () => {
      const diff = Math.floor(
        (Date.now() - new Date(startedAt).getTime()) / 1000
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
  }, [startedAt]);

  const destroyPlayer = useCallback(() => {
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.unload();
        playerRef.current.detachMediaElement();
        playerRef.current.destroy();
      } catch {}
      playerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const initPlayer = useCallback(async () => {
    if (!videoRef.current || !streamUrl || !isLive) return;

    destroyPlayer();
    setStatus("loading");

    try {
      const mpegts = (await import("mpegts.js")).default;

      if (!mpegts.isSupported()) {
        console.error("mpegts.js is not supported in this browser");
        setStatus("error");
        return;
      }

      const player = mpegts.createPlayer(
        {
          type: "flv",
          isLive: true,
          url: streamUrl,
        },
        {
          enableWorker: true,
          enableStashBuffer: false,
          stashInitialSize: 128,
          liveBufferLatencyChasing: true,
          liveBufferLatencyMaxLatency: 1.5,
          liveBufferLatencyMinRemain: 0.3,
        }
      );

      player.attachMediaElement(videoRef.current);
      player.load();

      player.on(mpegts.Events.ERROR, (errorType: string, errorDetail: string) => {
        console.error(`[StreamPlayer] Error: ${errorType} - ${errorDetail}`);
        setStatus("error");
        // Auto-reconnect after 3s
        reconnectTimerRef.current = setTimeout(() => {
          initPlayer();
        }, 3000);
      });

      player.on(mpegts.Events.LOADING_COMPLETE, () => {
        // Stream ended, try to reconnect
        setStatus("error");
        reconnectTimerRef.current = setTimeout(() => {
          initPlayer();
        }, 3000);
      });

      videoRef.current
        .play()
        .then(() => setStatus("playing"))
        .catch(() => {
          // Autoplay might be blocked, try muted
          if (videoRef.current) {
            videoRef.current.muted = true;
            setMuted(true);
            videoRef.current
              .play()
              .then(() => setStatus("playing"))
              .catch(() => setStatus("error"));
          }
        });

      playerRef.current = player;
    } catch (err) {
      console.error("[StreamPlayer] Failed to init:", err);
      setStatus("error");
      reconnectTimerRef.current = setTimeout(() => {
        initPlayer();
      }, 3000);
    }
  }, [streamUrl, isLive, destroyPlayer]);

  useEffect(() => {
    if (isLive && streamUrl) {
      initPlayer();
    }
    return () => {
      destroyPlayer();
    };
  }, [isLive, streamUrl, initPlayer, destroyPlayer]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setMuted(videoRef.current.muted);
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (!onVideoClick || !videoRef.current || !deviceWidth || !deviceHeight) return;
    const video = videoRef.current;
    
    const rect = video.getBoundingClientRect();
    const vWidth = video.videoWidth;
    const vHeight = video.videoHeight;
    
    if (vWidth === 0 || vHeight === 0) return;

    const videoRatio = vWidth / vHeight;
    const elementRatio = rect.width / rect.height;

    let actualWidth, actualHeight, startX, startY;

    if (elementRatio > videoRatio) {
      actualHeight = rect.height;
      actualWidth = actualHeight * videoRatio;
      startX = (rect.width - actualWidth) / 2;
      startY = 0;
    } else {
      actualWidth = rect.width;
      actualHeight = actualWidth / videoRatio;
      startX = 0;
      startY = (rect.height - actualHeight) / 2;
    }

    const clickX = e.clientX - rect.left - startX;
    const clickY = e.clientY - rect.top - startY;

    if (clickX >= 0 && clickX <= actualWidth && clickY >= 0 && clickY <= actualHeight) {
      const relativeX = clickX / actualWidth;
      const relativeY = clickY / actualHeight;
      onVideoClick(Math.round(relativeX * deviceWidth), Math.round(relativeY * deviceHeight));
    }
  };

  const getTapStyle = (tapX: number, tapY: number) => {
    if (!videoRef.current || !deviceWidth || !deviceHeight) return { display: 'none' };
    const video = videoRef.current;
    const rect = video.getBoundingClientRect();
    const vWidth = video.videoWidth;
    const vHeight = video.videoHeight;
    if (vWidth === 0 || vHeight === 0) return { display: 'none' };

    const videoRatio = vWidth / vHeight;
    const elementRatio = rect.width / rect.height;

    let actualWidth, actualHeight, startX, startY;

    if (elementRatio > videoRatio) {
      actualHeight = rect.height;
      actualWidth = actualHeight * videoRatio;
      startX = (rect.width - actualWidth) / 2;
      startY = 0;
    } else {
      actualWidth = rect.width;
      actualHeight = actualWidth / videoRatio;
      startX = 0;
      startY = (rect.height - actualHeight) / 2;
    }

    const relativeX = tapX / deviceWidth;
    const relativeY = tapY / deviceHeight;

    return {
      left: `${startX + (relativeX * actualWidth)}px`,
      top: `${startY + (relativeY * actualHeight)}px`,
      transform: 'translate(-50%, -50%)'
    };
  };

  return (
    <div
      ref={containerRef}
      className="group relative flex flex-col h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]"
    >
      {/* Video Area */}
      <div className="relative flex-1 h-full w-full overflow-hidden bg-neutral-950">
        {/* Live Badge */}
        {isLive && status === "playing" && (
          <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-red-500/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg backdrop-blur-sm">
            <Radio size={10} className="animate-pulse" />
            LIVE
          </div>
        )}

        {/* Elapsed Time */}
        {isLive && elapsed && (
          <div className="absolute right-3 top-3 z-20 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-mono text-white/80 backdrop-blur-sm">
            {elapsed}
          </div>
        )}

        {/* Video Element */}
        <video
          ref={videoRef}
          className={`h-full w-full object-contain ${onVideoClick ? "cursor-pointer" : ""}`}
          muted={muted}
          playsInline
          autoPlay
          onClick={handleVideoClick}
        />

        {/* Remote Taps Visualizer */}
        {remoteTaps && remoteTaps.map(tap => (
          <div
            key={tap.ts}
            className="absolute z-30 w-8 h-8 rounded-full border-2 border-red-500 bg-red-500/20 pointer-events-none animate-ping opacity-0"
            style={{
              ...getTapStyle(tap.x, tap.y),
              animationDuration: '1s',
              animationIterationCount: '1',
              animationFillMode: 'forwards'
            }}
          />
        ))}

        {/* Loading State */}
        {status === "loading" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-neutral-950/80 backdrop-blur-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            <span className="text-xs text-neutral-400">
              Connecting to stream...
            </span>
          </div>
        )}

        {/* Error State */}
        {status === "error" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-neutral-950/80 backdrop-blur-sm">
            <WifiOff size={28} className="text-neutral-500" />
            <span className="text-xs text-neutral-400">
              Stream interrupted
            </span>
            <button
              onClick={() => initPlayer()}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10"
            >
              <RefreshCw size={12} />
              Reconnect
            </button>
          </div>
        )}

        {/* Idle State */}
        {status === "idle" && !isLive && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-neutral-950/80 backdrop-blur-sm">
            <Wifi size={28} className="text-neutral-500" />
            <span className="text-xs text-neutral-400">
              Waiting for stream...
            </span>
          </div>
        )}

        {/* Controls Overlay — visible on hover */}
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <button
            onClick={toggleMute}
            className="rounded-full bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20"
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="rounded-full bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20"
          >
            {isFullscreen ? (
              <Minimize2 size={14} />
            ) : (
              <Maximize2 size={14} />
            )}
          </button>
        </div>
      </div>

      {/* Stream Info Footer */}
      <div className="flex items-center gap-3 border-t border-white/5 px-4 py-3">
        <div
          className={`h-2 w-2 rounded-full ${isLive ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" : "bg-neutral-600"}`}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <span className="truncate text-sm font-medium text-white">
            {streamName}
          </span>
          <span className="text-[11px] text-neutral-500">
            {clientIp || "Unknown source"}
            {elapsed && ` · ${elapsed}`}
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-neutral-500">
          <Wifi size={10} />
          {status === "playing"
            ? "Connected"
            : status === "loading"
              ? "Buffering"
              : "Offline"}
        </div>
      </div>
    </div>
  );
}
