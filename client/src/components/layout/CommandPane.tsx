"use client";

import { SequenceStep } from "@/hooks/useOverlayServer";
import { useState, useEffect } from "react";
import { AnimatedCard } from "../ui/AnimatedCard";
import { Crosshair, Play, Plus, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const CommandPane = ({
  onQuickTap,
  onRunSequence,
}: {
  onQuickTap: (x: number, y: number) => void;
  onRunSequence: (steps: SequenceStep[]) => void;
}) => {
  const [qtX, setQtX] = useState("");
  const [qtY, setQtY] = useState("");

  const [sqX, setSqX] = useState("");
  const [sqY, setSqY] = useState("");
  const [sqDelay, setSqDelay] = useState("500");
  const [sequence, setSequence] = useState<SequenceStep[]>([]);

  const [presets, setPresets] = useState<{ name: string; steps: SequenceStep[] }[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("oi_presets_v2");
    if (saved) {
      try {
        setPresets(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const savePresets = (p: any) => {
    setPresets(p);
    localStorage.setItem("oi_presets_v2", JSON.stringify(p));
  };

  const handleQuickTap = () => {
    const x = parseInt(qtX);
    const y = parseInt(qtY);
    if (!isNaN(x) && !isNaN(y)) onQuickTap(x, y);
  };

  const handleAddStep = () => {
    const x = parseInt(sqX);
    const y = parseInt(sqY);
    const delay = parseInt(sqDelay) || 500;
    if (!isNaN(x) && !isNaN(y)) {
      setSequence([...sequence, { action: "tap", x, y, delay }]);
      setSqX("");
      setSqY("");
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
      <AnimatedCard title="Quick Tap" delay={0.2}>
        <div className="flex gap-2">
          <Input placeholder="X" value={qtX} onChange={(e) => setQtX(e.target.value)} />
          <Input placeholder="Y" value={qtY} onChange={(e) => setQtY(e.target.value)} />
        </div>
        <Button className="mt-4 w-full bg-blue-600 hover:bg-blue-500" onClick={handleQuickTap}>
          <Crosshair className="mr-2 h-4 w-4" /> Fire Tap
        </Button>
      </AnimatedCard>

      <AnimatedCard title="Sequence Builder" delay={0.3}>
        <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border border-white/5 bg-black/20 p-2 scrollbar-thin">
          {sequence.length === 0 ? (
            <div className="p-4 text-center text-xs text-neutral-500">No steps yet</div>
          ) : (
            sequence.map((s, i) => (
              <div
                key={i}
                className="mb-1 flex items-center justify-between rounded bg-white/5 px-2 py-1.5 text-xs font-mono text-neutral-300"
              >
                <span>
                  <span className="text-neutral-500">#{i + 1}</span> ({s.x}, {s.y}){" "}
                  <span className="text-neutral-500">+{s.delay}ms</span>
                </span>
                <button
                  className="text-red-400 hover:text-red-300"
                  onClick={() => setSequence(sequence.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mb-4 grid grid-cols-4 gap-2">
          <Input placeholder="X" value={sqX} onChange={(e) => setSqX(e.target.value)} />
          <Input placeholder="Y" value={sqY} onChange={(e) => setSqY(e.target.value)} />
          <Input placeholder="ms" value={sqDelay} onChange={(e) => setSqDelay(e.target.value)} />
          <Button variant="secondary" className="px-0" onClick={handleAddStep}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            className="flex-1 bg-green-600 hover:bg-green-500"
            onClick={() => onRunSequence(sequence)}
            disabled={sequence.length === 0}
          >
            <Play className="mr-2 h-4 w-4" /> Run
          </Button>
          <Button variant="danger" onClick={() => setSequence([])} disabled={sequence.length === 0}>
            Clear
          </Button>
        </div>
      </AnimatedCard>

      <AnimatedCard title="Presets" delay={0.4}>
        <Button
          variant="secondary"
          className="mb-4 w-full"
          onClick={() => {
            if (sequence.length === 0) return;
            const name = window.prompt("Preset name:");
            if (name) savePresets([...presets, { name, steps: sequence }]);
          }}
          disabled={sequence.length === 0}
        >
          <Save className="mr-2 h-4 w-4" /> Save current
        </Button>

        <div className="flex flex-col gap-2">
          {presets.length === 0 ? (
            <div className="text-center text-xs text-neutral-500">No presets saved</div>
          ) : (
            presets.map((p, i) => (
              <div key={i} className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1 justify-start overflow-hidden truncate px-3 text-xs"
                  onClick={() => setSequence(p.steps)}
                >
                  <Play className="mr-2 h-3 w-3 shrink-0" /> {p.name}
                </Button>
                <Button
                  variant="danger"
                  className="px-2"
                  onClick={() => savePresets(presets.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      </AnimatedCard>
    </div>
  );
};

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    type="number"
    className={cn(
      "w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm font-mono text-white outline-none transition-colors focus:border-blue-500",
      className
    )}
    {...props}
  />
);

const Button = ({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) => {
  const variants = {
    primary: "bg-white/10 text-white hover:bg-white/20",
    secondary: "border border-white/10 bg-transparent text-neutral-300 hover:bg-white/5",
    danger: "bg-red-500/10 text-red-400 hover:bg-red-500/20",
  };
  return (
    <button
      className={cn(
        "flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        className
      )}
      {...props}
    />
  );
};
