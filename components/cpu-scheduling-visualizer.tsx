"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  motion,
  AnimatePresence,
  LayoutGroup,
  type Transition,
  type Variants,
} from "framer-motion";
import {
  Cpu,
  Plus,
  Play,
  RotateCcw,
  Clock,
  Layers,
  Trash2,
  ChevronDown,
  Timer,
  Gauge,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface Process {
  id: string;
  name: string;
  arrivalTime: number;
  burstTime: number;
  remainingTime: number;
  color: string;
}

interface GanttBlock {
  processId: string;
  processName: string;
  startTime: number;
  endTime: number;
  color: string;
}

interface SchedulingResult {
  waitingTime: number;
  turnaroundTime: number;
  completionTime: number;
}

const PROCESS_COLORS = [
  "oklch(0.7 0.18 200)",
  "oklch(0.65 0.2 170)",
  "oklch(0.75 0.15 60)",
  "oklch(0.6 0.22 25)",
  "oklch(0.65 0.18 300)",
  "oklch(0.7 0.15 140)",
  "oklch(0.68 0.2 30)",
  "oklch(0.72 0.16 250)",
];

const BASE_STEP_MS = 800;

const SPEED_PRESETS = [
  { label: "0.5×", value: 0.5 },
  { label: "1×", value: 1 },
  { label: "1.5×", value: 1.5 },
  { label: "2×", value: 2 },
  { label: "3×", value: 3 },
] as const;

const springSnappy: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 28,
  mass: 0.8,
};

const springSmooth: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 24,
};

const easeSmooth: Transition = {
  duration: 0.45,
  ease: [0.22, 1, 0.36, 1],
};

const fadeScaleIn: Variants = {
  initial: { opacity: 0, scale: 0.85, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.85, y: -8 },
};

const slideFromRight: Variants = {
  initial: { opacity: 0, x: 40, scale: 0.9 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -30, scale: 0.85 },
};

const ganttBlockVariants: Variants = {
  initial: { opacity: 0, scaleY: 0.4, scaleX: 0.3 },
  animate: {
    opacity: 1,
    scaleY: 1,
    scaleX: 1,
  },
};

