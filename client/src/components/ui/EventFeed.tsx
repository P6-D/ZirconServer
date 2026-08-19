"use client";

import { useRef, useEffect } from "react";
import { OverlayEvent } from "@/hooks/useOverlayServer";
import { cn } from "@/lib/utils";
import { MousePointer2, AppWindow, Radio, MessageSquare, Clipboard, Play, Plus } from "lucide-react";

export const EventFeed = ({
  events,
  filter,
  onQuickTap,
  onAddSequenceStep,
}: {
  events: OverlayEvent[];
  filter: "all" | "tap" | "window" | "sms" | "clipboard";
  onQuickTap?: (x: number, y: number) => void;
  onAddSequenceStep?: (x: number, y: number) => void;
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const filteredEvents = events.filter(
    (e) =>
      filter === "all" ||
      (filter === "tap" && e.type === "tap_event") ||
      (filter === "window" && e.type === "window_event") ||
      (filter === "sms" && e.type === "sms") ||
      (filter === "clipboard" && e.type === "clipboard")
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filteredEvents.length]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md">
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        {filteredEvents.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-neutral-500">
            <Radio className="mb-4 h-12 w-12 text-neutral-500" strokeWidth={1.5} />
            <p>Waiting for events from device...</p>
          </div>
        ) : (
          filteredEvents.map((e, idx) => (
            <EventRow 
              key={e._receivedAt || e.ts || idx} 
              event={e} 
              onQuickTap={onQuickTap} 
              onAddSequenceStep={onAddSequenceStep} 
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

const EventRow = ({ 
  event, 
  onQuickTap, 
  onAddSequenceStep 
}: { 
  event: OverlayEvent;
  onQuickTap?: (x: number, y: number) => void;
  onAddSequenceStep?: (x: number, y: number) => void;
}) => {
  const time = new Date(event._receivedAt || event.ts || Date.now()).toLocaleTimeString(
    [],
    { hour: "2-digit", minute: "2-digit", second: "2-digit" }
  );
  
  const isTap = event.type === "tap_event";
  const isWindow = event.type === "window_event";
  const isSms = event.type === "sms";
  const isClip = event.type === "clipboard";

  return (
    <div
      className="group mb-2 flex items-center gap-4 rounded-xl border border-transparent p-3 transition-colors hover:border-white/5 hover:bg-white/5 animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="flex flex-col gap-0.5">
        <div className="text-xs text-neutral-500">{time}</div>
        {event.deviceId && (
          <div className="text-[9px] font-mono text-neutral-600 truncate max-w-[80px] uppercase">
            {event.deviceId.replace('device_', '')}
          </div>
        )}
      </div>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-widest",
          isTap && "bg-blue-500/10 text-blue-400",
          isWindow && "bg-green-500/10 text-green-400",
          isSms && "bg-pink-500/10 text-pink-400",
          isClip && "bg-indigo-500/10 text-indigo-400"
        )}
      >
        {isTap && <MousePointer2 className="h-3 w-3" />}
        {isWindow && <AppWindow className="h-3 w-3" />}
        {isSms && <MessageSquare className="h-3 w-3" />}
        {isClip && <Clipboard className="h-3 w-3" />}
        
        {isTap ? "TAP" : isWindow ? "WINDOW" : isSms ? "SMS" : "CLIP"}
      </div>
      <div className="flex-1 truncate text-sm font-mono text-neutral-300">
        {isTap && (
          <>
            <span className="font-bold text-orange-400">
              ({event.x}, {event.y})
            </span>
            <span className="ml-3 text-neutral-500">{event.package}</span>
          </>
        )}
        {isWindow && (
          <>
            <span className="text-neutral-200">
              {event.activity?.split(".").pop()}
            </span>
            <span className="ml-3 text-neutral-500">{event.package}</span>
          </>
        )}
        {(isSms || isClip) && (
          <span className="text-neutral-200">{event.text}</span>
        )}
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {isTap && onQuickTap && event.x !== undefined && event.y !== undefined && (
          <button 
            onClick={() => onQuickTap(event.x!, event.y!)} 
            className="p-1.5 rounded bg-white/5 hover:bg-blue-500/20 text-neutral-400 hover:text-blue-400 transition-colors" 
            title="Quick Tap"
          >
            <Play size={14} />
          </button>
        )}
        {isTap && onAddSequenceStep && event.x !== undefined && event.y !== undefined && (
          <button 
            onClick={() => onAddSequenceStep(event.x!, event.y!)} 
            className="p-1.5 rounded bg-white/5 hover:bg-green-500/20 text-neutral-400 hover:text-green-400 transition-colors" 
            title="Add to Sequence"
          >
            <Plus size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
