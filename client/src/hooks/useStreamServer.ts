"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type StreamInfo = {
  id: string;
  app: string;
  name: string;
  streamPath: string;
  startedAt: string;
  clientIp: string;
  flvUrl?: string;
  durationSec?: number;
};

type StreamServerState = {
  streams: StreamInfo[];
  wsConnected: boolean;
  deviceConnected: boolean;
};

export function useStreamServer(wsUrl: string = "") {
  const [state, setState] = useState<StreamServerState>({
    streams: [],
    wsConnected: false,
    deviceConnected: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial stream list via REST
  const fetchStreams = useCallback(async () => {
    try {
      const isDev = typeof window !== "undefined" && window.location.port === "3001";
      const baseUrl = isDev
        ? `${window.location.protocol}//${window.location.hostname}:3000`
        : "";
      const res = await fetch(`${baseUrl}/streams`);
      if (res.ok) {
        const streams: StreamInfo[] = await res.json();
        setState((prev) => ({ ...prev, streams }));
      }
    } catch (e) {
      console.error("Failed to fetch streams:", e);
    }
  }, []);

  const connect = useCallback(() => {
    if (!wsUrl || wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setState((prev) => ({ ...prev, wsConnected: true }));
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      ws.send(JSON.stringify({ type: "hello", client: "browser" }));
      // Fetch current streams on connect
      fetchStreams();
    };

    ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);

        switch (msg.type) {
          case "init":
            setState((prev) => ({
              ...prev,
              deviceConnected: !!msg.deviceConnected,
            }));
            fetchStreams();
            break;

          case "device_status":
            setState((prev) => ({ ...prev, deviceConnected: !!msg.connected }));
            break;

          case "stream_start":
            setState((prev) => {
              const exists = prev.streams.some(
                (s) => s.streamPath === msg.stream.streamPath
              );
              if (exists) return prev;
              return {
                ...prev,
                streams: [...prev.streams, msg.stream],
              };
            });
            break;

          case "stream_stop":
            setState((prev) => ({
              ...prev,
              streams: prev.streams.filter(
                (s) => s.streamPath !== msg.streamPath
              ),
            }));
            break;
        }
      } catch (e) {
        console.error("Error parsing WS message:", e);
      }
    };

    ws.onclose = () => {
      setState((prev) => ({ ...prev, wsConnected: false }));
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {};
  }, [wsUrl, fetchStreams]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  return {
    streams: state.streams,
    wsConnected: state.wsConnected,
    deviceConnected: state.deviceConnected,
    refreshStreams: fetchStreams,
  };
}