function SystemClockTimeline({
  currentTime,
  timelineMax,
  stepIntervalMs,
  isRunning,
  processes,
  ganttChart,
}: {
  currentTime: number;
  timelineMax: number;
  stepIntervalMs: number;
  isRunning: boolean;
  processes: Process[];
  ganttChart: GanttBlock[];
}) {
  const ticks = useMemo(() => {
    const count = Math.min(timelineMax + 1, 24);
    return Array.from({ length: count }, (_, i) => i);
  }, [timelineMax]);

  const playheadPercent =
    timelineMax > 0 ? (currentTime / timelineMax) * 100 : 0;
  const elapsedPercent =
    timelineMax > 0 ? (currentTime / timelineMax) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-1">
          <motion.div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Timer className="w-4 h-4 text-primary" />
            System Clock
          </motion.div>
          <div className="flex items-baseline gap-2">
            <span className="text-muted-foreground text-lg font-mono">T</span>
            <span className="text-muted-foreground text-2xl font-light">=</span>
            <AnimatePresence mode="wait">
              <motion.span
                key={currentTime}
                initial={{ opacity: 0, y: 12, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.85 }}
                transition={springSnappy}
                className="text-5xl md:text-6xl font-mono font-bold gradient-text tabular-nums"
              >
                {currentTime}
              </motion.span>
            </AnimatePresence>
            <span className="text-muted-foreground text-sm ml-1">time units</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <motion.div
            animate={
              isRunning
                ? { opacity: [0.6, 1, 0.6], scale: [1, 1.05, 1] }
                : { opacity: 0.5, scale: 1 }
            }
            transition={{
              duration: stepIntervalMs / 1000,
              repeat: isRunning ? Infinity : 0,
              ease: "easeInOut",
            }}
            className={`neon-badge ${
              isRunning
                ? "border-primary/50 text-primary"
                : "border-border/50 text-muted-foreground"
            }`}
          >
            {isRunning ? "● SIMULATING" : "○ IDLE"}
          </motion.div>
        </div>
      </div>

      {/* Intra-step progress sweep */}
      <motion.div
        className="relative h-1.5 rounded-full bg-secondary/40 overflow-hidden border border-primary/5"
        layout
      >
        <motion.div
          className="absolute inset-y-0 left-0 bg-primary/30 rounded-full"
          animate={{ width: `${elapsedPercent}%` }}
          transition={{ duration: stepIntervalMs / 1000, ease: "linear" }}
        />
        <AnimatePresence>
          {isRunning && (
            <motion.div
              key={`sweep-${currentTime}`}
              className="absolute inset-y-0 rounded-full bg-primary"
              style={{
                left: `${Math.max(0, playheadPercent - (timelineMax > 0 ? 100 / timelineMax : 0))}%`,
              }}
              initial={{ width: "0%", opacity: 0.6 }}
              animate={{
                width: `${timelineMax > 0 ? 100 / timelineMax : 0}%`,
                opacity: [0.6, 1, 0.6],
              }}
              exit={{ opacity: 0 }}
              transition={{
                width: { duration: stepIntervalMs / 1000, ease: "linear" },
                opacity: { duration: stepIntervalMs / 1000, ease: "easeInOut" },
              }}
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* Timeline ruler */}
      <div className="relative pt-2 pb-8">
        <div className="absolute inset-x-0 top-6 h-px bg-border" />
        <motion.div
          className="absolute top-6 h-px bg-primary/60 origin-left"
          animate={{ width: `${elapsedPercent}%` }}
          transition={{ duration: stepIntervalMs / 1000, ease: "linear" }}
        />

        {/* Gantt segments on timeline */}
        <div className="absolute top-4 left-0 right-0 h-3">
          {ganttChart.map((block) => {
            const left = (block.startTime / timelineMax) * 100;
            const width = ((block.endTime - block.startTime) / timelineMax) * 100;
            return (
              <motion.div
                key={`${block.processId}-${block.startTime}`}
                layout
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 0.85, scaleY: 1 }}
                transition={springSnappy}
                className="absolute h-full rounded-sm"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  backgroundColor: block.color,
                }}
              />
            );
          })}
        </div>

        {/* Arrival markers */}
        {processes.map((p) => {
          const left = timelineMax > 0 ? (p.arrivalTime / timelineMax) * 100 : 0;
          return (
            <motion.div
              key={`arrival-${p.id}`}
              className="absolute top-8 flex flex-col items-center -translate-x-1/2"
              style={{ left: `${left}%` }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springSmooth}
            >
              <div
                className="w-2 h-2 rounded-full border-2 border-background"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-[10px] text-muted-foreground mt-1 whitespace-nowrap">
                {p.name}↓
              </span>
            </motion.div>
          );
        })}

        {/* Playhead */}
        <motion.div
          className="absolute top-3 z-10 flex flex-col items-center -translate-x-1/2 pointer-events-none"
          animate={{ left: `${playheadPercent}%` }}
          transition={{ duration: stepIntervalMs / 1000, ease: "linear" }}
        >
          <motion.div
            animate={
              isRunning
                ? {
                    boxShadow: [
                      "0 0 8px oklch(0.7 0.18 200 / 0.5)",
                      "0 0 16px oklch(0.7 0.18 200 / 0.8)",
                      "0 0 8px oklch(0.7 0.18 200 / 0.5)",
                    ],
                  }
                : { boxShadow: "0 0 6px oklch(0.7 0.18 200 / 0.4)" }
            }
            transition={{ duration: 1, repeat: isRunning ? Infinity : 0 }}
            className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-primary"
          />
          <motion.div
            className="w-px h-8 bg-primary"
            animate={{ opacity: isRunning ? [0.5, 1, 0.5] : 0.7 }}
            transition={{ duration: 1.2, repeat: isRunning ? Infinity : 0 }}
          />
        </motion.div>

        {/* Tick labels */}
        <div className="relative flex justify-between mt-10">
          {ticks.map((tick) => (
            <div key={tick} className="flex flex-col items-center">
              <div
                className={`w-px h-2 ${tick <= currentTime ? "bg-primary/70" : "bg-border"}`}
              />
              <span
                className={`text-[10px] mt-1 tabular-nums ${
                  tick === currentTime
                    ? "text-primary font-semibold"
                    : tick < currentTime
                      ? "text-muted-foreground"
                      : "text-muted-foreground/50"
                }`}
              >
                {tick}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CPUSchedulingVisualizer() {
  const [processes, setProcesses] = useState<Process[]>([
    {
      id: "P1",
      name: "P1",
      arrivalTime: 0,
      burstTime: 5,
      remainingTime: 5,
      color: PROCESS_COLORS[0],
    },
    {
      id: "P2",
      name: "P2",
      arrivalTime: 1,
      burstTime: 3,
      remainingTime: 3,
      color: PROCESS_COLORS[1],
    },
    {
      id: "P3",
      name: "P3",
      arrivalTime: 2,
      burstTime: 8,
      remainingTime: 8,
      color: PROCESS_COLORS[2],
    },
  ]);

  const [algorithm, setAlgorithm] = useState<"FCFS" | "RR">("FCFS");
  const [timeQuantum, setTimeQuantum] = useState(2);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [readyQueue, setReadyQueue] = useState<Process[]>([]);
  const [executingProcess, setExecutingProcess] = useState<Process | null>(
    null
  );
  const [ganttChart, setGanttChart] = useState<GanttBlock[]>([]);
  const [results, setResults] = useState<Map<string, SchedulingResult>>(
    new Map()
  );
  const [isAlgorithmOpen, setIsAlgorithmOpen] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const simulationRef = useRef<NodeJS.Timeout | null>(null);
  const runStepRef = useRef<(() => void) | null>(null);

  const stepIntervalMs = useMemo(
    () => Math.round(BASE_STEP_MS / simulationSpeed),
    [simulationSpeed]
  );

  const stepIntervalMsRef = useRef(stepIntervalMs);
  stepIntervalMsRef.current = stepIntervalMs;

  const timelineMax = useMemo(() => {
    if (processes.length === 0) return 12;
    const processSpan = processes.reduce(
      (max, p) => Math.max(max, p.arrivalTime + p.burstTime),
      0
    );
    const ganttEnd = ganttChart.reduce((max, b) => Math.max(max, b.endTime), 0);
    return Math.max(8, processSpan + 2, currentTime + 2, ganttEnd + 1);
  }, [processes, currentTime, ganttChart]);

  const scheduleNextStep = useCallback((step: () => void) => {
    runStepRef.current = step;
    if (simulationRef.current) {
      clearTimeout(simulationRef.current);
    }
    simulationRef.current = setTimeout(step, stepIntervalMsRef.current);
  }, []);

  useEffect(() => {
    if (!isRunning || !runStepRef.current) return;
    scheduleNextStep(runStepRef.current);
  }, [stepIntervalMs, isRunning, scheduleNextStep]);

  const resetSimulation = useCallback(() => {
    setIsRunning(false);
    setCurrentTime(0);
    setReadyQueue([]);
    setExecutingProcess(null);
    setGanttChart([]);
    setResults(new Map());
    setProcesses((prev) =>
      prev.map((p) => ({ ...p, remainingTime: p.burstTime }))
    );
    if (simulationRef.current) {
      clearTimeout(simulationRef.current);
    }
    runStepRef.current = null;
  }, []);

  const addProcess = () => {
    const newId = `P${processes.length + 1}`;
    const newProcess: Process = {
      id: newId,
      name: newId,
      arrivalTime: 0,
      burstTime: 4,
      remainingTime: 4,
      color: PROCESS_COLORS[processes.length % PROCESS_COLORS.length],
    };
    setProcesses([...processes, newProcess]);
  };

  const removeProcess = (id: string) => {
    setProcesses(processes.filter((p) => p.id !== id));
  };

  const updateProcess = (
    id: string,
    field: keyof Process,
    value: number | string
  ) => {
    setProcesses(
      processes.map((p) => {
        if (p.id === id) {
          const updated = { ...p, [field]: value };
          if (field === "burstTime") {
            updated.remainingTime = value as number;
          }
          return updated;
        }
        return p;
      })
    );
  };

  const runSimulation = useCallback(() => {
    if (isRunning) return;

    resetSimulation();
    setIsRunning(true);

    const processQueue = processes.map((p) => ({
      ...p,
      remainingTime: p.burstTime,
    }));
    const completed: Map<string, SchedulingResult> = new Map();
    const gantt: GanttBlock[] = [];
    let time = 0;
    let ready: Process[] = [];
    let current: Process | null = null;
    let quantumRemaining = timeQuantum;

    const simulateStep = () => {
      // Add arriving processes to ready queue
      const arriving = processQueue.filter(
        (p) =>
          p.arrivalTime === time &&
          p.remainingTime > 0 &&
          !ready.find((r) => r.id === p.id) &&
          (!current || current.id !== p.id)
      );
      ready = [...ready, ...arriving];

      // FCFS Logic
      if (algorithm === "FCFS") {
        if (!current && ready.length > 0) {
          current = ready.shift()!;
        }

        if (current) {
          current.remainingTime--;

          if (
            gantt.length === 0 ||
            gantt[gantt.length - 1].processId !== current.id
          ) {
            gantt.push({
              processId: current.id,
              processName: current.name,
              startTime: time,
              endTime: time + 1,
              color: current.color,
            });
          } else {
            gantt[gantt.length - 1].endTime = time + 1;
          }

          if (current.remainingTime === 0) {
            const completionTime = time + 1;
            const turnaroundTime = completionTime - current.arrivalTime;
            const waitingTime = turnaroundTime - current.burstTime;
            completed.set(current.id, {
              waitingTime,
              turnaroundTime,
              completionTime,
            });
            current = null;
          }
        }
      }

      // Round Robin Logic
      if (algorithm === "RR") {
        if (!current && ready.length > 0) {
          current = ready.shift()!;
          quantumRemaining = timeQuantum;
        }

        if (current) {
          current.remainingTime--;
          quantumRemaining--;

          if (
            gantt.length === 0 ||
            gantt[gantt.length - 1].processId !== current.id
          ) {
            gantt.push({
              processId: current.id,
              processName: current.name,
              startTime: time,
              endTime: time + 1,
              color: current.color,
            });
          } else {
            gantt[gantt.length - 1].endTime = time + 1;
          }

          if (current.remainingTime === 0) {
            const completionTime = time + 1;
            const turnaroundTime = completionTime - current.arrivalTime;
            const waitingTime =
              turnaroundTime -
              processQueue.find((p) => p.id === current!.id)!.burstTime;
            completed.set(current.id, {
              waitingTime,
              turnaroundTime,
              completionTime,
            });
            current = null;
          } else if (quantumRemaining === 0) {
            ready.push(current);
            current = null;
          }
        }
      }

      time++;
      setCurrentTime(time);
      setReadyQueue([...ready]);
      setExecutingProcess(current ? { ...current } : null);
      setGanttChart([...gantt]);
      setResults(new Map(completed));

      const allCompleted = processQueue.every((p) => completed.has(p.id));
      const hasWork =
        ready.length > 0 ||
        current !== null ||
        processQueue.some((p) => p.arrivalTime >= time && !completed.has(p.id));

      if (!allCompleted && (hasWork || time < 50)) {
        scheduleNextStep(simulateStep);
      } else {
        setIsRunning(false);
        runStepRef.current = null;
      }
    };

    simulateStep();
  }, [
    processes,
    algorithm,
    timeQuantum,
    isRunning,
    resetSimulation,
    scheduleNextStep,
  ]);

  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        clearTimeout(simulationRef.current);
      }
    };
  }, []);

  const avgWaitingTime =
    results.size > 0
      ? Array.from(results.values()).reduce((a, b) => a + b.waitingTime, 0) /
        results.size
      : 0;

  const avgTurnaroundTime =
    results.size > 0
      ? Array.from(results.values()).reduce((a, b) => a + b.turnaroundTime, 0) /
        results.size
      : 0;

  return (
    <motion.div
      className="futuristic-shell min-h-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <motion.div
        className="ambient-orb ambient-orb-cyan"
        animate={{ opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="ambient-orb ambient-orb-teal"
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div className="ambient-orb ambient-orb-purple" aria-hidden />
      <div className="grid-overlay" aria-hidden />
      <motion.div
        className="absolute top-0 inset-x-0 h-[420px] pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.72 0.19 200 / 0.08) 0%, oklch(0.68 0.2 170 / 0.03) 40%, transparent 100%)",
        }}
      />

      <motion.div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 space-y-5 md:space-y-7">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={easeSmooth}
          className="text-center space-y-3 px-2"
        >
          <motion.div
            className="inline-flex items-center gap-2 neon-badge mb-1"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, ...springSnappy }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            OS Scheduling Lab
          </motion.div>
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
            animate={isRunning ? { scale: [1, 1.01, 1] } : { scale: 1 }}
            transition={{ duration: 2, repeat: isRunning ? Infinity : 0, ease: "easeInOut" }}
          >
            <motion.div
              animate={{
                rotate: isRunning ? 360 : 0,
                scale: isRunning ? [1, 1.08, 1] : 1,
              }}
              transition={{
                rotate: { duration: 3, repeat: isRunning ? Infinity : 0, ease: "linear" },
                scale: { duration: 1.5, repeat: isRunning ? Infinity : 0, ease: "easeInOut" },
              }}
            >
              <Cpu className="w-10 h-10 text-primary glow-text-cyan" />
            </motion.div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold gradient-text tracking-tight">
              CPU Scheduling Visualizer
            </h1>
          </motion.div>
          <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Visualize FCFS and Round Robin scheduling algorithms in real-time
          </p>
          <div className="neon-divider max-w-xs mx-auto pt-1" />
        </motion.header>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...easeSmooth, delay: 0.1 }}
          className={`glass rounded-2xl p-4 sm:p-5 md:p-6 glow-cyan relative overflow-visible ${isAlgorithmOpen ? "z-50" : "z-10"}`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_auto_minmax(0,1.1fr)_auto] gap-4 md:gap-5 items-end overflow-visible">
            {/* Algorithm Selector */}
            <div className="w-full md:w-auto space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Algorithm
              </label>
              <div className="relative z-50">
                <button
                  onClick={() => setIsAlgorithmOpen(!isAlgorithmOpen)}
                  className="w-full md:w-52 px-4 py-2.5 glass-input text-foreground flex items-center justify-between hover:border-primary/30 transition-all"
                >
                  <span>
                    {algorithm === "FCFS"
                      ? "First Come First Serve"
                      : "Round Robin"}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${isAlgorithmOpen ? "rotate-180" : ""}`}
                  />
                </button>
                <AnimatePresence>
                  {isAlgorithmOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={springSnappy}
                      className="absolute top-full mt-2 w-full glass-strong rounded-xl overflow-hidden z-50 glow-cyan pointer-events-auto"
                    >
                      <button
                        onClick={() => {
                          setAlgorithm("FCFS");
                          setIsAlgorithmOpen(false);
                          resetSimulation();
                        }}
                        className={`w-full px-4 py-2.5 text-left hover:bg-secondary/50 transition-colors ${
                          algorithm === "FCFS"
                            ? "bg-primary/20 text-primary"
                            : "text-foreground"
                        }`}
                      >
                        First Come First Serve (FCFS)
                      </button>
                      <button
                        onClick={() => {
                          setAlgorithm("RR");
                          setIsAlgorithmOpen(false);
                          resetSimulation();
                        }}
                        className={`w-full px-4 py-2.5 text-left hover:bg-secondary/50 transition-colors ${
                          algorithm === "RR"
                            ? "bg-primary/20 text-primary"
                            : "text-foreground"
                        }`}
                      >
                        Round Robin (RR)
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Time Quantum (for RR) */}
            <AnimatePresence>
              {algorithm === "RR" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, width: 0 }}
                  animate={{ opacity: 1, scale: 1, width: "auto" }}
                  exit={{ opacity: 0, scale: 0.9, width: 0 }}
                  transition={springSmooth}
                  className="space-y-2 overflow-hidden"
                >
                  <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4 text-accent" />
                    Time Quantum
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={timeQuantum}
                    onChange={(e) => {
                      setTimeQuantum(parseInt(e.target.value) || 1);
                      resetSimulation();
                    }}
                    className="w-24 px-4 py-2.5 glass-input text-foreground tabular-nums"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Simulation Speed */}
            <motion.div className="w-full sm:col-span-2 xl:col-span-1 space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary" />
                  Simulation Speed
                </span>
                <motion.span
                  key={simulationSpeed}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={springSnappy}
                  className="text-primary font-mono text-xs tabular-nums"
                >
                  {simulationSpeed.toFixed(2)}×
                </motion.span>
              </label>
              <Slider
                value={[simulationSpeed]}
                min={0.25}
                max={3}
                step={0.25}
                disabled={false}
                onValueChange={([value]) => setSimulationSpeed(value)}
                className="py-2 [&_[data-slot=slider-track]]:bg-secondary/60 [&_[data-slot=slider-range]]:bg-gradient-to-r [&_[data-slot=slider-range]]:from-primary [&_[data-slot=slider-range]]:to-accent [&_[data-slot=slider-thumb]]:bg-primary [&_[data-slot=slider-thumb]]:border-primary/50 [&_[data-slot=slider-thumb]]:shadow-[0_0_12px_oklch(0.72_0.19_200_/_0.5)]"
              />
              <div className="flex flex-wrap gap-1.5">
                {SPEED_PRESETS.map((preset) => (
                  <motion.button
                    key={preset.value}
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSimulationSpeed(preset.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all border ${
                      simulationSpeed === preset.value
                        ? "bg-primary/20 text-primary border-primary/40 glow-cyan"
                        : "glass-input text-muted-foreground hover:border-primary/25"
                    }`}
                  >
                    {preset.label}
                  </motion.button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/80 tabular-nums font-mono">
                Step interval: {stepIntervalMs}ms
              </p>
            </motion.div>

            {/* Action Buttons */}
            <motion.div className="flex flex-col sm:flex-row gap-2 w-full sm:col-span-2 xl:col-span-1 sm:justify-end">
              <motion.button
                whileHover={{ scale: isRunning ? 1 : 1.05 }}
                whileTap={{ scale: isRunning ? 1 : 0.95 }}
                onClick={runSimulation}
                disabled={isRunning || processes.length === 0}
                className={`px-6 py-2.5 neon-button flex items-center justify-center gap-2 min-w-[7rem] ${isRunning ? "animate-pulse-glow" : ""}`}
              >
                <Play className="w-4 h-4 shrink-0" aria-hidden />
                <span>Run</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={resetSimulation}
                className="px-6 py-2.5 neon-button-secondary flex items-center justify-center gap-2 min-w-[7rem]"
              >
                <RotateCcw className="w-4 h-4 shrink-0" aria-hidden />
                <span>Reset</span>
              </motion.button>
            </motion.div>
          </div>
        </motion.div>

        {/* System Clock & Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...easeSmooth, delay: 0.15 }}
          className="glass rounded-2xl p-4 sm:p-5 md:p-6 glow-cyan glow-purple"
        >
          <SystemClockTimeline
            currentTime={currentTime}
            timelineMax={timelineMax}
            stepIntervalMs={stepIntervalMs}
            isRunning={isRunning}
            processes={processes}
            ganttChart={ganttChart}
          />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6 relative z-0">
          {/* Process Input Table */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...easeSmooth, delay: 0.2 }}
            className="glass rounded-2xl p-4 sm:p-5 md:p-6 glow-cyan"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <h2 className="section-title text-foreground glow-text-teal">
                Process Table
              </h2>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={addProcess}
                disabled={isRunning}
                className="px-4 py-2 neon-button-secondary text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4 shrink-0" aria-hidden />
                <span>Add Process</span>
              </motion.button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-primary/10">
                    <th className="pb-3 pr-4">Process</th>
                    <th className="pb-3 pr-4">Arrival</th>
                    <th className="pb-3 pr-4">Burst</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {processes.map((process, index) => (
                      <motion.tr
                        key={process.id}
                        layout
                        variants={fadeScaleIn}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ ...springSnappy, delay: index * 0.04 }}
                        className="border-b border-border/50"
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: process.color }}
                            />
                            <span className="text-foreground font-medium">
                              {process.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <input
                            type="number"
                            min="0"
                            value={process.arrivalTime}
                            onChange={(e) =>
                              updateProcess(
                                process.id,
                                "arrivalTime",
                                parseInt(e.target.value) || 0
                              )
                            }
                            disabled={isRunning}
                            className="w-16 px-2 py-1.5 glass-input text-foreground text-center tabular-nums disabled:opacity-50"
                          />
                        </td>
                        <td className="py-3 pr-4">
                          <input
                            type="number"
                            min="1"
                            value={process.burstTime}
                            onChange={(e) =>
                              updateProcess(
                                process.id,
                                "burstTime",
                                parseInt(e.target.value) || 1
                              )
                            }
                            disabled={isRunning}
                            className="w-16 px-2 py-1.5 glass-input text-foreground text-center tabular-nums disabled:opacity-50"
                          />
                        </td>
                        <td className="py-3">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => removeProcess(process.id)}
                            disabled={isRunning || processes.length <= 1}
                            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Ready Queue & CPU */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...easeSmooth, delay: 0.3 }}
            className="space-y-6"
          >
            <LayoutGroup id="scheduling-flow">
              {/* Ready Queue */}
              <div className="glass rounded-2xl p-4 sm:p-5 md:p-6 glow-teal">
                <motion.div className="flex items-center justify-between mb-5">
                  <h2 className="section-title text-foreground">
                    Ready Queue
                  </h2>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={currentTime}
                      initial={{ opacity: 0, y: -8, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.9 }}
                      transition={springSnappy}
                      className="text-sm font-mono text-primary tabular-nums"
                    >
                      Time: {currentTime}
                    </motion.span>
                  </AnimatePresence>
                </motion.div>
                <motion.div className="flex gap-2 min-h-[68px] items-center flex-wrap p-1 rounded-xl bg-secondary/20 border border-primary/5">
                  <AnimatePresence mode="popLayout">
                    {readyQueue.length > 0 ? (
                      readyQueue.map((process) => (
                        <motion.div
                          key={process.id}
                          layout
                          layoutId={`process-${process.id}`}
                          variants={slideFromRight}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          transition={springSnappy}
                          whileHover={{ scale: 1.06, y: -2 }}
                          className="px-4 py-2 rounded-lg border-2 font-medium shadow-sm cursor-default"
                          style={{
                            backgroundColor: `color-mix(in oklch, ${process.color} 22%, transparent)`,
                            borderColor: process.color,
                            color: process.color,
                          }}
                        >
                          {process.name}
                        </motion.div>
                      ))
                    ) : (
                      <motion.span
                        key="empty-queue"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={easeSmooth}
                        className="text-muted-foreground text-sm"
                      >
                        Queue is empty
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>

              {/* CPU Execution */}
              <div className="glass rounded-2xl p-4 sm:p-5 md:p-6 glow-cyan overflow-hidden">
                <h2 className="section-title text-foreground mb-5 glow-text-cyan">
                  CPU Execution
                </h2>
                <div className="relative flex items-center justify-center min-h-[140px]">
                  {/* Pulsing glow rings when executing */}
                  <AnimatePresence>
                    {executingProcess && (
                      <>
                        <motion.div
                          key="ring-outer"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{
                            opacity: [0.15, 0.35, 0.15],
                            scale: [1, 1.35, 1],
                          }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          className="absolute w-44 h-44 rounded-full pointer-events-none"
                          style={{
                            background: `radial-gradient(circle, color-mix(in oklch, ${executingProcess.color} 40%, transparent) 0%, transparent 70%)`,
                          }}
                        />
                        <motion.div
                          key="ring-inner"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{
                            opacity: [0.25, 0.5, 0.25],
                            scale: [1, 1.15, 1],
                          }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                          className="absolute w-36 h-36 rounded-2xl pointer-events-none"
                          style={{
                            boxShadow: `0 0 30px color-mix(in oklch, ${executingProcess.color} 50%, transparent), 0 0 60px color-mix(in oklch, ${executingProcess.color} 25%, transparent)`,
                          }}
                        />
                      </>
                    )}
                  </AnimatePresence>

                  <motion.div
                    layout
                    animate={
                      executingProcess
                        ? {
                            scale: [1, 1.03, 1],
                            boxShadow: [
                              `0 0 24px color-mix(in oklch, ${executingProcess.color} 45%, transparent)`,
                              `0 0 48px color-mix(in oklch, ${executingProcess.color} 65%, transparent)`,
                              `0 0 24px color-mix(in oklch, ${executingProcess.color} 45%, transparent)`,
                            ],
                          }
                        : { scale: 1, boxShadow: "0 0 0px transparent" }
                    }
                    transition={
                      executingProcess
                        ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                        : springSmooth
                    }
                    className="relative w-32 h-32 rounded-2xl border-2 flex items-center justify-center z-10"
                    style={{
                      backgroundColor: executingProcess
                        ? `color-mix(in oklch, ${executingProcess.color} 28%, transparent)`
                        : "oklch(0.12 0.02 260 / 0.5)",
                      borderColor: executingProcess
                        ? executingProcess.color
                        : "var(--border)",
                    }}
                  >
                    <AnimatePresence mode="wait">
                      {executingProcess ? (
                        <motion.div
                          key={executingProcess.id}
                          layoutId={`process-${executingProcess.id}`}
                          initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
                          animate={{ opacity: 1, scale: 1, rotate: 0 }}
                          exit={{ opacity: 0, scale: 0.6, rotate: 8 }}
                          transition={springSnappy}
                          className="text-center"
                        >
                          <motion.div
                            animate={{ y: [0, -3, 0] }}
                            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <Cpu
                              className="w-8 h-8 mx-auto mb-2"
                              style={{ color: executingProcess.color }}
                            />
                          </motion.div>
                          <p
                            className="text-xl font-bold"
                            style={{ color: executingProcess.color }}
                          >
                            {executingProcess.name}
                          </p>
                          <motion.p
                            key={executingProcess.remainingTime}
                            initial={{ opacity: 0.5, scale: 1.15 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={springSnappy}
                            className="text-sm text-muted-foreground tabular-nums"
                          >
                            Remaining: {executingProcess.remainingTime}
                          </motion.p>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="idle"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={easeSmooth}
                          className="text-center text-muted-foreground"
                        >
                          <Cpu className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Idle</p>
                        </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
              </div>
            </LayoutGroup>
          </motion.div>
        </div>

        {/* Gantt Chart */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...easeSmooth, delay: 0.4 }}
          className="glass rounded-2xl p-4 sm:p-5 md:p-6 glow-cyan"
        >
          <h2 className="section-title text-foreground mb-5 glow-text-cyan">
            Gantt Chart
          </h2>
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-0 min-h-[88px] items-end">
              <AnimatePresence mode="popLayout">
                {ganttChart.length > 0 ? (
                  ganttChart.map((block, index) => (
                    <motion.div
                      key={`${block.processId}-${block.startTime}`}
                      layout
                      variants={ganttBlockVariants}
                      initial="initial"
                      animate="animate"
                      transition={springSnappy}
                      className="relative flex flex-col items-center origin-bottom"
                      style={{ originX: 0 }}
                    >
                      <motion.div
                        layout
                        animate={{
                          width: `${(block.endTime - block.startTime) * 44}px`,
                        }}
                        transition={springSmooth}
                        className="h-14 flex items-center justify-center px-2 min-w-[44px] border-r border-background/50 font-medium text-sm rounded-sm"
                        style={{
                          backgroundColor: block.color,
                          color: "oklch(0.08 0.02 260)",
                        }}
                        whileHover={{ scale: 1.06, y: -2, zIndex: 10 }}
                      >
                        <motion.span
                          key={`${block.processName}-${block.endTime - block.startTime}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={springSnappy}
                        >
                          {block.processName}
                        </motion.span>
                      </motion.div>
                      <div className="flex justify-between w-full text-xs text-muted-foreground mt-1.5 px-0.5">
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.1 }}
                        >
                          {block.startTime}
                        </motion.span>
                        {index === ganttChart.length - 1 && (
                          <motion.span
                            key={block.endTime}
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={springSnappy}
                          >
                            {block.endTime}
                          </motion.span>
                        )}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <motion.div
                    key="gantt-empty"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={easeSmooth}
                    className="flex items-center justify-center w-full h-[88px] text-muted-foreground text-sm"
                  >
                    Run simulation to see Gantt chart
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Results Table */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...easeSmooth, delay: 0.5 }}
          className="glass rounded-2xl p-4 sm:p-5 md:p-6 glow-teal glow-purple"
        >
          <h2 className="section-title text-foreground mb-5 glow-text-teal">
            Performance Metrics
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-primary/10">
                  <th className="pb-3 pr-4">Process</th>
                  <th className="pb-3 pr-4">Arrival Time</th>
                  <th className="pb-3 pr-4">Burst Time</th>
                  <th className="pb-3 pr-4">Completion Time</th>
                  <th className="pb-3 pr-4">Turnaround Time</th>
                  <th className="pb-3">Waiting Time</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {processes.map((process, index) => {
                    const result = results.get(process.id);
                    return (
                      <motion.tr
                        key={process.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...easeSmooth, delay: index * 0.04 }}
                        className="border-b border-border/50"
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: process.color }}
                            />
                            <span className="text-foreground font-medium">
                              {process.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {process.arrivalTime}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {process.burstTime}
                        </td>
                        <td className="py-3 pr-4">
                          <AnimatePresence mode="wait">
                            {result ? (
                              <motion.span
                                key={`ct-${result.completionTime}`}
                                initial={{ opacity: 0, scale: 0.6, y: 4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={springSnappy}
                                className="text-primary font-medium tabular-nums"
                              >
                                {result.completionTime}
                              </motion.span>
                            ) : (
                              <motion.span
                                key="ct-empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-muted-foreground"
                              >
                                -
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </td>
                        <td className="py-3 pr-4">
                          <AnimatePresence mode="wait">
                            {result ? (
                              <motion.span
                                key={`tat-${result.turnaroundTime}`}
                                initial={{ opacity: 0, scale: 0.6, y: 4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={springSnappy}
                                className="text-accent font-medium tabular-nums"
                              >
                                {result.turnaroundTime}
                              </motion.span>
                            ) : (
                              <motion.span
                                key="tat-empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-muted-foreground"
                              >
                                -
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </td>
                        <td className="py-3">
                          <AnimatePresence mode="wait">
                            {result ? (
                              <motion.span
                                key={`wt-${result.waitingTime}`}
                                initial={{ opacity: 0, scale: 0.6, y: 4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={springSnappy}
                                className="text-chart-3 font-medium tabular-nums"
                              >
                                {result.waitingTime}
                              </motion.span>
                            ) : (
                              <motion.span
                                key="wt-empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-muted-foreground"
                              >
                                -
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
              {results.size > 0 && (
                <tfoot>
                  <motion.tr
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={springSmooth}
                    className="border-t border-border"
                  >
                    <td
                      colSpan={4}
                      className="pt-3 text-right font-semibold text-foreground"
                    >
                      Averages:
                    </td>
                    <td className="pt-3 pr-4">
                      <motion.span
                        key={avgTurnaroundTime}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={springSnappy}
                        className="text-accent font-bold tabular-nums"
                      >
                        {avgTurnaroundTime.toFixed(2)}
                      </motion.span>
                    </td>
                    <td className="pt-3">
                      <motion.span
                        key={avgWaitingTime}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={springSnappy}
                        className="text-chart-3 font-bold tabular-nums"
                      >
                        {avgWaitingTime.toFixed(2)}
                      </motion.span>
                    </td>
                  </motion.tr>
                </tfoot>
              )}
            </table>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
