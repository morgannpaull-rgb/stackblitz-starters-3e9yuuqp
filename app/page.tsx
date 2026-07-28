// ============================================================
// EDGELAB BACCARAT FULL FILE REPLACEMENT
// PULSE PHASE 2A ENGINE-SPECIFIC CONFIDENCE MODULATION + RECOVERY LOCK REMOVED + ENTRY/EXIT SIGNAL AUDIT
// Source baseline preserved; Roulette-derived Pulse axis logic removed from active Pulse path. Pulse applies Markov-style cadence assistance to BB Straight + Pulse and BB Inverted + Pulse, and non-Markov Pulse authority filtering to Markov + Pulse. Shadow Recovery remains removed from active Pulse. Standalone Markov remains independent and does not receive a second Markov predictor. Clickable Streak Analysis is detached from Pulse and remains a standalone Analytics/Research tool. Confidence Governance, Execution Governance, Structural Drift Detection, and Loss Acceleration are removed from active Pulse behavior.
// Standalone PULSE chart/execution rows remain removed from live comparison surfaces.
// BB Straight, BB Inverted, DPI, Baccarat single-stream Markov, analytics, and shell/layout preserved.
// ============================================================

"use client";

import React, { useEffect, useMemo, useState } from "react";

type SpinValue = number | "00";
type Result = "win" | "loss" | "push";
type ETRState = "off" | "armed" | "recovery";
type ETRBetType = "flat" | "recovery";
type TierLabel = "Strong Prediction" | "Controlled Prediction" | "Weak Prediction" | "Directional Observe" | "No Prediction" | "BB Straight" | "BB Inverted" | "BB Inverted Armed" | "Cadence" | "Disabled";
type GroupKey = "BHE" | "BHO" | "BLE" | "BLO" | "RHE" | "RHO" | "RLE" | "RLO";
type Strategy =
  | "Flat"
  | "Martingale"
  | "Fibonacci"
  | "D'Alembert"
  | "ReverseD'Alembert"
  | "1-3-2-6"
  | "ETR"
  | "ETR-C"
  | "Step Recovery"
  | "Exposure Cap"
  | "Confidence-65"
  | "Confidence-75"
  | "Progressive Confidence";
type Appearance = "dark" | "light";
type ViewKey = "Dashboard" | "Analytics" | "Reports" | "Sessions";
type BBMode = "BB Off" | "BB Straight" | "BB Inverted";
type ExecutionMode = "Stream Direct" | "Baccarat Side Execution" | "Baccarat Edge Handling" | "Hybrid Coverage";
type ShadowEngine = "PULSE" | "BB_STRAIGHT" | "BB_INVERTED" | "MARKOV"; // PULSE retained for diagnostics only; live charts use engine+Pulse paired replays.

type Step = {
  spin: number;
  outcome: SpinValue;
  outcomeGroup: GroupKey;
  predictedGroup: GroupKey | null;
  predictedNumbers: SpinValue[];
  forecastGroup?: GroupKey | null;
  forecastNumbers?: SpinValue[];
  confidence: number;
  dpi?: number;
  tier: string;
  result: Result;
  unitBet: number;
  exposure: number;
  net: number;
  bankroll: number;
  note: string;
  executionMode: ExecutionMode;
  coreResult: Result;
  overlayResult: Result;
  wheelNeighbors: SpinValue[];
  wheelAlignment: number;
  streamConflict: boolean;
  pulseGate?: any;
  pulseDiagnostics?: any;
  etrStateAfter?: ETRState;
  etrBetType?: ETRBetType;
  recoveryStep?: number;
  oneThreeTwoSixStep?: number;
  // Set once the all-engines-declining-from-peak circuit breaker fires (see
  // getEngineDeclineHaltTriggered) — permanent for the rest of the session,
  // same semantics as roulette's Stop-Loss/Trail-Stop.
  sessionEnded?: boolean;
};

type SavedSession = {
  name: string;
  createdAt: string;
  startingBankroll: number;
  baseUnit: number;
  tableLimit?: number;
  perNumberLimit?: number;
  exposureCapPercent?: number;
  autoSpins: number;
  strategy: Strategy;
  pulseEnabled: boolean;
  bbMode: BBMode;
  bbStraightEnabled?: boolean;
  bbInvertedEnabled?: boolean;
  executeWeak?: boolean;
  executeObservation?: boolean;
  history: Step[];
  executionMode?: ExecutionMode;
};

type SavedControlSettings = {
  startingBankroll: number;
  baseUnit: number;
  tableLimit: number;
  perNumberLimit: number;
  exposureCapPercent: number;
  autoSpins: number;
  strategy: Strategy;
  pulseEnabled: boolean;
  bbStraightEnabled: boolean;
  bbInvertedEnabled: boolean;
  markovEnabled: boolean;
  cadenceEnabled: boolean;
  scoutEnabled: boolean;
  executionMode: ExecutionMode;
  executeWeak: boolean;
  executeObservation: boolean;
  appearance: Appearance;
};

const DEFAULT_STARTING_BANKROLL = 5000;
const DEFAULT_BASE_UNIT = 25;
const DEFAULT_AUTO_SPINS = 80;
const DEFAULT_NUMBER_OF_SHOES = 1;
const DEFAULT_TABLE_LIMIT = 10000;
const DEFAULT_PER_NUMBER_LIMIT = 10000;
const DEFAULT_EXPOSURE_CAP_PERCENT = 2;
const MAX_ETR_C_RECOVERY_BET = 500;
const MAX_ETR_C_RECOVERY_STEPS = 5;
const DEFAULT_EXECUTE_WEAK = true;
const DEFAULT_EXECUTE_OBSERVATION = true;

type TierExecutionSettings = {
  executeWeak: boolean;
  executeObservation: boolean;
};

const DEFAULT_TIER_EXECUTION: TierExecutionSettings = {
  executeWeak: DEFAULT_EXECUTE_WEAK,
  executeObservation: DEFAULT_EXECUTE_OBSERVATION,
};

const DEFAULT_DIMENSION_GATE_MIN = 51;
const RV_MODERATE = 45;
const RV_HIGH = 58;
const RV_EXTREME = 75;
const RV_STRUCTURAL_MODERATE = 55;
const RV_STRUCTURAL_HIGH = 68;
const RV_STRUCTURAL_EXTREME = 82;
const RV_STRUCTURAL_PENALTY_MODERATE = 3;
const RV_STRUCTURAL_PENALTY_HIGH = 7;
const RV_STRUCTURAL_PENALTY_EXTREME = 12;
const RV_CONFIDENCE_PENALTY_MODERATE = 4;
const RV_CONFIDENCE_PENALTY_HIGH = 8;
const RV_CONFIDENCE_PENALTY_EXTREME = 14;
const ENTROPY_EXTREME_BLOCK = 78;
const PERSISTENCE_GATE_MIN = 50;
const STRONG_PERSISTENCE_MIN = 56;
const NEURAL_DOWNGRADE_THRESHOLD = -6;
const NEURAL_HOLD_THRESHOLD = -12;
const DEFAULT_STRATEGY: Strategy = "Flat";
const PERF_REPLAY_HAND_LIMIT = 120;
const PERF_CHART_HAND_LIMIT = 120;
const STORAGE_KEY = "edgelab_baccarat_native_pulse_terminal_v1";
const CONTROL_SETTINGS_KEY = "edgelab_baccarat_native_pulse_control_settings_v1";
const STRATEGIES: Strategy[] = [
  "Flat",
  "Martingale",
  "Fibonacci",
  "D'Alembert",
  "ReverseD'Alembert",
  "1-3-2-6",
  "ETR",
  "ETR-C",
];
const VIEWS: ViewKey[] = ["Dashboard", "Analytics", "Reports", "Sessions"];
const EXECUTION_MODES: ExecutionMode[] = ["Stream Direct"];
const ALL_NUMBERS: SpinValue[] = [0, "00", ...Array.from({ length: 36 }, (_, i) => i + 1)];
const RED_NUMBERS = new Set<SpinValue>([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

const COLORS = {
  cyan: "#22c7f3",
  blue: "#2563eb",
  red: "#ef4444",
  green: "#22c55e",
  amber: "#f59e0b",
  yellow: "#facc15",
};

const GROUPS: Record<GroupKey, SpinValue[]> = {
  BHE: [20, 22, 24, 26, 28],
  BHO: ["00", 29, 31, 33, 35],
  BLE: [2, 4, 6, 8, 10],
  BLO: [11, 13, 15, 17],
  RHE: [0, 30, 32, 34, 36],
  RHO: [19, 21, 23, 25, 27],
  RLE: [12, 14, 16, 18],
  RLO: [1, 3, 5, 7, 9],
};

const WHEEL_NEIGHBORS: Partial<Record<GroupKey, SpinValue[]>> = {
  BHE: [9],
  RHO: [10],
  BHO: [1],
  RHE: [2],
  BLO: [1],
  RLE: [2],
};

// EDGE EXPANSION MAP
// Separate from Baccarat Side Execution.
// Baccarat Edge Handling = core group + only these one-number edge adds.
const EDGE_EXPANSION: Partial<Record<GroupKey, SpinValue[]>> = {
  BHE: [9],
  RHE: [2],
  BHO: [1],
  RHO: [10],
  RLE: [2],
  BLO: [1],
};

// NEIGHBOR EXPANSION MAP
// These added numbers are an execution overlay used by Baccarat Side Execution.
// They do not modify BB Straight, BB Inverted, Markov, or DPI core logic.
const PULSE_ONLY_NEIGHBORS: Partial<Record<GroupKey, SpinValue[]>> = {
  BHE: [1, 3, 5, 7, 9],
  BHO: [1, 12, 14, 16, 18],
  BLE: [19, 21, 23, 25, 27],
  BLO: [0, 30, 32, 34, 36],
  RHE: [2, 11, 13, 15, 17],
  RHO: [2, 4, 6, 8, 10],
  RLE: ["00", 29, 31, 33, 35],
  RLO: [20, 22, 24, 26, 28],
};

const ROULETTE_GRID: SpinValue[][] = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

function getTheme(appearance: Appearance) {
  const dark = appearance === "dark";
  return {
    appBg: dark ? "radial-gradient(circle at top left, rgba(34,199,243,0.12), transparent 32%), #080d18" : "#f4f7fb",
    railBg: dark ? "#020617" : "#ffffff",
    panel: dark ? "rgba(15,23,42,0.88)" : "#ffffff",
    panel2: dark ? "rgba(2,6,23,0.56)" : "#f8fafc",
    input: dark ? "#020617" : "#ffffff",
    text: dark ? "#e5e7eb" : "#0f172a",
    subtext: dark ? "#94a3b8" : "#64748b",
    border: dark ? "rgba(148,163,184,0.22)" : "#dbe3ef",
    borderStrong: dark ? "rgba(148,163,184,0.38)" : "#94a3b8",
    shadow: dark ? "0 16px 40px rgba(0,0,0,0.22)" : "0 10px 30px rgba(15,23,42,0.08)",
  };
}

function numberToGroup(value: SpinValue): GroupKey {
  if (value === 0) return "RHE";
  if (value === "00") return "BHO";
  const n = value as number;
  const color = RED_NUMBERS.has(n) ? "R" : "B";
  const range = n >= 19 ? "H" : "L";
  const parity = n % 2 === 0 ? "E" : "O";
  return `${color}${range}${parity}` as GroupKey;
}

function groupSeries(history: Step[]) {
  return history.map((h) => h.outcomeGroup);
}

function currentStreak(values: string[]) {
  if (!values.length) return 0;
  const last = values[values.length - 1];
  let streak = 1;
  for (let i = values.length - 2; i >= 0; i -= 1) {
    if (values[i] === last) streak += 1;
    else break;
  }
  return streak;
}

function entropy(values: string[]) {
  const recent = values.slice(-12);
  if (recent.length < 4) return 0;
  const counts: Record<string, number> = {};
  recent.forEach((v) => (counts[v] = (counts[v] || 0) + 1));
  let e = 0;
  Object.values(counts).forEach((count) => {
    const p = count / recent.length;
    e -= p * Math.log2(p);
  });
  return Math.round(e * 25);
}

function getLossStreak(history: Step[]) {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].result === "loss") streak += 1;
    else if (history[i].result === "win") break;
  }
  return streak;
}

function isRealSettledStrategyRow(row: Step) {
  // STRATEGY LEDGER LOCK
  // A strategy progression may read ONLY real, settled wagers from its own replay.
  // It must ignore PUSH / No Bet / Pulse Hold / shadow diagnostic rows / zero-exposure rows.
  return row.exposure > 0 && row.unitBet > 0 && (row.result === "win" || row.result === "loss") && row.net !== 0;
}

function getResolvedStrategyResults(history: Step[]) {
  // ISOLATED STRATEGY STATE LOCK
  // Every strategy replay builds its progression from only its own real settled wagers.
  // Raw outcomes may be shared, but progression state is never shared across engines,
  // Pulse-enhanced replays, shadow replays, chart history, or comparison rows.
  return history.filter(isRealSettledStrategyRow);
}

function getStrategyResolvedLossStreak(history: Step[]) {
  const ledger = getResolvedStrategyResults(history);
  let streak = 0;
  for (let i = ledger.length - 1; i >= 0; i -= 1) {
    if (ledger[i].result === "loss") streak += 1;
    else break;
  }
  return streak;
}

function getStrategyResolvedWinStreak(history: Step[]) {
  const ledger = getResolvedStrategyResults(history);
  let streak = 0;
  for (let i = ledger.length - 1; i >= 0; i -= 1) {
    if (ledger[i].result === "win") streak += 1;
    else break;
  }
  return streak;
}

function getStrategyOpenLossExposure(history: Step[]) {
  // MARTINGALE OPEN LOSS EXPOSURE
  // Open loss exposure is calculated only since the last real settled strategy win.
  // Push/No Bet/Pulse Hold/shadow rows never advance, reduce, or reset this value.
  const ledger = getResolvedStrategyResults(history);
  let exposure = 0;
  for (let i = ledger.length - 1; i >= 0; i -= 1) {
    const row = ledger[i];
    if (row.result === "win") break;
    if (row.result === "loss") exposure += Math.abs(row.net || row.exposure || row.unitBet || 0);
  }
  return exposure;
}

function getFibonacciProgressionIndex(history: Step[]) {
  // TRUE FIBONACCI PROGRESSION LOCK
  // Sequence: 1, 1, 2, 3, 5, 8, 13, 21.
  // Loss -> advance exactly ONE step forward.
  // Win -> move exactly TWO steps back, never below zero.
  // Push / No Bet / Pulse Hold / shadow diagnostic rows -> HOLD current step.
  const fibMaxIndex = 7;
  let index = 0;

  getResolvedStrategyResults(history).forEach((row) => {
    if (row.result === "loss") index = Math.min(fibMaxIndex, index + 1);
    if (row.result === "win") index = Math.max(0, index - 2);
  });

  return index;
}

function getDAlembertProgressionIndex(history: Step[]) {
  // D'Alembert: +1 unit after each real loss, -1 unit after each real win.
  let index = 0;
  getResolvedStrategyResults(history).forEach((row) => {
    if (row.result === "loss") index += 1;
    if (row.result === "win") index = Math.max(0, index - 1);
  });
  return Math.min(index, 20);
}

function getReverseDAlembertProgressionIndex(history: Step[]) {
  // Reverse D'Alembert: +1 unit after each real win, -1 unit after each real loss.
  let index = 0;
  getResolvedStrategyResults(history).forEach((row) => {
    if (row.result === "win") index += 1;
    if (row.result === "loss") index = Math.max(0, index - 1);
  });
  return Math.min(index, 20);
}

function getOneThreeTwoSixStep(history: Step[]) {
  // TRUE 1-3-2-6 PROGRESSION LOCK
  // Uses its own dedicated state path, separate from ETR recoveryStep.
  // Sequence: 1, 3, 2, 6.
  // Win -> advance to the next step.
  // Loss -> reset to step 0.
  // Completing step 3 (6x) on a win resets to step 0.
  // Push / No Bet / Pulse Hold / shadow diagnostic rows -> HOLD current step.
  let step = 0;

  getResolvedStrategyResults(history).forEach((row) => {
    const rowStep = typeof row.oneThreeTwoSixStep === "number" ? row.oneThreeTwoSixStep : step;

    if (row.result === "loss") {
      step = 0;
    } else if (row.result === "win") {
      step = rowStep >= 3 ? 0 : rowStep + 1;
    }
  });

  return Math.max(0, Math.min(3, step));
}

function getOneThreeTwoSixMultiplier(step: number) {
  const sequence = [1, 3, 2, 6];
  return sequence[Math.max(0, Math.min(sequence.length - 1, step))] ?? 1;
}

function getOneThreeTwoSixIndex(history: Step[]) {
  // Backward-compatible alias. Do not use recoveryStep for 1-3-2-6.
  return getOneThreeTwoSixStep(history);
}

function getLastResolvedStrategyRow(history: Step[]) {
  return getResolvedStrategyResults(history).at(-1) ?? null;
}

function getLastEtrState(history: Step[]): ETRState {
  const last = getLastResolvedStrategyRow(history);
  return (last?.etrStateAfter ?? "off") as ETRState;
}

function getLastEtrRecoveryStep(history: Step[]) {
  const last = getLastResolvedStrategyRow(history);
  return last?.recoveryStep ?? 0;
}

function isInvertedControl(history: Step[]) {
  // Inverted Control is the locked DPI transition zone.
  // This reads the same engine-independent DPI used by the rest of the platform.
  return getDpiValue(history) <= -5;
}

function getEtrRecoveryPlan(strategy: Strategy, baseUnit: number, history: Step[]) {
  // CLEAN ETR / ETR-C REBUILD
  // State path: off -> armed -> recovery -> off.
  // Arm only after a real FLAT loss followed by a real FLAT win while DPI is in
  // Inverted Control. The arming hand stays flat; the NEXT hand is the first
  // recovery wager.
  const applies = strategy === "ETR" || strategy === "ETR-C";
  const prev = getLastResolvedStrategyRow(history);
  const prevState = applies ? getLastEtrState(history) : "off";
  const dpiPressure = Math.abs(getDpiValue(history));

  let etrStateBefore: ETRState = "off";
  let etrBetType: ETRBetType = "flat";
  let recoveryStep = 0;
  let rawUnit = baseUnit;

  if (!applies) {
    return { etrStateBefore, etrBetType, recoveryStep, rawUnit, dpiPressure };
  }

  if (prevState === "armed") {
    etrStateBefore = "recovery";
    etrBetType = "recovery";
    recoveryStep = 1;
    rawUnit = Math.max(1, dpiPressure) * baseUnit;
    if (strategy === "ETR-C") rawUnit = Math.min(rawUnit, MAX_ETR_C_RECOVERY_BET);
    return { etrStateBefore, etrBetType, recoveryStep, rawUnit, dpiPressure };
  }

  if (prevState === "recovery" && prev?.result === "loss") {
    const nextStep = (prev.recoveryStep ?? 0) + 1;

    if (strategy === "ETR") {
      etrStateBefore = "recovery";
      etrBetType = "recovery";
      recoveryStep = nextStep;
      rawUnit = Math.max(baseUnit, (prev.unitBet || baseUnit) * 2);
      return { etrStateBefore, etrBetType, recoveryStep, rawUnit, dpiPressure };
    }

    if (strategy === "ETR-C" && nextStep <= MAX_ETR_C_RECOVERY_STEPS) {
      etrStateBefore = "recovery";
      etrBetType = "recovery";
      recoveryStep = nextStep;
      rawUnit = Math.min((prev.unitBet || baseUnit) + baseUnit, MAX_ETR_C_RECOVERY_BET);
      return { etrStateBefore, etrBetType, recoveryStep, rawUnit, dpiPressure };
    }
  }

  return { etrStateBefore, etrBetType, recoveryStep, rawUnit, dpiPressure };
}

function getEtrStateAfterCurrentHand(strategy: Strategy, historyBefore: Step[], result: Result, etrBetType: ETRBetType, recoveryStep: number) {
  if (strategy !== "ETR" && strategy !== "ETR-C") return "off" as ETRState;

  if (etrBetType === "recovery") {
    return result === "win" ? ("off" as ETRState) : ("recovery" as ETRState);
  }

  const prev = getLastResolvedStrategyRow(historyBefore);
  const shouldArmRecovery =
    result === "win" &&
    isInvertedControl(historyBefore) &&
    prev?.result === "loss" &&
    (prev?.etrBetType ?? "flat") === "flat";

  return shouldArmRecovery ? ("armed" as ETRState) : ("off" as ETRState);
}

function getEtrRecoveryState(history: Step[]) {
  const last = getLastResolvedStrategyRow(history);
  const state = getLastEtrState(history);
  const plan = getEtrRecoveryPlan("ETR", 1, history);
  return {
    state,
    etrBetType: last?.etrBetType ?? "flat",
    recoveryStep: last?.recoveryStep ?? 0,
    dpiPressure: Math.abs(getDpiValue(history)),
    active: state === "armed" || state === "recovery",
    recovered: !!last && last.etrBetType === "recovery" && last.result === "win",
    nextBetType: plan.etrBetType,
  };
}

function getStreakStats(history: Step[]) {
  let currentType: "win" | "loss" | null = null;
  let currentLength = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let largestWinStreak = 0;
  let largestLossStreak = 0;
  let totalWinStreaks = 0;
  let totalLossStreaks = 0;
  let winStreakLengthSum = 0;
  let lossStreakLengthSum = 0;
  let activeStartSpin: number | null = null;
  let lastResolvedSpin: number | null = null;
  const segments: { type: "win" | "loss"; startSpin: number; endSpin: number; length: number }[] = [];

  const closeCurrent = () => {
    if (!currentType || activeStartSpin === null || lastResolvedSpin === null || currentLength <= 0) return;
    segments.push({ type: currentType, startSpin: activeStartSpin, endSpin: lastResolvedSpin, length: currentLength });
    if (currentType === "win") {
      largestWinStreak = Math.max(largestWinStreak, currentLength);
      totalWinStreaks += 1;
      winStreakLengthSum += currentLength;
    } else {
      largestLossStreak = Math.max(largestLossStreak, currentLength);
      totalLossStreaks += 1;
      lossStreakLengthSum += currentLength;
    }
  };

  history.forEach((row) => {
    if (row.result !== "win" && row.result !== "loss") return;
    if (row.result === currentType) {
      currentLength += 1;
      lastResolvedSpin = row.spin;
    } else {
      closeCurrent();
      currentType = row.result;
      currentLength = 1;
      activeStartSpin = row.spin;
      lastResolvedSpin = row.spin;
    }
  });

  closeCurrent();

  if (currentType === "win") currentWinStreak = currentLength;
  if (currentType === "loss") currentLossStreak = currentLength;

  return {
    currentType,
    currentWinStreak,
    currentLossStreak,
    largestWinStreak,
    largestLossStreak,
    avgWinStreak: totalWinStreaks ? winStreakLengthSum / totalWinStreaks : 0,
    avgLossStreak: totalLossStreaks ? lossStreakLengthSum / totalLossStreaks : 0,
    segments,
  };
}

function getLossStreakSeverity(length: number) {
  if (length >= 8) return "Critical";
  if (length >= 5) return "Pressure";
  if (length >= 3) return "Elevated";
  if (length >= 1) return "Normal";
  return "None";
}

function forecast(history: Step[]) {
  // BACCARAT-NATIVE PULSE LOCK
  // Pulse no longer has a standalone forecast engine.
  // This diagnostic stub remains only for legacy panels that expect a `forecast()` shape.
  // It does not use Roulette Color/Range/Parity logic, WDS, TDA, RV, or internal Pulse Markov.
  const latest = history.at(-1)?.forecastGroup ?? null;
  return {
    group: latest as GroupKey | null,
    numbers: latest ? GROUPS[latest] : [] as SpinValue[],
    confidence: latest ? 50 : 0,
    tier: latest ? "Weak Prediction" : "No Prediction",
    reason: latest ? "Pulse diagnostic reads selected-engine forecast only." : "No selected-engine forecast yet.",
    dimensionTDA: {
      min: 0,
      passed: true,
      mode: "DISABLED",
      modeLabel: "DISABLED",
      failed: [] as string[],
      note: "Removed from active Baccarat Pulse.",
    },
    weakDimensionSubstitution: { active: false, note: "Removed from active Baccarat Pulse." },
  };
}

function getPulseTier(confidence: number) {
  return confidence >= 78
    ? "Strong Prediction"
    : confidence >= 65
    ? "Controlled Prediction"
    : confidence >= 50
    ? "Weak Prediction"
    : "Directional Observe";
}

function getPulseReason(confidence: number) {
  if (confidence < 50) return "Directional Observe · best available directional bias.";
  return "Neural-calibrated PULSE forecast.";
}


const PULSE_LOSS_PROTECTION_TRIGGER = 3;
const PULSE_REENTRY_THRESHOLD = 60;
const WDS_ACCURACY_MIN = 0.42;
const WDS_WINDOW = 8;
const WDS_MIN_TRIALS = 4;
const WDS_CONFIDENCE_PENALTY = 6;
const DIS_STAGE1_MISSES = 3;
const DIS_STAGE1_WINDOW = 5;
const DIS_STAGE1_PENALTY = 8;
const DIS_STAGE2_MISSES = 4;
const DIS_STAGE2_WINDOW = 6;
const DIS_STAGE2_PENALTY = 14;
const DIS_STAGE3_MISSES = 5;
const DIS_STAGE3_WINDOW = 8;
const DIS_STAGE3_PENALTY = 20;

function getPulseShadowResult(row: Step): Result {
  // PULSE SHADOW RESULT
  // Even when Pulse blocks real execution as No Bet, the selected engine's
  // forecast must still be scored in shadow through coreResult. Otherwise
  // Pulse receives only PUSH rows and can never recover from a filtered state.
  if (row.coreResult === "win" || row.coreResult === "loss") return row.coreResult;
  return row.result;
}

function isActivePulseRow(row: Step) {
  // Counts both actual Pulse-enhanced executions and Pulse-filtered shadow rows.
  // A row is Pulse governed if diagnostics are present; this avoids requiring
  // a literal "PULSE" prefix in the note when Pulse is attached to BB/Markov.
  return !!row.pulseDiagnostics && !!row.forecastGroup && getPulseShadowResult(row) !== "push";
}

function isProtectionHoldRow(row: Step) {
  return row.result === "push" && row.note.startsWith("Pulse Loss Protection");
}

function getActivePulseLossStreak(history: Step[]) {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const row = history[i];

    if (isProtectionHoldRow(row)) break;

    if (isActivePulseRow(row) && getPulseShadowResult(row) === "loss") {
      streak += 1;
      continue;
    }

    if (isActivePulseRow(row) && getPulseShadowResult(row) === "win") break;

    if (row.result === "push") continue;

    break;
  }
  return streak;
}


function getRecentActivePulseRows(history: Step[], limit: number) {
  const rows: Step[] = [];
  for (let i = history.length - 1; i >= 0 && rows.length < limit; i -= 1) {
    const row = history[i];
    if (isActivePulseRow(row)) rows.push(row);
  }
  return rows.reverse();
}

function getDirectionalInvalidationSpeed(history: Step[]) {
  // BACCARAT-NATIVE DIS
  // Measures how quickly the selected engine's shadow settlement is failing.
  // No Color/Range/Parity axis logic is used here.
  const rows = getRecentActivePulseRows(history, DIS_STAGE3_WINDOW);
  const recent4 = rows.slice(-4);
  const recent6 = rows.slice(-6);
  const recent8 = rows.slice(-8);

  const lossCount4 = recent4.filter((row) => getPulseShadowResult(row) === "loss").length;
  const lossCount6 = recent6.filter((row) => getPulseShadowResult(row) === "loss").length;
  const lossCount8 = recent8.filter((row) => getPulseShadowResult(row) === "loss").length;

  let level = 0;
  let penalty = 0;
  let cap: null | TierLabel = null;
  let label = "Clear";

  if (recent8.length >= 7 && lossCount8 >= 5) {
    level = 3;
    penalty = 18;
    cap = "Weak Prediction";
    label = "Fast Invalidate";
  } else if (recent6.length >= 5 && lossCount6 >= 4) {
    level = 2;
    penalty = 12;
    cap = "Weak Prediction";
    label = "Invalidating";
  } else if (recent4.length >= 4 && lossCount4 >= 3) {
    level = 1;
    penalty = 7;
    cap = "Controlled Prediction";
    label = "Watch";
  }

  return {
    level,
    penalty,
    cap,
    label,
    lossCount4,
    lossCount6,
    lossCount8,
    worstAxis: "Baccarat Side",
    worstAxisRate: recent8.length ? Math.round((lossCount8 / recent8.length) * 100) : 0,
    axisMisses: { side: lossCount8 },
    axisTrials: { side: recent8.length },
  };
}


function getAxisRecentAccuracyFromRows(history: Step[], axis: "color" | "range" | "parity", window = WDS_WINDOW) {
  // WDS is removed from active Baccarat Pulse. Stub retained for legacy diagnostics only.
  return { trials: 0, wins: 0, rate: 0.5, weak: false };
}

function getWeakDimensionSubstitution(history: Step[], originalBits: [0 | 1, 0 | 1, 0 | 1]) {
  const originalGroup = bitsToGroup(originalBits[0], originalBits[1], originalBits[2]);
  return {
    active: false,
    substitutedAxis: null as null | "Color" | "Range" | "Parity",
    originalBits,
    adjustedBits: originalBits,
    originalGroup,
    adjustedGroup: originalGroup,
    penalty: 0,
    axisRates: { color: 50, range: 50, parity: 50 },
    note: "WDS removed from active Baccarat Pulse.",
  };
}


function getAxisDirectionalDiagnostics(history: Step[], window = 12) {
  // AXIS DIRECTIONAL PRESSURE
  // This panel is not forecast accuracy.
  // It is a directional pressure meter:
  // - Black increases Color percentage; Red decreases it.
  // - High increases Range percentage; Low decreases it.
  // - Even increases Parity percentage; Odd decreases it.
  const recentGroups = groupSeries(history).slice(-window);
  const bits = recentGroups.map(groupToBits);

  const axisData = [
    { key: "color" as const, name: "Color", index: 0, favored: "Black", opposed: "Red" },
    { key: "range" as const, name: "Range", index: 1, favored: "High", opposed: "Low" },
    { key: "parity" as const, name: "Parity", index: 2, favored: "Even", opposed: "Odd" },
  ];

  return axisData.map((axis) => {
    let favoredCount = 0;
    let opposedCount = 0;

    bits.forEach((bitRow) => {
      const bit = bitRow[axis.index];
      // groupToBits mapping:
      // Color: Black=0, Red=1
      // Range: High=0, Low=1
      // Parity: Even=0, Odd=1
      if (bit === 0) favoredCount += 1;
      else opposedCount += 1;
    });

    const trials = bits.length;
    const accuracy = trials ? Math.round((favoredCount / trials) * 100) : 0;
    const axisBits = bits.map((b) => b[axis.index]);
    const stability = getAxisStabilityScore(axisBits);
    const persistence = getAxisPersistenceScore(axisBits, 0);
    const stableButWrong = trials >= 4 && stability >= 60 && accuracy < 45;
    const weakDirection = trials >= 4 && accuracy < 45;
    const strongDirection = trials >= 4 && accuracy >= 60;

    return {
      ...axis,
      bits: axisBits,
      stability,
      persistence,
      accuracy,
      correct: favoredCount,
      trials,
      favoredCount,
      opposedCount,
      stableButWrong,
      weakDirection,
      strongDirection,
      status: strongDirection
        ? `${axis.favored} Favored`
        : weakDirection
        ? `${axis.opposed} Pressure`
        : "Neutral",
    };
  });
}

function getLatestProtectionEvent(history: Step[]) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const row = history[i];
    if (isProtectionHoldRow(row)) return "HOLD" as const;
    if (isActivePulseRow(row)) return row.result === "win" ? ("PULSE_WIN" as const) : ("PULSE_LOSS" as const);
  }
  return "NONE" as const;
}

function getProtectionHoldCountSinceLastActivePulseLoss(history: Step[]) {
  let holds = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const row = history[i];

    if (isProtectionHoldRow(row)) {
      holds += 1;
      continue;
    }

    if (isActivePulseRow(row) && row.result === "loss") break;
    if (isActivePulseRow(row) && row.result === "win") break;
    if (row.result !== "push") break;
  }
  return holds;
}

function getLastActivePulseLoss(history: Step[]) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const row = history[i];
    const isActivePulse = row.result !== "push" && row.note.startsWith("PULSE");
    if (isActivePulse && row.result === "loss") return row;
    if (isActivePulse && row.result === "win") return null;
  }
  return null;
}

function getForecastAgreementScore(history: Step[], pulseGroup?: GroupKey | null) {
  // Engine consensus is not used in Baccarat Pulse prediction.
  // This diagnostic returns 100 when a selected forecast exists, otherwise 0.
  return (pulseGroup ?? history.at(-1)?.forecastGroup) ? 100 : 0;
}

function getReEntryScore(history: Step[], rawPulse: any, adjustedConfidence: number) {
  // Consensus/Re-entry governance removed from active Baccarat Pulse.
  return {
    score: 0,
    threshold: 0,
    passed: true,
    checks: {},
    currentEntropy: entropy(groupSeries(history)),
    priorEntropy: entropy(groupSeries(history.slice(0, -1))),
    currentAgreement: 0,
    priorAgreement: 0,
  };
}

function getPulseRecentAccuracy(history: Step[], lookback = 20) {
  // PERFORMANCE OPTIMIZATION:
  // The prior version re-ran forecast(priorHistory) for every past spin.
  // During Auto Mode this became very expensive because forecast itself contains
  // Markov/Bayesian/TDA calculations. We now read the already-recorded forecast
  // stored on each Step, which gives the same session memory view without
  // repeatedly replaying the entire engine.
  const scored: Result[] = history
    .filter((row) => !!row.forecastGroup)
    .map((row) => (GROUPS[row.forecastGroup as GroupKey]?.includes(row.outcome) ? "win" : "loss"));

  const recent = scored.slice(-lookback);
  const wins = recent.filter((r) => r === "win").length;
  return {
    wins,
    losses: recent.length - wins,
    active: recent.length,
    rate: recent.length ? wins / recent.length : 0.5,
  };
}

function getNeuralAssistMetrics(history: Step[]) {
  // BACCARAT-NATIVE LIGHT DIAGNOSTIC ONLY
  // This no longer calls the old Roulette PULSE forecast engine.
  const latestForecast = history.at(-1)?.forecastGroup ?? null;
  const recentRows = history.filter((row) => !!row.forecastGroup).slice(-12);
  const scored = recentRows.map((row) => getPulseShadowResult(row));
  const wins = scored.filter((r) => r === "win").length;
  const losses = scored.filter((r) => r === "loss").length;
  const active = wins + losses;
  const rate = active ? wins / active : 0.5;
  const neuralScore = Math.max(0, Math.min(100, Math.round(rate * 100)));
  const status = active < 4 ? "No Data" : neuralScore >= 62 ? "Agree" : neuralScore >= 48 ? "Caution" : "Conflict";
  const adjustment = status === "Agree" ? 2 : status === "Caution" ? 0 : -6;
  const rawConfidence = latestForecast ? Math.round(48 + rate * 30) : 0;
  const adjustedConfidence = Math.max(0, Math.min(100, rawConfidence + adjustment));
  const adjustedTier = getPulseTier(adjustedConfidence);

  const rawPulse = {
    group: latestForecast,
    numbers: latestForecast ? GROUPS[latestForecast] : [],
    confidence: rawConfidence,
    tier: getPulseTier(rawConfidence),
    reason: "Baccarat-native neural diagnostic only.",
  };

  return {
    rawPulse,
    straight: bbStraightForecast(history),
    inverted: bbInvertedForecast(history),
    entropy: entropy(groupSeries(history)),
    recent: { wins, losses, active, rate },
    aligned: false,
    neuralReady: active >= 4,
    neuralScore,
    status,
    adjustment,
    adjustedConfidence,
    adjustedTier,
    adjustedReason: "Baccarat-native neural diagnostic only.",
  };
}

function getPulseRvMetrics(history: Step[]) {
  const rows = groupSeries(history).map(groupToBits);
  const color = getAxisRotationVelocity(rows.map((b) => b[0]));
  const range = getAxisRotationVelocity(rows.map((b) => b[1]));
  const parity = getAxisRotationVelocity(rows.map((b) => b[2]));
  const composite = Math.round((color + range + parity) / 3);
  const state = getRotationState(composite);
  const confidencePenalty =
    composite >= RV_EXTREME
      ? RV_CONFIDENCE_PENALTY_EXTREME
      : composite >= RV_HIGH
      ? RV_CONFIDENCE_PENALTY_HIGH
      : composite >= RV_MODERATE
      ? RV_CONFIDENCE_PENALTY_MODERATE
      : 0;

  return {
    color,
    range,
    parity,
    composite,
    instabilityScore: composite,
    state,
    confidencePenalty,
    weakSuppressed: composite >= RV_HIGH,
    extremeObserve: composite >= RV_EXTREME,
  };
}


function applyNeuralGovernance(
  tier: TierLabel,
  confidence: number,
  neuralAdjustment: number,
  neuralStatus: string
) {
  let adjustedTier = tier;
  let adjustedConfidence = confidence;
  let governanceHold = false;
  let governanceReason = "Neural Neutral";

  // DOWNGRADE AUTHORITY ONLY
  // Neural can reduce aggression or hold execution,
  // but cannot upgrade confidence/tier.

  if (neuralAdjustment <= NEURAL_HOLD_THRESHOLD || neuralStatus === "Conflict") {
    governanceHold = true;
    adjustedTier = "Directional Observe";
    adjustedConfidence = Math.max(0, confidence - 15);
    governanceReason = "Neural HOLD";
  } else if (neuralAdjustment <= NEURAL_DOWNGRADE_THRESHOLD) {
    if (tier === "Strong Prediction") {
      adjustedTier = "Controlled Prediction";
    } else if (tier === "Controlled Prediction") {
      adjustedTier = "Weak Prediction";
    } else if (tier === "Weak Prediction") {
      adjustedTier = "Directional Observe";
    }

    adjustedConfidence = Math.max(0, confidence - 8);
    governanceReason = "Neural Downgrade";
  }

  return {
    adjustedTier,
    adjustedConfidence,
    governanceHold,
    governanceReason,
  };
}


function capTierAt(tier: string, cap: string) {
  const rank: Record<string, number> = {
    "Directional Observe": 0,
    "Weak Prediction": 1,
    "Controlled Prediction": 2,
    "Strong Prediction": 3,
  };

  const reverse: Record<number, string> = {
    0: "Directional Observe",
    1: "Weak Prediction",
    2: "Controlled Prediction",
    3: "Strong Prediction",
  };

  return reverse[Math.min(rank[tier] ?? 0, rank[cap] ?? 3)] ?? tier;
}

function getRvStructuralGovernance(history: Step[]) {
  const rv = getPulseRvMetrics(history);
  const score = rv.instabilityScore ?? rv.composite ?? 0;

  if (score >= RV_STRUCTURAL_EXTREME) {
    return {
      rv,
      score,
      level: "Extreme",
      penalty: RV_STRUCTURAL_PENALTY_EXTREME,
      cap: "Directional Observe" as TierLabel,
      blockExecution: true,
      note: `RV Extreme ${score}%`,
    };
  }

  if (score >= RV_STRUCTURAL_HIGH) {
    return {
      rv,
      score,
      level: "High",
      penalty: RV_STRUCTURAL_PENALTY_HIGH,
      cap: "Weak Prediction" as TierLabel,
      blockExecution: false,
      note: `RV High ${score}%`,
    };
  }

  if (score >= RV_STRUCTURAL_MODERATE) {
    return {
      rv,
      score,
      level: "Moderate",
      penalty: RV_STRUCTURAL_PENALTY_MODERATE,
      cap: "Controlled Prediction" as TierLabel,
      blockExecution: false,
      note: `RV Moderate ${score}%`,
    };
  }

  return {
    rv,
    score,
    level: "Low",
    penalty: 0,
    cap: null as null | TierLabel,
    blockExecution: false,
    note: `RV Low ${score}%`,
  };
}


function getBaccaratSideBits(history: Step[]) {
  // Baccarat uses one dominant binary stream: Player/Banker side.
  // This avoids Roulette-style multi-axis dependency inside active Pulse protection.
  return history.map((row) => groupToBits(row.outcomeGroup)[0]);
}

function getMarkovReliabilityCollapse(history: Step[], window = 10) {
  const trials: { predicted: 0 | 1; actual: 0 | 1 }[] = [];

  for (let i = Math.max(6, history.length - window); i < history.length; i += 1) {
    const prior = history.slice(0, i);
    const forecastRow = markovForecast(prior);
    if (!forecastRow.group) continue;
    trials.push({
      predicted: groupToBits(forecastRow.group)[0],
      actual: groupToBits(history[i].outcomeGroup)[0],
    });
  }

  const wins = trials.filter((row) => row.predicted === row.actual).length;
  const total = trials.length;
  const rate = total ? wins / total : 0.5;
  const recent = trials.slice(-6);
  const recentWins = recent.filter((row) => row.predicted === row.actual).length;
  const recentRate = recent.length ? recentWins / recent.length : rate;
  const collapsing = total >= 5 && (rate <= 0.42 || recentRate <= 0.34);
  const warning = total >= 4 && !collapsing && (rate <= 0.50 || recentRate <= 0.45);
  const penalty = collapsing ? 14 : warning ? 7 : 0;

  return {
    active: collapsing || warning,
    collapsing,
    warning,
    wins,
    trials: total,
    rate: Math.round(rate * 100),
    recentRate: Math.round(recentRate * 100),
    penalty,
    label: collapsing ? "Markov Collapse" : warning ? "Markov Weakening" : "Markov Stable",
  };
}

function getPredictorDisagreement(history: Step[]) {
  const straight = bbStraightForecast(history);
  const inverted = bbInvertedForecast(history);
  const markov = markovForecast(history);
  const sideVotes = [straight.group, inverted.group, markov.group]
    .filter(Boolean)
    .map((group) => groupToBits(group as GroupKey)[0]);

  if (sideVotes.length < 2) {
    return { active: false, agreement: 100, disagreement: 0, penalty: 0, label: "No Conflict", votes: sideVotes };
  }

  const zeroVotes = sideVotes.filter((bit) => bit === 0).length;
  const oneVotes = sideVotes.length - zeroVotes;
  const majority = Math.max(zeroVotes, oneVotes);
  const agreement = Math.round((majority / sideVotes.length) * 100);
  const disagreement = 100 - agreement;
  const active = disagreement >= 34;
  const penalty = disagreement >= 50 ? 12 : active ? 6 : 0;

  return {
    active,
    agreement,
    disagreement,
    penalty,
    label: active ? "Predictor Conflict" : "Predictor Aligned",
    votes: sideVotes,
  };
}

function getStructuralDriftDetector(history: Step[], targetGroup?: GroupKey | null, window = 8) {
  // REMOVED FROM ACTIVE PULSE
  // Structural Drift Detection was consolidated into the Unified Structural Pressure Engine.
  // This stub remains only so old diagnostics never break the shell. It applies no penalty.
  void history;
  void targetGroup;
  void window;
  return { active: false, severe: false, driftRate: 0, adverseRun: 0, penalty: 0, label: "Removed", misses: 0, trials: 0 };
}

function getLightweightNeuralConflict(history: Step[], pulse: any, disagreement: any, markovCollapse: any) {
  const neuralStatus = pulse?.neuralStatus ?? "No Data";
  const neuralAdjustment = Number(pulse?.neuralDiagnosticAdjustment ?? pulse?.neuralAdjustment ?? 0);
  const conflict = neuralStatus === "Conflict" || disagreement?.active || markovCollapse?.collapsing;
  const penalty = conflict ? Math.max(6, Math.min(12, Math.abs(neuralAdjustment) || 8)) : neuralStatus === "Caution" ? 3 : 0;
  return {
    active: conflict || neuralStatus === "Caution",
    conflict,
    status: conflict ? "Conflict" : neuralStatus,
    penalty,
    label: conflict ? "Neural Conflict" : neuralStatus === "Caution" ? "Neural Caution" : "Neural Clear",
  };
}

function getNeuralCalibratedPulse(history: Step[]) {
  // BACCARAT-NATIVE PULSE — 7-COMPONENT LIGHTWEIGHT REBUILD
  // Active Pulse components:
  // 1) Persistence / Stability Analysis
  // 2) Confidence Modulation
  // 3) Execution Filtering
  // 4) Adaptive Tier Engine
  // 5) Loss Protection
  // 6) Simplified Player/Banker Entropy Governance
  // 7) Consensus / Re-Entry Governance
  // Removed from active Pulse: Unified Structural Pressure Engine, Shadow Recovery,
  // HMM, CPD, Roulette axis systems, TDA, WDS, and RV governance.
  const rows = history.filter((row) => !!row.forecastGroup).slice(-12);
  const scored = rows.map((row) => getPulseShadowResult(row)).filter((r) => r === "win" || r === "loss");
  const wins = scored.filter((r) => r === "win").length;
  const losses = scored.filter((r) => r === "loss").length;
  const active = wins + losses;
  const recentRate = active ? wins / active : 0.5;
  const entropyGov = getPulseSideEntropy(history);
  const stability = getPulsePersistenceStability(history, history.at(-1)?.forecastGroup ?? null);
  const confidence = Math.max(0, Math.min(100, Math.round(58 - entropyGov.penalty - stability.penalty)));
  const tier = getPulseTier(confidence);

  return {
    group: null as GroupKey | null,
    numbers: [] as SpinValue[],
    confidence,
    tier,
    reason: "Pulse 7-component lightweight layer. Unified Structural Pressure removed.",
    rawConfidence: confidence,
    baccaratNativePulse: true,
    activePulseComponents: {
      persistenceStabilityAnalysis: true,
      confidenceModulation: true,
      executionFiltering: true,
      adaptiveTierEngine: true,
      lossProtection: true,
      simplifiedEntropyGovernance: true,
      consensusReEntryGovernance: true,
      unifiedStructuralPressure: false,
      shadowRecovery: false,
      hmm: false,
      changePointDetection: false,
      engineSpecificRouting: true,
      pulseReplayIntegration: true,
      clickableStreakAnalysis: false,
      streakAnalysisLayer: "Detached Analytics/Research",
    },
    persistenceStability: stability,
    entropyGovernance: entropyGov,
    recentEngineWins: wins,
    recentEngineLosses: losses,
    recentEngineAccuracy: Math.round(recentRate * 100),
    neuralScore: Math.round(recentRate * 100),
    neuralAdjustment: 0,
    neuralStatus: active < 4 ? "No Data" : recentRate >= 0.58 ? "Agree" : recentRate >= 0.45 ? "Caution" : "Conflict",
    entropyValue: entropyGov.entropy,
    entropyPenalty: entropyGov.penalty,
    entropyDiagnosticsOnly: false,
    weakDimensionSubstitution: { active: false, note: "Removed from active Baccarat Pulse." },
    rvStructuralGovernance: { level: "Removed", score: 0, penalty: 0, blockExecution: false },
    rvPenalty: 0,
    rvStructuralBlock: false,
  };
}

// =====================================================
// LOCKED BB BOOLEAN LOGIC
// BB Straight follows the confirmed Boolean table:
// Base side wins. First opposite = loss. Second same opposite = loss.
// Third and beyond same opposite = win because the forecast switches
// after two consecutive opposite outcomes. First base after a run is
// a reset loss until the second same base confirms the reset.
// BB Inverted is the mirrored Boolean structure and is eligible only
// when DPI is at/below -5. DPI calculation itself is unchanged.
// =====================================================

function groupToBits(group: GroupKey): [0 | 1, 0 | 1, 0 | 1] {
  return [
    group[0] === "B" ? 0 : 1,
    group[1] === "H" ? 0 : 1,
    group[2] === "E" ? 0 : 1,
  ];
}

function bitsToGroup(color: 0 | 1, range: 0 | 1, parity: 0 | 1): GroupKey {
  const c = color === 0 ? "B" : "R";
  const r = range === 0 ? "H" : "L";
  const p = parity === 0 ? "E" : "O";
  return `${c}${r}${p}` as GroupKey;
}


function getAxisStabilityScore(values: (0 | 1)[]) {
  const recent = values.slice(-10);
  if (recent.length < 4) return 50;

  let flips = 0;
  let longestRun = 1;
  let currentRun = 1;
  for (let i = 1; i < recent.length; i += 1) {
    if (recent[i] !== recent[i - 1]) {
      flips += 1;
      currentRun = 1;
    } else {
      currentRun += 1;
      longestRun = Math.max(longestRun, currentRun);
    }
  }

  const flipRate = flips / Math.max(1, recent.length - 1);
  const runSupport = Math.min(1, longestRun / 5);
  const lastRun = getCurrentBitRun(recent).length;
  const lastRunSupport = Math.min(1, lastRun / 4);

  // Higher means the axis is not only confident, but durable.
  // Heavy flipping means dimensional migration risk is elevated.
  return Math.max(0, Math.min(100, Math.round(82 - flipRate * 58 + runSupport * 12 + lastRunSupport * 8)));
}


function getAxisPersistenceScore(values: (0 | 1)[], predictedBit: 0 | 1) {
  const recent = values.slice(-12);
  if (recent.length < 5) return 50;

  const lastRun = getCurrentBitRun(recent);
  const predictedRunSupport = lastRun.bit === predictedBit ? Math.min(1, lastRun.length / 4) : 0;

  const shortWindow = recent.slice(-5);
  const midWindow = recent.slice(-9);
  const shortSupport = shortWindow.filter((bit) => bit === predictedBit).length / Math.max(1, shortWindow.length);
  const midSupport = midWindow.filter((bit) => bit === predictedBit).length / Math.max(1, midWindow.length);

  let flips = 0;
  for (let i = 1; i < recent.length; i += 1) {
    if (recent[i] !== recent[i - 1]) flips += 1;
  }
  const flipPressure = flips / Math.max(1, recent.length - 1);

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        34 +
          shortSupport * 24 +
          midSupport * 18 +
          predictedRunSupport * 20 -
          flipPressure * 18
      )
    )
  );
}


type AxisKey = "color" | "range" | "parity";
type AdaptiveTDAMode = "FULL_3D" | "COMPRESSED_2D" | "OBSERVE";

function axisIndex(axis: AxisKey) {
  return axis === "color" ? 0 : axis === "range" ? 1 : 2;
}

function getAdaptiveDimensionNumbers(group: GroupKey, activeAxes: AxisKey[]) {
  const targetBits = groupToBits(group);
  if (activeAxes.length >= 3) return GROUPS[group];
  if (activeAxes.length < 2) return [] as SpinValue[];

  return ALL_NUMBERS.filter((value) => {
    const bits = groupToBits(numberToGroup(value));
    return activeAxes.every((axis) => bits[axisIndex(axis)] === targetBits[axisIndex(axis)]);
  });
}

function getTdaModeLabel(mode?: AdaptiveTDAMode) {
  if (mode === "FULL_3D") return "3D PASS";
  if (mode === "COMPRESSED_2D") return "2D COMP";
  return "HOLD";
}

function getCoreExecutionNumbers(group: GroupKey | null, source?: string, decision?: any, executionMode?: ExecutionMode) {
  if (!group) return [] as SpinValue[];
  // 2D adaptive compression is allowed only in Hybrid Coverage.
  // Stream Direct and Baccarat Side Execution must stay tied to the exact 3D group basket.
  if (
    source === "PULSE" &&
    executionMode === "Hybrid Coverage" &&
    Array.isArray(decision?.dimensionTDA?.adaptiveNumbers) &&
    decision.dimensionTDA.adaptiveNumbers.length
  ) {
    return decision.dimensionTDA.adaptiveNumbers as SpinValue[];
  }
  return GROUPS[group];
}

function getCurrentBitRun(bits: (0 | 1)[]) {
  if (!bits.length) return { bit: 0 as 0 | 1, length: 0 };
  const bit = bits[bits.length - 1];
  let length = 1;
  for (let i = bits.length - 2; i >= 0; i -= 1) {
    if (bits[i] === bit) length += 1;
    else break;
  }
  return { bit, length };
}


function getAxisRotationVelocity(bits: (0 | 1)[]) {
  const recent = bits.slice(-8);
  if (recent.length < 4) return 0;
  let flips = 0;
  for (let i = 1; i < recent.length; i += 1) {
    if (recent[i] !== recent[i - 1]) flips += 1;
  }
  return Math.min(100, Math.round((flips / Math.max(1, recent.length - 1)) * 100));
}

function getRotationState(value: number) {
  if (value >= 75) return "Extreme";
  if (value >= 58) return "High";
  if (value >= 38) return "Moderate";
  return "Low";
}

function getStraightNextBit(bits: (0 | 1)[]): 0 | 1 {
  // LOCKED BB STRAIGHT BOOLEAN TABLE
  // 0 = win
  // 0 0 = win
  // 1 = loss
  // 1 1 = loss
  // 1 1 1+ = win
  // 1 1 1 0 = reset loss
  // 1 1 1 0 0 = win
  // Therefore the NEXT forecast is:
  // - always 0 while the current run is 0, including immediately after reset
  // - 0 for the first two 1s
  // - 1 after two consecutive 1s, so the third 1 is a win
  if (!bits.length) return 0;
  const { bit, length } = getCurrentBitRun(bits);
  if (bit === 0) return 0;
  return length >= 2 ? 1 : 0;
}

function getInvertedNextBit(bits: (0 | 1)[]): 0 | 1 {
  // LOCKED BB INVERTED BOOLEAN TABLE
  // Mirrored Straight table, only eligible when DPI <= -5.
  // 1 = win
  // 1 1 = win
  // 0 = loss
  // 0 0 = loss
  // 0 0 0+ = win
  // 0 0 0 1 = reset loss
  // 0 0 0 1 1 = win
  if (!bits.length) return 1;
  const { bit, length } = getCurrentBitRun(bits);
  if (bit === 1) return 1;
  return length >= 2 ? 0 : 1;
}

function getBooleanConfirmedGroup(groups: GroupKey[]) {
  if (!groups.length) return null as GroupKey | null;

  const bitRows = groups.map(groupToBits);
  const colorBits = bitRows.map((b) => b[0]);
  const rangeBits = bitRows.map((b) => b[1]);
  const parityBits = bitRows.map((b) => b[2]);

  return bitsToGroup(
    getStraightNextBit(colorBits),
    getStraightNextBit(rangeBits),
    getStraightNextBit(parityBits)
  );
}

function getBooleanInvertedGroup(groups: GroupKey[]) {
  if (!groups.length) return null as GroupKey | null;

  const bitRows = groups.map(groupToBits);
  const colorBits = bitRows.map((b) => b[0]);
  const rangeBits = bitRows.map((b) => b[1]);
  const parityBits = bitRows.map((b) => b[2]);

  return bitsToGroup(
    getInvertedNextBit(colorBits),
    getInvertedNextBit(rangeBits),
    getInvertedNextBit(parityBits)
  );
}

function getDpiValue(history: Step[]) {
  // ============================================================
  // LOCKED GLOBAL DPI RULE — DO NOT CHANGE
  // ============================================================
  // DPI is applied to the OUTCOME side only.
  // It is NOT based on:
  // - Forecast side
  // - Forecast correctness
  // - Engine win/loss
  // - Bankroll settlement
  // - Pulse / BB Straight / BB Inverted / Markov mode
  //
  // Binary mapping:
  // 0 = Player
  // 1 = Banker
  //
  // Confirmed locked examples:
  // Outcomes: 0 0 1 1 1 1 0 0
  // DPI:      0 0 -1 -2 -1 0 -1 0
  //
  // Outcomes: 0 0 1 0 1 1 0
  // DPI:      0 0 -1 0 -1 -2 -3
  //
  // Mechanical rule:
  // Each new OUTCOME bit is compared against the locked BB Straight
  // pressure-cycle reference created from prior OUTCOMES only.
  // If the outcome matches the pressure-cycle reference, DPI moves +1 toward 0.
  // If it does not match, DPI moves -1 deeper.
  // DPI is capped at 0 and never goes positive.
  let dpi = 0;
  const priorOutcomeBits: (0 | 1)[] = [];

  history.forEach((row) => {
    const outcomeBit = groupToBits(row.outcomeGroup)[0]; // Player=0, Banker=1
    const pressureCycleReference = getStraightNextBit(priorOutcomeBits);
    const pressureResolved = outcomeBit === pressureCycleReference;

    dpi = capDpi(dpi + (pressureResolved ? 1 : -1));
    priorOutcomeBits.push(outcomeBit);
  });

  return dpi;
}

function getDpiValueAfterOutcome(history: Step[], outcomeGroup: GroupKey) {
  // LOCKED POST-HAND DPI RECONSTRUCTION
  // Includes the current raw outcome and ignores forecast/result/push/observe/no-bet/engine/bankroll.
  return getDpiValue([...history, { outcomeGroup } as Step]);
}


function capDpi(value: number) {
  return Math.min(0, value);
}

function settleStraightBbAxis(priorBits: (0 | 1)[], actualBit: 0 | 1): Result {
  // LOCKED FIRST-SPIN BASE RULE
  // Empty prior history still has a base forecast.
  // Straight BB base = 0 for every axis: Black / High / Even.
  // Therefore first spin Red/Low/Odd settles as three losses, not three pushes.
  return getStraightNextBit(priorBits) === actualBit ? "win" : "loss";
}

function settleInvertedBbAxis(priorBits: (0 | 1)[], actualBit: 0 | 1): Result {
  // Inverted BB base = 1 for every axis when used for forecast/execution.
  // DPI counting remains Straight-only elsewhere.
  return getInvertedNextBit(priorBits) === actualBit ? "win" : "loss";
}

function updateDpiFromResult(value: number, result: Result) {
  // LEGACY HELPER ONLY.
  // Do NOT use this for AutoRun DPI or popup DPI.
  // AutoRun DPI must use raw outcome-pressure via getAutoRunLockedDpiAfterOutcome().
  if (result === "win") return capDpi(value + 1);
  if (result === "loss") return capDpi(value - 1);
  return value;
}

function getAxisBbDpiValues(history: Step[], bbInvertedEnabled = false) {
  // ============================================================
  // LOCKED GLOBAL AXIS DPI RULE — DO NOT CHANGE
  // ============================================================
  // Axis DPI mirrors the same outcome-pressure rule used by getDpiValue().
  // It is not affected by selected engine, forecast correctness, or settlement.
  void bbInvertedEnabled;

  let color = 0;
  let range = 0;
  let parity = 0;

  const colorBits: (0 | 1)[] = [];
  const rangeBits: (0 | 1)[] = [];
  const parityBits: (0 | 1)[] = [];

  history.forEach((row) => {
    const [colorBit, rangeBit, parityBit] = groupToBits(row.outcomeGroup);

    color = capDpi(color + (colorBit === getStraightNextBit(colorBits) ? 1 : -1));
    range = capDpi(range + (rangeBit === getStraightNextBit(rangeBits) ? 1 : -1));
    parity = capDpi(parity + (parityBit === getStraightNextBit(parityBits) ? 1 : -1));

    colorBits.push(colorBit);
    rangeBits.push(rangeBit);
    parityBits.push(parityBit);
  });

  return { color, range, parity };
}


function getAxisBitStreams(history: Step[]) {
  const bitRows = groupSeries(history).map(groupToBits);
  return {
    colorBits: bitRows.map((b) => b[0]),
    rangeBits: bitRows.map((b) => b[1]),
    parityBits: bitRows.map((b) => b[2]),
  };
}

function getLockedAxisForecastBit(bits: (0 | 1)[], axisDpi: number, invertedModeOn: boolean) {
  // FINAL LOCKED BB ASSEMBLY RULE
  // Each axis decides independently:
  // - if Inverted mode is ON AND that axis DPI <= -5, use the Inverted BB table for that axis only.
  // - otherwise use the Straight BB table for that axis.
  // No global inversion, no combined override, no ADA/TDA/Entropy/WDS/Markov influence.
  return invertedModeOn && axisDpi <= -5 ? getInvertedNextBit(bits) : getStraightNextBit(bits);
}

function getLockedBbAxisGroup(history: Step[], invertedModeOn: boolean) {
  const axisDpi = getAxisBbDpiValues(history, false);
  const { colorBits, rangeBits, parityBits } = getAxisBitStreams(history);

  const colorBit = getLockedAxisForecastBit(colorBits, axisDpi.color, invertedModeOn);
  const rangeBit = getLockedAxisForecastBit(rangeBits, axisDpi.range, invertedModeOn);
  const parityBit = getLockedAxisForecastBit(parityBits, axisDpi.parity, invertedModeOn);

  return {
    group: bitsToGroup(colorBit, rangeBit, parityBit),
    axisDpi,
    axisModes: {
      color: invertedModeOn && axisDpi.color <= -5 ? "Inverted" : "Straight",
      range: invertedModeOn && axisDpi.range <= -5 ? "Inverted" : "Straight",
      parity: invertedModeOn && axisDpi.parity <= -5 ? "Inverted" : "Straight",
    },
  };
}

function getAxisLabel(axis: "color" | "range" | "parity", bit: 0 | 1) {
  if (axis === "color") return bit === 0 ? "Black" : "Red";
  if (axis === "range") return bit === 0 ? "High" : "Low";
  return bit === 0 ? "Even" : "Odd";
}

function getDimensionDpis(history: Step[], activeGroup: GroupKey | null, bbInvertedEnabled = false) {
  const axisDpi = getAxisBbDpiValues(history, bbInvertedEnabled);
  const activeBits = activeGroup ? groupToBits(activeGroup) : null;

  return {
    color: { label: activeBits ? getAxisLabel("color", activeBits[0]) : "Black Base", value: axisDpi.color },
    range: { label: activeBits ? getAxisLabel("range", activeBits[1]) : "High Base", value: axisDpi.range },
    parity: { label: activeBits ? getAxisLabel("parity", activeBits[2]) : "Even Base", value: axisDpi.parity },
  };
}


// =====================================================
// 256-GATE STRAIGHT LOGIC — ported from the roulette (EdgeLab) project's
// Straight engine per request (July 26). Replaces this file's previous
// simple run-length-table Straight with a per-axis search over all 256
// possible 3-input Boolean truth tables, each scored against a rolling
// window of recent history; the best-fitting gate per axis is used as that
// axis's prediction. Ported as a self-contained block — nothing here was
// changed from the roulette source except two things, both to preserve
// compatibility with THIS file's existing tier/execution conventions:
//   1. The forecast's `tier` stays "BB Straight" (this file's real,
//      load-bearing tier string used by shouldExecuteTier and elsewhere)
//      instead of the roulette file's "Active · Confirmed".
//   2. The "no gate confident on any axis" case uses this file's existing
//      "No Prediction" tier instead of the roulette file's "Hold · No Bet",
//      which isn't a valid TierLabel here.
// NOTE: a few internal diagnostic/summary strings still say "B/H/E" /
// "R/L/O" (roulette's Black/High/Even vs Red/Low/Odd labels) — these are
// cosmetic display text only, not functional, but worth revisiting in your
// Baccarat-focused follow-up chat if Color/Range/Parity mean something
// different in this file's own model.
// =====================================================

type PulseDivergenceState = "OFF_PATTERN" | "DIVERGING" | "ON_PATTERN";
type DimensionPerformanceState = "WARMING" | "HOLD" | "EXECUTE";

type PulseAxisDivergence = {
  andPrediction: 0 | 1;
  overrideBit: 0 | 1;
  overrideActive: boolean;
  overrideReason: string;
  axisDpi: number;
  axisConfidence: number;
  spread: number;
  spreadActive: boolean;
  performanceState: DimensionPerformanceState;
  adjustedConfidence: number;
  isHold: boolean;
  isWarming: boolean;
  state: PulseDivergenceState;
  conformanceScore: number;
  conformanceWindow: number;
  mismatchStreak: number;
  rollingAccuracy: number;
  rollingWindow: number;
  consecutiveBelowThreshold: number;
  performanceFlipActive: boolean;
  selectedGate: string;
  gateFitScore: number;
  summary: string;
};

type PulseDivergenceResult = {
  color: PulseAxisDivergence;
  range: PulseAxisDivergence;
  parity: PulseAxisDivergence;
  colorBit: 0 | 1;
  rangeBit: 0 | 1;
  parityBit: 0 | 1;
  group: GroupKey;
  overrideCount: number;
  holdCount: number;
  isWarming: boolean;
  label: string;
};

// ── Pulse Divergence Detector Constants ──────────────────────────────────────
const MIN_HISTORY_HANDS          = 13;
const SPREAD_THRESHOLD           = 40;
const AXIS_DPI_CAP               = 0;
const BASE_AXIS_CONFIDENCE       = 65;
const AXIS_CONF_WINDOW           = 12;
const LOSS_PROTECT_TRIGGER       = 4;
const LOSS_PROTECT_SEVERE        = 6;
// ─────────────────────────────────────────────────────────────────────────────

function scoreDimensionConformance(bits: (0 | 1)[], window = 10): { conformanceScore: number; mismatchStreak: number; windowUsed: number } {
  if (bits.length < 2) return { conformanceScore: 1, mismatchStreak: 0, windowUsed: 0 };
  const checkBits = bits.slice(-window - 1);
  const results: boolean[] = [];
  for (let i = 1; i < checkBits.length; i++) {
    results.push(getStraightNextBit(checkBits.slice(0, i) as (0|1)[]) === checkBits[i]);
  }
  if (!results.length) return { conformanceScore: 1, mismatchStreak: 0, windowUsed: 0 };
  const conformanceScore = results.filter(Boolean).length / results.length;
  let mismatchStreak = 0;
  for (let i = results.length - 1; i >= 0; i--) { if (!results[i]) mismatchStreak++; else break; }
  return { conformanceScore, mismatchStreak, windowUsed: results.length };
}

function getDivergenceState(conformanceScore: number, mismatchStreak: number): PulseDivergenceState {
  if (mismatchStreak >= 3) return "OFF_PATTERN";
  if (mismatchStreak === 2) return "DIVERGING";
  if (conformanceScore >= 0.70) return "ON_PATTERN";
  if (conformanceScore < 0.50) return "DIVERGING";
  return "ON_PATTERN";
}

// ── 3-Input Boolean Gate System ───────────────────────────────────────────────
// Each axis uses a 3-input Boolean truth table instead of a simple rule.
// Inputs: A = outcome[n-3], B = outcome[n-2], C = outcome[n-1]
// The truth table is a number 0-255 encoding all 8 possible (A,B,C) → output mappings.
// Bit index = A*4 + B*2 + C*1, value = (truthTable >> index) & 1.
// All 256 tables are scored against recent history; the best-fitting one is selected.
const GATE_3_NAMES: Record<number, string> = {
  0:   "FALSE",   // always 0
  255: "TRUE",    // always 1
  128: "AND3",    // 1 only when A=1,B=1,C=1
  254: "OR3",     // 0 only when A=0,B=0,C=0
  127: "NOR3",    // inverse of OR3
  1:   "NAND3",   // inverse of AND3
  150: "XOR3",    // odd parity
  105: "XNOR3",   // even parity
  136: "AND-A-B", // AND of A and B (ignore C)
  160: "A-ONLY",  // lag-3 predictor
  170: "B-ONLY",  // lag-2 predictor
  204: "C-ONLY",  // lag-1 predictor
  232: "MAJ3",    // majority vote: output 1 if 2+ inputs are 1
};
const GATE_3_NAMES_REVERSE: Map<string, number> = new Map(Object.entries(GATE_3_NAMES).map(([id, name]) => [name, parseInt(id, 10)]));

function apply3InputGate(truthTable: number, a: 0|1, b: 0|1, c: 0|1): 0|1 {
  const idx = a*4 + b*2 + c;
  return ((truthTable >> idx) & 1) as 0|1;
}

function getGate3Name(id: number): string {
  return GATE_3_NAMES[id] ?? `G${id}`;
}

function describeGateBehavior(selectedGateLabel: string): { label: string; id: number | null } {
  if (GATE_3_NAMES_REVERSE.has(selectedGateLabel)) {
    return { label: selectedGateLabel, id: GATE_3_NAMES_REVERSE.get(selectedGateLabel)! };
  }
  const match = /^G(\d+)$/.exec(selectedGateLabel);
  if (!match) return { label: selectedGateLabel, id: null };
  const id = parseInt(match[1], 10);

  let matchA = 0, matchB = 0, matchC = 0;
  for (let a = 0; a <= 1; a++) for (let b = 0; b <= 1; b++) for (let c = 0; c <= 1; c++) {
    const out = apply3InputGate(id, a as 0|1, b as 0|1, c as 0|1);
    if (out === a) matchA++;
    if (out === b) matchB++;
    if (out === c) matchC++;
  }

  const candidates = [
    { label: "Follows Most Recent Hand", strength: matchC },
    { label: "Contrarian to Most Recent Hand", strength: 8 - matchC },
    { label: "Follows Hand 2 Back", strength: matchB },
    { label: "Contrarian to Hand 2 Back", strength: 8 - matchB },
    { label: "Follows Hand 3 Back", strength: matchA },
    { label: "Contrarian to Hand 3 Back", strength: 8 - matchA },
  ];
  candidates.sort((x, y) => y.strength - x.strength);
  const top = candidates[0];

  const label = top.strength >= 7 ? top.label
    : top.strength === 6 ? `Leans: ${top.label}`
    : "Mixed Pattern";

  return { label, id };
}

// Score all 256 3-input truth tables against the last `window+3` outcomes.
function score3InputGates(bits: (0|1)[], window = 12): { id: number; score: number; name: string }[] {
  if (bits.length < 4) {
    return Array.from({length: 256}, (_,i) => ({ id: i, score: 0.5, name: getGate3Name(i) }));
  }
  const check = bits.slice(-(window + 3));
  const scores: { id: number; score: number; name: string }[] = [];
  for (let gateId = 0; gateId < 256; gateId++) {
    let correct = 0; let total = 0;
    for (let i = 3; i < check.length; i++) {
      const pred = apply3InputGate(gateId, check[i-3], check[i-2], check[i-1]);
      if (pred === check[i]) correct++;
      total++;
    }
    scores.push({ id: gateId, score: total ? correct/total : 0.5, name: getGate3Name(gateId) });
  }
  scores.sort((a,b) => b.score - a.score);
  return scores;
}

const GATE_3_HOLD_THRESHOLD  = 0.55;
const GATE_3_EVAL_WINDOW     = 12;

const _gateCache = new Map<string, { id: number; score: number; name: string; prediction: 0|1|null; isHold: boolean; topScores: {id:number;score:number;name:string}[] }>();

function selectBest3InputGate(bits: (0|1)[]): {
  gateId: number; gateName: string; fitScore: number;
  prediction: 0|1|null; isHold: boolean;
  topScores: {id:number;score:number;name:string}[];
} {
  const cacheKey = bits.length + ":" + bits.slice(-15).join("");
  const cached = _gateCache.get(cacheKey);
  if (cached) return { gateId: cached.id, gateName: cached.name, fitScore: cached.score, prediction: cached.prediction, isHold: cached.isHold, topScores: cached.topScores };

  const ranked = score3InputGates(bits, GATE_3_EVAL_WINDOW);
  const best = ranked[0];
  const isHold = best.score <= GATE_3_HOLD_THRESHOLD;
  const prediction = (!isHold && bits.length >= 3)
    ? apply3InputGate(best.id, bits[bits.length-3], bits[bits.length-2], bits[bits.length-1])
    : null;

  const result = { id: best.id, score: best.score, name: best.name, prediction, isHold, topScores: ranked.slice(0,6) };
  if (_gateCache.size > 50) _gateCache.delete(_gateCache.keys().next().value);
  _gateCache.set(cacheKey, result);

  return { gateId: best.id, gateName: best.name, fitScore: best.score, prediction, isHold, topScores: ranked.slice(0,6) };
}

function computeAxisDpi(bits: (0|1)[], gateId: number): number {
  if (bits.length < 4) return 0;
  let dpi = 0;
  for (let i = 3; i < bits.length; i++) {
    const pred = apply3InputGate(gateId, bits[i-3], bits[i-2], bits[i-1]);
    dpi = Math.min(AXIS_DPI_CAP, dpi + (bits[i]===pred ? 1 : -1));
  }
  return dpi;
}

function computeAxisConfidence(bits: (0|1)[], gateId: number, window=AXIS_CONF_WINDOW): number {
  if (bits.length < 4) return BASE_AXIS_CONFIDENCE;
  const check = bits.slice(-(window+3));
  const results: boolean[] = [];
  for (let i=3; i<check.length; i++) {
    const pred = apply3InputGate(gateId, check[i-3], check[i-2], check[i-1]);
    results.push(pred === check[i]);
  }
  if (!results.length) return BASE_AXIS_CONFIDENCE;
  const raw = results.filter(Boolean).length / results.length;
  return Math.max(0, Math.min(100, Math.round(BASE_AXIS_CONFIDENCE + (raw - 0.65) * 100)));
}

// ── Main per-axis analyser ──────────────────────────────────────────────────
function analyseAxis(
  bits: (0|1)[],
  axisName: string,
  gatePredOtherA: 0|1,
  gatePredOtherB: 0|1,
): PulseAxisDivergence {
  const andPrediction: 0|1 = getStraightNextBit(bits) as 0|1;
  const isWarming = false;

  const { conformanceScore, mismatchStreak, windowUsed } = scoreDimensionConformance(bits, 10);
  const state = getDivergenceState(conformanceScore, mismatchStreak);

  const makeResult = (
    overrideBit: 0|1,
    overrideReason: string,
    perfState: DimensionPerformanceState,
    isHold: boolean,
    gateId: number,
    gateName: string,
    fitScore: number,
    summary: string,
  ): PulseAxisDivergence => ({
    andPrediction, overrideBit,
    overrideActive: overrideBit !== andPrediction && !isHold,
    overrideReason,
    axisDpi: 0, axisConfidence: Math.round(fitScore * 100), spread: 0, spreadActive: !isHold,
    performanceState: perfState, adjustedConfidence: Math.round(fitScore * 100),
    isHold, isWarming,
    state, conformanceScore, conformanceWindow: windowUsed, mismatchStreak,
    rollingAccuracy: fitScore, rollingWindow: GATE_3_EVAL_WINDOW,
    consecutiveBelowThreshold: 0, performanceFlipActive: overrideBit !== andPrediction && !isHold,
    selectedGate: gateName, gateFitScore: fitScore,
    summary,
  });

  const gateResult = selectBest3InputGate(bits);

  if (bits.length < 4) {
    return makeResult(
      andPrediction, "INSUFFICIENT_DATA_FALLBACK", "EXECUTE", false,
      gateResult.gateId, "AND3-fallback", 0.5,
      `${axisName} using fallback (${bits.length}/4 bits — not enough yet to test any gate) → ${andPrediction===0?"B/H/E":"R/L/O"}`,
    );
  }

  if (gateResult.isHold || gateResult.prediction === null) {
    return makeResult(
      andPrediction, "GATE_HOLD", "HOLD", true,
      gateResult.gateId, gateResult.gateName, gateResult.fitScore,
      `${axisName} HOLD — no gate beats ${Math.round(GATE_3_HOLD_THRESHOLD*100)}% (best: ${gateResult.gateName} ${Math.round(gateResult.fitScore*100)}%)`,
    );
  }

  const gatePrediction = gateResult.prediction;
  const gateLabel = `${gateResult.gateName}(#${gateResult.gateId}) ${Math.round(gateResult.fitScore*100)}%`;

  return makeResult(
    gatePrediction,
    gatePrediction !== andPrediction ? `GATE_${gateResult.gateName}` : "NONE",
    "EXECUTE", false,
    gateResult.gateId, gateResult.gateName, gateResult.fitScore,
    `${axisName} EXECUTE · ${gateLabel} → ${gatePrediction===0?"B/H/E":"R/L/O"}`,
  );
}

// ── Main entry point ─────────────────────────────────────────────────────────
function getPulseBBStraightDivergence(history: Step[]): PulseDivergenceResult {
  const {colorBits, rangeBits, parityBits} = getAxisBitStreams(history);

  const gC = selectBest3InputGate(colorBits);
  const gR = selectBest3InputGate(rangeBits);
  const gP = selectBest3InputGate(parityBits);
  const predC = gC.isHold || gC.prediction===null ? getStraightNextBit(colorBits)  as 0|1 : gC.prediction;
  const predR = gR.isHold || gR.prediction===null ? getStraightNextBit(rangeBits)  as 0|1 : gR.prediction;
  const predP = gP.isHold || gP.prediction===null ? getStraightNextBit(parityBits) as 0|1 : gP.prediction;

  const color  = analyseAxis(colorBits,  "Color",  predR, predP);
  const range  = analyseAxis(rangeBits,  "Range",  predC, predP);
  const parity = analyseAxis(parityBits, "Parity", predC, predR);

  const colorBit  = color.overrideBit;
  const rangeBit  = range.overrideBit;
  const parityBit = parity.overrideBit;
  const group     = bitsToGroup(colorBit, rangeBit, parityBit);

  const holdCount     = [color,range,parity].filter(a=>a.isHold).length;
  const execCount     = [color,range,parity].filter(a=>a.performanceState==="EXECUTE").length;
  const overrideCount = [color,range,parity].filter(a=>a.overrideActive).length;

  const label = holdCount===3
    ? "All Dimensions HOLD"
    : holdCount>0
    ? `${holdCount}/3 HOLD · ${execCount} EXECUTE`
    : `Straight · All EXECUTE`;

  return { color,range,parity,colorBit,rangeBit,parityBit,group,overrideCount,holdCount,isWarming:false,label };
}
// ─── END 256-GATE STRAIGHT LOGIC ──────────────────────────────────────────────


function bbStraightForecast(history: Step[]) {
  const divergence = getPulseBBStraightDivergence(history);

  if (divergence.holdCount === 3) {
    return { group: null as GroupKey | null, numbers: [] as SpinValue[], confidence: 0, tier: "No Prediction", reason: divergence.label };
  }

  const group = divergence.group;
  return {
    group,
    numbers: group ? GROUPS[group] : [],
    confidence: 65,
    tier: "BB Straight",
    reason: `3-input gate · ${divergence.label}`,
    pulseDivergence: divergence,
  };
}

function invertGroup(group: GroupKey): GroupKey {
  const map: Record<GroupKey, GroupKey> = {
    BHE: "RHE",
    BHO: "RHO",
    BLE: "RLE",
    BLO: "RLO",
    RHE: "BHE",
    RHO: "BHO",
    RLE: "BLE",
    RLO: "BLO",
  };
  return map[group];
}

function bbInvertedForecast(history: Step[]) {
  if (!history.length) {
    return { group: "BHE" as GroupKey, numbers: GROUPS.BHE, confidence: 0, tier: "BB Inverted", reason: "Locked BB Inverted initial base recommendation." };
  }

  const locked = getLockedBbAxisGroup(history, true);
  const group = locked.group;

  return {
    group,
    numbers: group ? GROUPS[group] : [],
    confidence: 0,
    tier: "BB Inverted",
    axisDpi: locked.axisDpi,
    axisModes: locked.axisModes,
    reason: `Locked BB Inverted axis assembly · Color ${locked.axisModes.color} (${locked.axisDpi.color}) · Range ${locked.axisModes.range} (${locked.axisDpi.range}) · Parity ${locked.axisModes.parity} (${locked.axisDpi.parity}).`
  };
}

// =====================================================
// CADENCE — the platform's original Straight logic, kept as its own engine
// (per request July 26) after the primary "Straight" engine was replaced
// with the 256-gate truth-table search. Unchanged from what this file used
// to run as BB Straight: each axis (only Color actually varies in Baccarat;
// Range/Parity are held constant) runs its own locked run-length Boolean
// table, no search or fitting. Same machinery as bbInvertedForecast above,
// called with invertedModeOn = false so it always stays on the Straight
// table per axis rather than ever flipping to the mirrored one.
// =====================================================
function cadenceForecast(history: Step[]) {
  if (!history.length) {
    return { group: "BHE" as GroupKey, numbers: GROUPS.BHE, confidence: 0, tier: "Cadence", reason: "Cadence initial base recommendation (locked run-length table)." };
  }

  const locked = getLockedBbAxisGroup(history, false);
  const group = locked.group;

  return {
    group,
    numbers: group ? GROUPS[group] : [],
    confidence: 0,
    tier: "Cadence",
    axisDpi: locked.axisDpi,
    axisModes: locked.axisModes,
    reason: `Cadence locked run-length assembly · Color ${locked.axisDpi.color} · Range ${locked.axisDpi.range} · Parity ${locked.axisDpi.parity}.`
  };
}

// =====================================================
// SCOUT — engine-selector ported from the roulette (EdgeLab) project's Pulse
// mechanism, per request July 26. Kept entirely separate from this file's own
// Pulse (which is an enhancer layered on a manually-chosen engine, and is
// untouched by this). Scout is a different kind of mechanism: it scores all
// four engines (Straight, Inverted, Markov, Cadence) on a cumulative-
// advantage total — sum of (win − 0.5 breakeven) — over a bounded recent
// window, and whichever engine currently has the highest score is the one
// Scout picks. It doesn't touch settleSpin/runStrategy/the betting pipeline
// at all beyond reading history: it's called fresh inside getActiveDecision,
// which itself runs once per hand — so this MUST stay cheap regardless of
// how long the shoe has gotten, or it locks the page on longer sessions/
// AutoRun batches (found and fixed July 26: the original version scanned
// the entire shoe from scratch on every single hand, which made building a
// long history effectively cubic-time). Both the number of hands evaluated
// and the amount of history each forecast call is allowed to see are capped
// to small constants, so the total cost stays roughly linear in shoe length
// no matter how long the shoe runs.
const SCOUT_ENGINE_ORDER = ["BB_STRAIGHT", "BB_INVERTED", "MARKOV", "CADENCE"] as const;
const SCOUT_UNIFORM_START = 3;
// Per finding July 27: the earlier windowed version (40/30-hand caps) was a
// mistake — it changed Scout from "reward genuine outperformance since the
// shoe started" (roulette's original design) into "chase whoever had a hot
// streak in the last ~40 hands," which measurably made things worse (real
// session replay: -650 net windowed vs -150 unwindowed on the same 80
// hands). The _scoutCache below already solves the actual performance
// problem (the Strategy Comparison table calling this once per betting
// strategy on identical data), so the window was never load-bearing for
// speed — confirmed: full-history scoring + this cache stays under 1.5s
// even across all 13 comparison strategies. No window at all now; every
// hand since the shoe started counts, exactly like roulette's Pulse.

const _scoutCache = new Map<string, "BB_STRAIGHT" | "BB_INVERTED" | "MARKOV" | "CADENCE">();

function getScoutSelectedEngine(history: Step[]): "BB_STRAIGHT" | "BB_INVERTED" | "MARKOV" | "CADENCE" {
  // Cache key uses the full outcome sequence (what Scout actually depends
  // on) — not bet size, bankroll, tier, or anything strategy-specific. This
  // is what lets all 13 Strategy Comparison replays, which share the same
  // underlying hands and differ only in bet sizing, hit the same cache entry
  // instead of each independently re-running the full scoring scan.
  const cacheKey = history.length + ":" + history.map((h) => h.outcome).join(",");
  const cached = _scoutCache.get(cacheKey);
  if (cached) return cached;

  const cumulative: Record<string, number> = { BB_STRAIGHT: 0, BB_INVERTED: 0, MARKOV: 0, CADENCE: 0 };
  const evaluated: Record<string, number> = { BB_STRAIGHT: 0, BB_INVERTED: 0, MARKOV: 0, CADENCE: 0 };

  for (let i = SCOUT_UNIFORM_START; i < history.length; i += 1) {
    const prior = history.slice(0, i);
    const actual = spinToBaccaratOutcome(history[i].outcome);
    if (!actual) continue;

    const forecasts: Record<string, GroupKey | null> = {
      BB_STRAIGHT: bbStraightForecast(prior).group ?? null,
      BB_INVERTED: bbInvertedForecast(prior).group ?? null,
      MARKOV: markovForecast(prior).group ?? null,
      CADENCE: cadenceForecast(prior).group ?? null,
    };

    for (const engine of SCOUT_ENGINE_ORDER) {
      const predictedSide = getBaccaratSideFromForecastGroup(forecasts[engine]);
      if (!predictedSide) continue;
      const outcome = predictedSide === actual ? 1 : 0;
      cumulative[engine] += outcome - 0.5;
      evaluated[engine] += 1;
    }
  }

  const eligible = SCOUT_ENGINE_ORDER.filter((e) => evaluated[e] >= 1);
  if (eligible.length === 0) {
    _scoutCache.set(cacheKey, "BB_STRAIGHT"); // neutral default before uniform start
    return "BB_STRAIGHT";
  }

  let best: "BB_STRAIGHT" | "BB_INVERTED" | "MARKOV" | "CADENCE" = eligible[0];
  let bestScore = -Infinity;
  for (const engine of eligible) {
    if (cumulative[engine] > bestScore) { bestScore = cumulative[engine]; best = engine; }
  }
  if (_scoutCache.size > 200) _scoutCache.delete(_scoutCache.keys().next().value);
  _scoutCache.set(cacheKey, best);
  return best;
}

// =====================================================
// ENGINE DECLINE HALT — per request July 27, updated same day to be
// releasable rather than permanent. A circuit breaker separate from Scout:
// tracks each of the four engines' own peak cumulative-advantage score
// reached since the session started, and halts betting once EVERY engine's
// current score is below its own peak by more than ENGINE_DECLINE_MIN_MARGIN
// at the same time — including whichever one currently has the highest
// score. The point is to catch "everything is worse than it's been, even
// the best option," not just "one engine is down."
//
// Unlike roulette's Stop-Loss/Trail-Stop (permanent once triggered), this
// halt is re-evaluated fresh every hand and releases automatically the
// moment ANY engine shows upward movement over the last
// ENGINE_RECOVERY_LOOKBACK hands — even if that engine is still below its
// own all-time peak. It doesn't need to fully recover, just start moving
// the right direction again. Both engineHaltActive and the two settings
// below are what settleSpin reads to decide whether to bet this hand.
// =====================================================
const ENGINE_DECLINE_MIN_MARGIN = 1; // tuned July 27 against real session data — 0 fired at hand 9/80 (too early, noise); 1 fires at hand 23/80 (meaningful, still early); 2 fires at hand 74/80 (too late to be useful)
const ENGINE_RECOVERY_LOOKBACK = 5; // hands to look back when checking whether any engine has started trending upward again
const _engineHaltCache = new Map<string, { haltActive: boolean; allDeclining: boolean; anyRecovering: boolean }>();

function getEngineHaltState(history: Step[]): { haltActive: boolean; allDeclining: boolean; anyRecovering: boolean } {
  const cacheKey = history.length + ":" + history.map((h) => h.outcome).join(",");
  const cached = _engineHaltCache.get(cacheKey);
  if (cached) return cached;

  const cumulative: Record<string, number> = { BB_STRAIGHT: 0, BB_INVERTED: 0, MARKOV: 0, CADENCE: 0 };
  const peak: Record<string, number> = { BB_STRAIGHT: -Infinity, BB_INVERTED: -Infinity, MARKOV: -Infinity, CADENCE: -Infinity };
  const evaluated: Record<string, number> = { BB_STRAIGHT: 0, BB_INVERTED: 0, MARKOV: 0, CADENCE: 0 };
  const scoreTrail: Record<string, number[]> = { BB_STRAIGHT: [], BB_INVERTED: [], MARKOV: [], CADENCE: [] };

  for (let i = SCOUT_UNIFORM_START; i < history.length; i += 1) {
    const prior = history.slice(0, i);
    const actual = spinToBaccaratOutcome(history[i].outcome);
    if (!actual) continue;

    const forecasts: Record<string, GroupKey | null> = {
      BB_STRAIGHT: bbStraightForecast(prior).group ?? null,
      BB_INVERTED: bbInvertedForecast(prior).group ?? null,
      MARKOV: markovForecast(prior).group ?? null,
      CADENCE: cadenceForecast(prior).group ?? null,
    };

    for (const engine of SCOUT_ENGINE_ORDER) {
      const predictedSide = getBaccaratSideFromForecastGroup(forecasts[engine]);
      if (!predictedSide) continue;
      const outcome = predictedSide === actual ? 1 : 0;
      cumulative[engine] += outcome - 0.5;
      evaluated[engine] += 1;
      if (cumulative[engine] > peak[engine]) peak[engine] = cumulative[engine];
      scoreTrail[engine].push(cumulative[engine]);
    }
  }

  const allEvaluated = SCOUT_ENGINE_ORDER.every((e) => evaluated[e] >= 1);
  const allDeclining = allEvaluated && SCOUT_ENGINE_ORDER.every((e) => cumulative[e] < peak[e] - ENGINE_DECLINE_MIN_MARGIN);

  const anyRecovering = allEvaluated && SCOUT_ENGINE_ORDER.some((engine) => {
    const trail = scoreTrail[engine];
    if (trail.length < 2) return false;
    const lookbackIdx = Math.max(0, trail.length - 1 - ENGINE_RECOVERY_LOOKBACK);
    return trail[trail.length - 1] > trail[lookbackIdx];
  });

  const haltActive = allDeclining && !anyRecovering;
  const result = { haltActive, allDeclining, anyRecovering };

  if (_engineHaltCache.size > 200) _engineHaltCache.delete(_engineHaltCache.keys().next().value);
  _engineHaltCache.set(cacheKey, result);
  return result;
}


// =====================================================
// INDEPENDENT MARKOV PLAY MODE
// Markov is a standalone Baccarat Play Mode like BB Straight / BB Inverted.
// It does NOT read or modify BB Logic or DPI.
// IMPORTANT: Baccarat Markov is single-stream only.
// It reads only the Player/Banker side stream represented by the first group bit.
// Roulette-style Color / Range / Parity Markov averaging is intentionally removed.
// Memory depth = 3. Forecast begins after 6 prior hands.
// =====================================================
function getMarkovNextBit(bits: (0 | 1)[], depth = 3) {
  if (!bits.length) return 0 as 0 | 1;

  if (bits.length < depth + 1) {
    return bits[bits.length - 1] as 0 | 1;
  }

  const currentKey = bits.slice(-depth).join("");
  const counts: Record<string, { zero: number; one: number }> = {};

  for (let i = depth; i < bits.length; i += 1) {
    const key = bits.slice(i - depth, i).join("");
    if (!counts[key]) counts[key] = { zero: 0, one: 0 };

    if (bits[i] === 1) counts[key].one += 1;
    else counts[key].zero += 1;
  }

  const stats = counts[currentKey];

  // Fallback protection: never collapse to null after activation.
  if (!stats || (stats.zero === 0 && stats.one === 0)) {
    const recent = bits.slice(-6);
    const ones = recent.filter((v) => v === 1).length;
    const zeros = recent.length - ones;
    return (ones >= zeros ? 1 : 0) as 0 | 1;
  }

  return (stats.one >= stats.zero ? 1 : 0) as 0 | 1;
}

function getMarkovSideConfidence(bits: (0 | 1)[], predicted: 0 | 1, depth = 3) {
  if (bits.length < depth + 1) return 55;

  const currentKey = bits.slice(-depth).join("");
  let matches = 0;
  let wins = 0;

  for (let i = depth; i < bits.length; i += 1) {
    const key = bits.slice(i - depth, i).join("");
    if (key === currentKey) {
      matches += 1;
      if (bits[i] === predicted) wins += 1;
    }
  }

  if (!matches) return 58;
  return Math.max(52, Math.min(82, Math.round((wins / matches) * 100)));
}

function markovForecast(history: Step[]) {
  if (history.length < 6) {
    return {
      group: null as GroupKey | null,
      numbers: [] as SpinValue[],
      confidence: 0,
      tier: "Observation Forecast",
      reason: "Single-stream Baccarat Markov waiting for 6-hand memory.",
    };
  }

  // BACCARAT MARKOV LOCK
  // Read only the single Player/Banker side stream.
  // The first bit is the existing side bit used throughout this file:
  // 0 = Player/Base side, 1 = Banker/Opposite side.
  // Range and Parity are ignored by Markov and are not averaged into confidence.
  const sideBits = groupSeries(history).map((group) => groupToBits(group)[0]);
  const predictedSide = getMarkovNextBit(sideBits, 3);
  const sideConfidence = getMarkovSideConfidence(sideBits, predictedSide, 3);

  // Keep the existing GroupKey shell stable by projecting the single Baccarat side
  // onto a fixed neutral group basket. Markov authority/confidence remains side-only.
  const group = (predictedSide === 0 ? "BHE" : "RHE") as GroupKey;
  const confidence = sideConfidence;

  const tier =
    confidence >= 78 ? "Strong Prediction" :
    confidence >= 65 ? "Controlled Prediction" :
    confidence >= 50 ? "Weak Prediction" :
    "Observation Forecast";

  return {
    group,
    numbers: GROUPS[group],
    confidence,
    tier,
    reason: `Single-stream Baccarat Markov · depth 3 · Side confidence ${sideConfidence}% · ${predictedSide === 0 ? "Player/Base" : "Banker/Opposite"}.`,
    markovDepth: 3,
    markovSideConfidence: sideConfidence,
    markovSidePrediction: predictedSide === 0 ? "Player/Base" : "Banker/Opposite",
    markovSingleStream: true,
  };
}

function getEngineModeLabel(pulseEnabled: boolean, bbStraightEnabled: boolean, bbInvertedEnabled: boolean, markovEnabled = false, cadenceEnabled = false, scoutEnabled = false) {
  const bbMode = cadenceEnabled ? "Cadence" : markovEnabled ? "Markov" : bbStraightEnabled && bbInvertedEnabled ? "Inverted BB" : bbStraightEnabled ? "Straight BB" : "BB Off";
  if (scoutEnabled && pulseEnabled) return "SCOUT + PULSE";
  if (scoutEnabled) return "SCOUT";
  if (pulseEnabled && bbMode !== "BB Off") return `PULSE + ${bbMode}`;
  if (pulseEnabled) return "PULSE Armed / No Engine";
  return bbMode === "BB Off" ? "Disabled" : bbMode;
}

function getActiveDecision(history: Step[], pulseEnabled: boolean, bbStraightEnabled: boolean, bbInvertedEnabled: boolean, markovEnabled = false, cadenceEnabled = false, scoutEnabled = false) {
  const pulse = getNeuralCalibratedPulse(history);
  const straight = bbStraightForecast(history);
  const inverted = bbInvertedForecast(history);
  const markov = markovForecast(history);
  const cadence = cadenceForecast(history);
  const mode = getEngineModeLabel(pulseEnabled, bbStraightEnabled, bbInvertedEnabled, markovEnabled, cadenceEnabled, scoutEnabled);

  // SCOUT AUTHORITY
  // Scout, when on, overrides manual Play Mode selection entirely — same
  // precedence Pulse has in the roulette platform this was ported from.
  // It picks whichever of the four engines currently has the highest
  // cumulative-advantage score (see getScoutSelectedEngine) and uses that
  // engine's own raw forecast, completely independent of what
  // bbStraightEnabled/bbInvertedEnabled/markovEnabled/cadenceEnabled say —
  // those flags are left untouched in state, so the Play Mode buttons keep
  // showing whatever you last picked manually. If Baccarat's own Pulse
  // (a separate, unrelated enhancer) is also on, it still enhances
  // whichever engine Scout selects, exactly as it would for a manual pick.
  //
  // Bug found and fixed July 27: if Scout's picked engine had no forecast
  // group that hand (a hold state), this block used to fall all the way
  // through to the manual Play Mode flags below — meaning Scout would
  // silently bet whatever engine happened to still be manually selected
  // underneath it, contaminating Scout's real results with leftover manual
  // state (confirmed: this made Scout track Straight almost exactly when
  // Straight was the last manual pick, unrelated to Scout's own scoring).
  // Scout now always returns its OWN hold decision instead of falling
  // through, so it can never inherit a manual selection while it's on.
  if (scoutEnabled) {
    const picked = getScoutSelectedEngine(history);
    const forecastByPick: Record<string, any> = { BB_STRAIGHT: straight, BB_INVERTED: inverted, MARKOV: markov, CADENCE: cadence };
    const picked_forecast = forecastByPick[picked];
    if (picked_forecast?.group) {
      const decision = {
        ...picked_forecast,
        source: picked as PulseEngineSource,
        mode,
      };
      return applyPulseEnhancerToDecision(decision, pulse, pulseEnabled, history);
    }
    return {
      group: null as GroupKey | null,
      numbers: [] as SpinValue[],
      confidence: 0,
      tier: "No Prediction",
      reason: `Scout picked ${picked}, but it has no forecast this hand — holding rather than falling back to a manual selection.`,
      source: picked as PulseEngineSource,
      mode,
    };
  }

  // HARD PLAY-MODE AUTHORITY
  // PULSE is enhancer-only. It cannot create standalone execution.
  if (!bbStraightEnabled && !bbInvertedEnabled && !markovEnabled && !cadenceEnabled) {
    return {
      group: null as GroupKey | null,
      numbers: [] as SpinValue[],
      confidence: 0,
      tier: "No Engine",
      reason: "No active Play Mode. PULSE is enhancer-only.",
      source: "NONE" as const,
      mode,
    };
  }

  if (cadenceEnabled && cadence.group) {
    const decision = {
      ...cadence,
      source: "CADENCE" as const,
      mode,
    };
    return applyPulseEnhancerToDecision(decision, pulse, pulseEnabled, history);
  }

  if (markovEnabled && markov.group) {
    const decision = {
      ...markov,
      source: "MARKOV" as const,
      mode,
    };
    return applyPulseEnhancerToDecision(decision, pulse, pulseEnabled, history);
  }

  if (bbInvertedEnabled && inverted.group) {
    const decision = {
      ...inverted,
      source: "BB_INVERTED" as const,
      mode,
    };
    return applyPulseEnhancerToDecision(decision, pulse, pulseEnabled, history);
  }

  if (bbStraightEnabled && straight.group) {
    const decision = {
      ...straight,
      source: "BB_STRAIGHT" as const,
      mode,
    };
    return applyPulseEnhancerToDecision(decision, pulse, pulseEnabled, history);
  }

  return {
    group: null as GroupKey | null,
    numbers: [] as SpinValue[],
    confidence: 0,
    tier: "Directional Observe",
    reason: "No forecast available.",
    source: "NONE" as const,
    mode,
  };
}


function getAxisResyncState(history: Step[]) {
  const groups = groupSeries(history);
  const rows = groups.map(groupToBits);

  const axisRows = [
    { key: "color", label: "Color", values: rows.map((r) => r[0]) },
    { key: "range", label: "Range", values: rows.map((r) => r[1]) },
    { key: "parity", label: "Parity", values: rows.map((r) => r[2]) },
  ];

  const axis = axisRows.map((row) => {
    const recent = row.values.slice(-8);
    const prior = row.values.slice(-16, -8);

    const stability = getAxisStabilityScore(row.values);
    const recentRun = getCurrentBitRun(recent).length;
    const priorStability = prior.length >= 4 ? getAxisStabilityScore(prior) : stability;
    const improving = stability >= priorStability || recentRun >= 3;
    const weak = stability < 45 && recentRun < 3;
    const strong = stability >= 58 || recentRun >= 4;

    return {
      ...row,
      stability,
      priorStability,
      improving,
      weak,
      strong,
      recentRun,
    };
  });

  const strongCount = axis.filter((a) => a.strong).length;
  const improvingCount = axis.filter((a) => a.improving).length;
  const weakCount = axis.filter((a) => a.weak).length;

  const score = Math.max(0, Math.min(100, Math.round(
    strongCount * 22 +
    improvingCount * 16 -
    weakCount * 18 +
    20
  )));

  return {
    axis,
    strongCount,
    improvingCount,
    weakCount,
    score,
    status:
      strongCount >= 2 && improvingCount >= 2 ? "Re-Sync Forming" :
      weakCount >= 2 ? "Diverging" :
      improvingCount >= 2 ? "Stabilizing" :
      "Mixed",
  };
}

function getForecastConsistencyState(history: Step[], decision: any) {
  if (!decision?.group) {
    return { score: 0, status: "No Forecast", stableCount: 0 };
  }

  const lookback = history.slice(-10);
  const sameForecast = lookback.filter((row) => row.forecastGroup === decision.group || row.predictedGroup === decision.group).length;
  const stableCount = sameForecast;
  const score = Math.max(0, Math.min(100, Math.round((sameForecast / Math.max(1, lookback.length || 1)) * 100)));

  return {
    score: lookback.length < 4 ? 55 : score,
    status:
      score >= 65 ? "Consistent" :
      score >= 40 ? "Mixed" :
      "Changing",
    stableCount,
  };
}

function getEntropyChaosInfluence(history: Step[]) {
  const e = entropy(groupSeries(history));
  const penalty =
    e >= 85 ? 14 :
    e >= 75 ? 9 :
    e >= 65 ? 5 :
    0;

  return {
    entropy: e,
    chaos: e,
    penalty,
    status:
      e >= 85 ? "Extreme" :
      e >= 75 ? "High" :
      e >= 65 ? "Elevated" :
      "Normal",
  };
}


function getDominantAxisBit(values: (0 | 1)[], window = 8) {
  const recent = values.slice(-window);
  if (!recent.length) return null as 0 | 1 | null;

  const ones = recent.filter((v) => v === 1).length;
  const zeros = recent.length - ones;
  if (ones === zeros) return null;

  return (ones > zeros ? 1 : 0) as 0 | 1;
}

function getPulseAxisCorrection(history: Step[], decision: any, resync: any, entropyChaos: any) {
  if (!decision?.group) {
    return {
      group: null as GroupKey | null,
      numbers: [] as SpinValue[],
      mode: "None",
      correctedAxis: null as string | null,
      originalGroup: null as GroupKey | null,
      reason: "No forecast group.",
    };
  }

  const originalBits = groupToBits(decision.group);
  const correctedBits = [...originalBits] as [0 | 1, 0 | 1, 0 | 1];

  const weakAxes = resync.axis.filter((a: any) => a.weak);
  const strongAxes = resync.axis.filter((a: any) => a.strong || a.improving);

  // Tool 1: Single-Axis Correction
  // If exactly one axis is weak while the other two are strong/improving,
  // correct only that weak dimension. This is not global inversion.
  if (weakAxes.length === 1 && strongAxes.length >= 2) {
    const weak = weakAxes[0];
    const axisIndex = weak.key === "color" ? 0 : weak.key === "range" ? 1 : 2;
    correctedBits[axisIndex] = (correctedBits[axisIndex] === 0 ? 1 : 0) as 0 | 1;

    const correctedGroup = bitsToGroup(correctedBits[0], correctedBits[1], correctedBits[2]);

    return {
      group: correctedGroup,
      numbers: GROUPS[correctedGroup],
      mode: "Single-Axis Correction",
      correctedAxis: weak.label,
      originalGroup: decision.group,
      reason: `${weak.label} weak while other dimensions are stabilizing; flipped ${weak.label} only.`,
    };
  }

  // Tool 2: Chaos Hold
  // When entropy/chaos is elevated, hold the dominant side of the weakest axis
  // instead of forcing a full no-bet. This only adjusts one dimension.
  if (entropyChaos.status === "High" || entropyChaos.status === "Extreme" || entropyChaos.status === "Elevated") {
    const weakest = [...resync.axis].sort((a: any, b: any) => a.stability - b.stability)[0];

    if (weakest) {
      const axisIndex = weakest.key === "color" ? 0 : weakest.key === "range" ? 1 : 2;
      const heldBit = getDominantAxisBit(weakest.values, 8);

      if (heldBit !== null && heldBit !== correctedBits[axisIndex]) {
        correctedBits[axisIndex] = heldBit;

        const correctedGroup = bitsToGroup(correctedBits[0], correctedBits[1], correctedBits[2]);

        return {
          group: correctedGroup,
          numbers: GROUPS[correctedGroup],
          mode: "Chaos Hold",
          correctedAxis: weakest.label,
          originalGroup: decision.group,
          reason: `${entropyChaos.status} entropy; holding dominant ${weakest.label} side until environment normalizes.`,
        };
      }
    }
  }

  return {
    group: decision.group as GroupKey,
    numbers: GROUPS[decision.group as GroupKey],
    mode: "None",
    correctedAxis: null as string | null,
    originalGroup: decision.group as GroupKey,
    reason: "No axis correction required.",
  };
}


function getAxisTransitionAcceleration(history: Step[]) {
  const groups = groupSeries(history);
  const rows = groups.map(groupToBits);

  const axes = [
    { key: "color", label: "Color", values: rows.map((r) => r[0]) },
    { key: "range", label: "Range", values: rows.map((r) => r[1]) },
    { key: "parity", label: "Parity", values: rows.map((r) => r[2]) },
  ];

  const axis = axes.map((axis) => {
    const recent = axis.values.slice(-8);
    const prior = axis.values.slice(-16, -8);

    const recentFlips = recent.slice(1).filter((v, i) => v !== recent[i]).length;
    const priorFlips = prior.slice(1).filter((v, i) => v !== prior[i]).length;
    const acceleration = recentFlips - priorFlips;

    return {
      ...axis,
      recentFlips,
      priorFlips,
      acceleration,
      transitioning: acceleration >= 2 || recentFlips >= 5,
    };
  });

  const transitioningCount = axis.filter((a) => a.transitioning).length;

  return {
    axis,
    transitioningCount,
    score: Math.max(0, Math.min(100, 100 - transitioningCount * 22 - axis.reduce((s, a) => s + Math.max(0, a.acceleration) * 4, 0))),
    status:
      transitioningCount >= 2 ? "Acceleration Risk" :
      transitioningCount === 1 ? "Single-Axis Transition" :
      "Acceleration Risk",
  };
}

function getAxisDriftVelocity(history: Step[]) {
  const groups = groupSeries(history);
  const rows = groups.map(groupToBits);

  const axes = [
    { key: "color", label: "Color", values: rows.map((r) => r[0]) },
    { key: "range", label: "Range", values: rows.map((r) => r[1]) },
    { key: "parity", label: "Parity", values: rows.map((r) => r[2]) },
  ];

  const axis = axes.map((axis) => {
    const now = getAxisStabilityScore(axis.values);
    const priorValues = axis.values.slice(0, -6);
    const prior = priorValues.length >= 4 ? getAxisStabilityScore(priorValues) : now;
    const drift = now - prior;

    return {
      ...axis,
      now,
      prior,
      drift,
      fallingFast: drift <= -12,
      improvingFast: drift >= 10,
    };
  });

  const fallingCount = axis.filter((a) => a.fallingFast).length;
  const improvingCount = axis.filter((a) => a.improvingFast).length;

  return {
    axis,
    fallingCount,
    improvingCount,
    score: Math.max(0, Math.min(100, 62 + improvingCount * 12 - fallingCount * 18)),
    status:
      fallingCount >= 2 ? "Drift Breaking" :
      fallingCount === 1 ? "Single-Axis Drift" :
      improvingCount >= 2 ? "Drift Improving" :
      "Neutral",
  };
}

function getForecastFamily(group: GroupKey | null) {
  if (!group) return "NONE";
  return `${group[0]}${group[1]}`; // color + range family; parity can vary inside family.
}

function getForecastFamilySaturation(history: Step[], decision: any) {
  const family = getForecastFamily(decision?.group ?? null);
  const recent = history.slice(-10);
  const familyRows = recent.filter((r) => getForecastFamily(r.forecastGroup ?? r.predictedGroup ?? null) === family);
  const losses = familyRows.filter((r) => r.result === "loss").length;
  const wins = familyRows.filter((r) => r.result === "win").length;
  const saturation = familyRows.length >= 4 && losses >= 3 && losses > wins;

  return {
    family,
    attempts: familyRows.length,
    wins,
    losses,
    saturation,
    score: saturation ? Math.max(0, 58 - losses * 8 + wins * 6) : 68,
    status: saturation ? "Saturated Failure" : "Clear",
  };
}

function getForecastCompression(history: Step[], decision: any) {
  const forecasts = history
    .slice(-12)
    .map((r) => r.forecastGroup ?? r.predictedGroup)
    .filter(Boolean) as GroupKey[];

  const uniqueFamilies = new Set(forecasts.map(getForecastFamily)).size;
  const uniqueGroups = new Set(forecasts).size;
  const compression = forecasts.length >= 8 && (uniqueFamilies <= 2 || uniqueGroups <= 3);

  return {
    uniqueFamilies,
    uniqueGroups,
    compression,
    score: compression ? 42 : 68,
    status: compression ? "Compressed Forecast Band" : "Diverse",
  };
}

function getStructuralPulseRead(history: Step[], decision: any, resync: any, consistency: any, entropyChaos: any) {
  const transition = getAxisTransitionAcceleration(history);
  const drift = getAxisDriftVelocity(history);
  const family = getForecastFamilySaturation(history, decision);
  const compression = getForecastCompression(history, decision);

  const entropyPenalty =
    entropyChaos.status === "Extreme" ? 8 :
    entropyChaos.status === "High" ? 5 :
    entropyChaos.status === "Elevated" ? 2 :
    0;

  const score = Math.max(0, Math.min(100, Math.round(
    resync.score * 0.25 +
    consistency.score * 0.18 +
    transition.score * 0.20 +
    drift.score * 0.17 +
    family.score * 0.12 +
    compression.score * 0.08 -
    entropyPenalty
  )));

  const directionalAdvisory =
    transition.status === "Acceleration Risk" ||
    drift.status === "Drift Breaking" ||
    (family.status === "Saturated Failure" && compression.status === "Compressed Forecast Band");

  return {
    transition,
    drift,
    family,
    compression,
    entropyPenalty,
    score,
    directionalAdvisory,
    status:
      directionalAdvisory ? "Directional Conflict" :
      score >= 68 ? "Structure Aligned" :
      score >= 54 ? "Structure Mixed" :
      "Structure Weak",
  };
}


function getDirectionalRebuildEngine(history: Step[], decision: any, resync: any, structural: any, entropyChaos: any) {
  if (!decision?.group) {
    return {
      selectedGroup: null,
      selectedReason: "No forecast",
      candidates: [],
    };
  }

  const originalBits = groupToBits(decision.group);

  const candidates = [
    originalBits,
    [originalBits[0], originalBits[1], originalBits[2] === 0 ? 1 : 0],
    [originalBits[0], originalBits[1] === 0 ? 1 : 0, originalBits[2]],
    [originalBits[0] === 0 ? 1 : 0, originalBits[1], originalBits[2]],
  ];

  const scored = candidates.map((bits) => {
    const group = bitsToGroup(bits[0], bits[1], bits[2]);

    const family = getForecastFamily(group);
    const recent = history.slice(-10);

    const familyLosses = recent.filter(
      (r) =>
        getForecastFamily(r.forecastGroup ?? r.predictedGroup ?? null) === family &&
        String(r.result).toLowerCase() === "loss"
    ).length;

    const parityBonus =
      bits[2] === originalBits[2] ? 0 : 8;

    const rangeBonus =
      bits[1] === originalBits[1] ? 0 : 6;

    const colorBonus =
      bits[0] === originalBits[0] ? 0 : 5;

    const score =
      structural.score +
      parityBonus +
      rangeBonus +
      colorBonus -
      familyLosses * 10 -
      entropyChaos.penalty;

    return {
      group,
      score,
      familyLosses,
      changedParity: bits[2] !== originalBits[2],
      changedRange: bits[1] !== originalBits[1],
      changedColor: bits[0] !== originalBits[0],
    };
  });

  scored.sort((a,b) => b.score - a.score);

  const best = scored[0];

  return {
    selectedGroup: best.group,
    selectedReason:
      best.changedParity ? "Parity rebuilt" :
      best.changedRange ? "Range rebuilt" :
      best.changedColor ? "Color rebuilt" :
      "Original structure retained",
    candidates: scored,
  };
}


// =====================================================
// ENGINE-SPECIFIC BACCARAT PULSE TRUE REBUILD
// Pulse is one button, but attaches different protection logic to
// the currently selected standalone engine only.
// It does NOT create predictions, vote engines, or modify BB/DPI/Markov.
// =====================================================

type PulseEngineSource = "BB_STRAIGHT" | "BB_INVERTED" | "MARKOV" | "CADENCE";

function getEngineRowSource(row: Step): PulseEngineSource | null {
  const selected = row.pulseDiagnostics?.selectedEngine;
  if (selected === "BB_STRAIGHT" || selected === "BB_INVERTED" || selected === "MARKOV" || selected === "CADENCE") return selected;
  if (row.note.includes("BB_STRAIGHT") || row.note.includes("Straight BB") || row.note.includes("BB Straight")) return "BB_STRAIGHT";
  if (row.note.includes("BB_INVERTED") || row.note.includes("Inverted BB") || row.note.includes("BB Inverted")) return "BB_INVERTED";
  if (row.note.includes("MARKOV") || row.note.includes("Markov")) return "MARKOV";
  if (row.note.includes("CADENCE") || row.note.includes("Cadence")) return "CADENCE";
  return null;
}

function getSideBitFromGroup(group?: GroupKey | null): 0 | 1 | null {
  const side = getBaccaratSideFromForecastGroup(group);
  if (!side) return null;
  return side === "B" ? 1 : 0;
}

function getBaccaratOutcomeBit(row: Step): 0 | 1 {
  return spinToBaccaratOutcome(row.outcome) === "B" ? 1 : 0;
}

function getSideBitStream(history: Step[]) {
  return history.map(getBaccaratOutcomeBit);
}

function getPulseRowsForEngine(history: Step[], engine: PulseEngineSource, limit = 12) {
  const rows: Step[] = [];
  for (let i = history.length - 1; i >= 0 && rows.length < limit; i -= 1) {
    const row = history[i];
    if (getEngineRowSource(row) === engine && row.forecastGroup) rows.push(row);
  }
  return rows.reverse();
}

function getEngineShadowStats(history: Step[], engine: PulseEngineSource, limit = 10) {
  const rows = getPulseRowsForEngine(history, engine, limit);
  const settled = rows.map((row) => getPulseShadowResult(row)).filter((r) => r === "win" || r === "loss");
  const wins = settled.filter((r) => r === "win").length;
  const losses = settled.filter((r) => r === "loss").length;
  const active = wins + losses;
  const accuracy = active ? wins / active : 0.5;
  let lossRun = 0;
  for (let i = settled.length - 1; i >= 0; i -= 1) {
    if (settled[i] === "loss") lossRun += 1;
    else break;
  }
  let winRun = 0;
  for (let i = settled.length - 1; i >= 0; i -= 1) {
    if (settled[i] === "win") winRun += 1;
    else break;
  }
  return { rows, settled, wins, losses, active, accuracy, lossRun, winRun };
}

// REMOVED FROM ACTIVE PULSE v2: retained only to avoid breaking older diagnostics/replay references.
function getBbStraightTrapPulse(history: Step[]) {
  const bits = getSideBitStream(history);
  const recent = bits.slice(-16).join("");

  // BB Straight nemesis detection.
  // Banker=1, Player=0. 1101 is the pre-trap; 11011 completes the trap.
  const caution110 = recent.endsWith("110");
  const trap1101 = recent.endsWith("1101");
  const trap11011 = recent.endsWith("11011");
  const repeatedTrap = recent.includes("11011011") || (recent.match(/11011/g) || []).length >= 2;

  // Micro-pattern probability: after seeing 1101, how often did the next bit complete 11011?
  let trapTrials = 0;
  let trapCompletions = 0;
  for (let i = 0; i <= bits.length - 5; i += 1) {
    if (bits.slice(i, i + 4).join("") === "1101") {
      trapTrials += 1;
      if (bits[i + 4] === 1) trapCompletions += 1;
    }
  }
  const trapCompletionRate = trapTrials ? trapCompletions / trapTrials : 0;
  const trapCompletionRisk = trap1101 && trapTrials >= 1 && trapCompletionRate >= 0.55;

  let penalty = 0;
  let observe = false;
  let status = "Straight Stable";

  // BB STRAIGHT + PULSE ACTIVE GUARD
  // BB Straight alone remains untouched. When Pulse is ON, this guard must create
  // a separate replay path by blocking the known pre-trap/trap cadence instead of
  // only changing labels. This is what makes BB Straight + Pulse visibly different
  // from plain BB Straight on the live chart.
  if (caution110) {
    penalty += 2;
    status = "Straight Caution 110";
  }
  if (trap1101) {
    penalty += 12;
    observe = true;
    status = "Straight Trap Forming 1101";
  }
  if (trapCompletionRisk) {
    penalty += 16;
    observe = true;
    status = "Straight Trap Completion Risk";
  }
  if (trap11011) {
    penalty += 20;
    observe = true;
    status = "Straight Trap Confirmed 11011";
  }
  if (repeatedTrap) {
    penalty += 30;
    observe = true;
    status = "Straight Repeated Trap";
  }

  return {
    penalty,
    observe,
    status,
    caution110,
    trap1101,
    trap11011,
    repeatedTrap,
    trapTrials,
    trapCompletionRate: Math.round(trapCompletionRate * 100),
  };
}

// REMOVED FROM ACTIVE PULSE v2: retained only to avoid breaking older diagnostics/replay references.
function getBbInvertedPulse(history: Step[], dpi: number) {
  const stats = getEngineShadowStats(history, "BB_INVERTED", 8);
  const recentAfterDpi = history.slice(-8).filter((row) => getEngineRowSource(row) === "BB_INVERTED");
  const immediateFailure = dpi <= -5 && stats.active >= 2 && stats.lossRun >= 2;
  const unstableSwitch = dpi <= -5 && stats.active >= 4 && stats.accuracy <= 0.42;
  const repeatedFailedReversal = stats.active >= 5 && stats.losses >= 4;

  let penalty = 0;
  let observe = false;
  let status = "Inverted Stable";

  // PASSIVE PULSE MODE:
  // Early inverted warnings are diagnostics only. Only repeated failed reversal
  // should materially alter execution.
  if (immediateFailure) {
    status = "Inverted Entry Failure";
  }
  if (unstableSwitch) {
    penalty += 4;
    status = "Inverted Switch Unstable";
  }
  if (repeatedFailedReversal) {
    penalty += 18;
    observe = true;
    status = "Inverted Reversal Failure";
  }

  return {
    penalty,
    observe,
    status,
    dpi,
    recentRows: recentAfterDpi.length,
    active: stats.active,
    accuracy: Math.round(stats.accuracy * 100),
    lossRun: stats.lossRun,
  };
}

function getMarkovPulse(history: Step[]) {
  const stats = getEngineShadowStats(history, "MARKOV", 12);
  const bits = getSideBitStream(history);
  const recent = bits.slice(-12).join("");

  const cadenceTrap = recent.includes("11011011") || recent.includes("101101101") || recent.includes("00100100");
  const reliabilityCollapse = stats.active >= 6 && stats.accuracy <= 0.42;
  const severeCollapse = stats.active >= 6 && stats.accuracy <= 0.34;
  const missCluster = stats.settled.slice(-4).filter((r) => r === "loss").length >= 3;

  let penalty = 0;
  let observe = false;
  let status = "Markov Stable";

  // PASSIVE PULSE MODE:
  // Markov warnings remain diagnostic unless reliability collapse becomes severe.
  if (cadenceTrap) {
    status = "Markov Cadence Trap";
  }
  if (missCluster) {
    status = "Markov Miss Cluster";
  }
  if (reliabilityCollapse) {
    penalty += 3;
    status = "Markov Reliability Collapse";
  }
  if (severeCollapse) {
    penalty += 22;
    observe = true;
    status = "Markov Severe Collapse";
  }

  return {
    penalty,
    observe,
    status,
    cadenceTrap,
    reliabilityCollapse,
    severeCollapse,
    active: stats.active,
    accuracy: Math.round(stats.accuracy * 100),
    lossRun: stats.lossRun,
  };
}


function getMarkovAssistForBbPulse(history: Step[], engine: "BB_STRAIGHT" | "BB_INVERTED" | "CADENCE") {
  // MARKOV ASSIST FOR BB ENGINES ONLY
  // This is not the standalone Markov engine and does not create predictions.
  // It answers one question for BB Straight / BB Inverted + Pulse:
  // "Is the recent outcome cadence becoming unfavorable for the selected BB engine?"
  // When standalone Markov is selected, this assist must be disabled because
  // the Markov engine already contains its own transition logic.
  const rows = getPulseRowsForEngine(history, engine, 12);
  const settled = rows.map((row) => getPulseShadowResult(row)).filter((r) => r === "win" || r === "loss");
  const active = settled.length;
  const losses = settled.filter((r) => r === "loss").length;
  const accuracy = active ? (active - losses) / active : 0.5;

  const sideBits = getSideBitStream(history);
  const recent = sideBits.slice(-14).join("");

  const bbStraightTrapCadence = recent.includes("11011011") || recent.endsWith("11011") || recent.endsWith("1101");
  const bbInvertedTrapCadence = recent.includes("00100100") || recent.endsWith("00100") || recent.endsWith("0010");
  const alternatingCadence = recent.includes("101101101") || recent.includes("010010010");
  const engineCadenceRisk = engine === "BB_STRAIGHT" || engine === "CADENCE" ? bbStraightTrapCadence || alternatingCadence : bbInvertedTrapCadence || alternatingCadence;

  let markovTrials = 0;
  let markovWins = 0;
  for (let i = Math.max(6, history.length - 12); i < history.length; i += 1) {
    const prior = history.slice(0, i);
    const mf = markovForecast(prior);
    if (!mf.group) continue;
    const predictedSide = getBaccaratSideFromForecastGroup(mf.group as GroupKey);
    const actualSide = spinToBaccaratOutcome(history[i].outcome);
    if (!predictedSide || !actualSide) continue;
    markovTrials += 1;
    if (predictedSide === actualSide) markovWins += 1;
  }

  const markovRate = markovTrials ? markovWins / markovTrials : 0.5;
  // REBALANCED: Markov assist is a warning layer for BB engines, not a frequent blocker.
  const markovWeak = markovTrials >= 7 && markovRate <= 0.35;
  const bbWeak = active >= 7 && accuracy <= 0.35;
  const severe = active >= 7 && accuracy <= 0.30 && engineCadenceRisk && markovWeak;

  let penalty = 0;
  let observe = false;
  let status = "BB Markov Assist Stable";

  if (engineCadenceRisk) status = "BB Markov Assist Cadence Risk";
  if (bbWeak || markovWeak) {
    penalty += 6;
    status = "BB Markov Assist Weakening";
  }
  if (engineCadenceRisk && (bbWeak || markovWeak)) {
    penalty += 5;
    status = "BB Markov Assist Trap Risk";
  }
  if (severe) {
    penalty += 8;
    observe = true;
    status = "BB Markov Assist Severe Risk";
  }

  return {
    penalty,
    observe,
    status,
    engine,
    active,
    accuracy: Math.round(accuracy * 100),
    markovTrials,
    markovRate: Math.round(markovRate * 100),
    engineCadenceRisk,
    markovWeak,
    bbWeak,
    severe,
  };
}


function getPulseAuthorityForStandaloneMarkov(history: Step[]) {
  // STANDALONE MARKOV + PULSE
  // This intentionally does NOT add a second Markov predictor.
  // It only grades the selected Markov engine's recent shadow performance and
  // can create a distinct Markov+Pulse replay path through severe hold logic.
  const stats = getEngineShadowStats(history, "MARKOV", 10);
  // REBALANCED: standalone Markov naturally oscillates; Pulse should be looser.
  const recentLossCluster = stats.settled.slice(-5).filter((r) => r === "loss").length >= 4;
  const severeLossCluster = stats.settled.slice(-6).filter((r) => r === "loss").length >= 5;
  const reliabilityFailure = stats.active >= 8 && stats.accuracy <= 0.32;
  const severe = severeLossCluster || reliabilityFailure;

  let penalty = 0;
  let observe = false;
  let status = "Markov Pulse Authority Stable";

  if (recentLossCluster) {
    penalty += 3;
    status = "Markov Pulse Authority Loss Cluster";
  }

  if (reliabilityFailure) {
    penalty += 5;
    status = "Markov Pulse Authority Reliability Failure";
  }

  if (severe) {
    penalty += 7;
    observe = true;
    status = "Markov Pulse Authority Severe Hold";
  }

  return {
    penalty,
    observe,
    status,
    active: stats.active,
    accuracy: Math.round(stats.accuracy * 100),
    lossRun: stats.lossRun,
    recentLossCluster,
    severeLossCluster,
    reliabilityFailure,
    severe,
    noDuplicateMarkovPrediction: true,
  };
}

function getPulseShadowRecoveryForEngine(history: Step[], engine: PulseEngineSource) {
  const rows = getPulseRowsForEngine(history, engine, 6);
  const shadowWins = rows.filter((row) => row.result === "push" && getPulseShadowResult(row) === "win").length;
  const recentShadow = rows.map(getPulseShadowResult).filter((r) => r === "win" || r === "loss");
  const latestShadowWin = recentShadow.at(-1) === "win";
  const recoveryLift = shadowWins >= 2 ? 10 : shadowWins >= 1 ? 5 : latestShadowWin ? 4 : 0;
  return {
    recoveryLift,
    shadowWins,
    latestShadowWin,
    status: recoveryLift >= 8 ? "Recovering" : recoveryLift > 0 ? "Recovery Watch" : "No Recovery",
  };
}

function getPulseTierFromConfidence(confidence: number, observe: boolean) {
  if (observe) return "Directional Observe";
  return getPulseTier(confidence);
}

function getPulseSideEntropy(history: Step[], window = 12) {
  const bits = getSideBitStream(history).slice(-window);
  if (bits.length < 4) return { entropy: 0, label: "No Data", penalty: 0, random: false };

  const ones = bits.filter((bit) => bit === 1).length;
  const zeros = bits.length - ones;
  const pB = ones / bits.length;
  const pP = zeros / bits.length;
  const e = [pB, pP].reduce((sum, p) => (p > 0 ? sum - p * Math.log2(p) : sum), 0);
  const entropyScore = Math.round(e * 100);
  // REBALANCED: Side entropy is advisory only and should not create frequent no-bets.
  const random = entropyScore >= 94;
  const elevated = entropyScore >= 85;

  return {
    entropy: entropyScore,
    label: random ? "Random Side Flow" : elevated ? "Elevated Side Randomness" : "Stable Side Flow",
    penalty: random ? 5 : elevated ? 2 : 0,
    random,
    bankerShare: Math.round(pB * 100),
    playerShare: Math.round(pP * 100),
  };
}

function getPulsePersistenceStability(history: Step[], forecastGroup?: GroupKey | null, window = 10) {
  const bits = getSideBitStream(history).slice(-window);
  const targetBit = getSideBitFromGroup(forecastGroup);
  if (bits.length < 4) {
    return {
      score: 50,
      status: "Building Memory",
      flips: 0,
      flipRate: 0,
      currentRun: 0,
      targetSupport: 50,
      unstable: false,
      breakingDown: false,
      penalty: 0,
    };
  }

  let flips = 0;
  for (let i = 1; i < bits.length; i += 1) {
    if (bits[i] !== bits[i - 1]) flips += 1;
  }

  const run = getCurrentBitRun(bits);
  const flipRate = flips / Math.max(1, bits.length - 1);
  const targetSupport = targetBit == null ? 0.5 : bits.filter((bit) => bit === targetBit).length / bits.length;
  const runSupport = Math.min(1, run.length / 4);
  const score = Math.max(0, Math.min(100, Math.round(72 - flipRate * 44 + runSupport * 18 + targetSupport * 18)));
  // REBALANCED: Baccarat naturally alternates. Only extreme flipping is treated as instability.
  const unstable = flipRate >= 0.70;
  const breakingDown = unstable && run.length <= 1;

  return {
    score,
    status: breakingDown ? "Breaking Down" : unstable ? "Flipping" : score >= 70 ? "Stable" : "Mixed",
    flips,
    flipRate: Math.round(flipRate * 100),
    currentRun: run.length,
    targetSupport: Math.round(targetSupport * 100),
    unstable,
    breakingDown,
    penalty: breakingDown ? 8 : unstable ? 4 : score < 45 ? 2 : 0,
  };
}

function getPulseLossProtection(history: Step[], engine: PulseEngineSource) {
  const stats = getEngineShadowStats(history, engine, 10);
  const recent = stats.settled.slice(-5);
  const recentLosses = recent.filter((r) => r === "loss").length;
  // STRAIGHT + PULSE RE-ENTRY FIX
  // Four straight losses should warn/downgrade, not lock the engine in Observe.
  // Straight only enters a true hold on a deeper confirmed loss cluster, and it
  // can re-enter after the first shadow/real recovery win through consensusReEntry.
  const isStraight = engine === "BB_STRAIGHT" || engine === "CADENCE";
  const active = isStraight ? stats.lossRun >= 4 || recentLosses >= 4 : stats.lossRun >= 4 || recentLosses >= 5;
  const severe = isStraight ? stats.lossRun >= 6 || recentLosses >= 5 : stats.lossRun >= 5 || recentLosses >= 5;

  return {
    active,
    severe,
    lossRun: stats.lossRun,
    recentLosses,
    penalty: severe ? (isStraight ? 8 : 12) : active ? (isStraight ? 3 : 6) : 0,
    observe: severe,
    status: severe ? "Loss Protection Hold" : active ? "Loss Protection Watch" : "Clear",
  };
}

function getPulseConsensusReEntry(history: Step[], engine: PulseEngineSource, forecastGroup?: GroupKey | null) {
  const stats = getEngineShadowStats(history, engine, 8);
  const markov = markovForecast(history);
  const markovSide = getSideBitFromGroup(markov.group as GroupKey | null);
  const forecastSide = getSideBitFromGroup(forecastGroup);
  const markovAgrees = markovSide != null && forecastSide != null && markovSide === forecastSide;
  const recentWin = stats.settled.at(-1) === "win";
  const twoRecentWins = stats.settled.slice(-3).filter((r) => r === "win").length >= 2;
  // REBALANCED: faster re-entry. Do not require perfect consensus after a single recovery win.
  const reEntryReady = recentWin || twoRecentWins || (markovAgrees && stats.accuracy >= 0.52);

  return {
    markovAgrees,
    recentWin,
    twoRecentWins,
    accuracy: Math.round(stats.accuracy * 100),
    reEntryReady,
    status: reEntryReady ? "Re-Entry Ready" : "Re-Entry Waiting",
    lift: reEntryReady ? 8 : 0,
  };
}

function getDpiStructuralPulseState(history: Step[], confidence: number) {
  // DPI STRUCTURAL STATE GATE
  // DPI is still calculated by the locked outcome-pressure rule only.
  // This layer does not change BB, Markov, settlement, bankroll, or DPI math.
  // It only prevents Pulse from trusting a confidence rebound while DPI is
  // still actively degrading.
  const currentDpi = getDpiValue(history);
  const window = 6;
  const start = Math.max(1, history.length - window + 1);
  const dpiSeries: number[] = [];

  for (let i = start; i <= history.length; i += 1) {
    dpiSeries.push(getDpiValue(history.slice(0, i)));
  }

  let worseningSteps = 0;
  let repairSteps = 0;
  let flatSteps = 0;

  for (let i = 1; i < dpiSeries.length; i += 1) {
    if (dpiSeries[i] < dpiSeries[i - 1]) worseningSteps += 1;
    else if (dpiSeries[i] > dpiSeries[i - 1]) repairSteps += 1;
    else flatSteps += 1;
  }

  const last4 = dpiSeries.slice(-4);
  let worseningLast4 = 0;
  let repairLast4 = 0;
  for (let i = 1; i < last4.length; i += 1) {
    if (last4[i] < last4[i - 1]) worseningLast4 += 1;
    else if (last4[i] > last4[i - 1]) repairLast4 += 1;
  }

  const last3 = dpiSeries.slice(-3);
  let worseningLast3 = 0;
  let repairLast3 = 0;
  for (let i = 1; i < last3.length; i += 1) {
    if (last3[i] < last3[i - 1]) worseningLast3 += 1;
    else if (last3[i] > last3[i - 1]) repairLast3 += 1;
  }

  const velocity = dpiSeries.length >= 2 ? dpiSeries[dpiSeries.length - 1] - dpiSeries[0] : 0;
  const deepPressure = currentDpi <= -8;
  const extremePressure = currentDpi <= -12;
  const rapidDivergence = currentDpi <= -5 && worseningLast4 >= 3;
  const persistentDivergence = deepPressure && worseningSteps >= 4 && repairSteps === 0;
  const confidenceReboundWithoutRepair = deepPressure && confidence >= 50 && worseningLast3 >= 1 && repairLast3 === 0;
  const structuralRecoveryConfirmed = repairLast3 >= 1 || (repairSteps >= 2 && worseningLast3 === 0);

  const forceObserve = (rapidDivergence || persistentDivergence || confidenceReboundWithoutRepair) && !structuralRecoveryConfirmed;
  const penalty = extremePressure && forceObserve ? 12 : forceObserve ? 8 : rapidDivergence ? 5 : 0;
  const status = forceObserve
    ? confidenceReboundWithoutRepair
      ? "Recovery Gate Hold"
      : persistentDivergence
      ? "Persistent DPI Divergence"
      : "DPI Velocity Warning"
    : structuralRecoveryConfirmed
    ? "DPI Stabilizing"
    : deepPressure
    ? "Deep DPI Pressure"
    : "DPI Clear";

  return {
    currentDpi,
    dpiSeries,
    velocity,
    worseningSteps,
    repairSteps,
    flatSteps,
    worseningLast4,
    repairLast4,
    worseningLast3,
    repairLast3,
    rapidDivergence,
    persistentDivergence,
    confidenceReboundWithoutRepair,
    structuralRecoveryConfirmed,
    forceObserve,
    penalty,
    status,
  };
}


function getStructuralCompressionIndex(history: Step[], signalConfidence: number) {
  // SCI = Structural Compression Index
  // Measures whether Signal confidence is moving WITH structural DPI repair,
  // or separating from it during hostile DPI pressure.
  // It is diagnostic-only: no BB, DPI, Markov, settlement, or bankroll math is changed.
  const buildPoint = (slice: Step[]) => {
    const dpi = getDpiValue(slice);
    const pressure = Math.min(100, Math.round(Math.abs(dpi) * 6));
    return { dpi, pressure };
  };

  const current = buildPoint(history);
  const prior = history.length > 1 ? buildPoint(history.slice(0, -1)) : current;
  const signal = Math.max(0, Math.min(100, Math.round(Number(signalConfidence || 0))));
  const priorSignal = history.length > 1 ? Math.max(0, Math.min(100, Math.round(Number(history.at(-2)?.confidence ?? signal)))) : signal;

  const spread = Math.abs(signal - current.pressure);
  const priorSpread = Math.abs(priorSignal - prior.pressure);
  const spreadVelocity = spread - priorSpread;
  const dpiWorsening = current.dpi < prior.dpi;
  const dpiRepairing = current.dpi > prior.dpi;
  const signalRising = signal > priorSignal;
  const deepPressure = current.dpi <= -8;
  const extremePressure = current.dpi <= -12;

  let state = "COMPRESSED";
  if (spreadVelocity >= 6 && deepPressure) state = extremePressure ? "EXTREME DIVERGENCE" : "DIVERGING";
  else if (spreadVelocity <= -4 || dpiRepairing) state = "COMPRESSING";
  else if (deepPressure && signalRising && !dpiRepairing) state = "DIVERGING";
  else if (Math.abs(spreadVelocity) <= 3) state = "FLAT";

  const outcomeState =
    state === "EXTREME DIVERGENCE" ? "Hostile Structure" :
    state === "DIVERGING" && signalRising && !dpiRepairing ? "False Confidence Risk" :
    state === "DIVERGING" ? "Structural Continuation" :
    state === "COMPRESSING" ? "Structural Repair" :
    dpiWorsening ? "Pressure Building" :
    "Neutral";

  const reEntryRisk =
    state === "EXTREME DIVERGENCE" ? "BLOCKED" :
    state === "DIVERGING" && deepPressure ? "HIGH" :
    state === "COMPRESSING" ? "LOW" :
    deepPressure ? "ELEVATED" :
    "NORMAL";

  return {
    state,
    signal,
    dpi: current.dpi,
    structuralPressure: current.pressure,
    spread,
    priorSpread,
    spreadVelocity,
    velocityLabel: spreadVelocity >= 6 ? "WIDENING" : spreadVelocity <= -4 ? "CLOSING" : "FLAT",
    outcomeState,
    reEntryRisk,
    dpiWorsening,
    dpiRepairing,
    signalRising,
  };
}


function getPulseEngineSpecificConfidenceModulation(history: Step[], engine: PulseEngineSource) {
  // PHASE 2A — CONFIDENCE MODULATION ONLY
  // This uses the visible engine-specific diagnostics to adjust displayed Pulse confidence/tier.
  // It does NOT change forecasts, settlement, replay routing, bankroll math, strategy math, charts, or session logs.
  const bits = getSideBitStream(history);
  const recent = bits.slice(-16).join("");
  const recentBits = bits.slice(-12);

  let flips = 0;
  for (let i = 1; i < recentBits.length; i += 1) {
    if (recentBits[i] !== recentBits[i - 1]) flips += 1;
  }

  const stabilityScore = recentBits.length > 1
    ? Math.max(0, Math.min(100, Math.round(100 - (flips / Math.max(1, recentBits.length - 1)) * 100)))
    : 50;
  const trapCount = (recent.match(/11011/g) || []).length;
  const compressionRisk = recent.includes("11011011") ? 90 : trapCount >= 2 ? 80 : recent.endsWith("1101") ? 68 : recent.endsWith("110") ? 48 : 18;
  const dpiValue = getDpiValue(history);
  const inversionEligible = dpiValue <= -5;
  const recentLossPressure = getLossStreak(history.slice(-12));

  const continuationFailureBenefit = inversionEligible ? compressionRisk : 0;
  const reversalHarvestStability = inversionEligible
    ? Math.max(0, Math.min(100, Math.round((continuationFailureBenefit * 0.65) + ((100 - stabilityScore) * 0.35))))
    : 0;
  const dpiRecoveryEfficiency = inversionEligible
    ? Math.max(0, Math.min(100, Math.round(100 - Math.min(90, Math.abs(dpiValue) * 7 + recentLossPressure * 5))))
    : 0;

  if (engine === "BB_STRAIGHT" || engine === "CADENCE") {
    const penalty = compressionRisk >= 85 ? -16 : compressionRisk >= 70 ? -11 : compressionRisk >= 55 ? -6 : 0;
    return {
      adjustment: penalty,
      status: penalty <= -12 ? "Straight Downgrade" : penalty < 0 ? "Straight Caution" : "Straight Clear",
      reason: penalty < 0 ? `Compression/Reset pressure ${compressionRisk}%` : "Straight structure clear",
      metrics: { compressionRisk, stabilityScore, trapCount },
    };
  }

  if (engine === "BB_INVERTED") {
    const rawBoost = reversalHarvestStability >= 75 && continuationFailureBenefit >= 70
      ? 12
      : reversalHarvestStability >= 62 && continuationFailureBenefit >= 55
      ? 8
      : 0;
    const efficiencyCap = dpiRecoveryEfficiency <= 15 ? 8 : dpiRecoveryEfficiency <= 30 ? 10 : 14;
    const adjustment = inversionEligible ? Math.min(rawBoost, efficiencyCap) : 0;
    return {
      adjustment,
      status: adjustment >= 10 ? "Inverted Boost" : adjustment > 0 ? "Inverted Support" : inversionEligible ? "Inverted Neutral" : "Inverted Standby",
      reason: inversionEligible
        ? `Harvest ${reversalHarvestStability}% · Failure Benefit ${continuationFailureBenefit}% · DPI Recovery ${dpiRecoveryEfficiency}%`
        : "Inverted not armed by DPI",
      metrics: { continuationFailureBenefit, reversalHarvestStability, dpiRecoveryEfficiency, compressionRisk },
    };
  }

  const markovTrials: { predicted: 0 | 1; actual: 0 | 1 }[] = [];
  for (let i = Math.max(6, history.length - 14); i < history.length; i += 1) {
    const prior = history.slice(0, i);
    const forecastRow = markovForecast(prior);
    if (!forecastRow.group) continue;
    const predicted = getSideBitFromGroup(forecastRow.group);
    if (predicted === null) continue;
    markovTrials.push({ predicted, actual: getBaccaratOutcomeBit(history[i]) });
  }
  const markovWins = markovTrials.filter((row) => row.predicted === row.actual).length;
  const markovAccuracy = markovTrials.length ? Math.round((markovWins / markovTrials.length) * 100) : 0;
  const adjustment = markovTrials.length >= 6 && markovAccuracy >= 70 ? 8 : markovTrials.length >= 6 && markovAccuracy >= 60 ? 5 : markovTrials.length >= 6 && markovAccuracy <= 42 ? -12 : markovTrials.length >= 6 && markovAccuracy <= 50 ? -6 : 0;

  return {
    adjustment,
    status: adjustment > 0 ? "Markov Boost" : adjustment < 0 ? "Markov Downgrade" : markovTrials.length ? "Markov Neutral" : "Markov Waiting",
    reason: markovTrials.length ? `Transition reliability ${markovAccuracy}%` : "Markov memory building",
    metrics: { markovAccuracy, trials: markovTrials.length, flips },
  };
}

function getPulseSevenComponentState(
  history: Step[],
  engine: PulseEngineSource,
  forecastGroup: GroupKey | null,
  engineConfidence: number
) {
  const stability = getPulsePersistenceStability(history, forecastGroup);
  const entropyGov = getPulseSideEntropy(history);
  const lossProtection = getPulseLossProtection(history, engine);
  const consensus = getPulseConsensusReEntry(history, engine, forecastGroup);
  const cadence =
    engine === "BB_STRAIGHT" || engine === "BB_INVERTED" || engine === "CADENCE"
      ? getMarkovAssistForBbPulse(history, engine)
      : getPulseAuthorityForStandaloneMarkov(history);

  const engineSpecificModulation = getPulseEngineSpecificConfidenceModulation(history, engine);
  const preliminaryConfidenceAdjustment =
    consensus.lift -
    stability.penalty -
    entropyGov.penalty -
    lossProtection.penalty -
    Number(cadence?.penalty ?? 0) +
    engineSpecificModulation.adjustment;
  const preliminaryConfidence = Math.max(0, Math.min(100, Math.round(engineConfidence + preliminaryConfidenceAdjustment)));
  const structuralDpiState = getDpiStructuralPulseState(history, preliminaryConfidence);

  const confidenceAdjustment = preliminaryConfidenceAdjustment - structuralDpiState.penalty;

  const rawConfidence = Math.max(0, Math.min(100, Math.round(engineConfidence + confidenceAdjustment)));
  // STRUCTURAL PULSE GATE
  // Straight can still soft-floor normal confidence, but not when DPI is still
  // degrading. This prevents premature re-entry after a confidence rebound while
  // structural pressure is still worsening.
  const severeObserve =
    ((!!lossProtection.observe || !!cadence?.observe) && !consensus.reEntryReady) ||
    structuralDpiState.forceObserve;
  const confidence = engine === "BB_STRAIGHT" && !severeObserve ? Math.max(52, rawConfidence) : rawConfidence;
  const observe = severeObserve;
  const tier = getPulseTierFromConfidence(confidence, observe);
  const executionFilter = {
    allow: !observe,
    state: observe ? "OBSERVE" : tier === "Weak Prediction" ? "WEAK" : "EXECUTE",
    reason: observe
      ? `${structuralDpiState.forceObserve ? structuralDpiState.status : lossProtection.status} · ${stability.status}`
      : `${tier} · ${structuralDpiState.status}`,
  };

  return {
    persistenceStability: stability,
    confidenceModulation: {
      baseConfidence: engineConfidence,
      adjustment: confidenceAdjustment,
      finalConfidence: confidence,
      engineSpecificAdjustment: engineSpecificModulation.adjustment,
      engineSpecificStatus: engineSpecificModulation.status,
      engineSpecificReason: engineSpecificModulation.reason,
      engineSpecificMetrics: engineSpecificModulation.metrics,
      structuralDpiPenalty: structuralDpiState.penalty,
    },
    adaptiveTier: { tier, confidence },
    executionFiltering: executionFilter,
    lossProtection,
    entropyGovernance: entropyGov,
    consensusReEntry: consensus,
    cadenceAssist: cadence,
    structuralDpiState,
    observe,
    confidence,
    tier,
  };
}



const BB_STRAIGHT_PULSE_SPREAD_OVERRIDE_THRESHOLD = 40;

function baccaratSideToBaseGroup(side: "P" | "B"): GroupKey {
  return side === "P" ? "BHE" : "RHE";
}

function getSignalDpiSpreadValue(signalConfidence: number, dpiValue: number) {
  // Must match the visible Signal & DPI Overview panel: Spread (|S - D|).
  return Math.abs(Math.max(0, Math.min(100, Math.round(Number(signalConfidence || 0)))) - Math.abs(dpiValue));
}

function getRowSignalDpiSpread(row: Step) {
  const rowDpi = typeof row.dpi === "number" ? row.dpi : 0;
  return getSignalDpiSpreadValue(Number(row.confidence || 0), rowDpi);
}

function getBbStraightPulseSpreadOverride(history: Step[], currentSignalConfidence?: number) {
  // BB STRAIGHT + PULSE ONLY SPREAD OVERRIDE
  // When the visible Signal & DPI Spread drops below 40, the next BB Straight + Pulse
  // forecast follows a side-only PBB/PBB/PBB cadence until the spread returns to 40+.
  if (!history.length) {
    return {
      active: false,
      threshold: BB_STRAIGHT_PULSE_SPREAD_OVERRIDE_THRESHOLD,
      spread: null as number | null,
      breakSpin: null as number | null,
      breakOutcome: null as null | "P" | "B",
      patternIndex: 0,
      side: null as null | "P" | "B",
      group: null as GroupKey | null,
      pattern: "PBBPBBPBBP",
    };
  }

  // IMPORTANT: Signal State and the Signal & DPI Overview panel show the CURRENT
  // post-hand Pulse confidence, not the confidence stored on the last settled row.
  // The override must therefore use the same live Signal-DPI spread seen on screen.
  const currentDpi = getDpiValue(history);
  const latestSpread = typeof currentSignalConfidence === "number"
    ? getSignalDpiSpreadValue(currentSignalConfidence, currentDpi)
    : getRowSignalDpiSpread(history[history.length - 1]);

  if (latestSpread >= BB_STRAIGHT_PULSE_SPREAD_OVERRIDE_THRESHOLD) {
    return {
      active: false,
      threshold: BB_STRAIGHT_PULSE_SPREAD_OVERRIDE_THRESHOLD,
      spread: latestSpread,
      breakSpin: null as number | null,
      breakOutcome: null as null | "P" | "B",
      patternIndex: 0,
      side: null as null | "P" | "B",
      group: null as GroupKey | null,
      pattern: "PBBPBBPBBP",
    };
  }

  let breakIndex = history.length - 1;

  // If the live spread is below 40 but the last settled row does not show below
  // 40, then the latest outcome is the hand that broke the live spread. That
  // means the NEXT forecast is pattern index 0.
  if (getRowSignalDpiSpread(history[history.length - 1]) < BB_STRAIGHT_PULSE_SPREAD_OVERRIDE_THRESHOLD) {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (getRowSignalDpiSpread(history[i]) >= BB_STRAIGHT_PULSE_SPREAD_OVERRIDE_THRESHOLD) {
        breakIndex = i + 1;
        break;
      }
      breakIndex = i;
    }
  }

  const breakRow = history[breakIndex];
  const breakOutcome = spinToBaccaratOutcome(breakRow.outcome) as "P" | "B";
  const patternWhenBankerBreaks: ("P" | "B")[] = ["P", "B", "B"];
  const patternWhenPlayerBreaks: ("P" | "B")[] = ["B", "B", "P"];
  const pattern = breakOutcome === "B" ? patternWhenBankerBreaks : patternWhenPlayerBreaks;
  const patternIndex = Math.max(0, history.length - breakIndex - 1);
  const side = pattern[patternIndex % pattern.length];
  const group = baccaratSideToBaseGroup(side);

  return {
    active: true,
    threshold: BB_STRAIGHT_PULSE_SPREAD_OVERRIDE_THRESHOLD,
    spread: latestSpread,
    breakSpin: breakRow.spin,
    breakOutcome,
    patternIndex,
    side,
    group,
    pattern: breakOutcome === "B" ? "PBBPBBPBBP" : "BBPBBPBBPB",
  };
}

function applyPulseEnhancerToDecision(decision: any, pulse: any, pulseEnabled: boolean, history: Step[] = []) {
  // ENGINE-SPECIFIC BACCARAT PULSE — 7 COMPONENTS ONLY
  // Pulse is attached only when the Pulse button is ON. Standalone BB Straight,
  // BB Inverted, Markov, and DPI calculations are not modified when Pulse is OFF.
  if (!pulseEnabled || !decision?.group || decision?.source === "NONE") return decision;

  const source = decision.source as PulseEngineSource;
  if (source !== "BB_STRAIGHT" && source !== "BB_INVERTED" && source !== "MARKOV" && source !== "CADENCE") return decision;

  const rawGroup = decision.group as GroupKey;
  const rawNumbers = Array.isArray(decision.numbers) && decision.numbers.length ? decision.numbers : GROUPS[rawGroup];
  const rawEngineConfidence = Number(decision.confidence ?? 0);
  const engineConfidence =
    (source === "BB_STRAIGHT" || source === "BB_INVERTED") && rawEngineConfidence <= 0
      ? 65
      : rawEngineConfidence || 58;

  const selectedSide = getBaccaratSideFromForecastGroup(rawGroup);
  const seven = getPulseSevenComponentState(history, source, rawGroup, engineConfidence);
  const pulseConfidence = seven.confidence;
  const pulseTier = getPulseTierFromConfidence(pulseConfidence, seven.observe);
  const pulseObserve = seven.observe;
  const spreadOverride = source === "BB_STRAIGHT" ? getBbStraightPulseSpreadOverride(history, pulseConfidence) : null;
  const finalGroup = spreadOverride?.active && spreadOverride.group ? spreadOverride.group : rawGroup;
  const finalNumbers = finalGroup ? GROUPS[finalGroup] : rawNumbers;

  return {
    ...decision,
    originalGroup: rawGroup,
    forecastGroup: finalGroup,
    group: finalGroup,
    numbers: finalNumbers,
    confidence: pulseConfidence,
    tier: pulseTier,
    pulseEnhanced: true,
    executionState: seven.executionFiltering.state,
    pulseGate: { allow: seven.executionFiltering.allow, reason: seven.executionFiltering.reason },
    pulseDiagnostics: {
      architecture: "PULSE_7_COMPONENT_REBALANCED_NO_UNIFIED_PRESSURE",
      selectedEngine: source,
      rawForecast: rawGroup,
      finalForecast: finalGroup,
      spreadOverride: spreadOverride
        ? {
            active: spreadOverride.active,
            threshold: spreadOverride.threshold,
            spread: spreadOverride.spread,
            breakSpin: spreadOverride.breakSpin,
            breakOutcome: spreadOverride.breakOutcome,
            patternIndex: spreadOverride.patternIndex,
            patternSide: spreadOverride.side,
            pattern: spreadOverride.pattern,
          }
        : null,
      selectedSide: getBaccaratSideFromForecastGroup(finalGroup),
      originalSelectedSide: selectedSide,
      engineConfidence,
      enhancedConfidence: pulseConfidence,
      observe: pulseObserve,
      persistenceStability: seven.persistenceStability,
      confidenceModulation: {
        ...seven.confidenceModulation,
      },
      executionFiltering: seven.executionFiltering,
      adaptiveTier: seven.adaptiveTier,
      lossProtection: seven.lossProtection,
      entropyGovernance: seven.entropyGovernance,
      consensusReEntry: seven.consensusReEntry,
      cadenceAssist: seven.cadenceAssist,
      structuralDpiState: seven.structuralDpiState,
      activeSystems: {
        persistenceStabilityAnalysis: true,
        confidenceModulation: true,
        executionFiltering: true,
        adaptiveTierEngine: true,
        lossProtection: true,
        simplifiedEntropyGovernance: true,
        consensusReEntryGovernance: true,
        engineSpecificRouting: true,
        pulseReplayIntegration: true,
        markovAssistForBbEngines: source === "BB_STRAIGHT" || source === "BB_INVERTED",
        standaloneMarkovPulseAuthority: source === "MARKOV",
        noDuplicateMarkovPrediction: source === "MARKOV",
        unifiedStructuralPressure: false,
        shadowRecovery: false,
        clickableStreakAnalysis: false,
        streakAnalysisLayer: "Detached Analytics/Research",
      },
      removedSystems: {
        unifiedStructuralPressure: true,
        shadowRecovery: true,
        hmm: true,
        changePointDetection: true,
        bbStraightTrapDetection: true,
        bbInvertedInstability: true,
        structuralDriftDetection: true,
        lossAccelerationDetection: true,
        weakDimensionSubstitution: true,
        tdaCompression: true,
        rvGovernance: true,
        rouletteAxisGovernance: true,
        forecastVoting: true,
      },
    },
    reason: `${decision.reason || "Engine forecast"} · Pulse 7-component layer: ${seven.executionFiltering.reason}${spreadOverride?.active ? ` · BB Straight Spread Override ${spreadOverride.pattern} active below ${spreadOverride.threshold} · Forced ${formatBaccaratSideShort(spreadOverride.side)}` : ""}`,
  };
}

function shouldExecuteTier(tier: string, source: string, settings: TierExecutionSettings = DEFAULT_TIER_EXECUTION, rv?: any, entropyExtreme?: boolean) {
  // PULSE controls execution through structural tier and pulseGate.
  // Entropy is reduced to a warning/input and does not directionalAdvisory by itself.
  if (source === "NONE") return false;

  if (tier === "Directional Observe") return settings.executeObservation;
  if (tier === "Weak Prediction") return settings.executeWeak;

  return true;
}


function getTierExecutionNote(tier: string, group: GroupKey | null, numbers: SpinValue[]) {
  const groupText = group ? ` ${group}` : "";
  const numbersText = numbers.length ? ` · Numbers ${numbers.join(", ")}` : "";
  if (tier === "Directional Observe") return `Directional Observe${groupText} · Advisory only · not settled as W/L${numbersText}`;
  if (tier === "Weak Prediction") return `Weak Prediction${groupText} · Weak execution OFF · not settled as W/L${numbersText}`;
  return `${tier}${groupText}${numbersText}`;
}

function capUnitByLimits(rawUnit: number, executionBasketSize: number, tableLimit: number, perNumberLimit: number) {
  const basketSize = Math.max(1, executionBasketSize);
  const tableUnitCap = Math.max(1, Math.floor(Math.max(1, tableLimit) / basketSize));
  // BACCARAT STRATEGY LIMIT LOCK
  // Baccarat side execution is not a roulette per-number wager. The old
  // perNumberLimit cap was silently capping Martingale at 300, preventing a
  // normal recovery win from restoring prior losses. Keep table limit as the
  // active cap for Baccarat side strategies. The perNumberLimit argument is
  // retained for compatibility but is not used to cap side-bet strategies.
  void perNumberLimit;
  return Math.max(1, Math.floor(Math.min(rawUnit, tableUnitCap)));
}

function getUnitBet(
  strategy: Strategy,
  baseUnit: number,
  confidence: number,
  history: Step[],
  executionBasketSize = 1,
  bankroll = 0,
  tableLimit = DEFAULT_TABLE_LIMIT,
  perNumberLimit = DEFAULT_PER_NUMBER_LIMIT,
  exposureCapPercent = DEFAULT_EXPOSURE_CAP_PERCENT
) {
  // Strategy progression must be local to this replay and based only on
  // actually settled wagers. This fixes Martingale when Pulse/diagnostic rows
  // create PUSH/No Bet hands between resolved wins and losses.
  const lossStreak = getStrategyResolvedLossStreak(history);
  const winStreak = getStrategyResolvedWinStreak(history);
  const dpiPressure = Math.abs(getDpiValue(history));
  let rawUnit = baseUnit;

  if (strategy === "Martingale") {
    // TRUE MARTINGALE RECOVERY
    // Next real bet = unresolved strategy losses since the last real win + base.
    // With base 25, L/L/W becomes -25, -50, +100 = +25. Push/No Bet rows do
    // not advance, reset, or reduce the open-loss amount.
    const openLossExposure = getStrategyOpenLossExposure(history);
    rawUnit = openLossExposure > 0 ? openLossExposure + baseUnit : baseUnit;
  } else if (strategy === "Step Recovery") {
    // Controlled staged recovery based on this strategy replay's own loss depth.
    if (lossStreak <= 0) rawUnit = baseUnit;
    else if (lossStreak <= 2) rawUnit = baseUnit * 2;
    else if (lossStreak <= 5) rawUnit = baseUnit * 3;
    else rawUnit = baseUnit * 4;
  } else if (strategy === "ETR" || strategy === "ETR-C") {
    // ETR / ETR-C rebuilt from the clean recovery-state model:
    // flat confirmation arms recovery; the following hand begins recovery.
    rawUnit = getEtrRecoveryPlan(strategy, baseUnit, history).rawUnit;
  } else if (strategy === "Fibonacci") {
    const fib = [1, 1, 2, 3, 5, 8, 13, 21];
    rawUnit = baseUnit * fib[getFibonacciProgressionIndex(history)];
  } else if (strategy === "D'Alembert") {
    rawUnit = baseUnit * (1 + getDAlembertProgressionIndex(history));
  } else if (strategy === "ReverseD'Alembert") {
    rawUnit = baseUnit * (1 + getReverseDAlembertProgressionIndex(history));
  } else if (strategy === "1-3-2-6") {
    rawUnit = baseUnit * getOneThreeTwoSixMultiplier(getOneThreeTwoSixStep(history));
  } else if (strategy === "Exposure Cap") {
    // Exposure Cap must cap the normal base unit; it must never increase the
    // wager above base because bankroll is large.
    const maxUnitByBankroll = Math.max(1, Math.floor((bankroll > 0 ? bankroll : DEFAULT_STARTING_BANKROLL) * (Math.max(0.1, exposureCapPercent) / 100)));
    rawUnit = Math.min(baseUnit, maxUnitByBankroll);
  } else if (strategy === "Progressive Confidence") {
    if (confidence >= 85) rawUnit = baseUnit * 4;
    else if (confidence >= 75) rawUnit = baseUnit * 3;
    else if (confidence >= 65) rawUnit = baseUnit * 2;
  }

  return capUnitByLimits(rawUnit, executionBasketSize, tableLimit, perNumberLimit);
}

function uniqueNumbers(values: SpinValue[]) {
  return Array.from(new Set(values.map(String))).map((v) => (v === "00" ? "00" : Number(v))) as SpinValue[];
}

function getBaseWheelNeighbors(group: GroupKey | null) {
  return group ? WHEEL_NEIGHBORS[group] ?? [] : [];
}

function getPulseOnlyNeighbors(group: GroupKey | null, source?: string) {
  // Engine-agnostic execution overlay.
  // This does not modify BB/Markov forecast logic; it only supplies expansion numbers.
  if (!group) return [];
  return PULSE_ONLY_NEIGHBORS[group] ?? [];
}

function getNeighborExpansionNumbers(group: GroupKey | null, source?: string) {
  // Baccarat Side Execution uses only the neighbor expansion map.
  // It intentionally does NOT include Baccarat Edge Handling numbers.
  return getPulseOnlyNeighbors(group, source);
}

function getEdgeExpansionNumbers(group: GroupKey | null) {
  // Baccarat Edge Handling uses only the one-number edge map.
  // It intentionally does NOT include Baccarat Side Execution numbers.
  return group ? EDGE_EXPANSION[group] ?? [] : [];
}

function getOverlayNumbersForExecutionMode(group: GroupKey | null, executionMode: ExecutionMode, source?: string) {
  // Baccarat Execution Overlay removed. No expanded overlay numbers are connected.
  return [] as SpinValue[];
}

function getWheelNeighbors(group: GroupKey | null, source?: string, executionMode: ExecutionMode = "Stream Direct") {
  return [] as SpinValue[];
}

function getExecutionNumbers(group: GroupKey | null, executionMode: ExecutionMode, source?: string, decision?: any) {
  if (!group) return [];
  return getCoreExecutionNumbers(group, source, decision, "Stream Direct");
}

function getWheelAlignment(group: GroupKey | null, executionMode: ExecutionMode, source?: string) {
  return group ? 100 : 0;
}

function hasStreamConflict(group: GroupKey | null, executionMode: ExecutionMode, source?: string) {
  return false;
}



function shouldBet(strategy: Strategy, confidence: number, pulseEnabled: boolean, group: GroupKey | null) {
  if (!group) return false;

  switch (strategy) {
    case "Confidence-75":
      return confidence >= 75;

    case "Confidence-65":
      return confidence >= 65;

    case "Progressive Confidence":
      return confidence >= (pulseEnabled ? 58 : 50);

    default:
      return true;
  }
}

function getBaccaratSideFromForecastGroup(group?: GroupKey | null): BaccaratOutcome | null {
  if (!group) return null;
  return group[0] === "B" ? "P" : "B";
}

function getBaccaratSideExecutionNumbers(group?: GroupKey | null): SpinValue[] {
  const side = getBaccaratSideFromForecastGroup(group);
  return side ? [baccaratOutcomeToSpin(side)] : [];
}

function isBaccaratForecastHit(group: GroupKey | null | undefined, outcome: SpinValue) {
  const side = getBaccaratSideFromForecastGroup(group);
  if (!side) return false;
  return side === spinToBaccaratOutcome(outcome);
}


function getAutoRunLockedDpiAfterOutcome(historyBeforeHand: Step[], outcomeGroup: GroupKey) {
  // AUTORUN DPI LOCK
  // AutoRun must use the exact same locked BB Straight-reference DPI as Manual mode.
  // It must process every raw outcome even when the row is Push / Observe / No Bet.
  return getDpiValueAfterOutcome(historyBeforeHand, outcomeGroup);
}

function verifyLockedDpiExample_BBPBBP() {
  // Locked reference example:
  // B B P B B P = 1 1 0 1 1 0
  // Expected DPI = -1, -2, -3, -4, -5, -6
  const groups: GroupKey[] = ["RHE", "RHE", "BHE", "RHE", "RHE", "BHE"];
  const rows: Step[] = [];
  const values: number[] = [];
  groups.forEach((outcomeGroup) => {
    values.push(getAutoRunLockedDpiAfterOutcome(rows, outcomeGroup));
    rows.push({ outcomeGroup } as Step);
  });
  return values;
}

function settleSpin(history: Step[], outcome: SpinValue, baseUnit: number, startingBankroll: number, strategy: Strategy, pulseEnabled: boolean, bbStraightEnabled: boolean, bbInvertedEnabled: boolean, executionMode: ExecutionMode = "Stream Direct", tableLimit = DEFAULT_TABLE_LIMIT, perNumberLimit = DEFAULT_PER_NUMBER_LIMIT, tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION, markovEnabled = false, exposureCapPercent = DEFAULT_EXPOSURE_CAP_PERCENT, cadenceEnabled = false, scoutEnabled = false): Step {
  const f = getActiveDecision(history, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, markovEnabled, cadenceEnabled, scoutEnabled);
  const bankroll = history.at(-1)?.bankroll ?? startingBankroll;
  const executionAllowed = shouldExecuteTier(f.tier, f.source, tierExecution, (f as any).rv, (f as any).entropyExtreme);
  const dimensionTDAAllowed = true; // TDA diagnostic only, not a hard gate.

  // ENGINE DECLINE HALT — live condition, re-evaluated every hand, not a
  // permanent ratchet. Checked using only PRIOR history (never this hand's
  // own outcome), matching the "decide before observing" principle used
  // everywhere else in this file. Auto-releases the moment any engine shows
  // upward movement over the last ENGINE_RECOVERY_LOOKBACK hands, even if
  // it's still below its own peak — see getEngineHaltState.
  const haltState = getEngineHaltState(history);
  const sessionEnded = haltState.haltActive;

  const active =
    !sessionEnded &&
    f.source !== "NONE" &&
    executionAllowed &&
    (
      !(f as any).pulseGate ||
      (f as any).pulseGate.allow ||
      !(f as any).observe
    );
  const lockedPreviewGroup = f.group;
  // BACCARAT SETTLEMENT LOCK
  // Baccarat is one-dimensional: Player vs Banker.
  // Charts and engine performance must settle on the forecast side, not on roulette-style group baskets.
  const previewNumbers = lockedPreviewGroup ? getBaccaratSideExecutionNumbers(lockedPreviewGroup) : [];
  const streamNumbers = previewNumbers;
  const wheelNeighbors: SpinValue[] = [];
  const numbers = previewNumbers;
  const activeBasket = previewNumbers;
  const etrPlan = getEtrRecoveryPlan(strategy, baseUnit, history);
  const unit = active ? getUnitBet(strategy, baseUnit, f.confidence, history, 1, bankroll, tableLimit, perNumberLimit, exposureCapPercent) : 0;
  const exposure = active ? unit : 0;

  // FINAL FORECAST / SETTLEMENT LOCK
  // The active forecast group is captured once before settlement.
  // Core settlement compares the outcome's group to that exact forecast group.
  // Overlay settlement remains separate and only applies to wheel-neighbor coverage.
  // SHADOW FORECAST LOCK
  // Keep the selected engine forecast attached to the row even when Pulse says No Bet.
  // Real bankroll settlement still requires active=true, but Pulse recovery diagnostics
  // need the would-have-won / would-have-lost result to recover from filtered states.
  const lockedForecastGroup = f.source !== "NONE" ? f.group : null;
  const lockedOutcomeGroup = numberToGroup(outcome);

  const neighborExpansionNumbers = active && lockedForecastGroup
    ? getNeighborExpansionNumbers(lockedForecastGroup, f.source)
    : [];
  const edgeExpansionNumbers = active && lockedForecastGroup
    ? getEdgeExpansionNumbers(lockedForecastGroup)
    : [];

  const overlayAllowed = executionMode !== "Stream Direct";

  const activeOverlayNeighbors =
    executionMode === "Baccarat Side Execution"
      ? neighborExpansionNumbers
      : executionMode === "Baccarat Edge Handling"
      ? edgeExpansionNumbers
      : executionMode === "Hybrid Coverage"
      ? uniqueNumbers([...neighborExpansionNumbers, ...edgeExpansionNumbers])
      : [];

  // EXECUTION-BASKET SETTLEMENT LOCK
  // Stream Direct settles against the core group only.
  // Baccarat Side Execution / Baccarat Edge Handling / Hybrid Coverage settle against the exact expanded execution basket.
  // This prevents Baccarat Side Execution hits, such as BHE + 7, from being recorded as losses/pushes.
  const executionBasket = active ? activeBasket : [];
  const coreHit = !!lockedForecastGroup ? isBaccaratForecastHit(lockedForecastGroup, outcome) : false;
  const overlayHit = false;
  const combinedHit = active && coreHit;
  // coreResult is the selected engine's shadow settlement. It is win/loss even
  // during No Bet, while result/net/bankroll remain push/0 when no real bet occurs.
  let coreResult: Result = lockedForecastGroup ? (coreHit ? "win" : "loss") : "push";
  const overlayResult: Result = "push";
  let result: Result = "push";
  let net = 0;

  // RELAXED PUSH LOGIC
  // Any executable forecast must settle WIN/LOSS.
  // PUSH only occurs during true HOLD / Observe / no-forecast states — and,
  // per a bug found and fixed July 28, during any other state where `active`
  // is false (no real bet placed), including the engine-decline halt. Before
  // this fix, `executableForecast` didn't check `active`, so a held/halted
  // hand's shadow forecast-vs-outcome match could still force result to
  // "win"/"loss" using the correctly-zeroed exposure, producing a wrong
  // "LOSS" label on a $0 hand.
  const executableForecast = active && !!lockedForecastGroup && f.source !== "NONE" && executionAllowed;

  if (executableForecast) {
    if (combinedHit) {
      result = "win";
      net = unit;
    } else {
      result = "loss";
      net = -exposure;
    }
  }


  const etrStateAfter = active ? getEtrStateAfterCurrentHand(strategy, history, result, etrPlan.etrBetType, etrPlan.recoveryStep) : getLastEtrState(history);
  const etrNote =
    strategy === "ETR" || strategy === "ETR-C"
      ? etrPlan.etrBetType === "recovery"
        ? ` · ${strategy} Recovery Step ${etrPlan.recoveryStep}${result === "win" ? " Win" : result === "loss" ? " Loss" : ""}`
        : etrStateAfter === "armed"
        ? ` · ${strategy} Armed`
        : ""
      : "";
  const oneThreeTwoSixStep = strategy === "1-3-2-6" && active ? getOneThreeTwoSixStep(history) : 0;
  const oneThreeTwoSixNote = strategy === "1-3-2-6" && active ? ` · 1-3-2-6 Step ${oneThreeTwoSixStep + 1} (${getOneThreeTwoSixMultiplier(oneThreeTwoSixStep)}x)` : "";

  const rowPulseDiagnostics = (f as any).pulseDiagnostics ?? null;
  const settledForecastGroup: GroupKey | null = lockedForecastGroup;

  return {
    spin: history.length + 1,
    outcome,
    outcomeGroup: lockedOutcomeGroup,
    predictedGroup: settledForecastGroup,
    predictedNumbers: settledForecastGroup ? getBaccaratSideExecutionNumbers(settledForecastGroup) : numbers,
    forecastGroup: settledForecastGroup,
    forecastNumbers: settledForecastGroup ? GROUPS[settledForecastGroup] : [],
    confidence: f.confidence,
      dpi: getAutoRunLockedDpiAfterOutcome(history, lockedOutcomeGroup),
    tier: f.tier,
    result,
    unitBet: unit,
    exposure,
    net,
    bankroll: bankroll + net,
    note: sessionEnded
      ? "PAUSED — all four engines below their own peak, none trending up yet"
      : active
      ? `${formatBaccaratEngineLabel(f.source, f.tier)} · Bet ${formatGroupAsBaccaratShort(settledForecastGroup)}${f.source === "PULSE" && (f as any).dimensionTDA?.compressed ? " · Compression" : ""}${f.source === "PULSE" ? ` · Conf ${f.confidence}%` : ""}${overlayHit ? " · Overlay Hit" : ""}${hasStreamConflict(lockedForecastGroup, executionMode, f.source) ? " · Stream Conflict" : ""}${etrNote}${oneThreeTwoSixNote}`
      : !dimensionTDAAllowed
      ? `No Bet · Baccarat alignment below ${((f as any).dimensionTDA?.min ?? DEFAULT_DIMENSION_GATE_MIN)}%`
      : f.source === "PULSE" && (f as any).entropyExtreme
      ? `No Bet · Baccarat side randomness ${((f as any).entropyValue ?? 0)}%`
      : (f as any).pulseEnhanced && lockedForecastGroup
      ? `PULSE No Bet · Shadow ${coreResult.toUpperCase()} · ${formatBaccaratEngineLabel(f.source, f.tier)} bet ${formatGroupAsBaccaratShort(lockedForecastGroup)} · Conf ${f.confidence}%`
      : getTierExecutionNote(f.tier, f.group, f.group ? GROUPS[f.group] : []),
    executionMode,
    coreResult,
    overlayResult,
    wheelNeighbors: [],
    wheelAlignment: getWheelAlignment(f.group, executionMode, f.source),
    streamConflict: hasStreamConflict(f.group, executionMode, f.source),
    pulseGate: (f as any).pulseGate ?? null,
    pulseDiagnostics: rowPulseDiagnostics,
    etrStateAfter,
    etrBetType: active ? etrPlan.etrBetType : "flat",
    recoveryStep: active ? etrPlan.recoveryStep : 0,
    oneThreeTwoSixStep,
    sessionEnded,
  };
}



function getShadowDecision(history: Step[], engine: ShadowEngine) {
  const mode =
    engine === "PULSE"
      ? "Pulse Shadow"
      : engine === "BB_STRAIGHT"
      ? "Straight BB Shadow"
      : engine === "BB_INVERTED"
      ? "Inverted BB Shadow"
      : "Markov Shadow";

  if (engine === "PULSE") {
    const pulse = getNeuralCalibratedPulse(history);
    return {
      ...pulse,
      source: "PULSE" as const,
      mode,
    };
  }

  if (engine === "BB_STRAIGHT") {
    return {
      ...bbStraightForecast(history),
      source: "BB_STRAIGHT" as const,
      mode,
    };
  }

  if (engine === "MARKOV") {
    return {
      ...markovForecast(history),
      source: "MARKOV" as const,
      mode,
    };
  }

  return {
    ...bbInvertedForecast(history),
    source: "BB_INVERTED" as const,
    mode,
  };
}

function settleSpinShadow(history: Step[], outcome: SpinValue, baseUnit: number, startingBankroll: number, strategy: Strategy, engine: ShadowEngine, executionMode: ExecutionMode = "Stream Direct", tableLimit = DEFAULT_TABLE_LIMIT, perNumberLimit = DEFAULT_PER_NUMBER_LIMIT, tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION, exposureCapPercent = DEFAULT_EXPOSURE_CAP_PERCENT): Step {
  const f = getShadowDecision(history, engine);
  const bankroll = history.at(-1)?.bankroll ?? startingBankroll;
  const executionAllowed = shouldExecuteTier(f.tier, f.source, tierExecution, (f as any).rv, (f as any).entropyExtreme);
  const dimensionTDAAllowed = true; // TDA diagnostic only, not a hard gate.
  const active = shouldBet(strategy, f.confidence, engine === "PULSE", f.group) && executionAllowed ;
  // BACCARAT SETTLEMENT LOCK
  // Baccarat is one-dimensional: Player vs Banker.
  // Charts and engine performance must settle on the forecast side, not on roulette-style group baskets.
  const previewNumbers = f.group ? getBaccaratSideExecutionNumbers(f.group) : [];
  const streamNumbers = previewNumbers;
  const wheelNeighbors: SpinValue[] = [];
  const numbers = previewNumbers;
  const activeBasket = previewNumbers;
  const etrPlan = getEtrRecoveryPlan(strategy, baseUnit, history);
  const unit = active ? getUnitBet(strategy, baseUnit, f.confidence, history, 1, bankroll, tableLimit, perNumberLimit, exposureCapPercent) : 0;
  const exposure = active ? unit : 0;

  // FINAL FORECAST / SETTLEMENT LOCK
  // The active forecast group is captured once before settlement.
  // Core settlement compares the outcome's group to that exact forecast group.
  // Overlay settlement remains separate and only applies to wheel-neighbor coverage.
  // SHADOW FORECAST LOCK
  // Keep the selected engine forecast attached to the row even when Pulse says No Bet.
  // Real bankroll settlement still requires active=true, but Pulse recovery diagnostics
  // need the would-have-won / would-have-lost result to recover from filtered states.
  const lockedForecastGroup = f.source !== "NONE" ? f.group : null;
  const lockedOutcomeGroup = numberToGroup(outcome);

  const neighborExpansionNumbers = active && lockedForecastGroup
    ? getNeighborExpansionNumbers(lockedForecastGroup, f.source)
    : [];
  const edgeExpansionNumbers = active && lockedForecastGroup
    ? getEdgeExpansionNumbers(lockedForecastGroup)
    : [];

  const overlayAllowed = executionMode !== "Stream Direct";

  const activeOverlayNeighbors =
    executionMode === "Baccarat Side Execution"
      ? neighborExpansionNumbers
      : executionMode === "Baccarat Edge Handling"
      ? edgeExpansionNumbers
      : executionMode === "Hybrid Coverage"
      ? uniqueNumbers([...neighborExpansionNumbers, ...edgeExpansionNumbers])
      : [];

  // EXECUTION-BASKET SETTLEMENT LOCK
  // Stream Direct settles against the core group only.
  // Baccarat Side Execution / Baccarat Edge Handling / Hybrid Coverage settle against the exact expanded execution basket.
  // This prevents Baccarat Side Execution hits, such as BHE + 7, from being recorded as losses/pushes.
  const executionBasket = active ? activeBasket : [];
  const coreHit = !!lockedForecastGroup ? isBaccaratForecastHit(lockedForecastGroup, outcome) : false;
  const overlayHit = false;
  const combinedHit = active && coreHit;
  // coreResult is the selected engine's shadow settlement. It is win/loss even
  // during No Bet, while result/net/bankroll remain push/0 when no real bet occurs.
  const coreResult: Result = lockedForecastGroup ? (coreHit ? "win" : "loss") : "push";
  const overlayResult: Result = "push";
  let result: Result = "push";
  let net = 0;

  // RELAXED PUSH LOGIC
  // Any executable forecast must settle WIN/LOSS.
  // PUSH only occurs during true HOLD / Observe / no-forecast states.
  const executableForecast =
    !!lockedForecastGroup &&
    f.source !== "NONE" &&
    executionAllowed;

  if (executableForecast) {
    if (combinedHit) {
      result = "win";
      net = unit;
    } else {
      result = "loss";
      net = -exposure;
    }
  }

  const etrStateAfter = active ? getEtrStateAfterCurrentHand(strategy, history, result, etrPlan.etrBetType, etrPlan.recoveryStep) : getLastEtrState(history);
  const etrNote =
    strategy === "ETR" || strategy === "ETR-C"
      ? etrPlan.etrBetType === "recovery"
        ? ` · ${strategy} Recovery Step ${etrPlan.recoveryStep}${result === "win" ? " Win" : result === "loss" ? " Loss" : ""}`
        : etrStateAfter === "armed"
        ? ` · ${strategy} Armed`
        : ""
      : "";
  const oneThreeTwoSixStep = strategy === "1-3-2-6" && active ? getOneThreeTwoSixStep(history) : 0;
  const oneThreeTwoSixNote = strategy === "1-3-2-6" && active ? ` · 1-3-2-6 Step ${oneThreeTwoSixStep + 1} (${getOneThreeTwoSixMultiplier(oneThreeTwoSixStep)}x)` : "";

  return {
    spin: history.length + 1,
    outcome,
    outcomeGroup: lockedOutcomeGroup,
    predictedGroup: lockedForecastGroup,
    predictedNumbers: lockedForecastGroup ? getBaccaratSideExecutionNumbers(lockedForecastGroup) : numbers,
    forecastGroup: lockedForecastGroup,
    forecastNumbers: lockedForecastGroup ? GROUPS[lockedForecastGroup] : [],
    confidence: f.confidence,
    tier: f.tier,
    result,
    unitBet: unit,
    exposure,
    net,
    bankroll: bankroll + net,
    note: active
      ? `${formatBaccaratEngineLabel(f.source, f.tier)} shadow · Bet ${formatGroupAsBaccaratShort(lockedForecastGroup)}${f.source === "PULSE" && (f as any).dimensionTDA?.compressed ? " · Compression" : ""}${overlayHit ? " · Overlay Hit" : ""}${etrNote}${oneThreeTwoSixNote}`
      : !dimensionTDAAllowed
      ? `No Bet · Baccarat alignment below ${((f as any).dimensionTDA?.min ?? DEFAULT_DIMENSION_GATE_MIN)}%`
      : (f as any).pulseEnhanced && lockedForecastGroup
      ? `PULSE No Bet · Shadow ${coreResult.toUpperCase()} · ${formatBaccaratEngineLabel(f.source, f.tier)} bet ${formatGroupAsBaccaratShort(lockedForecastGroup)} · Conf ${f.confidence}%`
      : getTierExecutionNote(f.tier, f.group, f.group ? GROUPS[f.group] : []),
    executionMode,
    coreResult,
    overlayResult,
    wheelNeighbors: [],
    wheelAlignment: getWheelAlignment(f.group, executionMode, f.source),
    streamConflict: hasStreamConflict(f.group, executionMode, f.source),
    etrStateAfter,
    etrBetType: active ? etrPlan.etrBetType : "flat",
    recoveryStep: active ? etrPlan.recoveryStep : 0,
    oneThreeTwoSixStep,
  };
}

function getLongestLossStreakFromRows(rows: Step[]) {
  let current = 0;
  let longest = 0;
  rows.forEach((row) => {
    if (row.result === "loss") {
      current += 1;
      longest = Math.max(longest, current);
    } else if (row.result === "win") {
      current = 0;
    }
  });
  return longest;
}

function getNeuralShadowDecision(history: Step[]) {
  const neural = getNeuralAssistMetrics(history);
  const pulse = neural.rawPulse;
  return {
    ...pulse,
    confidence: neural.adjustedConfidence,
    tier: neural.adjustedTier,
    reason: `Neural Shadow · ${neural.status} · ${neural.adjustment > 0 ? "+" : ""}${neural.adjustment}`,
    source: "PULSE" as const,
    mode: "Neural Shadow",
    neuralShadow: true,
    neuralScore: neural.neuralScore,
    neuralAdjustment: neural.adjustment,
    neuralStatus: neural.status,
  };
}

function settleSpinNeuralShadow(history: Step[], outcome: SpinValue, baseUnit: number, startingBankroll: number, strategy: Strategy, executionMode: ExecutionMode = "Stream Direct", tableLimit = DEFAULT_TABLE_LIMIT, perNumberLimit = DEFAULT_PER_NUMBER_LIMIT, tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION, exposureCapPercent = DEFAULT_EXPOSURE_CAP_PERCENT): Step {
  const f = getNeuralShadowDecision(history);
  const bankroll = history.at(-1)?.bankroll ?? startingBankroll;
  const executionAllowed = shouldExecuteTier(f.tier, f.source, tierExecution, (f as any).rv, (f as any).entropyExtreme);
  const dimensionTDAAllowed = true; // TDA diagnostic only, not a hard gate.
  const active = shouldBet(strategy, f.confidence, true, f.group) && executionAllowed ;
  // BACCARAT SETTLEMENT LOCK
  // Baccarat is one-dimensional: Player vs Banker.
  // Charts and engine performance must settle on the forecast side, not on roulette-style group baskets.
  const previewNumbers = f.group ? getBaccaratSideExecutionNumbers(f.group) : [];
  const streamNumbers = previewNumbers;
  const wheelNeighbors: SpinValue[] = [];
  const numbers = previewNumbers;
  const activeBasket = previewNumbers;
  const etrPlan = getEtrRecoveryPlan(strategy, baseUnit, history);
  const unit = active ? getUnitBet(strategy, baseUnit, f.confidence, history, 1, bankroll, tableLimit, perNumberLimit, exposureCapPercent) : 0;
  const exposure = active ? unit : 0;

  // FINAL FORECAST / SETTLEMENT LOCK
  // The active forecast group is captured once before settlement.
  // Core settlement compares the outcome's group to that exact forecast group.
  // Overlay settlement remains separate and only applies to wheel-neighbor coverage.
  // SHADOW FORECAST LOCK
  // Keep the selected engine forecast attached to the row even when Pulse says No Bet.
  // Real bankroll settlement still requires active=true, but Pulse recovery diagnostics
  // need the would-have-won / would-have-lost result to recover from filtered states.
  const lockedForecastGroup = f.source !== "NONE" ? f.group : null;
  const lockedOutcomeGroup = numberToGroup(outcome);

  const neighborExpansionNumbers = active && lockedForecastGroup
    ? getNeighborExpansionNumbers(lockedForecastGroup, f.source)
    : [];
  const edgeExpansionNumbers = active && lockedForecastGroup
    ? getEdgeExpansionNumbers(lockedForecastGroup)
    : [];

  const overlayAllowed = executionMode !== "Stream Direct";

  const activeOverlayNeighbors =
    executionMode === "Baccarat Side Execution"
      ? neighborExpansionNumbers
      : executionMode === "Baccarat Edge Handling"
      ? edgeExpansionNumbers
      : executionMode === "Hybrid Coverage"
      ? uniqueNumbers([...neighborExpansionNumbers, ...edgeExpansionNumbers])
      : [];

  // EXECUTION-BASKET SETTLEMENT LOCK
  // Stream Direct settles against the core group only.
  // Baccarat Side Execution / Baccarat Edge Handling / Hybrid Coverage settle against the exact expanded execution basket.
  // This prevents Baccarat Side Execution hits, such as BHE + 7, from being recorded as losses/pushes.
  const executionBasket = active ? activeBasket : [];
  const coreHit = !!lockedForecastGroup ? isBaccaratForecastHit(lockedForecastGroup, outcome) : false;
  const overlayHit = false;
  const combinedHit = active && coreHit;
  // coreResult is the selected engine's shadow settlement. It is win/loss even
  // during No Bet, while result/net/bankroll remain push/0 when no real bet occurs.
  const coreResult: Result = lockedForecastGroup ? (coreHit ? "win" : "loss") : "push";
  const overlayResult: Result = "push";
  let result: Result = "push";
  let net = 0;

  // RELAXED PUSH LOGIC
  // Any executable forecast must settle WIN/LOSS.
  // PUSH only occurs during true HOLD / Observe / no-forecast states.
  const executableForecast =
    !!lockedForecastGroup &&
    f.source !== "NONE" &&
    executionAllowed;

  if (executableForecast) {
    if (combinedHit) {
      result = "win";
      net = unit;
    } else {
      result = "loss";
      net = -exposure;
    }
  }

  const etrStateAfter = active ? getEtrStateAfterCurrentHand(strategy, history, result, etrPlan.etrBetType, etrPlan.recoveryStep) : getLastEtrState(history);
  const etrNote =
    strategy === "ETR" || strategy === "ETR-C"
      ? etrPlan.etrBetType === "recovery"
        ? ` · ${strategy} Recovery Step ${etrPlan.recoveryStep}${result === "win" ? " Win" : result === "loss" ? " Loss" : ""}`
        : etrStateAfter === "armed"
        ? ` · ${strategy} Armed`
        : ""
      : "";
  const oneThreeTwoSixStep = strategy === "1-3-2-6" && active ? getOneThreeTwoSixStep(history) : 0;
  const oneThreeTwoSixNote = strategy === "1-3-2-6" && active ? ` · 1-3-2-6 Step ${oneThreeTwoSixStep + 1} (${getOneThreeTwoSixMultiplier(oneThreeTwoSixStep)}x)` : "";

  return {
    spin: history.length + 1,
    outcome,
    outcomeGroup: lockedOutcomeGroup,
    predictedGroup: lockedForecastGroup,
    predictedNumbers: lockedForecastGroup ? getBaccaratSideExecutionNumbers(lockedForecastGroup) : numbers,
    forecastGroup: lockedForecastGroup,
    forecastNumbers: lockedForecastGroup ? GROUPS[lockedForecastGroup] : [],
    confidence: f.confidence,
    tier: f.tier,
    result,
    unitBet: unit,
    exposure,
    net,
    bankroll: bankroll + net,
    note: active ? `Neural Shadow · Bet ${formatGroupAsBaccaratShort(lockedForecastGroup)} · Conf ${f.confidence}%${overlayHit ? " · Overlay Hit" : ""}${etrNote}` : getTierExecutionNote(f.tier, f.group, f.group ? GROUPS[f.group] : []),
    executionMode,
    coreResult,
    overlayResult,
    wheelNeighbors: [],
    wheelAlignment: getWheelAlignment(f.group, executionMode, f.source),
    streamConflict: hasStreamConflict(f.group, executionMode, f.source),
    etrStateAfter,
    etrBetType: active ? etrPlan.etrBetType : "flat",
    recoveryStep: active ? etrPlan.recoveryStep : 0,
    oneThreeTwoSixStep,
  };
}

function runNeuralShadowStrategy(outcomes: SpinValue[], strategy: Strategy, baseUnit: number, startingBankroll: number, executionMode: ExecutionMode = "Stream Direct", tableLimit = DEFAULT_TABLE_LIMIT, perNumberLimit = DEFAULT_PER_NUMBER_LIMIT, tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION, exposureCapPercent = DEFAULT_EXPOSURE_CAP_PERCENT) {
  const rows: Step[] = [];
  outcomes.forEach((o) => rows.push(settleSpinNeuralShadow(rows, o, baseUnit, startingBankroll, strategy, executionMode, tableLimit, perNumberLimit, tierExecution, exposureCapPercent)));
  return rows;
}

function runShadowStrategy(outcomes: SpinValue[], strategy: Strategy, baseUnit: number, startingBankroll: number, engine: ShadowEngine, executionMode: ExecutionMode = "Stream Direct", tableLimit = DEFAULT_TABLE_LIMIT, perNumberLimit = DEFAULT_PER_NUMBER_LIMIT, tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION, exposureCapPercent = DEFAULT_EXPOSURE_CAP_PERCENT) {
  const rows: Step[] = [];
  outcomes.forEach((o) => rows.push(settleSpinShadow(rows, o, baseUnit, startingBankroll, strategy, engine, executionMode, tableLimit, perNumberLimit, tierExecution, exposureCapPercent)));
  return rows;
}

function runStrategy(outcomes: SpinValue[], strategy: Strategy, baseUnit: number, startingBankroll: number, pulseEnabled: boolean, bbStraightEnabled: boolean, bbInvertedEnabled: boolean, executionMode: ExecutionMode = "Stream Direct", tableLimit = DEFAULT_TABLE_LIMIT, perNumberLimit = DEFAULT_PER_NUMBER_LIMIT, tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION, markovEnabled = false, exposureCapPercent = DEFAULT_EXPOSURE_CAP_PERCENT, cadenceEnabled = false, scoutEnabled = false) {
  const rows: Step[] = [];
  outcomes.forEach((o) => rows.push(settleSpin(rows, o, baseUnit, startingBankroll, strategy, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, tierExecution, markovEnabled, exposureCapPercent, cadenceEnabled, scoutEnabled)));
  return rows;
}


function runComboShadowStrategy(
  outcomes: SpinValue[],
  strategy: Strategy,
  baseUnit: number,
  startingBankroll: number,
  combo: "PULSE_STRAIGHT" | "PULSE_INVERTED" | "PULSE_MARKOV",
  executionMode: ExecutionMode = "Stream Direct",
  tableLimit = DEFAULT_TABLE_LIMIT,
  perNumberLimit = DEFAULT_PER_NUMBER_LIMIT,
  tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION,
  exposureCapPercent = DEFAULT_EXPOSURE_CAP_PERCENT
) {
  const rows: Step[] = [];
  outcomes.forEach((outcome) => {
    rows.push(
      settleSpin(
        rows,
        outcome,
        baseUnit,
        startingBankroll,
        strategy,
        true,
        combo === "PULSE_STRAIGHT",
        combo === "PULSE_INVERTED",
        executionMode,
        tableLimit,
        perNumberLimit,
        tierExecution,
        combo === "PULSE_MARKOV",
        exposureCapPercent
      )
    );
  });
  return rows;
}


type ShadowReplayBundle = {
  pulse: Step[];
  straight: Step[];
  inverted: Step[];
  markov: Step[];
  pulseStraight: Step[];
  pulseInverted: Step[];
  pulseMarkov: Step[];
};

function runAllShadowStrategiesSinglePass(
  outcomes: SpinValue[],
  strategy: Strategy,
  baseUnit: number,
  startingBankroll: number,
  executionMode: ExecutionMode = "Stream Direct",
  tableLimit = DEFAULT_TABLE_LIMIT,
  perNumberLimit = DEFAULT_PER_NUMBER_LIMIT,
  tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION,
  exposureCapPercent = DEFAULT_EXPOSURE_CAP_PERCENT
): ShadowReplayBundle {
  // PERFORMANCE UPGRADE: one traversal of the hand history builds every shadow path.
  // This keeps the existing settlement helpers intact but removes six separate
  // full-history loops from the render path.
  const bundle: ShadowReplayBundle = {
    pulse: [],
    straight: [],
    inverted: [],
    markov: [],
    pulseStraight: [],
    pulseInverted: [],
    pulseMarkov: [],
  };

  outcomes.forEach((outcome) => {
    // Standalone PULSE shadow replay removed. Pulse exists only as +Pulse attached to a selected engine.
    bundle.straight.push(settleSpinShadow(bundle.straight, outcome, baseUnit, startingBankroll, strategy, "BB_STRAIGHT", executionMode, tableLimit, perNumberLimit, tierExecution, exposureCapPercent));
    bundle.inverted.push(settleSpinShadow(bundle.inverted, outcome, baseUnit, startingBankroll, strategy, "BB_INVERTED", executionMode, tableLimit, perNumberLimit, tierExecution, exposureCapPercent));
    bundle.markov.push(settleSpinShadow(bundle.markov, outcome, baseUnit, startingBankroll, strategy, "MARKOV", executionMode, tableLimit, perNumberLimit, tierExecution, exposureCapPercent));

    bundle.pulseStraight.push(settleSpin(bundle.pulseStraight, outcome, baseUnit, startingBankroll, strategy, true, true, false, executionMode, tableLimit, perNumberLimit, tierExecution, false, exposureCapPercent));
    bundle.pulseInverted.push(settleSpin(bundle.pulseInverted, outcome, baseUnit, startingBankroll, strategy, true, false, true, executionMode, tableLimit, perNumberLimit, tierExecution, false, exposureCapPercent));
    bundle.pulseMarkov.push(settleSpin(bundle.pulseMarkov, outcome, baseUnit, startingBankroll, strategy, true, false, false, executionMode, tableLimit, perNumberLimit, tierExecution, true, exposureCapPercent));
  });

  return bundle;
}

function runComparisonStrategyReplay(outcomes: SpinValue[], comparisonStrategy: Strategy, baseUnit: number, startingBankroll: number, pulseEnabled: boolean, bbStraightEnabled: boolean, bbInvertedEnabled: boolean, executionMode: ExecutionMode = "Stream Direct", tableLimit = DEFAULT_TABLE_LIMIT, perNumberLimit = DEFAULT_PER_NUMBER_LIMIT, tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION, markovEnabled = false, exposureCapPercent = DEFAULT_EXPOSURE_CAP_PERCENT, cadenceEnabled = false, scoutEnabled = false) {
  // LOCKED COMPARISON REPLAY
  // This intentionally creates a fresh Step[] for every strategy row.
  // Only the raw spin outcomes are shared. Bankroll, loss streak, unit size,
  // exposure, pushes, drawdown, and profit factor are recalculated from zero
  // using comparisonStrategy. Do not replace this with current history results.
  const replayRows: Step[] = [];
  outcomes.forEach((outcome) => {
    replayRows.push(
      settleSpin(
        replayRows,
        outcome,
        baseUnit,
        startingBankroll,
        comparisonStrategy,
        pulseEnabled,
        bbStraightEnabled,
        bbInvertedEnabled,
        executionMode,
        tableLimit,
        perNumberLimit,
        tierExecution,
        markovEnabled,
        exposureCapPercent,
        cadenceEnabled,
        scoutEnabled
      )
    );
  });
  return replayRows;
}

function randomSpin(): SpinValue {
  return ALL_NUMBERS[Math.floor(Math.random() * ALL_NUMBERS.length)];
}



// =====================================================
// BACCARAT MANUAL SIMULATOR INSERT
// Imported from the functional Baccarat BB/DPI manual simulator pattern.
// This is isolated from the Roulette spin history so the Roulette shell can be
// converted one section at a time without disturbing the protected Roulette engine.
// =====================================================
type BaccaratOutcome = "P" | "B";
type BaccaratBBMode = "Straight" | "Inverted";
type BaccaratETRState = "off" | "armed" | "recovery";

type BaccaratStep = {
  hand: number;
  shoeNumber: number;
  outcome: BaccaratOutcome;
  bet: BaccaratOutcome;
  betAmount: number;
  result: "win" | "loss";
  bankroll: number;
  count: number;
  mode: BaccaratBBMode;
  etrStateAfter: BaccaratETRState;
  etrBetType: "flat" | "recovery";
  recoveryStep: number;
  oneThreeTwoSixStep: number;
  outcomeStreak: number;
  note: string;
};

function getBaccaratPrimaryBetSide(prev: BaccaratStep | null, bbMode: BaccaratBBMode = "Straight"): BaccaratOutcome {
  const priorOutcomeStreak = prev?.outcomeStreak ?? 1;
  const hasTwoPlus = !!prev && priorOutcomeStreak >= 2;
  if (bbMode === "Straight") {
    if (hasTwoPlus && prev.outcome === "B") return "B";
    return "P";
  }
  if (hasTwoPlus && prev.outcome === "P") return "P";
  return "B";
}

function getBaccaratBBResult(
  prevOutcome: BaccaratOutcome | null,
  prevStreak: number,
  outcome: BaccaratOutcome,
  bbMode: BaccaratBBMode = "Straight"
): "win" | "loss" {
  const streak = prevOutcome === outcome ? prevStreak + 1 : 1;
  if (bbMode === "Inverted") {
    if (outcome === "B") {
      if (prevOutcome === "P" && prevStreak >= 2) return "loss";
      return "win";
    }
    return streak >= 3 ? "win" : "loss";
  }
  if (outcome === "P") {
    if (prevOutcome === "B" && prevStreak >= 2) return "loss";
    return "win";
  }
  return streak >= 3 ? "win" : "loss";
}

function getBaccaratDPIChange(prevOutcome: BaccaratOutcome | null, prevStreak: number, outcome: BaccaratOutcome): number {
  const streak = prevOutcome === outcome ? prevStreak + 1 : 1;
  if (prevOutcome && outcome !== prevOutcome && prevStreak >= 2) return -1;
  if (outcome === "P") return streak === 1 ? -1 : 1;
  return streak >= 3 ? 1 : -1;
}

function simulateBaccaratStep(
  prev: BaccaratStep | null,
  outcome: BaccaratOutcome,
  baseBet: number,
  startingBankrollForThisHand: number,
  tableLimit: number,
  bbMode: BaccaratBBMode = "Straight"
): BaccaratStep {
  const count = prev ? prev.count : 0;
  const bankroll = prev ? prev.bankroll : startingBankrollForThisHand;
  const previousOutcome = prev?.outcome ?? null;
  const previousOutcomeStreak = prev?.outcomeStreak ?? 0;
  const currentOutcomeStreak = prev && prev.outcome === outcome ? previousOutcomeStreak + 1 : 1;
  const result = getBaccaratBBResult(previousOutcome, previousOutcomeStreak, outcome, bbMode);
  const dpiChange = getBaccaratDPIChange(previousOutcome, previousOutcomeStreak, outcome);
  let betSide: BaccaratOutcome = getBaccaratPrimaryBetSide(prev, bbMode);

  if (bbMode === "Inverted") {
    if (outcome === "B" && !(previousOutcome === "P" && previousOutcomeStreak >= 2)) betSide = "B";
    if (outcome === "P" && currentOutcomeStreak >= 3) betSide = "P";
  } else {
    if (outcome === "P" && !(previousOutcome === "B" && previousOutcomeStreak >= 2)) betSide = "P";
    if (outcome === "B" && currentOutcomeStreak >= 3) betSide = "B";
  }

  const betAmount = Math.min(tableLimit, Math.max(1, Math.round(baseBet)));
  const nextCount = Math.min(0, count + dpiChange);
  const delta = result === "win" ? betAmount : -betAmount;
  let note = `${bbMode} / Bet ${betSide}`;

  if (bbMode === "Inverted") {
    if (outcome === "B" && previousOutcome === "P" && previousOutcomeStreak >= 2) note += " / Banker reset loss after 2+ Player run";
    else if (outcome === "B") note += " / Banker base win";
    if (outcome === "P" && currentOutcomeStreak === 1) note += " / P1 loss";
    if (outcome === "P" && currentOutcomeStreak === 2) note += " / P2 loss";
    if (outcome === "P" && currentOutcomeStreak >= 3) note += " / P3+ Player streak win";
  } else {
    if (outcome === "P" && previousOutcome === "B" && previousOutcomeStreak >= 2) note += " / Player reset loss after 2+ Banker run";
    else if (outcome === "P") note += " / Player base win";
    if (outcome === "B" && currentOutcomeStreak === 1) note += " / B1 loss";
    if (outcome === "B" && currentOutcomeStreak === 2) note += " / B2 loss";
    if (outcome === "B" && currentOutcomeStreak >= 3) note += " / B3+ Banker streak win";
  }

  note += ` / DPI ${dpiChange > 0 ? "+" : ""}${dpiChange}`;

  return {
    hand: prev ? prev.hand + 1 : 1,
    shoeNumber: 1,
    outcome,
    bet: betSide,
    betAmount,
    result,
    bankroll: bankroll + delta,
    count: nextCount,
    mode: bbMode,
    etrStateAfter: "off",
    etrBetType: "flat",
    recoveryStep: 0,
    oneThreeTwoSixStep: 0,
    outcomeStreak: currentOutcomeStreak,
    note,
  };
}

function randomBaccaratOutcome(): BaccaratOutcome {
  return Math.random() < 0.507 ? "B" : "P";
}


function baccaratOutcomeToSpin(outcome: BaccaratOutcome): SpinValue {
  // Internal one-dimensional Baccarat mapping.
  // Player is treated as the primary/Black side; Banker is treated as the Red side.
  // Range and Parity are held constant so PULSE, Markov, BB Straight, BB Inverted,
  // DPI, charts, and comparison tables operate on one Player/Banker dimension only.
  return outcome === "P" ? 20 : 0;
}

function spinToBaccaratOutcome(value: SpinValue): BaccaratOutcome {
  return numberToGroup(value)[0] === "B" ? "P" : "B";
}

function baccaratOutcomeLabel(outcome?: BaccaratOutcome | null) {
  if (outcome === "P") return "Player";
  if (outcome === "B") return "Banker";
  return "—";
}

function groupToBaccaratSide(group?: GroupKey | null) {
  if (!group) return null as BaccaratOutcome | null;
  return group[0] === "B" ? "P" : "B";
}

function formatGroupAsBaccarat(group?: GroupKey | null) {
  const side = groupToBaccaratSide(group);
  return side ? baccaratOutcomeLabel(side) : "—";
}

function formatSpinAsBaccarat(value?: SpinValue | null) {
  if (value == null) return "—";
  return baccaratOutcomeLabel(spinToBaccaratOutcome(value));
}

function formatBaccaratSideShort(side?: BaccaratOutcome | null) {
  if (side === "P") return "P";
  if (side === "B") return "B";
  return "—";
}

function formatGroupAsBaccaratShort(group?: GroupKey | null) {
  return formatBaccaratSideShort(groupToBaccaratSide(group));
}

function formatBaccaratEngineLabel(note?: string, tier?: string) {
  const raw = `${note ?? ""} ${tier ?? ""}`.toUpperCase();
  if (raw.includes("MARKOV")) return "Markov";
  if (raw.includes("INVERTED")) return "BB Inverted";
  if (raw.includes("BB_STRAIGHT") || raw.includes("BB STRAIGHT") || raw.includes("STRAIGHT")) return "BB Straight";
  if (raw.includes("PULSE")) return "Pulse";
  return tier || "Baccarat Engine";
}

function getBaccaratStructuralNote(row: Step) {
  const engine = formatBaccaratEngineLabel(row.note, row.tier);
  const forecastSide = formatGroupAsBaccarat(row.predictedGroup ?? row.forecastGroup);
  const outcomeSide = formatSpinAsBaccarat(row.outcome);
  if (row.result === "loss") {
    if (engine === "BB Straight") return `BB Straight reset/continuation failure · forecast ${forecastSide}, outcome ${outcomeSide}`;
    if (engine === "BB Inverted") return `BB Inverted instability · forecast ${forecastSide}, outcome ${outcomeSide}`;
    if (engine === "Markov") return `Markov transition miss · forecast ${forecastSide}, outcome ${outcomeSide}`;
    return `Baccarat signal miss · forecast ${forecastSide}, outcome ${outcomeSide}`;
  }
  if (row.result === "win") return `${engine} aligned · forecast ${forecastSide}, outcome ${outcomeSide}`;
  return `${engine} diagnostic hold / no-bet`;
}

function runBaccaratEngineHistory(
  outcomes: BaccaratOutcome[],
  strategy: Strategy,
  baseUnit: number,
  startingBankroll: number,
  pulseEnabled: boolean,
  bbStraightEnabled: boolean,
  bbInvertedEnabled: boolean,
  executionMode: ExecutionMode,
  tableLimit: number,
  perNumberLimit: number,
  tierExecution: any,
  markovEnabled: boolean,
  exposureCapPercent = DEFAULT_EXPOSURE_CAP_PERCENT,
  cadenceEnabled = false,
  scoutEnabled = false
): Step[] {
  return runStrategy(
    outcomes.map(baccaratOutcomeToSpin),
    strategy,
    baseUnit,
    startingBankroll,
    pulseEnabled,
    bbStraightEnabled,
    bbInvertedEnabled,
    executionMode,
    tableLimit,
    perNumberLimit,
    tierExecution,
    markovEnabled,
    exposureCapPercent,
    cadenceEnabled,
    scoutEnabled
  );
}

function runBaccaratOutcomes(
  outcomes: BaccaratOutcome[],
  baseBet: number,
  startingBankroll: number,
  tableLimit: number
): BaccaratStep[] {
  const rows: BaccaratStep[] = [];
  outcomes.forEach((outcome) => {
    const prev = rows.length ? rows[rows.length - 1] : null;
    const activeModeForHand: BaccaratBBMode = (prev?.count ?? 0) <= -5 ? "Inverted" : "Straight";
    rows.push(simulateBaccaratStep(prev, outcome, baseBet, startingBankroll, tableLimit, activeModeForHand));
  });
  return rows;
}

export default function Page() {
  const [history, setHistory] = useState<Step[]>([]);
  const [startingBankroll, setStartingBankroll] = useState(DEFAULT_STARTING_BANKROLL);
  const [baseUnit, setBaseUnit] = useState(DEFAULT_BASE_UNIT);
  const [tableLimit, setTableLimit] = useState(DEFAULT_TABLE_LIMIT);
  const [perNumberLimit, setPerNumberLimit] = useState(DEFAULT_PER_NUMBER_LIMIT);
  const [exposureCapPercent, setExposureCapPercent] = useState(DEFAULT_EXPOSURE_CAP_PERCENT);
  const [autoSpins, setAutoSpins] = useState(DEFAULT_AUTO_SPINS);
  const [numberOfShoes, setNumberOfShoes] = useState(DEFAULT_NUMBER_OF_SHOES);
  const [strategy, setStrategy] = useState<Strategy>(DEFAULT_STRATEGY);
  const [pulseEnabled, setPulseEnabled] = useState(false);
  const [bbMode, setBbMode] = useState<BBMode>("BB Straight");
  const [bbStraightEnabled, setBbStraightEnabled] = useState(false);
  const [bbInvertedEnabled, setBbInvertedEnabled] = useState(false);
  const [markovEnabled, setMarkovEnabled] = useState(false);
  const [cadenceEnabled, setCadenceEnabled] = useState(false);
  const [scoutEnabled, setScoutEnabled] = useState(false);
  // Execution Mode UI removed for Baccarat; internal execution remains locked to direct Player/Banker settlement.
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("Stream Direct");
  const [executeWeak, setExecuteWeak] = useState(DEFAULT_EXECUTE_WEAK);
  const [executeObservation, setExecuteObservation] = useState(DEFAULT_EXECUTE_OBSERVATION);
  const [appearance, setAppearance] = useState<Appearance>("dark");
  const [activeView, setActiveView] = useState<ViewKey>("Dashboard");
  const [showSettings, setShowSettings] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [settingsSavedNotice, setSettingsSavedNotice] = useState("");
  const [controlsOpen, setControlsOpen] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedMerge, setSelectedMerge] = useState<string[]>([]);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>({});
  const [selectedStreakBand, setSelectedStreakBand] = useState<{ type: "win" | "loss"; startSpin: number; endSpin: number; length: number } | null>(null);
  const togglePanel = (id: string) => setCollapsedPanels((prev) => ({ ...prev, [id]: !prev[id] }));

  const [baccaratHistory, setBaccaratHistory] = useState<BaccaratStep[]>([]);
  const [baccaratBBMode, setBaccaratBBMode] = useState<BaccaratBBMode>("Straight");
  const [uploadedDataset, setUploadedDataset] = useState<{ name: string; outcomes: BaccaratOutcome[]; rowCount: number; errors: string[] } | null>(null);
  const [datasetNotice, setDatasetNotice] = useState("");

  useEffect(() => {
    const id = "edgelab-sora-font";
    if (typeof document === "undefined" || document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);

  const syncBaccaratFromOutcomes = (
    outcomes: BaccaratOutcome[],
    start = startingBankroll,
    unit = baseUnit,
    limit = tableLimit,
    nextStrategy = strategy,
    nextPulse = pulseEnabled,
    nextStraight = bbStraightEnabled,
    nextInverted = bbInvertedEnabled,
    nextExecutionMode = executionMode,
    nextTierExecution = tierExecution,
    nextMarkov = markovEnabled,
    nextExposureCapPercent = exposureCapPercent,
    nextCadence = cadenceEnabled,
    nextScout = scoutEnabled
  ) => {
    setBaccaratHistory(runBaccaratOutcomes(outcomes, unit, start, limit));
    setHistory(runBaccaratEngineHistory(outcomes, nextStrategy, unit, start, nextPulse, nextStraight, nextInverted, nextExecutionMode, limit, perNumberLimit, nextTierExecution, nextMarkov, nextExposureCapPercent, nextCadence, nextScout));
  };

  const rebuildBaccarat = (start = startingBankroll, unit = baseUnit, limit = tableLimit) => {
    syncBaccaratFromOutcomes(baccaratHistory.map((h) => h.outcome), start, unit, limit);
  };

  const addBaccaratOutcome = (outcome: BaccaratOutcome) => {
    syncBaccaratFromOutcomes([...baccaratHistory.map((h) => h.outcome), outcome]);
  };

  const undoBaccaratHand = () => {
    syncBaccaratFromOutcomes(baccaratHistory.slice(0, -1).map((h) => h.outcome));
  };
  const resetBaccaratShoe = () => syncBaccaratFromOutcomes([]);


  const t = getTheme(appearance);
  const isDark = appearance === "dark";
  const headerBg = isDark ? "linear-gradient(180deg, rgba(15,23,42,0.94), rgba(2,6,23,0.70))" : "linear-gradient(180deg, #ffffff, #eef4fb)";
  const headerLogoFill = isDark ? "white" : "#0f172a";
  const headerAccent = isDark ? COLORS.cyan : COLORS.blue;
  const dpiRowBg = isDark ? "linear-gradient(180deg, rgba(2,6,23,0.82), rgba(2,6,23,0.46))" : "linear-gradient(180deg, #ffffff, #f1f5f9)";
  const dpiTrackBg = isDark ? "rgba(148,163,184,0.18)" : "rgba(100,116,139,0.16)";
  const sidebarIconBg = isDark ? "linear-gradient(180deg, rgba(2,6,23,0.98), rgba(15,23,42,0.82))" : "linear-gradient(180deg, #ffffff, #e2e8f0)";
  const sidebarIconBorder = isDark ? "1px solid rgba(34,199,243,0.28)" : "1px solid #cbd5e1";
  const sidebarIconShadow = isDark ? "0 0 18px rgba(34,199,243,0.12)" : "0 8px 18px rgba(15,23,42,0.08)";
  const tierExecution = useMemo(() => ({ executeWeak, executeObservation }), [executeWeak, executeObservation]);

  // ACTIVE REPLAY SYNC LOCK
  // Chart, Compact Metrics, Session Log, Strategy Comparison, and Signal State all read
  // from the same selected-engine replay path. This prevents one mode, such as Inverted,
  // from updating the chart while other panels continue reading stale Straight/Markov rows.
  const activeReplayHistory = useMemo(() => {
    const sourceOutcomes = baccaratHistory.length ? baccaratHistory.map((h) => h.outcome) : history.map((h) => h.outcome);
    if (!sourceOutcomes.length) return [] as Step[];
    return runBaccaratEngineHistory(
      sourceOutcomes,
      strategy,
      baseUnit,
      startingBankroll,
      pulseEnabled,
      bbStraightEnabled,
      bbInvertedEnabled,
      executionMode,
      tableLimit,
      perNumberLimit,
      tierExecution,
      markovEnabled,
      exposureCapPercent,
      cadenceEnabled,
      scoutEnabled
    );
  }, [baccaratHistory, history, strategy, baseUnit, startingBankroll, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, tierExecution, markovEnabled, exposureCapPercent, cadenceEnabled, scoutEnabled]);

  const displayHistory = activeReplayHistory.length ? activeReplayHistory : history;
  const f = useMemo(() => getActiveDecision(displayHistory, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, markovEnabled, cadenceEnabled, scoutEnabled), [displayHistory, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, markovEnabled, cadenceEnabled, scoutEnabled]);
  const wheelNeighbors = useMemo(() => getWheelNeighbors(f.group, f.source, executionMode), [f.group, f.source, executionMode]);
  const executionNumbers = useMemo(() => getExecutionNumbers(f.group, executionMode, f.source, f), [f.group, executionMode, f.source]);
  const wheelAlignment = useMemo(() => getWheelAlignment(f.group, executionMode, f.source), [f.group, executionMode, f.source]);
  const streamConflict = useMemo(() => hasStreamConflict(f.group, executionMode, f.source), [f.group, executionMode, f.source]);
  const bankroll = displayHistory.at(-1)?.bankroll ?? startingBankroll;
  const net = bankroll - startingBankroll;
  const pulseConfidenceScore = pulseEnabled && f.source !== "NONE" ? Math.round(Number(f.confidence ?? 0)) : 0;
  const currentBetAmount = (() => {
    const executionAllowedForPreview = shouldExecuteTier(f.tier, f.source, tierExecution, (f as any).rv, (f as any).entropyExtreme);
    const activePreview =
      f.source !== "NONE" &&
      (!(f as any).pulseGate || (f as any).pulseGate.allow) &&
      shouldBet(strategy, f.confidence, pulseEnabled, f.group) &&
      executionAllowedForPreview;

    return activePreview
      ? getUnitBet(strategy, baseUnit, f.confidence, displayHistory, 1, bankroll, tableLimit, perNumberLimit, exposureCapPercent)
      : 0;
  })();
  const wins = displayHistory.filter((h) => h.result === "win").length;
  const losses = displayHistory.filter((h) => h.result === "loss").length;
  const pushes = displayHistory.filter((h) => h.result === "push").length;
  const resolved = wins + losses;
  const winRate = resolved ? `${((wins / resolved) * 100).toFixed(1)}%` : "0.0%";
  const roi = displayHistory.length ? `${((net / startingBankroll) * 100).toFixed(1)}%` : "0.0%";
  const lossStreak = getLossStreak(displayHistory);
  const recoveryState = lossStreak >= 7 ? "recovery" : lossStreak >= 4 ? "watch" : "off";
  const dpiValue = getDpiValue(displayHistory);
  const dpiZone = dpiValue <= -7 ? "Transition" : dpiValue <= -3 ? "Pressure" : "Neutral";
  const recent = [...displayHistory].reverse().slice(0, 24);
  const rawOutcomes = useMemo(() => displayHistory.map((h) => h.outcome), [displayHistory]);
  // PERFORMANCE: keep full history for live settlement/export, but cap expensive
  // comparison/shadow analytics to the most recent hands. This preserves reactive
  // Signal State updates while preventing Auto Run renders from replaying every
  // engine and every strategy across the entire session on every render.
  const analyticsOutcomes = useMemo(() => rawOutcomes.slice(-PERF_REPLAY_HAND_LIMIT), [rawOutcomes]);
  const visibleChartHistory = useMemo(() => displayHistory.slice(-PERF_CHART_HAND_LIMIT), [displayHistory]);
  const isPulseOnlyMode = pulseEnabled && !bbStraightEnabled && !bbInvertedEnabled;
  const streakStats = useMemo(() => getStreakStats(displayHistory), [displayHistory]);
  const peakBankroll = displayHistory.reduce((peak, row) => Math.max(peak, row.bankroll), startingBankroll);
  const activeDrawdown = Math.max(0, peakBankroll - bankroll);
  const activeDrawdownPct = peakBankroll ? (activeDrawdown / peakBankroll) * 100 : 0;
  const lossStreakSeverity = getLossStreakSeverity(streakStats.currentLossStreak);

  const chartData = [{ spin: Math.max(0, (visibleChartHistory[0]?.spin ?? 1) - 1), bankroll: visibleChartHistory[0]?.bankroll ?? startingBankroll }, ...visibleChartHistory.map((h) => ({ spin: h.spin, bankroll: h.bankroll }))];
  const values = chartData.map((d) => d.bankroll);
  const axisMin = Math.floor((Math.min(...values, startingBankroll) - 50) / 25) * 25;
  const axisMax = Math.ceil((Math.max(...values, startingBankroll) + 50) / 25) * 25;
  const chartW = 1000;
  const chartH = 390;
  const pl = 76;
  const pr = 32;
  const pt = 28;
  const pb = 42;
  const maxSpin = Math.max(1, chartData.at(-1)?.spin ?? 1);
  const yRange = Math.max(1, axisMax - axisMin);
  const x = (spin: number) => pl + (spin / maxSpin) * (chartW - pl - pr);
  const y = (v: number) => pt + ((axisMax - v) / yRange) * (chartH - pt - pb);
  const chartPoints = chartData.map((d) => `${x(d.spin)},${y(d.bankroll)}`).join(" ");
  const chartTicks = Array.from({ length: 5 }, (_, i) => Math.round(axisMin + ((axisMax - axisMin) / 4) * i)).reverse();

  const saveLocal = (sessions: SavedSession[]) => {
    setSavedSessions(sessions);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  };

  React.useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setSavedSessions(JSON.parse(raw));
  }, []);

  React.useEffect(() => {
    const raw = localStorage.getItem(CONTROL_SETTINGS_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Partial<SavedControlSettings>;
      setStartingBankroll(Number(saved.startingBankroll) || DEFAULT_STARTING_BANKROLL);
      setBaseUnit(Number(saved.baseUnit) || DEFAULT_BASE_UNIT);
      setTableLimit(Number(saved.tableLimit) || DEFAULT_TABLE_LIMIT);
      setPerNumberLimit(Number(saved.perNumberLimit) || DEFAULT_PER_NUMBER_LIMIT);
      setExposureCapPercent(Number(saved.exposureCapPercent) || DEFAULT_EXPOSURE_CAP_PERCENT);
      setAutoSpins(Number(saved.autoSpins) || DEFAULT_AUTO_SPINS);
      if (saved.strategy && STRATEGIES.includes(saved.strategy)) setStrategy(saved.strategy);
      // Pulse must always open OFF; saved controls no longer auto-enable Pulse on startup.
      setPulseEnabled(false);
      if (typeof saved.bbStraightEnabled === "boolean") setBbStraightEnabled(saved.bbStraightEnabled);
      if (typeof saved.bbInvertedEnabled === "boolean") setBbInvertedEnabled(saved.bbInvertedEnabled);
      if (typeof saved.markovEnabled === "boolean") setMarkovEnabled(saved.markovEnabled);
      if (typeof saved.cadenceEnabled === "boolean") setCadenceEnabled(saved.cadenceEnabled);
      if (typeof saved.scoutEnabled === "boolean") setScoutEnabled(saved.scoutEnabled);
      if (typeof saved.executeWeak === "boolean") setExecuteWeak(saved.executeWeak);
      if (typeof saved.executeObservation === "boolean") setExecuteObservation(saved.executeObservation);
      if (saved.appearance === "light" || saved.appearance === "dark") setAppearance(saved.appearance);
    } catch {
      localStorage.removeItem(CONTROL_SETTINGS_KEY);
    }
  }, []);

  const addSpin = (value: SpinValue) => setHistory((h) => [...h, settleSpin(h, value, baseUnit, startingBankroll, strategy, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, tierExecution, markovEnabled, exposureCapPercent, cadenceEnabled, scoutEnabled)]);
  const rebuild = (start = startingBankroll, unit = baseUnit, nextStrategy = strategy, nextPulse = pulseEnabled) => {
    setHistory(runStrategy(history.map((h) => h.outcome), nextStrategy, unit, start, nextPulse, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, tierExecution, markovEnabled, exposureCapPercent, cadenceEnabled, scoutEnabled));
  };

  const replayBaccaratChartForMode = (
    nextPulse = pulseEnabled,
    nextStraight = bbStraightEnabled,
    nextInverted = bbInvertedEnabled,
    nextMarkov = markovEnabled,
    nextExposureCapPercent = exposureCapPercent,
    nextCadence = cadenceEnabled,
    nextScout = scoutEnabled
  ) => {
    // LIVE CHART MODE-SWITCH REPLAY LOCK
    // The live chart must be rebuilt from raw outcomes every time the selected engine
    // changes, including Straight BB -> Straight BB + Pulse.
    //
    // Some sessions have baccaratHistory populated; others only have the active engine
    // rows in history. Use baccaratHistory as the preferred raw source, but fall back
    // to history so the chart never keeps a stale Straight-only replay after Pulse is
    // toggled on.
    const outcomes = baccaratHistory.length
      ? baccaratHistory.map((h) => h.outcome)
      : history.map((h) => h.outcome);

    setHistory(
      runBaccaratEngineHistory(
        outcomes,
        strategy,
        baseUnit,
        startingBankroll,
        nextPulse,
        nextStraight,
        nextInverted,
        executionMode,
        tableLimit,
        perNumberLimit,
        tierExecution,
        nextMarkov,
        nextExposureCapPercent,
        nextCadence,
        nextScout
      )
    );
  };

  const applyPulseMode = () => {
    const nextPulse = !pulseEnabled;
    setPulseEnabled(nextPulse);
    replayBaccaratChartForMode(nextPulse, bbStraightEnabled, bbInvertedEnabled, markovEnabled, exposureCapPercent, cadenceEnabled, scoutEnabled);
  };


  const applyBBMode = (nextStraight: boolean, nextInverted: boolean) => {
    setBbStraightEnabled(nextStraight);
    setBbInvertedEnabled(nextInverted);
    setMarkovEnabled(false);
    setCadenceEnabled(false);
    setScoutEnabled(false);
    replayBaccaratChartForMode(pulseEnabled, nextStraight, nextInverted, false, exposureCapPercent, false, false);
  };

  const applyMarkovMode = () => {
    setBbStraightEnabled(false);
    setBbInvertedEnabled(false);
    setMarkovEnabled(true);
    setCadenceEnabled(false);
    setScoutEnabled(false);
    replayBaccaratChartForMode(pulseEnabled, false, false, true, exposureCapPercent, false, false);
  };
  const applyCadenceMode = () => {
    setBbStraightEnabled(false);
    setBbInvertedEnabled(false);
    setMarkovEnabled(false);
    setCadenceEnabled(true);
    setScoutEnabled(false);
    replayBaccaratChartForMode(pulseEnabled, false, false, false, exposureCapPercent, true, false);
  };

  // SCOUT — read-only pick, used only to display an indicator (added below).
  // The actual engine-selection override now happens inside getActiveDecision
  // itself (see scoutEnabled threading throughout), so this never touches
  // bbStraightEnabled/bbInvertedEnabled/markovEnabled/cadenceEnabled directly
  // — the Play Mode buttons stay exactly as you left them manually.
  const scoutPick = useMemo(() => (scoutEnabled ? getScoutSelectedEngine(displayHistory) : null), [scoutEnabled, displayHistory]);
  const applyExecutionMode = (_nextMode: ExecutionMode) => {
    const nextMode: ExecutionMode = "Stream Direct";
    setExecutionMode(nextMode);

    const outcomes = history.map((h) => h.outcome);
    if (outcomes.length) {
      setHistory(
        runStrategy(
          outcomes,
          strategy,
          baseUnit,
          startingBankroll,
          pulseEnabled,
          bbStraightEnabled,
          bbInvertedEnabled,
          nextMode,
          tableLimit,
          perNumberLimit,
          tierExecution,
          markovEnabled,
          exposureCapPercent,
          cadenceEnabled,
          scoutEnabled
        )
      );
    }
  };

  const runAuto = () => {
    // PERFORMANCE-SAFE AUTO RUN
    // Keep Signal State and chart reactivity intact. The prior cache-based optimization
    // broke updates; this version optimizes only Auto Run by creating all outcomes in
    // memory first, then rebuilding Baccarat rows and live engine rows one time.
    setAutoRunning(true);
    window.setTimeout(() => {
      const handsPerShoe = Math.max(1, autoSpins);
      const shoes = Math.max(1, numberOfShoes);
      const totalHands = handsPerShoe * shoes;
      const allOutcomes = Array.from({ length: totalHands }, () => randomBaccaratOutcome());

      const nextBaccaratRows = runBaccaratOutcomes(allOutcomes, baseUnit, startingBankroll, tableLimit).map((row, index) => ({
        ...row,
        hand: index + 1,
        shoeNumber: Math.floor(index / handsPerShoe) + 1,
      }));

      const nextEngineRows = runBaccaratEngineHistory(
        allOutcomes,
        strategy,
        baseUnit,
        startingBankroll,
        pulseEnabled,
        bbStraightEnabled,
        bbInvertedEnabled,
        executionMode,
        tableLimit,
        perNumberLimit,
        tierExecution,
        markovEnabled,
        exposureCapPercent,
        cadenceEnabled,
        scoutEnabled
      ).map((row, index) => ({
        ...row,
        spin: index + 1,
        note: `${row.note} · Shoe ${Math.floor(index / handsPerShoe) + 1}`,
      }));

      setBaccaratHistory(nextBaccaratRows);
      setHistory(nextEngineRows);
      setAutoRunning(false);
    }, 0);
  };
  const reset = () => {
    setHistory([]);
    setBaccaratHistory([]);
    setStartingBankroll(DEFAULT_STARTING_BANKROLL);
    setBaseUnit(DEFAULT_BASE_UNIT);
    setTableLimit(DEFAULT_TABLE_LIMIT);
    setPerNumberLimit(DEFAULT_PER_NUMBER_LIMIT);
    setExposureCapPercent(DEFAULT_EXPOSURE_CAP_PERCENT);
    setAutoSpins(DEFAULT_AUTO_SPINS);
    setNumberOfShoes(DEFAULT_NUMBER_OF_SHOES);
    setStrategy(DEFAULT_STRATEGY);
    setPulseEnabled(false);
    setBbStraightEnabled(false);
    setBbMode("BB Off");
    setBbInvertedEnabled(false);
    setMarkovEnabled(false);
    setExecutionMode("Stream Direct");
    setExecuteWeak(DEFAULT_EXECUTE_WEAK);
    setExecuteObservation(DEFAULT_EXECUTE_OBSERVATION);
  };

  const parseBaccaratCsvText = (rawText: string) => {
    const lines = rawText
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const errors: string[] = [];
    const outcomes: BaccaratOutcome[] = [];
    if (!lines.length) return { outcomes, errors: ["CSV is empty."], rowCount: 0 };

    const firstCells = lines[0].split(",").map((cell) => cell.trim().replace(/^"|"$/g, "").toLowerCase());
    const hasHeader = firstCells.some((cell) => ["hand", "shoe", "outcome", "result", "side"].includes(cell));
    const header = hasHeader ? firstCells : [];
    const outcomeIndex = hasHeader
      ? Math.max(header.indexOf("outcome"), header.indexOf("result"), header.indexOf("side"))
      : lines[0].split(",").length > 1
      ? 1
      : 0;

    if (outcomeIndex < 0) {
      return { outcomes, errors: ["CSV must include an outcome, result, or side column."], rowCount: lines.length };
    }

    const dataLines = hasHeader ? lines.slice(1) : lines;
    dataLines.slice(0, 10000).forEach((line, index) => {
      const cells = line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
      const rawOutcome = String(cells[outcomeIndex] ?? "").trim().toUpperCase();
      if (!rawOutcome) {
        errors.push(`Row ${index + (hasHeader ? 2 : 1)} missing outcome.`);
        return;
      }
      if (rawOutcome === "P" || rawOutcome === "PLAYER") outcomes.push("P");
      else if (rawOutcome === "B" || rawOutcome === "BANKER") outcomes.push("B");
      else errors.push(`Row ${index + (hasHeader ? 2 : 1)} unsupported outcome: ${rawOutcome}. Use P/Player or B/Banker.`);
    });

    if (dataLines.length > 10000) errors.push("Dataset was capped at 10,000 hands for browser performance.");
    if (!outcomes.length && !errors.length) errors.push("No playable Player/Banker outcomes were found.");
    return { outcomes, errors, rowCount: dataLines.length };
  };

  const handleBaccaratCsvUpload = (event: any) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseBaccaratCsvText(String(reader.result ?? ""));
      setUploadedDataset({ name: file.name, outcomes: parsed.outcomes, rowCount: parsed.rowCount, errors: parsed.errors.slice(0, 8) });
      setDatasetNotice(parsed.outcomes.length ? `Loaded ${parsed.outcomes.length.toLocaleString()} hands from ${file.name}.` : `No playable hands found in ${file.name}.`);
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const replayUploadedDataset = () => {
    if (!uploadedDataset?.outcomes.length) {
      setDatasetNotice("Upload a valid Baccarat CSV first.");
      return;
    }
    syncBaccaratFromOutcomes(uploadedDataset.outcomes);
    setActiveView("Reports");
    setDatasetNotice(`Replayed ${uploadedDataset.outcomes.length.toLocaleString()} uploaded hands through the active engine settings.`);
  };

  const clearUploadedDataset = () => {
    setUploadedDataset(null);
    setDatasetNotice("Uploaded dataset cleared.");
  };

  const saveSession = () => {
    const name = sessionName.trim();
    if (!name) return;
    const next: SavedSession = { name, createdAt: new Date().toISOString(), startingBankroll, baseUnit, tableLimit, perNumberLimit, exposureCapPercent, autoSpins, strategy, pulseEnabled, bbMode, bbStraightEnabled, bbInvertedEnabled, executeWeak, executeObservation , executionMode, history };
    saveLocal([...savedSessions.filter((s) => s.name !== name), next]);
    setSelectedSession(name);
    setSessionName("");
    setShowSave(false);
  };
  const recoverSession = (name: string) => {
    const s = savedSessions.find((x) => x.name === name);
    if (!s) return;
    setStartingBankroll(s.startingBankroll);
    setBaseUnit(s.baseUnit);
    setTableLimit(s.tableLimit ?? DEFAULT_TABLE_LIMIT);
    setPerNumberLimit(s.perNumberLimit ?? DEFAULT_PER_NUMBER_LIMIT);
    setExposureCapPercent((s as any).exposureCapPercent ?? DEFAULT_EXPOSURE_CAP_PERCENT);
    setAutoSpins(s.autoSpins);
    setStrategy(s.strategy);
    setPulseEnabled(s.pulseEnabled);
    setBbStraightEnabled(s.bbStraightEnabled ?? false);
    setBbInvertedEnabled(s.bbInvertedEnabled ?? false);
    setExecuteWeak(s.executeWeak ?? DEFAULT_EXECUTE_WEAK);
    setExecuteObservation(s.executeObservation ?? DEFAULT_EXECUTE_OBSERVATION);
    setBbMode(s.bbMode);
    setHistory(s.history);
    setSelectedSession(name);
  };
  const deleteSession = () => {
    if (!selectedSession) return;
    saveLocal(savedSessions.filter((s) => s.name !== selectedSession));
    setSelectedSession("");
  };
  const mergeSelected = () => {
    const sessions = savedSessions.filter((s) => selectedMerge.includes(s.name));
    let rows: Step[] = [];
    sessions.forEach((s) => s.history.forEach((h) => rows.push(settleSpin(rows, h.outcome, baseUnit, startingBankroll, strategy, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, tierExecution, markovEnabled, exposureCapPercent, cadenceEnabled, scoutEnabled))));
    setHistory(rows);
  };

  const saveControlSettings = () => {
    const saved: SavedControlSettings = {
      startingBankroll,
      baseUnit,
      tableLimit,
      perNumberLimit,
      exposureCapPercent,
      autoSpins,
      strategy,
      pulseEnabled: false,
      bbStraightEnabled,
      bbInvertedEnabled,
      markovEnabled,
      cadenceEnabled,
      scoutEnabled,
      executionMode,
      executeWeak,
      executeObservation,
      appearance,
    };
    localStorage.setItem(CONTROL_SETTINGS_KEY, JSON.stringify(saved));
    setSettingsSavedNotice("Control settings saved for next login.");
  };

  const clearSavedControlSettings = () => {
    localStorage.removeItem(CONTROL_SETTINGS_KEY);
    setSettingsSavedNotice("Saved control settings cleared.");
  };

  const rowsForExport = () => [
    ["Hand", "Outcome", "Forecast", "Executed Prediction", "CoreResult", "CombinedResult", "Confidence", "Tier", "Unit", "Exposure", "Net", "Bankroll", "Note"],
    ...history.map((h) => [h.spin, formatSpinAsBaccarat(h.outcome), formatGroupAsBaccarat(h.forecastGroup), formatGroupAsBaccarat(h.predictedGroup), h.coreResult, h.result, h.confidence, h.tier, h.unitBet, h.exposure, h.net, h.bankroll, h.note]),
  ];
  const downloadCSV = () => {
    const csv = rowsForExport().map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join(String.fromCharCode(10));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "edgelab_baccarat_session.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const comparison = useMemo(() => {
    return STRATEGIES.map((comparisonStrategy) => {
      const rows = runComparisonStrategyReplay(
        analyticsOutcomes,
        comparisonStrategy,
        baseUnit,
        startingBankroll,
        pulseEnabled,
        bbStraightEnabled,
        bbInvertedEnabled,
        executionMode,
        tableLimit,
        perNumberLimit,
        tierExecution,
        markovEnabled,
        exposureCapPercent,
        cadenceEnabled,
        scoutEnabled
      );
      const end = rows.at(-1)?.bankroll ?? startingBankroll;
      const w = rows.filter((r) => r.result === "win").length;
      const l = rows.filter((r) => r.result === "loss").length;
      const obs = rows.filter((r) => r.result === "push").length;
      const active = w + l;
      let peak = startingBankroll;
      let maxDrawdown = 0;
      rows.forEach((r) => {
        peak = Math.max(peak, r.bankroll);
        maxDrawdown = Math.max(maxDrawdown, peak - r.bankroll);
      });
      const grossWins = rows.filter((r) => r.net > 0).reduce((sum, r) => sum + r.net, 0);
      const grossLosses = Math.abs(rows.filter((r) => r.net < 0).reduce((sum, r) => sum + r.net, 0));
      const profitFactor = grossLosses > 0 ? (grossWins / grossLosses).toFixed(2) : grossWins > 0 ? "∞" : "0.00";
      const largest = rows.reduce((m, r) => Math.max(m, r.unitBet), 0);
      return {
        strategy: comparisonStrategy,
        end,
        roi: ((end - startingBankroll) / startingBankroll * 100).toFixed(1),
        winRate: active ? (w / active * 100).toFixed(1) : "0.0",
        obs,
        largest,
        maxDrawdown,
        profitFactor,
      };
    });
  }, [analyticsOutcomes, baseUnit, startingBankroll, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, tierExecution, markovEnabled, exposureCapPercent, cadenceEnabled, scoutEnabled]);


  const shadowReplayBundle = useMemo(
    () => runAllShadowStrategiesSinglePass(
      analyticsOutcomes,
      strategy,
      baseUnit,
      startingBankroll,
      executionMode,
      tableLimit,
      perNumberLimit,
      tierExecution,
      exposureCapPercent
    ),
    [analyticsOutcomes, strategy, baseUnit, startingBankroll, executionMode, tableLimit, perNumberLimit, tierExecution, exposureCapPercent]
  );

  const pulseShadowRows = shadowReplayBundle.pulse;
  const straightShadowRows = shadowReplayBundle.straight;
  const invertedShadowRows = shadowReplayBundle.inverted;
  const markovShadowRows = shadowReplayBundle.markov;
  const pulseStraightShadowRows = shadowReplayBundle.pulseStraight;
  const pulseInvertedShadowRows = shadowReplayBundle.pulseInverted;
  const pulseMarkovShadowRows = shadowReplayBundle.pulseMarkov;

  const Panel = ({ title, children, style = {} }: any) => (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 16, padding: 12, boxShadow: t.shadow, color: t.text, minWidth: 0, maxWidth: "100%", overflow: "hidden", boxSizing: "border-box", ...style }}>
      {title ? <div style={{ fontSize: 11, fontWeight: 950, color: t.subtext, marginBottom: 10, letterSpacing: 0.8, textTransform: "uppercase" }}>{title}</div> : null}
      {children}
    </div>
  );

  const CollapsiblePanel = ({ id, title, children, style = {} }: any) => {
    const collapsed = !!collapsedPanels[id];
    const collapsedStyle = collapsed
      ? { minHeight: "unset", height: "auto", maxHeight: "none" }
      : {};
    return (
      <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 16, padding: 12, boxShadow: t.shadow, color: t.text, minWidth: 0, maxWidth: "100%", overflow: "hidden", boxSizing: "border-box", ...style, ...collapsedStyle }}>
        <button
          onClick={() => togglePanel(id)}
          style={{
            width: "100%",
            border: 0,
            background: "transparent",
            padding: 0,
            margin: 0,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: t.subtext,
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 950,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            textAlign: "left",
          }}
        >
          <span>{title}</span>
          <span style={{ color: collapsed ? COLORS.cyan : t.subtext, fontSize: 12, fontWeight: 950 }}>{collapsed ? "▸" : "▾"}</span>
        </button>
        {!collapsed ? <div style={{ marginTop: 10 }}>{children}</div> : null}
      </div>
    );
  };
  const Button = ({ children, onClick, variant = "primary", disabled = false }: any) => {
    const bg = variant === "primary" ? COLORS.blue : variant === "danger" ? COLORS.red : t.input;
    return <button onClick={onClick} disabled={disabled} style={{ width: "100%", minWidth: 112, height: 38, borderRadius: 10, background: disabled ? "#94a3b8" : bg, color: variant === "secondary" ? t.text : "#fff", border: variant === "secondary" ? `1px solid ${t.borderStrong}` : `1px solid ${bg}`, cursor: disabled ? "not-allowed" : "pointer", fontWeight: 900, fontSize: 12 }}>{children}</button>;
  };
  const Input = (props: any) => <input {...props} style={{ width: "100%", height: 38, padding: "0 10px", borderRadius: 10, border: `1px solid ${t.borderStrong}`, background: t.input, color: t.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />;
  const NumericInput = ({ value, onCommit, min = 0, max, allowDecimal = false }: any) => {
    const [draft, setDraft] = useState(String(value ?? ""));

    useEffect(() => {
      setDraft(String(value ?? ""));
    }, [value]);

    const commit = () => {
      if (draft.trim() === "") {
        setDraft(String(value ?? ""));
        return;
      }

      const parsed = Number(draft);
      if (!Number.isFinite(parsed)) {
        setDraft(String(value ?? ""));
        return;
      }

      const bounded = Math.min(max ?? parsed, Math.max(min, parsed));
      onCommit(bounded);
      setDraft(String(bounded));
    };

    return (
      <input
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        value={draft}
        onChange={(e: any) => {
          const next = e.target.value;
          const pattern = allowDecimal ? /^\d*\.?\d*$/ : /^\d*$/;
          if (pattern.test(next)) setDraft(next);
        }}
        onBlur={commit}
        onKeyDown={(e: any) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        style={{ width: "100%", height: 38, padding: "0 10px", borderRadius: 10, border: `1px solid ${t.borderStrong}`, background: t.input, color: t.text, fontSize: 13, outline: "none", boxSizing: "border-box" }}
      />
    );
  };
  const Select = ({ value, onChange, options }: any) => <select value={value} onChange={onChange} style={{ width: "100%", height: 38, padding: "0 10px", borderRadius: 10, border: `1px solid ${t.borderStrong}`, background: t.input, color: t.text, fontSize: 13 }}>{options.map((o: string) => <option key={o} value={o}>{o || "Select Saved Session"}</option>)}</select>;
  const MiniMetric = ({ label, value, accent }: any) => <div style={{ border: `1px solid ${t.border}`, background: t.panel2, borderRadius: 12, padding: "9px 10px" }}><div style={{ fontSize: 10, color: t.subtext, textTransform: "uppercase", fontWeight: 900 }}>{label}</div><div style={{ marginTop: 4, color: accent || t.text, fontSize: 18, fontWeight: 950 }}>{value}</div></div>;
  const Modal = ({ open, children }: any) => !open ? null : <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.62)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}><div style={{ width: "100%", maxWidth: 470, background: t.panel, borderRadius: 16, border: `1px solid ${t.borderStrong}`, boxShadow: t.shadow, padding: 18, color: t.text }}>{children}</div></div>;
  const rouletteButtonStyle = (value: SpinValue): React.CSSProperties => {
    const isZero = value === 0 || value === "00";
    const bg = isZero ? "#15803d" : RED_NUMBERS.has(value) ? "#991b1b" : "#111827";
    return { minHeight: 42, borderRadius: 8, border: "1px solid rgba(255,255,255,0.16)", background: bg, color: "#fff", cursor: "pointer", fontWeight: 900, fontSize: 13 };
  };

  const SignalPanel = () => {
    const pulseStatus = pulseEnabled ? "ENABLED" : "DISABLED";
    const dimensionTDA = (f as any).dimensionTDA;
    const dimensionTDABlocked = f.source === "PULSE" && dimensionTDA?.passed === false;
    // OBSERVE SETTINGS LOCK
    // The Settings button is intentionally worded as Observe ON/OFF. In the
    // existing state model, executeObservation=true means the user has turned
    // the Observe hold state OFF and wants the forecast treated as actionable
    // instead of displayed as OBSERVE / NO BET.
    const observeSuppressedBySettings = f.tier === "Directional Observe" && executeObservation;
    const isObservationForecast = (f.tier === "Directional Observe" && !observeSuppressedBySettings) || dimensionTDABlocked;
    const displayPrediction = isObservationForecast ? "OBSERVE" : formatGroupAsBaccarat(f.group);
    const executionLabel = !pulseEnabled
      ? "PULSE OFF"
      : isObservationForecast
      ? "NO BET"
      : f.group
      ? "EXECUTE"
      : "WAITING";
    const executionColor = executionLabel === "EXECUTE"
      ? COLORS.green
      : executionLabel === "NO BET"
      ? COLORS.amber
      : executionLabel === "PULSE OFF"
      ? COLORS.red
      : t.subtext;
    const forecastTierLabel = f.tier;
    const displayedTierLabel = dimensionTDABlocked ? "TDA HOLD" : observeSuppressedBySettings ? "Observe OFF" : f.tier;
    const tierColor = displayedTierLabel === "Strong Prediction"
      ? COLORS.green
      : displayedTierLabel === "Controlled Prediction"
      ? COLORS.cyan
      : displayedTierLabel === "Weak Prediction"
      ? COLORS.amber
      : displayedTierLabel === "Directional Observe" || displayedTierLabel === "TDA HOLD"
      ? COLORS.red
      : t.text;
    const forecastTierColor = f.tier === "Strong Prediction"
      ? COLORS.green
      : f.tier === "Controlled Prediction"
      ? COLORS.cyan
      : f.tier === "Weak Prediction"
      ? COLORS.amber
      : f.tier === "Directional Observe"
      ? COLORS.red
      : t.text;
    const predictedSide = f.group && !isObservationForecast ? formatGroupAsBaccarat(f.group) : null;
    const finalPredictionColor = predictedSide === "Player"
      ? COLORS.blue
      : predictedSide === "Banker"
      ? COLORS.red
      : t.subtext;
    const statusReason = isObservationForecast
      ? dimensionTDABlocked
        ? "TDA Hold · No Bet"
        : "No Bet"
      : predictedSide
      ? `Side: ${predictedSide}`
      : "Awaiting Player/Banker signal.";
    return <Panel title="Signal State" style={{ minHeight: 344 }}>
      <button onClick={applyPulseMode} style={{ width: "100%", height: 34, borderRadius: 10, border: `1px solid ${pulseEnabled ? COLORS.cyan : COLORS.red}`, background: pulseEnabled ? "rgba(34,199,243,0.16)" : "rgba(239,68,68,0.10)", color: pulseEnabled ? COLORS.cyan : COLORS.red, fontWeight: 950, cursor: "pointer", marginBottom: 8 }}>{pulseEnabled ? "PULSE ON" : "PULSE OFF"}</button>
      <button onClick={() => setScoutEnabled((v) => !v)} style={{ width: "100%", height: 34, borderRadius: 10, border: `1px solid ${scoutEnabled ? COLORS.amber : COLORS.red}`, background: scoutEnabled ? "rgba(245,158,11,0.16)" : "rgba(239,68,68,0.10)", color: scoutEnabled ? COLORS.amber : COLORS.red, fontWeight: 950, cursor: "pointer", marginBottom: scoutEnabled ? 4 : 8 }}>{scoutEnabled ? "SCOUT ON" : "SCOUT OFF"}</button>
      {scoutEnabled && (
        <div style={{ textAlign: "center", fontSize: 10, fontWeight: 900, color: COLORS.amber, letterSpacing: 0.4, marginBottom: 8 }}>
          → {{ BB_STRAIGHT: "STRAIGHT", BB_INVERTED: "INVERTED", MARKOV: "MARKOV", CADENCE: "CADENCE" }[scoutPick ?? "BB_STRAIGHT"]}
        </div>
      )}
      {displayHistory.at(-1)?.sessionEnded && (
        <div style={{ textAlign: "center", fontSize: 11, fontWeight: 950, color: COLORS.red, background: "rgba(239,68,68,0.14)", border: `1px solid ${COLORS.red}55`, borderRadius: 8, padding: "8px 10px", marginBottom: 10, lineHeight: 1.4 }}>
          BETTING PAUSED
          <div style={{ fontSize: 10, fontWeight: 800, color: t.subtext, marginTop: 3 }}>All four engines below their own peak. Resumes automatically once one starts trending up.</div>
        </div>
      )}
      <div style={{ fontSize: 10, color: t.subtext, fontWeight: 950, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>Play Mode</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 10 }}>
        <button onClick={() => applyBBMode(false, false)} style={{ height: 34, borderRadius: 10, border: `1px solid ${!bbStraightEnabled && !bbInvertedEnabled && !markovEnabled && !cadenceEnabled ? COLORS.red : t.borderStrong}`, background: !bbStraightEnabled && !bbInvertedEnabled && !markovEnabled && !cadenceEnabled ? "rgba(239,68,68,0.10)" : t.input, color: !bbStraightEnabled && !bbInvertedEnabled && !markovEnabled && !cadenceEnabled ? COLORS.red : t.subtext, fontWeight: 950, cursor: "pointer", whiteSpace: "nowrap", fontSize: 12 }}>OFF</button>
        <button onClick={() => applyBBMode(true, false)} style={{ height: 34, borderRadius: 10, border: `1px solid ${bbStraightEnabled && !bbInvertedEnabled && !markovEnabled && !cadenceEnabled ? COLORS.blue : t.borderStrong}`, background: bbStraightEnabled && !bbInvertedEnabled && !markovEnabled && !cadenceEnabled ? "rgba(37,99,235,0.14)" : t.input, color: bbStraightEnabled && !bbInvertedEnabled && !markovEnabled && !cadenceEnabled ? COLORS.blue : t.subtext, fontWeight: 950, cursor: "pointer", whiteSpace: "nowrap", fontSize: 11 }}>STRAIGHT</button>
        <button onClick={() => applyBBMode(true, true)} style={{ height: 34, borderRadius: 10, border: `1px solid ${bbStraightEnabled && bbInvertedEnabled && !markovEnabled && !cadenceEnabled ? COLORS.amber : t.borderStrong}`, background: bbStraightEnabled && bbInvertedEnabled && !markovEnabled && !cadenceEnabled ? "rgba(245,158,11,0.12)" : t.input, color: bbStraightEnabled && bbInvertedEnabled && !markovEnabled && !cadenceEnabled ? COLORS.amber : t.subtext, fontWeight: 950, cursor: "pointer", whiteSpace: "nowrap", fontSize: 11 }}>INVERTED</button>
        <button onClick={applyMarkovMode} style={{ height: 34, borderRadius: 10, border: `1px solid ${markovEnabled && !cadenceEnabled ? COLORS.green : t.borderStrong}`, background: markovEnabled && !cadenceEnabled ? "rgba(34,197,94,0.13)" : t.input, color: markovEnabled && !cadenceEnabled ? COLORS.green : t.subtext, fontWeight: 950, cursor: "pointer", whiteSpace: "nowrap", fontSize: 11 }}>MARKOV</button>
        <button onClick={applyCadenceMode} style={{ height: 34, borderRadius: 10, border: `1px solid ${cadenceEnabled ? "#a855f7" : t.borderStrong}`, background: cadenceEnabled ? "rgba(168,85,247,0.13)" : t.input, color: cadenceEnabled ? "#a855f7" : t.subtext, fontWeight: 950, cursor: "pointer", whiteSpace: "nowrap", fontSize: 11 }}>CADENCE</button>
      </div>
      <div style={{ textAlign: "center", padding: "10px 0" }}>
        <div style={{ fontSize: 11, color: t.subtext, fontWeight: 950 }}>FINAL PREDICTION</div>
        <div style={{ fontSize: 50, fontWeight: 950, color: finalPredictionColor, lineHeight: 1, marginTop: 8 }}>{displayPrediction}</div>
        <div style={{ fontSize: 13, color: predictedSide ? finalPredictionColor : executionColor, fontWeight: 900, marginTop: 10 }}>{statusReason}</div>
      </div>
      <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, background: t.panel2, padding: "9px 10px", marginTop: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", fontSize: 12, fontWeight: 900 }}>
          <span style={{ color: t.subtext }}>PULSE Status</span>
          <span style={{ color: pulseEnabled ? (isDark ? "#ffffff" : "#0f172a") : COLORS.red }}>{pulseStatus}</span>
          <span style={{ color: t.subtext }}>Execution</span>
          <span style={{ color: executionColor }}>{executionLabel}</span>
          <span style={{ color: t.subtext }}>Tier</span>
          <span style={{ color: tierColor }}>{displayedTierLabel}</span>
          {dimensionTDABlocked ? <span style={{ color: t.subtext }}>Forecast Tier</span> : null}
          {dimensionTDABlocked ? <span style={{ color: forecastTierColor }}>{forecastTierLabel}</span> : null}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: t.subtext, fontWeight: 900 }}><span>PULSE Confidence</span><span>{pulseEnabled ? `${Math.round(f.confidence)}%` : "N/A"}</span></div>
        <div style={{ height: 10, borderRadius: 999, background: t.border, overflow: "hidden", marginTop: 7 }}><div style={{ width: pulseEnabled ? `${Math.round(f.confidence)}%` : "0%", height: "100%", background: f.confidence >= 78 ? COLORS.green : f.confidence >= 65 ? COLORS.cyan : f.confidence >= 50 ? COLORS.amber : COLORS.red }} /></div>
        <div style={{ textAlign: "center", marginTop: 10, color: t.subtext, fontSize: 12, fontWeight: 800 }}>{pulseEnabled ? (dimensionTDABlocked ? `TDA HOLD · Forecast Tier: ${forecastTierLabel}` : displayedTierLabel) : "Pulse Disabled"}</div>
      </div>
    </Panel>;
  };
  const CompactMetrics = () => <CollapsiblePanel id="compactMetrics" title="Compact Metrics"><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><MiniMetric label="Bankroll" value={bankroll.toLocaleString()} accent={net >= 0 ? COLORS.green : COLORS.red} /><MiniMetric label="Net" value={net.toLocaleString()} accent={net >= 0 ? COLORS.green : COLORS.red} /><MiniMetric label="Pulse Confidence" value={pulseEnabled ? `${pulseConfidenceScore}%` : "Off"} accent={pulseEnabled ? COLORS.cyan : COLORS.amber} /><MiniMetric label="Current Bet" value={currentBetAmount.toLocaleString()} accent={currentBetAmount > 0 ? COLORS.green : COLORS.amber} /><MiniMetric label="Win Rate" value={winRate} /><MiniMetric label="ROI" value={roi} /><MiniMetric label="DPI Zone" value={dpiZone} accent={dpiZone === "Transition" ? COLORS.red : dpiZone === "Pressure" ? COLORS.amber : COLORS.green} /></div></CollapsiblePanel>;
  const AxisDirectionalAccuracyPanel = () => {
    return null;
  };

  const BankrollChart = () => {
    const streakBands = streakStats.segments.filter((segment) => segment.length >= 2);
    const buildStreakAudit = (band: { type: "win" | "loss"; startSpin: number; endSpin: number; length: number }) => {
      const rows = displayHistory.filter((row) => row.spin >= band.startSpin && row.spin <= band.endSpin);
      if (!rows.length) {
        return {
          rows,
          title: `${band.type.toUpperCase()} STREAK ANALYSIS`,
          summary: [] as string[],
          diagnosis: "No detail available.",
          netChange: 0,
          avgConfidence: 0,
          entropyValue: 0,
          executed: 0,
          tdaHolds: 0,
          coreMisses: 0,
          overlayMisses: 0,
          tiers: "—",
        };
      }
      const netChange = rows.reduce((sum, row) => sum + row.net, 0);
      const avgConfidence = rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length;
      const startBankroll = rows[0].bankroll - rows[0].net;
      const endBankroll = rows[rows.length - 1].bankroll;
      const groups = rows.map((row) => row.outcomeGroup);
      const e = entropy(groups);
      const tdaHolds = rows.filter((row) => !(row.unitBet > 0)).length;
      const executed = rows.filter((row) => row.unitBet > 0).length;
      const coreMisses = rows.filter((row) => row.coreResult === "loss").length;
      const overlayMisses = rows.filter((row) => row.overlayResult === "loss").length;
      const tiers = Array.from(new Set(rows.map((row) => row.tier))).join(" / ");
      const settlementMismatchCount = rows.filter((row) => row.predictedGroup && row.predictedGroup === row.outcomeGroup && row.result !== "win").length;
      const diagnosis = settlementMismatchCount > 0
        ? `SETTLEMENT WARNING: ${settlementMismatchCount} matching forecast/outcome rows did not settle as WIN.`
        : band.type === "loss"
        ? e >= 62
          ? "Primary read: Player/Banker cadence became unstable during this loss block."
          : tdaHolds > Math.max(1, rows.length / 2)
          ? "Primary read: selected Baccarat engine was unstable or held execution too often."
          : avgConfidence < 55
          ? "Primary read: signal strength weakened during this Baccarat sequence."
          : "Primary read: selected Baccarat side missed despite active engine signal."
        : "Winning streak block. Shows which Baccarat engine behavior aligned during this run.";
      return {
        rows,
        title: `${band.type === "loss" ? "LOSS" : "WIN"} STREAK ANALYSIS`,
        summary: [
          `Hands: ${band.startSpin}-${band.endSpin} · Length: ${band.length}`,
          `Bankroll: ${startBankroll} → ${endBankroll} · Net: ${netChange}`,
          `Avg Signal Strength: ${avgConfidence.toFixed(1)}%`,
          `Executed Hands: ${executed}/${rows.length} · Diagnostic Holds: ${tdaHolds}`,
          `Settlement Misses: ${coreMisses}`,
                  ],
        diagnosis,
        netChange,
        avgConfidence,
        entropyValue: e,
        executed,
        tdaHolds,
        coreMisses,
        overlayMisses,
        tiers,
      };
    };
  const StreakAuditModal = () => {
    if (!selectedStreakBand) return null;
    const audit = buildStreakAudit(selectedStreakBand);
    const resultColor = (value: string) => value === "win" ? COLORS.green : value === "loss" ? COLORS.red : COLORS.amber;
    return <div
      style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.72)", zIndex: 9997, padding: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={() => setSelectedStreakBand(null)}
    >
      <div
        style={{ width: "min(1180px, 96vw)", maxHeight: "86vh", overflow: "hidden", background: t.panel, border: `1px solid ${t.borderStrong}`, borderRadius: 16, boxShadow: t.shadow, color: t.text, display: "grid", gridTemplateRows: "auto auto 1fr auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "16px 18px", borderBottom: `1px solid ${t.border}` }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 950, letterSpacing: 0.5 }}>{audit.title}</div>
            <div style={{ color: t.subtext, fontSize: 12, fontWeight: 800, marginTop: 4 }}>Baccarat Hand Settlement Audit</div>
          </div>
          <button onClick={() => setSelectedStreakBand(null)} style={{ border: `1px solid ${t.borderStrong}`, background: t.input, borderRadius: 10, width: 42, height: 38, fontSize: 24, fontWeight: 900, cursor: "pointer", color: t.text, flexShrink: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, padding: "12px 18px", borderBottom: `1px solid ${t.border}` }}>
          {audit.summary.map((item) => <div key={item} style={{ background: t.panel2, border: `1px solid ${t.border}`, borderRadius: 10, padding: "9px 10px", fontSize: 12, fontWeight: 850, color: t.text }}>{item}</div>)}
        </div>

        <div style={{ overflow: "auto", padding: 18 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", whiteSpace: "nowrap" }}>
            <thead>
              <tr style={{ textAlign: "left", color: t.subtext, borderBottom: `1px solid ${t.border}` }}>
                <th style={{ padding: "8px 10px" }}>Hand</th>
                <th style={{ padding: "8px 10px" }}>Engine Forecast</th>
                <th style={{ padding: "8px 10px" }}>Outcome</th>
                <th style={{ padding: "8px 10px" }}>Result</th>
                <th style={{ padding: "8px 10px" }}>Engine</th>
                <th style={{ padding: "8px 10px" }}>Action</th>
                <th style={{ padding: "8px 10px" }}>Entry Signal</th>
                <th style={{ padding: "8px 10px" }}>Exit Signal</th>
                <th style={{ padding: "8px 10px" }}>DPI</th>
                <th style={{ padding: "8px 10px" }}>Net</th>
              </tr>
            </thead>
            <tbody>
              {audit.rows.map((row) => {
                const outcomeLabel = formatSpinAsBaccarat(row.outcome);
                const executionLabel = row.unitBet > 0 ? "EXEC" : "HOLD";
                const nextRow = displayHistory.find((item) => item.spin === row.spin + 1) ?? null;
                const previousRow = displayHistory.find((item) => item.spin === row.spin - 1) ?? null;
                const forecastLabel = row.predictedGroup || row.forecastGroup ? formatGroupAsBaccarat(row.predictedGroup ?? row.forecastGroup) : "HOLD";
                const entrySignal = `${Math.round(row.confidence)}%`;
                const currentDpi = typeof row.dpi === "number" ? row.dpi : getDpiValue(displayHistory.filter((item) => item.spin < row.spin));
                const exitSignal = nextRow ? `${Math.round(nextRow.confidence)}%` : "—";
                const signalDirection = nextRow ? nextRow.confidence > row.confidence ? "▲" : nextRow.confidence < row.confidence ? "▼" : "→" : "";
                return <tr key={`audit-${row.spin}`} style={{ borderBottom: `1px solid ${t.border}`, background: row.result === "win" ? "rgba(34,197,94,0.07)" : row.result === "loss" ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.05)" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 950 }}>{row.spin}</td>
                  <td style={{ padding: "8px 10px", color: COLORS.cyan, fontWeight: 950 }}>{forecastLabel}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 900 }}>{outcomeLabel}</td>
                  <td style={{ padding: "8px 10px", color: resultColor(row.result), fontWeight: 950 }}>{row.result.toUpperCase()}</td>
                  <td style={{ padding: "8px 10px", color: t.text, fontWeight: 900 }}>{formatBaccaratEngineLabel(row.note, row.tier)}</td>
                  <td style={{ padding: "8px 10px", color: executionLabel === "EXEC" ? COLORS.blue : t.subtext, fontWeight: 950 }}>{executionLabel}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 900 }}>{entrySignal}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 900, color: signalDirection === "▲" ? COLORS.green : signalDirection === "▼" ? COLORS.red : t.text }}>{exitSignal} {signalDirection}</td>
                  <td style={{ padding: "8px 10px", color: currentDpi <= -5 ? COLORS.amber : t.text, fontWeight: 950 }}>{currentDpi}</td>
                  <td style={{ padding: "8px 10px", color: row.net > 0 ? COLORS.green : row.net < 0 ? COLORS.red : t.subtext, fontWeight: 900 }}>{row.net}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "12px 18px", borderTop: `1px solid ${t.border}`, color: audit.diagnosis.includes("WARNING") ? COLORS.red : t.subtext, fontSize: 12, fontWeight: 900, lineHeight: 1.45 }}>
          {audit.diagnosis}<div style={{ color: t.subtext, marginTop: 6 }}>Entry Signal and DPI are hand-start values. Exit Signal is the post-settlement value that becomes the next hand's entry signal. PUSH occurs only during true HOLD / Observe / No Forecast states.</div>
        </div>
      </div>
    </div>;
  };


    return <><StreakAuditModal /><CollapsiblePanel id="bankrollChart" title="Live Baccarat Bankroll Chart" style={{ minHeight: "unset", overflow: "hidden" }}><div style={{ width: "100%", overflow: "hidden" }}><svg viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "auto", maxHeight: 360, display: "block", background: t.panel2, borderRadius: 12 }}>
      {streakBands.map((band, index) => {
        const x1 = x(Math.max(0, band.startSpin - 1));
        const x2 = x(Math.max(band.startSpin, band.endSpin));
        const fill = band.type === "win" ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.11)";
        const stroke = band.type === "win" ? "rgba(34,197,94,0.22)" : "rgba(239,68,68,0.24)";
        return <g key={`${band.type}-${band.startSpin}-${band.endSpin}-${index}`} style={{ cursor: "pointer" }} onClick={() => setSelectedStreakBand(band)}><rect x={x1} y={pt} width={Math.max(3, x2 - x1)} height={chartH - pt - pb} fill={fill} stroke={stroke} strokeWidth="1" /><text x={x1 + 5} y={pt + 14} fill={band.type === "win" ? COLORS.green : COLORS.red} fontSize="10" fontWeight="900">{band.type === "win" ? "W" : "L"}{band.length}</text></g>;
      })}
      {chartTicks.map((tick) => { const yy = y(tick); return <g key={tick}><line x1={pl} x2={chartW - pr} y1={yy} y2={yy} stroke={t.border} /><text x={pl - 10} y={yy + 4} textAnchor="end" fill={t.subtext} fontSize="12" fontWeight="900">{tick.toLocaleString()}</text></g>; })}<line x1={pl} x2={chartW - pr} y1={y(startingBankroll)} y2={y(startingBankroll)} stroke="rgba(250,204,21,0.72)" strokeDasharray="4 4" /><text x={chartW - pr - 130} y={y(startingBankroll) - 6} fill={COLORS.yellow} fontSize="12" fontWeight="800">Start {startingBankroll}</text><polyline points={chartPoints} fill="none" stroke={COLORS.cyan} strokeWidth="3" />{chartData.length > 1 ? <circle cx={x(maxSpin)} cy={y(chartData.at(-1)!.bankroll)} r="5" fill={COLORS.cyan} /> : null}<g transform={`translate(${pl},${chartH - 16})`}><rect x="0" y="-10" width="10" height="10" fill="rgba(34,197,94,0.18)" stroke="rgba(34,197,94,0.32)" /><text x="16" y="0" fill={t.subtext} fontSize="10" fontWeight="900">Win streak zone</text><rect x="126" y="-10" width="10" height="10" fill="rgba(239,68,68,0.18)" stroke="rgba(239,68,68,0.32)" /><text x="142" y="0" fill={t.subtext} fontSize="10" fontWeight="900">Loss streak zone</text></g></svg></div><div style={{ marginTop: 8, color: t.subtext, fontSize: 11, fontWeight: 850 }}>Click any shaded W/L streak zone on the chart to open the streak analysis popup.</div></CollapsiblePanel></>;
  };
  const baccaratChartData = [{ hand: Math.max(0, (visibleChartHistory[0]?.spin ?? 1) - 1), bankroll: visibleChartHistory[0]?.bankroll ?? startingBankroll }, ...visibleChartHistory.map((h) => ({ hand: h.spin, bankroll: h.bankroll }))];
  const baccaratBankroll = displayHistory.at(-1)?.bankroll ?? startingBankroll;
  const baccaratCount = getDpiValue(displayHistory);
  const baccaratWins = displayHistory.filter((h) => h.result === "win").length;
  const baccaratLosses = displayHistory.filter((h) => h.result === "loss").length;
  const baccaratSettled = baccaratWins + baccaratLosses;
  const baccaratWinRate = baccaratSettled ? `${((baccaratWins / baccaratSettled) * 100).toFixed(1)}%` : "0.0%";

  const BaccaratManualSimulator = () => {
    return <Panel title="Manual Simulator">
      <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => addBaccaratOutcome("P")} style={{ border: "none", background: COLORS.blue, color: "white", borderRadius: 10, padding: "11px 14px", fontWeight: 950, cursor: "pointer" }}>Player</button>
          <button onClick={() => addBaccaratOutcome("B")} style={{ border: "none", background: COLORS.red, color: "white", borderRadius: 10, padding: "11px 14px", fontWeight: 950, cursor: "pointer" }}>Banker</button>
        </div>
      </div>
    </Panel>;
  };

  const BaccaratTable = () => {
    const maxRows = 6;
    const recentHands = baccaratHistory.slice(-90);
    const cells: Array<{ col: number; row: number; step: BaccaratStep }> = [];
    const occupied = new Set<string>();
    let lastOutcome: BaccaratOutcome | null = null;
    let lastCol = 0;
    let lastRow = 0;
    let runStartCol = 0;
    let rightMostCol = -1;
    const key = (col: number, row: number) => `${col}-${row}`;

    recentHands.forEach((step) => {
      let nextCol = 0;
      let nextRow = 0;
      if (lastOutcome == null) {
        nextCol = 0;
        nextRow = 0;
        runStartCol = 0;
      } else if (step.outcome !== lastOutcome) {
        nextCol = runStartCol + 1;
        nextRow = 0;
        while (occupied.has(key(nextCol, nextRow))) nextCol += 1;
        runStartCol = nextCol;
      } else {
        const canMoveDown = lastRow < maxRows - 1 && !occupied.has(key(lastCol, lastRow + 1));
        if (canMoveDown) {
          nextCol = lastCol;
          nextRow = lastRow + 1;
        } else {
          nextCol = lastCol + 1;
          nextRow = lastRow;
          while (occupied.has(key(nextCol, nextRow))) nextCol += 1;
        }
      }
      cells.push({ col: nextCol, row: nextRow, step });
      occupied.add(key(nextCol, nextRow));
      lastOutcome = step.outcome;
      lastCol = nextCol;
      lastRow = nextRow;
      rightMostCol = Math.max(rightMostCol, nextCol);
    });

    const minVisibleCol = Math.max(0, rightMostCol - 21);
    const visibleCells = cells.filter((cell) => cell.col >= minVisibleCol);
    const visibleColCount = Math.max(22, rightMostCol - minVisibleCol + 1);

    return <CollapsiblePanel id="baccaratTable" title="Baccarat Table" style={{ minHeight: 260 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", color: t.subtext, fontSize: 12, fontWeight: 800, marginBottom: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 999, border: `3px solid ${COLORS.blue}`, display: "inline-block" }} />Player</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 999, border: `3px solid ${COLORS.red}`, display: "inline-block" }} />Banker</span>
      </div>
      <div style={{ color: t.subtext, fontSize: 12, marginBottom: 12 }}>Hands run downward to six. Same-side overflow moves horizontally; an opposite hand starts beside the start of the prior run.</div>
      <div style={{ overflowX: "auto", padding: 4 }}>
        <div style={{ display: "grid", gridTemplateRows: `repeat(${maxRows}, 34px)`, gridTemplateColumns: `repeat(${visibleColCount}, 42px)`, gap: "4px 6px", width: "max-content", minWidth: "100%" }}>
          {visibleCells.map((cell) => {
            const displayCol = cell.col - minVisibleCol;
            const step = cell.step;
            return <div key={`${step.hand}-${displayCol}-${cell.row}`} style={{ gridColumn: displayCol + 1, gridRow: cell.row + 1, width: 42, height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span title={`Hand ${step.hand}: ${step.outcome === "B" ? "Banker" : "Player"}`} style={{ width: 24, height: 24, borderRadius: 999, border: `4px solid ${step.outcome === "B" ? COLORS.red : COLORS.blue}`, display: "inline-block", background: t.panel }} />
            </div>;
          })}
        </div>
      </div>
      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
        <MiniMetric label="Displayed Hands" value={recentHands.length} />
        <MiniMetric label="Player" value={recentHands.filter((h) => h.outcome === "P").length} />
        <MiniMetric label="Banker" value={recentHands.filter((h) => h.outcome === "B").length} />
        <MiniMetric label="Last Outcome" value={baccaratHistory.at(-1)?.outcome ?? "-"} />
      </div>
    </CollapsiblePanel>;
  };

  const RecentLog = () => (
    <CollapsiblePanel id="sessionLog" title="Session Log" style={{ minHeight: 408 }}>
      <div style={{ maxHeight: 356, overflowY: "auto", display: "grid", gap: 8 }}>
        {recent.length === 0 ? (
          <div style={{ color: t.subtext, fontSize: 13 }}>No hands yet.</div>
        ) : (
          recent.map((s) => {
            const handIndex = history.findIndex((row) => row.spin === s.spin);
            const upToHand = history.slice(0, handIndex >= 0 ? handIndex + 1 : history.length);
            const rowDpi = getDpiValue(upToHand);
            const outcomeSide = formatBaccaratSideShort(spinToBaccaratOutcome(s.outcome));
            const betSide = s.predictedGroup ? formatGroupAsBaccaratShort(s.predictedGroup) : "—";
            // SESSION LOG FORECAST LOCK
            // The row's Bet is the side that was actually wagered/settled for that hand.
            // The Forecast line should mirror the Signal State produced after that hand,
            // so it is computed from the exact hand-by-hand history snapshot instead of
            // stale note text or the settled bet side.
            const signalStateDecisionForRow = getActiveDecision(
              upToHand,
              pulseEnabled,
              bbStraightEnabled,
              bbInvertedEnabled,
              markovEnabled,
              cadenceEnabled,
              scoutEnabled
            );
            const signalForecastSide = signalStateDecisionForRow.group
              ? formatGroupAsBaccaratShort(signalStateDecisionForRow.group)
              : "—";
            const engineLabel = formatBaccaratEngineLabel(s.note, s.tier);
            const modeLabel =
              engineLabel === "BB Straight"
                ? "Straight"
                : engineLabel === "BB Inverted"
                ? "Inverted"
                : engineLabel;
            const shoeNumber = Math.max(1, Math.ceil(s.spin / Math.max(1, Number(autoSpins) || DEFAULT_AUTO_SPINS)));
            const resultColor = s.result === "win" ? COLORS.green : s.result === "loss" ? COLORS.red : t.subtext;

            return (
              <div
                key={s.spin}
                style={{
                  border: `1px solid ${t.border}`,
                  borderRadius: 12,
                  padding: 11,
                  background: t.panel2,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 950,
                    fontSize: 14,
                    marginBottom: 6,
                  }}
                >
                  <span>Hand {s.spin}</span>
                  <span style={{ color: resultColor }}>{s.result.toUpperCase()}</span>
                </div>

                <div style={{ fontSize: 12, color: t.text, lineHeight: 1.45 }}>
                  <div>Outcome: {outcomeSide}</div>
                  <div>Settled Bet: {betSide}</div>
                  <div>Bet Amount: {s.exposure > 0 ? s.exposure : s.unitBet}</div>
                  <div>Bankroll: {s.bankroll}</div>
                  <div>DPI: {rowDpi}</div>
                  <div>Decision Layer: BB/DPI</div>
                  <div>Mode: {modeLabel}</div>
                  <div>Recovery State: {s.etrStateAfter ?? "off"}</div>
                  <div>Recovery Step: {s.recoveryStep ?? 0}</div>
                  {strategy === "1-3-2-6" ? <div>1-3-2-6 Step: {(s.oneThreeTwoSixStep ?? 0) + 1}</div> : null}
                  <div>Shoe: {shoeNumber}</div>
                  <div style={{ color: t.subtext, marginTop: 4 }}>{`${engineLabel} · Forecast ${signalForecastSide}`}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </CollapsiblePanel>
  );
  const displayStrategyName = (name: Strategy) => name;

  const roiColor = (roiValue: string) => {
    const n = Number(roiValue);
    if (n > 0) return COLORS.green;
    if (n < 0) return COLORS.red;
    return t.text;
  };

  const ComparisonTable = ({ title = "Strategy Comparison", compact = false }: { title?: string; compact?: boolean }) => {
    if (compact) {
      return <CollapsiblePanel id={`strategyComparison-${title}-compact`} title={title}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: t.text, tableLayout: "fixed" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: `1px solid ${t.border}` }}>
              <th style={{ paddingBottom: 7, width: "42%" }}>Strategy</th>
              <th style={{ paddingBottom: 7, textAlign: "center", width: "22%" }}>End</th>
              <th style={{ paddingBottom: 7, textAlign: "center", width: "18%" }}>ROI</th>
              <th style={{ paddingBottom: 7, textAlign: "center", width: "18%" }}>PF</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map(row => <tr key={row.strategy} style={{ borderBottom: `1px solid ${t.border}` }}>
              <td style={{ padding: "8px 0", fontWeight: 900, whiteSpace: "normal", lineHeight: 1.15 }}>{displayStrategyName(row.strategy)}</td>
              <td style={{ textAlign: "center", fontWeight: 850 }}>{row.end.toLocaleString()}</td>
              <td style={{ textAlign: "center", fontWeight: 950, color: roiColor(row.roi) }}>{row.roi}%</td>
              <td style={{ textAlign: "center", fontWeight: 950, color: row.profitFactor === "0.00" ? t.subtext : COLORS.cyan }}>{row.profitFactor}</td>
            </tr>)}
          </tbody>
        </table>
        <div style={{ marginTop: 9, color: t.subtext, fontSize: 11, fontWeight: 800, lineHeight: 1.45 }}>
          Full diagnostics are available in Analytics.
        </div>
      </CollapsiblePanel>;
    }

    return <CollapsiblePanel id={`strategyComparison-${title}-full`} title={title}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: t.text }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: `1px solid ${t.border}` }}>
            <th style={{ paddingBottom: 7 }}>Strategy</th>
            <th style={{ textAlign: "center" }}>End</th>
            <th style={{ textAlign: "center" }}>ROI</th>
            <th style={{ textAlign: "center" }}>Win%</th>
            <th style={{ textAlign: "center" }}>Obs</th>
            <th style={{ textAlign: "center" }}>Largest</th>
            <th style={{ textAlign: "center" }}>Max DD</th>
            <th style={{ textAlign: "center" }}>PF</th>
          </tr>
        </thead>
        <tbody>
          {comparison.map(row => <tr key={row.strategy} style={{ borderBottom: `1px solid ${t.border}` }}>
            <td style={{ padding: "7px 0", fontWeight: 800 }}>{row.strategy}</td>
            <td style={{ textAlign: "center" }}>{row.end.toLocaleString()}</td>
            <td style={{ textAlign: "center", color: roiColor(row.roi), fontWeight: 900 }}>{row.roi}%</td>
            <td style={{ textAlign: "center" }}>{row.winRate}%</td>
            <td style={{ textAlign: "center" }}>{row.obs}</td>
            <td style={{ textAlign: "center" }}>{row.largest}</td>
            <td style={{ textAlign: "center" }}>{row.maxDrawdown.toLocaleString()}</td>
            <td style={{ textAlign: "center", color: row.profitFactor === "0.00" ? t.subtext : COLORS.cyan, fontWeight: 900 }}>{row.profitFactor}</td>
          </tr>)}
        </tbody>
      </table>
    </CollapsiblePanel>;
  };
  const StreamsPanel = () => null;

  const WheelOverlayPanel = () => null;

  const DimensionTDAPanel = () => {
  return null;
};

  const DpiTerminalPanel = () => {
    // BACCARAT SINGLE-DIMENSION DPI PANEL
    // Roulette used Player / Banker. Baccarat uses one binary axis only:
    // Player = primary/base side above -5, Banker = inverted/base side at or below -5.
    const value = baccaratCount;
    const transitionActive = value <= -5;
    const sideTitle = transitionActive ? "BANKER" : "PLAYER";
    const sideColor = transitionActive ? COLORS.red : COLORS.blue;
    const modeLabel = transitionActive ? "INVERTED" : "STRAIGHT";
    const modeColor = transitionActive ? COLORS.red : "#ffffff";
    const zone = value <= -5 ? "Transition" : value <= -2 ? "Pressure" : "Neutral";
    const accent = value <= -5 ? COLORS.red : value <= -2 ? COLORS.amber : COLORS.green;
    const barWidth = `${Math.min(100, Math.max(8, Math.abs(value) * 18))}%`;

    return <CollapsiblePanel id="bbDimensionDpi" title="Directional Pressure Index"><div style={{ display: "grid", gap: 10 }}>
      <div style={{ border: `1px solid ${t.border}`, background: dpiRowBg, borderRadius: 12, padding: "12px 12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "78px 1fr 44px", gap: 10, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, color: t.subtext, fontWeight: 950, letterSpacing: 0.8, textTransform: "uppercase" }}>DPI SIDE</div>
            <div style={{ marginTop: 3, fontSize: 13, color: sideColor, fontWeight: 950 }}>{sideTitle}</div>
          </div>
          <div>
            <div style={{ height: 9, borderRadius: 999, background: dpiTrackBg, overflow: "hidden", border: `1px solid ${t.border}` }}>
              <div style={{ width: barWidth, height: "100%", borderRadius: 999, background: accent, boxShadow: `0 0 12px ${accent}66` }} />
            </div>
            <div style={{ marginTop: 5, fontSize: 10, color: accent, fontWeight: 950, textTransform: "uppercase", letterSpacing: 0.5 }}>{zone}</div>
          </div>
          <div style={{ color: accent, fontSize: 24, fontWeight: 950, textAlign: "center", lineHeight: 1 }}>{value}</div>
        </div>
      </div>
      <div style={{ border: `1px solid ${t.border}`, background: t.panel2, borderRadius: 12, padding: "10px 11px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 10, color: t.subtext, fontWeight: 950, letterSpacing: 0.8, textTransform: "uppercase" }}>Mode</div>
        <div style={{ fontSize: 15, fontWeight: 950, color: modeColor, textAlign: "right" }}>{modeLabel}</div>
      </div>
    </div></CollapsiblePanel>;
  };


  const SignalDpiSpreadPanel = () => {
    const hasSignalDpiData = history.length > 0;
    const signal = hasSignalDpiData ? Math.max(0, Math.min(100, Math.round(Number(pulseConfidenceScore || 0)))) : null;
    const dpi = hasSignalDpiData ? getDpiValue(history) : null;
    const spread = hasSignalDpiData && signal !== null && dpi !== null ? Math.abs(signal - Math.abs(dpi)) : null;
    const signalAccent = !hasSignalDpiData || signal === null ? t.subtext : signal >= 65 ? COLORS.green : signal >= 50 ? COLORS.amber : COLORS.red;
    const dpiAccent = !hasSignalDpiData || dpi === null ? t.subtext : dpi <= -8 ? COLORS.red : dpi <= -5 ? COLORS.amber : COLORS.green;
    const spreadAccent = !hasSignalDpiData || spread === null ? t.subtext : spread >= 25 ? COLORS.red : spread >= 12 ? COLORS.amber : t.text;

    const metric = (label: string, value: any, color: string) => (
      <div style={{ minWidth: 0, textAlign: "center" }}>
        <div style={{ fontSize: 10, color: t.subtext, fontWeight: 950, letterSpacing: 0.7, textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</div>
        <div style={{ marginTop: 7, fontSize: 28, lineHeight: 1, color, fontWeight: 950 }}>{value}</div>
      </div>
    );

    return <CollapsiblePanel id="signalDpiOverview" title="Signal & DPI Overview"><div style={{ border: `1px solid ${t.border}`, background: t.panel2, borderRadius: 12, padding: "12px 10px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr 1px 1fr", gap: 10, alignItems: "center" }}>
        {metric("Signal", hasSignalDpiData && signal !== null ? `${signal}%` : "--", signalAccent)}
        <div style={{ width: 1, height: 46, background: t.border }} />
        {metric("Spread (|S - D|)", hasSignalDpiData && spread !== null ? spread : "--", spreadAccent)}
        <div style={{ width: 1, height: 46, background: t.border }} />
        {metric("DPI", hasSignalDpiData && dpi !== null ? dpi : "--", dpiAccent)}
      </div>
    </div></CollapsiblePanel>;
  };

  const ControlsPanel = () => (
    <section style={{ marginBottom: 14, display: "grid", gap: 10, minWidth: 0 }}>
      <button
        onClick={() => setControlsOpen((v) => !v)}
        style={{ height: 42, borderRadius: 14, border: `1px solid ${t.border}`, background: t.panel, color: t.text, fontWeight: 950, cursor: "pointer", textAlign: "left", padding: "0 14px" }}
      >
        {controlsOpen ? "▾" : "▸"} Controls
      </button>
      {controlsOpen ? (
        <Panel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))", gap: 10, alignItems: "end", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Starting Bankroll</div>
              <NumericInput
                value={startingBankroll}
                min={1}
                onCommit={(n: number) => {
                  setStartingBankroll(n);
                  rebuild(n, baseUnit, strategy);
                  setBaccaratHistory((current) => runBaccaratOutcomes(current.map((h) => h.outcome), baseUnit, n, tableLimit));
                }}
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Base Unit / Hand</div>
              <NumericInput
                value={baseUnit}
                min={1}
                onCommit={(n: number) => {
                  setBaseUnit(n);
                  rebuild(startingBankroll, n, strategy);
                  setBaccaratHistory((current) => runBaccaratOutcomes(current.map((h) => h.outcome), n, startingBankroll, tableLimit));
                }}
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Strategy</div>
              <Select value={strategy} onChange={(e: any) => { const s = e.target.value as Strategy; setStrategy(s); rebuild(startingBankroll, baseUnit, s); }} options={STRATEGIES} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Hands / Shoe</div>
              <NumericInput value={autoSpins} min={1} onCommit={(n: number) => setAutoSpins(Math.max(1, Math.round(n)))} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Shoes</div>
              <NumericInput value={numberOfShoes} min={1} onCommit={(n: number) => setNumberOfShoes(Math.max(1, Math.round(n)))} />
            </div>
            <Button onClick={runAuto} disabled={autoRunning}>{autoRunning ? "Running..." : "Auto Run"}</Button>
            <Button variant="secondary" onClick={undoBaccaratHand} disabled={!baccaratHistory.length}>Undo</Button>
            <Button variant="secondary" onClick={reset}>Reset</Button>
          </div>
        </Panel>
      ) : null}
    </section>
  );

  const EngineStrip = () => {
    const rows = [
      { name: "BB Straight", on: !pulseEnabled && bbStraightEnabled && !bbInvertedEnabled && !markovEnabled, sim: straightShadowRows, accent: COLORS.blue },
      { name: "BB Straight + PULSE", on: pulseEnabled && bbStraightEnabled && !bbInvertedEnabled && !markovEnabled, sim: pulseStraightShadowRows, accent: COLORS.cyan },
      { name: "BB Inverted", on: !pulseEnabled && bbInvertedEnabled && !markovEnabled, sim: invertedShadowRows, accent: COLORS.amber },
      { name: "BB Inverted + PULSE", on: pulseEnabled && bbInvertedEnabled && !markovEnabled, sim: pulseInvertedShadowRows, accent: COLORS.cyan },
      { name: "Markov", on: markovEnabled && !pulseEnabled, sim: markovShadowRows, accent: COLORS.green },
      { name: "Markov + PULSE", on: markovEnabled && pulseEnabled, sim: pulseMarkovShadowRows, accent: COLORS.cyan },
    ].map((row) => {
      const wins = row.sim.filter(x => x.result === "win").length;
      const losses = row.sim.filter(x => x.result === "loss").length;
      const active = wins + losses;
      const end = row.sim.at(-1)?.bankroll ?? startingBankroll;
      const roi = startingBankroll ? ((end - startingBankroll) / startingBankroll) * 100 : 0;
      const longestLoss = getLongestLossStreakFromRows(row.sim);
      return { ...row, active, wr: active ? ((wins / active) * 100).toFixed(1) : "0.0", roi, longestLoss };
    });

    return <CollapsiblePanel id="engineStrip" title="Engine Shadow Comparison">
      
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map(r => <div key={r.name} style={{ border: `1px solid ${t.border}`, background: t.panel2, borderRadius: 12, padding: "9px 10px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
            <div style={{ fontWeight: 950, fontSize: 12, color: r.accent }}>{r.name}</div>
            <div style={{ color: r.on ? COLORS.green : t.subtext, fontWeight: 950, fontSize: 11 }}>{r.on ? "LIVE" : "SHADOW"}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 8, fontSize: 11 }}>
            <div><span style={{ color: t.subtext, fontWeight: 900 }}>WR</span><br /><b style={{ color: t.text }}>{r.wr}%</b></div>
            <div><span style={{ color: t.subtext, fontWeight: 900 }}>ROI</span><br /><b style={{ color: r.roi >= 0 ? COLORS.green : COLORS.red }}>{r.roi.toFixed(1)}%</b></div>
            <div><span style={{ color: t.subtext, fontWeight: 900 }}>SIG</span><br /><b style={{ color: t.text }}>{r.active}</b></div>
            <div><span style={{ color: t.subtext, fontWeight: 900 }}>LL</span><br /><b style={{ color: r.longestLoss >= 8 ? COLORS.red : r.longestLoss >= 5 ? COLORS.amber : COLORS.green }}>{r.longestLoss}</b></div>
          </div>
        </div>)}
      </div>
    </CollapsiblePanel>;
  };

  const getEngineComparisonRows = () => [
    { name: "BB Straight", on: !pulseEnabled && bbStraightEnabled && !bbInvertedEnabled && !markovEnabled, sim: straightShadowRows },
    { name: "BB Straight + PULSE", on: pulseEnabled && bbStraightEnabled && !bbInvertedEnabled && !markovEnabled, sim: pulseStraightShadowRows },
    { name: "BB Inverted", on: !pulseEnabled && bbInvertedEnabled && !markovEnabled, sim: invertedShadowRows },
    { name: "BB Inverted + PULSE", on: pulseEnabled && bbInvertedEnabled && !markovEnabled, sim: pulseInvertedShadowRows },
    { name: "Markov", on: !pulseEnabled && markovEnabled, sim: markovShadowRows },
    { name: "Markov + PULSE", on: pulseEnabled && markovEnabled, sim: pulseMarkovShadowRows },
  ];

  const getExecutionMetrics = (rows: Step[]) => {
    const wins = rows.filter((r) => r.result === "win").length;
    const losses = rows.filter((r) => r.result === "loss").length;
    const active = wins + losses;
    const end = rows.at(-1)?.bankroll ?? startingBankroll;
    const roi = startingBankroll ? ((end - startingBankroll) / startingBankroll) * 100 : 0;
    const wr = active ? (wins / active) * 100 : 0;
    const grossWins = rows.filter((r) => r.net > 0).reduce((sum, r) => sum + r.net, 0);
    const grossLosses = Math.abs(rows.filter((r) => r.net < 0).reduce((sum, r) => sum + r.net, 0));
    const pf = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;
    let peak = startingBankroll;
    let dd = 0;
    rows.forEach((r) => {
      peak = Math.max(peak, r.bankroll);
      dd = Math.max(dd, peak - r.bankroll);
    });
    return { wins, losses, active, end, roi, wr, pf, dd, ll: getLongestLossStreakFromRows(rows) };
  };

  const getRawSignalMetrics = (rows: Step[]) => {
    const signalRows = rows.filter((r) => !!r.forecastGroup);
    const isSideCorrect = (r: Step) => groupToBaccaratSide(r.forecastGroup as GroupKey) === spinToBaccaratOutcome(r.outcome);
    const correct = signalRows.filter(isSideCorrect).length;
    const rawAccuracy = signalRows.length ? (correct / signalRows.length) * 100 : 0;
    const edge = rawAccuracy - 50;

    let entropySignals = 0;
    let entropyCorrect = 0;
    let stabilitySignals = 0;
    let stabilityCorrect = 0;
    let persistenceSignals = 0;
    let persistenceCorrect = 0;
    let qualitySignals = 0;
    let qualityCorrect = 0;

    signalRows.forEach((row, index) => {
      const priorRows = rows.slice(0, Math.max(0, row.spin - 1));
      const e = entropy(priorRows.map((r) => r.outcomeGroup));
      const isCorrect = isSideCorrect(row);

      if (e >= 55) {
        entropySignals += 1;
        if (isCorrect) entropyCorrect += 1;
      }

      const previousSignal = signalRows[index - 1];
      if (previousSignal?.forecastGroup && previousSignal.forecastGroup === row.forecastGroup) {
        stabilitySignals += 1;
        if (isCorrect) stabilityCorrect += 1;
      }

      const previousOutcome = rows.find((r) => r.spin === row.spin - 1);
      if (previousOutcome?.outcomeGroup && previousOutcome.outcomeGroup === row.forecastGroup) {
        persistenceSignals += 1;
        if (isCorrect) persistenceCorrect += 1;
      }

      if (row.confidence >= 65) {
        qualitySignals += 1;
        if (isCorrect) qualityCorrect += 1;
      }
    });

    const pct = (wins: number, trials: number) => trials ? (wins / trials) * 100 : 0;
    const entropyFit = pct(entropyCorrect, entropySignals);
    const stability = pct(stabilityCorrect, stabilitySignals);
    const persistence = pct(persistenceCorrect, persistenceSignals);
    const signalQuality = pct(qualityCorrect, qualitySignals);

    return {
      signals: signalRows.length,
      rawAccuracy,
      edge,
      entropyFit,
      stability,
      persistence,
      signalQuality,
    };
  };

  const LiveExecutionPerformancePanel = () => {
    const rows = getEngineComparisonRows().map((row) => ({ ...row, metrics: getExecutionMetrics(row.sim) }));
    return <Panel title="Live Execution Performance"><div style={{ color: t.subtext, fontSize: 11, fontWeight: 800, marginBottom: 10 }}></div><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: t.text }}><thead><tr style={{ textAlign: "left", borderBottom: `1px solid ${t.border}` }}><th style={{ paddingBottom: 7 }}>Engine</th><th style={{ textAlign: "center" }}>ROI</th><th style={{ textAlign: "center" }}>Bankroll</th><th style={{ textAlign: "center" }}>WR</th><th style={{ textAlign: "center" }}>PF</th><th style={{ textAlign: "center" }}>DD</th><th style={{ textAlign: "center" }}>LL</th></tr></thead><tbody>{rows.map((row) => {
      const m = row.metrics;
      return <tr key={row.name} style={{ borderBottom: `1px solid ${t.border}` }}><td style={{ padding: "8px 0", fontWeight: 900 }}>{row.name} <span style={{ color: row.on ? COLORS.green : t.subtext, fontSize: 10, marginLeft: 6 }}>{row.on ? "LIVE" : "SHADOW"}</span></td><td style={{ textAlign: "center", color: m.roi >= 0 ? COLORS.green : COLORS.red, fontWeight: 950 }}>{m.roi.toFixed(1)}%</td><td style={{ textAlign: "center", fontWeight: 900 }}>{m.end.toLocaleString()}</td><td style={{ textAlign: "center" }}>{m.wr.toFixed(1)}%</td><td style={{ textAlign: "center", color: m.pf === Infinity ? COLORS.green : m.pf >= 1 ? COLORS.green : COLORS.red, fontWeight: 900 }}>{m.pf === Infinity ? "∞" : m.pf.toFixed(2)}</td><td style={{ textAlign: "center", color: m.dd > 0 ? COLORS.amber : COLORS.green }}>{m.dd.toLocaleString()}</td><td style={{ textAlign: "center", color: m.ll >= 8 ? COLORS.red : m.ll >= 5 ? COLORS.amber : COLORS.green, fontWeight: 950 }}>{m.ll}</td></tr>;
    })}</tbody></table></Panel>;
  };

  

  const EngineIntelligencePanel = () => {
    const rows = getEngineComparisonRows().map((row) => ({
      name: row.name,
      on: row.on,
      metrics: getRawSignalMetrics(row.sim),
    }));

    return (
      <Panel title="Engine Intelligence">
        <div
          style={{
            color: t.subtext,
            fontSize: 11,
            fontWeight: 800,
            marginBottom: 10,
          }}
        >
          
        </div>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
            fontSize: 12,
            color: t.text,
          }}
        >
          <colgroup>
            <col style={{ width: "68%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
          </colgroup>
          <thead>
            <tr
              style={{
                textAlign: "left",
                borderBottom: `1px solid ${t.border}`,
              }}
            >
              <th style={{ paddingBottom: 7 }}>Engine</th>
              <th style={{ textAlign: "center" }}>Accuracy</th>
              <th style={{ textAlign: "center" }}>Signal Quality</th>
              <th style={{ textAlign: "center" }}>Stability</th>
              <th style={{ textAlign: "center" }}>Persistence</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const quality =
                row.metrics.quality ??
                row.metrics.signalQuality ??
                0;

              return (
                <tr
                  key={row.name}
                  style={{
                    borderBottom: `1px solid ${t.border}`,
                  }}
                >
                  <td
                    style={{
                      padding: "8px 0",
                      fontWeight: 900,
                    }}
                  >
                    {row.name}{" "}
                    <span
                      style={{
                        color: row.on ? COLORS.green : t.subtext,
                        fontSize: 10,
                        marginLeft: 6,
                        fontWeight: 950,
                      }}
                    >
                      {row.on ? "LIVE" : "SHADOW"}
                    </span>
                  </td>

                  <td
                    style={{
                      textAlign: "center",
                      color:
                        row.metrics.rawAccuracy >= 18
                          ? COLORS.green
                          : row.metrics.rawAccuracy >= 14
                          ? COLORS.amber
                          : COLORS.red,
                      fontWeight: 900,
                    }}
                  >
                    {row.metrics.rawAccuracy.toFixed(1)}%
                  </td>

                  <td
                    style={{
                      textAlign: "center",
                      color:
                        quality >= 18
                          ? COLORS.green
                          : quality >= 12
                          ? COLORS.amber
                          : COLORS.red,
                      fontWeight: 900,
                    }}
                  >
                    {quality.toFixed(1)}%
                  </td>

                  <td
                    style={{
                      textAlign: "center",
                      color:
                        row.metrics.stability >= 20
                          ? COLORS.green
                          : row.metrics.stability >= 14
                          ? COLORS.amber
                          : COLORS.red,
                      fontWeight: 900,
                    }}
                  >
                    {row.metrics.stability.toFixed(1)}%
                  </td>

                  <td
                    style={{
                      textAlign: "center",
                      color:
                        row.metrics.persistence >= 16
                          ? COLORS.green
                          : row.metrics.persistence >= 10
                          ? COLORS.amber
                          : COLORS.red,
                      fontWeight: 900,
                    }}
                  >
                    {row.metrics.persistence.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    );
  };


  const EngineSpecificPulseDiagnosticsPanel = () => {
    // PHASE 1A — DIAGNOSTICS ONLY
    // These readings do not modify execution, bankroll routing, replay accounting,
    // charts, strategy progression, BB Straight, BB Inverted, or Markov logic.
    const bits = getSideBitStream(history);
    const recent = bits.slice(-16).join("");

    let flips = 0;
    const recentBits = bits.slice(-12);
    for (let i = 1; i < recentBits.length; i += 1) {
      if (recentBits[i] !== recentBits[i - 1]) flips += 1;
    }
    const stabilityScore = recentBits.length > 1 ? Math.max(0, Math.min(100, Math.round(100 - (flips / Math.max(1, recentBits.length - 1)) * 100))) : 50;

    const trapCount = (recent.match(/11011/g) || []).length;
    const compressionRisk = recent.includes("11011011") ? 90 : trapCount >= 2 ? 80 : recent.endsWith("1101") ? 68 : recent.endsWith("110") ? 48 : 18;
    const resetTrapRisk = recent.includes("11011011") || recent.endsWith("11011") ? "High" : recent.endsWith("1101") ? "Watch" : "Clear";
    const straightStatus = compressionRisk >= 80 ? "Compression Risk" : compressionRisk >= 60 ? "Trap Forming" : stabilityScore >= 62 ? "Stable" : "Mixed";

    const dpiValue = getDpiValue(history);
    const inversionEligible = dpiValue <= -5;
    const recentLossPressure = getLossStreak(history.slice(-12));

    // ENGINE-SPECIFIC INTERPRETATION UPGRADE — DISPLAY ONLY
    // Straight and Inverted are separate engines, so Pulse must not read the same pattern the same way.
    // For Straight, repeated continuation failure is harmful.
    // For Inverted, after DPI arms inversion, repeated continuation failure can be useful because Inverted harvests those failures.
    const continuationFailureBenefit = inversionEligible ? compressionRisk : 0;
    const reversalHarvestStability = inversionEligible
      ? Math.max(0, Math.min(100, Math.round((continuationFailureBenefit * 0.65) + ((100 - stabilityScore) * 0.35))))
      : 0;
    const dpiRecoveryEfficiency = inversionEligible
      ? Math.max(0, Math.min(100, Math.round(100 - Math.min(90, Math.abs(dpiValue) * 7 + recentLossPressure * 5))))
      : 0;
    const inversionExhaustion = inversionEligible
      ? Math.max(0, Math.min(100, Math.round(100 - ((reversalHarvestStability * 0.65) + (dpiRecoveryEfficiency * 0.35)))))
      : Math.min(45, Math.abs(dpiValue) * 6);
    const invertedStatus = !inversionEligible
      ? "Not Armed"
      : reversalHarvestStability >= 70
      ? "Harvesting Failures"
      : continuationFailureBenefit >= 60
      ? "Benefit Forming"
      : inversionExhaustion >= 75
      ? "Exhaustion Risk"
      : "Armed Stable";

    const markovTrials: { predicted: 0 | 1; actual: 0 | 1 }[] = [];
    for (let i = Math.max(6, history.length - 14); i < history.length; i += 1) {
      const prior = history.slice(0, i);
      const forecastRow = markovForecast(prior);
      if (!forecastRow.group) continue;
      const predicted = getSideBitFromGroup(forecastRow.group);
      if (predicted === null) continue;
      markovTrials.push({ predicted, actual: getBaccaratOutcomeBit(history[i]) });
    }
    const markovWins = markovTrials.filter((row) => row.predicted === row.actual).length;
    const markovAccuracy = markovTrials.length ? Math.round((markovWins / markovTrials.length) * 100) : 0;
    const staleMemoryRisk = markovTrials.length >= 6 && markovAccuracy <= 42 ? "High" : markovTrials.length >= 6 && markovAccuracy <= 50 ? "Watch" : "Clear";
    const migrationRisk = flips >= 7 ? "High" : flips >= 5 ? "Watch" : "Clear";
    const markovStatus = staleMemoryRisk === "High" ? "Transition Collapse" : migrationRisk !== "Clear" ? "Migration Watch" : markovTrials.length ? "Reliable" : "Waiting";
    const straightMod = getPulseEngineSpecificConfidenceModulation(history, "BB_STRAIGHT");
    const invertedMod = getPulseEngineSpecificConfidenceModulation(history, "BB_INVERTED");
    const markovMod = getPulseEngineSpecificConfidenceModulation(history, "MARKOV");
    const formatAdj = (n: number) => n > 0 ? `+${n}` : String(n);

    const colorFor = (value: number, invert = false) => {
      const v = invert ? 100 - value : value;
      return v >= 70 ? COLORS.green : v >= 60 ? COLORS.amber : COLORS.red;
    };

    const diagRows = [
      {
        engine: "BB Straight + Pulse",
        status: straightStatus,
        value: compressionRisk,
        invertColor: true,
        rows: [
          { label: "Structural Compression", value: `${compressionRisk}%`, accent: colorFor(compressionRisk, true) },
          { label: "Reset Trap", value: resetTrapRisk, accent: resetTrapRisk === "Clear" ? COLORS.green : COLORS.red },
          { label: "Confidence Mod", value: formatAdj(straightMod.adjustment), accent: straightMod.adjustment >= 0 ? t.text : COLORS.red },
        ],
      },
      {
        engine: "BB Inverted + Pulse",
        status: invertedStatus,
        value: reversalHarvestStability,
        invertColor: false,
        rows: [
          { label: "Reversal Harvest Stability", value: inversionEligible ? `${reversalHarvestStability}%` : "Standby", accent: inversionEligible ? colorFor(reversalHarvestStability) : COLORS.red },
          { label: "Continuation Failure Benefit", value: inversionEligible ? `${continuationFailureBenefit}%` : "Standby", accent: inversionEligible ? colorFor(continuationFailureBenefit) : COLORS.red },
          { label: "DPI Recovery Efficiency", value: inversionEligible ? `${dpiRecoveryEfficiency}%` : "Standby", accent: inversionEligible ? colorFor(dpiRecoveryEfficiency) : COLORS.red },
          { label: "Confidence Mod", value: formatAdj(invertedMod.adjustment), accent: invertedMod.adjustment >= 0 ? t.text : COLORS.red },
        ],
      },
      {
        engine: "Markov + Pulse",
        status: markovStatus,
        value: markovAccuracy,
        invertColor: false,
        rows: [
          { label: "Transition Reliability", value: markovTrials.length ? `${markovAccuracy}%` : "Waiting", accent: markovTrials.length ? colorFor(markovAccuracy) : COLORS.red },
          { label: "State Memory", value: staleMemoryRisk, accent: staleMemoryRisk === "Clear" ? COLORS.green : COLORS.red },
          { label: "Migration Risk", value: migrationRisk, accent: migrationRisk === "Clear" ? COLORS.green : COLORS.red },
          { label: "Confidence Mod", value: formatAdj(markovMod.adjustment), accent: markovMod.adjustment >= 0 ? t.text : COLORS.red },
        ],
      },
    ];

    const statusColorFor = (row: any) => {
      if (row.status === "Waiting" || row.status === "Not Armed") return COLORS.red;
      return colorFor(row.value, row.invertColor);
    };

    return (
      <Panel title="Pulse Engine Diagnostics">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          {diagRows.map((row) => (
            <div key={row.engine} style={{ border: `1px solid ${t.border}`, background: t.panel2, borderRadius: 14, padding: 12, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 950, color: t.text, marginBottom: 6 }}>{row.engine}</div>
              <div style={{ fontSize: 20, fontWeight: 950, color: statusColorFor(row), lineHeight: 1.15 }}>{row.status}</div>
              <div style={{ height: 1, background: t.border, margin: "10px 0 8px" }} />
              <div style={{ display: "grid", gap: 0 }}>
                {row.rows.map((item: any) => (
                  <div
                    key={item.label}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      alignItems: "center",
                      gap: 12,
                      minHeight: 30,
                      borderBottom: `1px solid ${t.border}`,
                      fontSize: 11,
                      fontWeight: 850,
                    }}
                  >
                    <span style={{ color: t.subtext, minWidth: 0 }}>{item.label}</span>
                    <span style={{ color: item.accent ?? t.text, fontWeight: 950, textAlign: "right", whiteSpace: "nowrap" }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    );
  };

const RawSignalEngineAnalyticsPanel = () => {
    const rows = getEngineComparisonRows().map((row) => ({ ...row, metrics: getRawSignalMetrics(row.sim) }));
    const scoreColor = (v: number) => v >= 55 ? COLORS.green : v >= 60 ? COLORS.amber : COLORS.red;
    return <Panel title="Raw Signal Engine Analytics"><div style={{ color: t.subtext, fontSize: 11, fontWeight: 800, marginBottom: 10 }}>Pre-execution signal intelligence. No bankroll ROI is shown here because this measures raw prediction quality, not money performance.</div><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: t.text }}><thead><tr style={{ textAlign: "left", borderBottom: `1px solid ${t.border}` }}><th style={{ paddingBottom: 7 }}>Engine</th><th style={{ textAlign: "center" }}>Raw Accuracy</th><th style={{ textAlign: "center" }}>Edge</th><th style={{ textAlign: "center" }}>Entropy Fit</th><th style={{ textAlign: "center" }}>Stability</th><th style={{ textAlign: "center" }}>Persistence</th><th style={{ textAlign: "center" }}>Signal Quality</th></tr></thead><tbody>{rows.map((row) => {
      const m = row.metrics;
      return <tr key={row.name} style={{ borderBottom: `1px solid ${t.border}` }}><td style={{ padding: "8px 0", fontWeight: 900 }}>{row.name}<div style={{ color: t.subtext, fontSize: 10, fontWeight: 800 }}>{m.signals} raw signals</div></td><td style={{ textAlign: "center", color: scoreColor(m.rawAccuracy), fontWeight: 950 }}>{m.rawAccuracy.toFixed(1)}%</td><td style={{ textAlign: "center", color: m.edge >= 0 ? COLORS.green : COLORS.red, fontWeight: 900 }}>{m.edge >= 0 ? "+" : ""}{m.edge.toFixed(1)}</td><td style={{ textAlign: "center", color: scoreColor(m.entropyFit) }}>{m.entropyFit.toFixed(1)}%</td><td style={{ textAlign: "center", color: scoreColor(m.stability) }}>{m.stability.toFixed(1)}%</td><td style={{ textAlign: "center", color: scoreColor(m.persistence) }}>{m.persistence.toFixed(1)}%</td><td style={{ textAlign: "center", color: scoreColor(m.signalQuality), fontWeight: 950 }}>{m.signalQuality.toFixed(1)}%</td></tr>;
    })}</tbody></table></Panel>;
  };

  const EngineAnalyticsTable = LiveExecutionPerformancePanel;

  const getPulseShadowRows = () => pulseShadowRows;


const StreakAnalyticsPanel = () => {
    const severityAccent = lossStreakSeverity === "Critical" ? COLORS.red : lossStreakSeverity === "Pressure" ? COLORS.amber : lossStreakSeverity === "Elevated" ? COLORS.yellow : COLORS.green;
    const currentLabel = streakStats.currentType === "win" ? `W${streakStats.currentWinStreak}` : streakStats.currentType === "loss" ? `L${streakStats.currentLossStreak}` : "—";
    const currentAccent = streakStats.currentType === "win" ? COLORS.green : streakStats.currentType === "loss" ? COLORS.red : t.subtext;
    const lossSegments = streakStats.segments.filter((segment) => segment.type === "loss").slice(-8).reverse();

    const getStructuralGateForSegment = (segment: { startSpin: number; endSpin: number; length: number }) => {
      const rows = displayHistory.filter((row) => row.spin >= segment.startSpin && row.spin <= segment.endSpin);
      const states = rows.map((row) => row.pulseDiagnostics?.structuralDpiState).filter(Boolean);
      if (!states.length) return { label: "—", detail: "No structural gate snapshot", accent: t.subtext };

      const restricted = states.find((state: any) => state.forceObserve);
      if (restricted) return { label: "Restricted", detail: restricted.status ?? "Structural gate active", accent: COLORS.red };

      const divergence = states.find((state: any) => state.rapidDivergence || state.persistentDivergence || state.confidenceReboundWithoutRepair);
      if (divergence) return { label: "Watch", detail: divergence.status ?? "DPI divergence watch", accent: COLORS.amber };

      const stabilizing = states.find((state: any) => state.structuralRecoveryConfirmed);
      if (stabilizing) return { label: "Open", detail: stabilizing.status ?? "DPI stabilizing", accent: COLORS.green };

      const last = states[states.length - 1] as any;
      return { label: "Clear", detail: last?.status ?? "DPI clear", accent: t.subtext };
    };


    const getSciForSegment = (segment: { startSpin: number; endSpin: number; length: number }) => {
      const rows = displayHistory.filter((row) => row.spin >= segment.startSpin && row.spin <= segment.endSpin);
      if (!rows.length) return { label: "—", detail: "No SCI snapshot", accent: t.subtext };
      const lastRow = rows[rows.length - 1];
      const priorRows = displayHistory.filter((row) => row.spin <= lastRow.spin);
      const sci = getStructuralCompressionIndex(priorRows, Number(lastRow.confidence ?? pulseConfidenceScore));
      const accent =
        sci.state === "EXTREME DIVERGENCE" ? COLORS.red :
        sci.state === "DIVERGING" ? COLORS.amber :
        sci.state === "COMPRESSING" ? COLORS.green :
        t.subtext;
      return { label: sci.state, detail: `${sci.velocityLabel} · Spread ${sci.spread}`, accent };
    };

    return (
      <Panel title="Streak Risk Analytics">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          <MiniMetric label="Current Streak" value={currentLabel} accent={currentAccent} />
          <MiniMetric label="Largest Win" value={streakStats.largestWinStreak} accent={COLORS.green} />
          <MiniMetric label="Largest Loss" value={streakStats.largestLossStreak} accent={COLORS.red} />
          <MiniMetric label="Loss Severity" value={lossStreakSeverity} accent={severityAccent} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 8 }}>
          <MiniMetric label="Avg Win Streak" value={streakStats.avgWinStreak.toFixed(1)} accent={COLORS.green} />
          <MiniMetric label="Avg Loss Streak" value={streakStats.avgLossStreak.toFixed(1)} accent={COLORS.red} />
          <MiniMetric label="High Water" value={peakBankroll.toLocaleString()} />
          <MiniMetric label="Active DD" value={`${activeDrawdown.toLocaleString()} / ${activeDrawdownPct.toFixed(1)}%`} accent={activeDrawdown > 0 ? COLORS.red : COLORS.green} />
        </div>

        <div style={{ marginTop: 12, border: `1px solid ${t.border}`, background: t.panel2, borderRadius: 12, padding: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ color: t.text, fontSize: 12, fontWeight: 950 }}>Loss Streak Analysis</div>
            <div style={{ color: t.subtext, fontSize: 10, fontWeight: 850 }}>Recent loss streaks with Structural Gate status</div>
          </div>
          {lossSegments.length === 0 ? (
            <div style={{ color: t.subtext, fontSize: 11, fontWeight: 800 }}>No settled loss streaks yet.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, color: t.text }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: `1px solid ${t.border}` }}>
                  <th style={{ padding: "0 0 7px" }}>Hands</th>
                  <th style={{ textAlign: "center", padding: "0 0 7px" }}>Length</th>
                  <th style={{ textAlign: "center", padding: "0 0 7px" }}>Structural Gate</th>
                  <th style={{ textAlign: "right", padding: "0 0 7px" }}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {lossSegments.map((segment) => {
                  const gate = getStructuralGateForSegment(segment);
                  const sci = getSciForSegment(segment);
                  return (
                    <tr key={`${segment.startSpin}-${segment.endSpin}`} style={{ borderBottom: `1px solid ${t.border}` }}>
                      <td style={{ padding: "8px 0", fontWeight: 900 }}>{segment.startSpin}–{segment.endSpin}</td>
                      <td style={{ textAlign: "center", fontWeight: 950, color: COLORS.red }}>L{segment.length}</td>
                      <td style={{ textAlign: "center", fontWeight: 950, color: gate.accent }}>{gate.label}</td>
                      <td style={{ textAlign: "right", color: t.subtext, fontWeight: 800 }}>{gate.detail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    );
  };


  const SpreadOverrideAnalyticsPanel = () => {
    const overrideRows = history.filter((row) => row.pulseDiagnostics?.spreadOverride?.active);
    const settledOverrideRows = overrideRows.filter((row) => row.result === "win" || row.result === "loss");
    const wins = settledOverrideRows.filter((row) => row.result === "win").length;
    const losses = settledOverrideRows.filter((row) => row.result === "loss").length;
    const net = settledOverrideRows.reduce((sum, row) => sum + Number(row.net || 0), 0);
    const exposure = settledOverrideRows.reduce((sum, row) => sum + Math.abs(Number(row.exposure || 0)), 0);
    const roi = exposure ? (net / exposure) * 100 : 0;

    const triggerMap = new Map<string, { breakOutcome: string; pattern: string; rows: Step[] }>();
    overrideRows.forEach((row) => {
      const ov = row.pulseDiagnostics?.spreadOverride;
      const key = `${ov?.breakSpin ?? "live"}-${ov?.pattern ?? "override"}`;
      if (!triggerMap.has(key)) triggerMap.set(key, { breakOutcome: ov?.breakOutcome ?? "—", pattern: ov?.pattern ?? "—", rows: [] });
      triggerMap.get(key)?.rows.push(row);
    });

    const triggers = Array.from(triggerMap.values());
    const bankerBreaks = triggers.filter((item) => item.breakOutcome === "B");
    const playerBreaks = triggers.filter((item) => item.breakOutcome === "P");
    const avgDuration = triggers.length ? triggers.reduce((sum, item) => sum + item.rows.length, 0) / triggers.length : 0;
    const patternRows = (pattern: string) => settledOverrideRows.filter((row) => row.pulseDiagnostics?.spreadOverride?.pattern === pattern);
    const patternWinRate = (pattern: string) => {
      const rows = patternRows(pattern);
      const patternWins = rows.filter((row) => row.result === "win").length;
      return rows.length ? (patternWins / rows.length) * 100 : 0;
    };

    return (
      <Panel title="Spread Override Analytics">
        <div style={{ color: t.subtext, fontSize: 11, fontWeight: 800, marginBottom: 10 }}>
          BB Straight + Pulse only. Tracks the below-40 Spread override cycle and does not affect BB Inverted, Markov, or standalone BB Straight.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
          <MiniMetric label="Triggers" value={triggers.length} accent={triggers.length ? COLORS.cyan : t.subtext} />
          <MiniMetric label="Override WR" value={settledOverrideRows.length ? `${((wins / settledOverrideRows.length) * 100).toFixed(1)}%` : "—"} accent={wins >= losses ? COLORS.green : COLORS.red} />
          <MiniMetric label="Override ROI" value={settledOverrideRows.length ? `${roi.toFixed(1)}%` : "—"} accent={roi >= 0 ? COLORS.green : COLORS.red} />
          <MiniMetric label="Net" value={settledOverrideRows.length ? `${net >= 0 ? "+" : ""}${net.toLocaleString()}` : "—"} accent={net >= 0 ? COLORS.green : COLORS.red} />
          <MiniMetric label="Banker Breaks" value={bankerBreaks.length} accent={COLORS.amber} />
          <MiniMetric label="Player Breaks" value={playerBreaks.length} accent={COLORS.amber} />
          <MiniMetric label="PBB WR" value={patternRows("PBBPBBPBBP").length ? `${patternWinRate("PBBPBBPBBP").toFixed(1)}%` : "—"} />
          <MiniMetric label="BBP WR" value={patternRows("BBPBBPBBPB").length ? `${patternWinRate("BBPBBPBBPB").toFixed(1)}%` : "—"} />
          <MiniMetric label="Avg Active Hands" value={triggers.length ? avgDuration.toFixed(1) : "—"} />
          <MiniMetric label="Active Now" value={history.at(-1)?.pulseDiagnostics?.spreadOverride?.active ? "YES" : "NO"} accent={history.at(-1)?.pulseDiagnostics?.spreadOverride?.active ? COLORS.green : t.subtext} />
        </div>
      </Panel>
    );
  };

  const CompactStreakAnalyticsPanel = () => {
    const severityAccent = lossStreakSeverity === "Critical" ? COLORS.red : lossStreakSeverity === "Pressure" ? COLORS.amber : lossStreakSeverity === "Elevated" ? COLORS.yellow : COLORS.green;
    const currentLabel = streakStats.currentType === "win" ? `W${streakStats.currentWinStreak}` : streakStats.currentType === "loss" ? `L${streakStats.currentLossStreak}` : "—";
    const currentAccent = streakStats.currentType === "win" ? COLORS.green : streakStats.currentType === "loss" ? COLORS.red : t.subtext;
    return (
      <Panel title="Compact Streak Analytics">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
          <MiniMetric label="Current" value={currentLabel} accent={currentAccent} />
          <MiniMetric label="Largest Win" value={streakStats.largestWinStreak} accent={COLORS.green} />
          <MiniMetric label="Largest Loss" value={streakStats.largestLossStreak} accent={COLORS.red} />
          <MiniMetric label="Loss Severity" value={lossStreakSeverity} accent={severityAccent} />
          <MiniMetric label="Avg Win" value={streakStats.avgWinStreak.toFixed(1)} accent={COLORS.green} />
          <MiniMetric label="Avg Loss" value={streakStats.avgLossStreak.toFixed(1)} accent={COLORS.red} />
          <MiniMetric label="High Water" value={peakBankroll.toLocaleString()} />
          <MiniMetric label="Active DD" value={`${activeDrawdown.toLocaleString()} / ${activeDrawdownPct.toFixed(1)}%`} accent={activeDrawdown > 0 ? COLORS.red : COLORS.green} />
        </div>
      </Panel>
    );
  };

  const NeuralConfidenceDiagnosticsPanel = () => {
    const neural = getNeuralAssistMetrics(history);
    const livePulse = getNeuralCalibratedPulse(history);
    const accuracyRate = neural.neuralReady ? `${(neural.recent.rate * 100).toFixed(1)}%` : "—";
    const historyLabel = neural.neuralReady ? `${neural.recent.wins}-${neural.recent.active} Current` : "—";
    const adjustmentText = neural.neuralReady ? (neural.adjustment > 0 ? `+${neural.adjustment}` : String(neural.adjustment)) : "—";
    const rawConfidence = neural.rawPulse.group ? neural.rawPulse.confidence : 0;
    const diagnosticConfidence = neural.rawPulse.group ? neural.adjustedConfidence : 0;
    const liveConfidence = livePulse.group ? livePulse.confidence : 0;
    const rawDisplay = neural.rawPulse.group ? `${rawConfidence}%` : "—";
    const diagnosticDisplay = neural.rawPulse.group ? `${diagnosticConfidence}%` : "—";
    const liveDisplay = livePulse.group ? `${liveConfidence}%` : "—";
    const delta = diagnosticConfidence - rawConfidence;
    const deltaText = neural.neuralReady ? (delta > 0 ? `+${delta}` : String(delta)) : "—";

    return ;
  };

  const Last20SpinsStrip = () => {
    // Rolling matrix rule:
    // - Newest spin appears at top-left.
    // - Oldest visible spin falls off at the bottom-right after 20.
    // - Grid always fills left-to-right, top-to-bottom.
    // - No horizontal overflow and no reverse row behavior.
    const last = [...history].reverse().slice(0, 20);

    return <CollapsiblePanel id="last20Spins" title="Session Log" style={{ overflow: "hidden", minWidth: 0 }}>
      {last.length === 0 ? <div style={{ color: t.subtext, fontSize: 13 }}>No spins yet.</div> : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 5,
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            overflow: "hidden",
            direction: "ltr",
            gridAutoFlow: "row",
          }}
        >
          {last.map((s, index) => {
            const isZero = s.outcome === 0 || s.outcome === "00";
            const red = !isZero && RED_NUMBERS.has(s.outcome);
            const opacity = index >= 16 ? 0.62 : index >= 12 ? 0.78 : 1;
            return (
              <div
                key={s.spin}
                style={{
                  height: 28,
                  minWidth: 0,
                  borderRadius: 6,
                  border: `1px solid ${isZero ? "rgba(34,197,94,0.55)" : red ? "rgba(239,68,68,0.55)" : t.borderStrong}`,
                  background: isZero ? "rgba(34,197,94,0.30)" : red ? "rgba(153,27,27,0.72)" : "rgba(2,6,23,0.82)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 950,
                  boxSizing: "border-box",
                  opacity,
                }}
              >
                {String(s.outcome)}
              </div>
            );
          })}
        </div>
      )}
    </CollapsiblePanel>;
  };

  const RouletteWheelPanel = () => null;


  const TrackPanel = ({ title, values, leftLabel, rightLabel }: any) => {
    const recentValues = values.slice(-18);
    const leftCount = recentValues.filter((v: string) => v === leftLabel).length;
    const rightCount = recentValues.filter((v: string) => v === rightLabel).length;
    return <Panel title={title}><div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 4 }}>{recentValues.map((v: string, i: number) => <div key={`${v}-${i}`} style={{ height: 18, borderRadius: 4, border: `1px solid ${t.border}`, background: v === leftLabel ? "rgba(239,68,68,0.72)" : "rgba(15,23,42,0.85)" }} />)}</div><div style={{ display: "flex", justifyContent: "space-around", color: t.text, fontSize: 12, fontWeight: 900, marginTop: 9 }}><span>{leftLabel}: {leftCount}</span><span>{rightLabel}: {rightCount}</span></div></Panel>;
  };

  const TrackCluster = () => {
    const rows = groupSeries(history).map(groupToBits);
    const colorVals = rows.map((r) => r[0] === 1 ? "R" : "B");
    const rangeVals = rows.map((r) => r[1] === 0 ? "HIGH" : "LOW");
    const parityVals = rows.map((r) => r[2] === 0 ? "EVEN" : "ODD");
    return <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}><TrackPanel title="Color Track" values={colorVals} leftLabel="R" rightLabel="B" /><TrackPanel title="Range Track" values={rangeVals} leftLabel="HIGH" rightLabel="LOW" /><TrackPanel title="Parity Track" values={parityVals} leftLabel="ODD" rightLabel="EVEN" /></div>;
  };

  const TerminalHeader = () => {
    const last = history.at(-1);
    return <header style={{ minHeight: 62, display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 14, border: `1px solid ${t.border}`, borderRadius: 18, background: headerBg, padding: "0 16px", boxShadow: t.shadow, marginBottom: 14 }}><div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0, height: "100%" }}><div aria-label="EDGELAB" role="img" style={{ display: "flex", alignItems: "center", height: 20, flexShrink: 0 }}>
  <span style={{ display: "inline-flex", alignItems: "center", color: headerLogoFill, fontFamily: "Sora, Arial, sans-serif", fontWeight: 300, letterSpacing: "0.18em", fontSize: 14, lineHeight: "20px", height: 20 }}>EDGELAB</span>
</div><span style={{ height: 20, width: 1, background: t.borderStrong }} /><span style={{ display: "inline-flex", alignItems: "center", color: headerAccent, fontFamily: "Sora, Arial, sans-serif", fontWeight: 300, letterSpacing: "0.14em", fontSize: 14, lineHeight: "20px", height: 20 }}>BACCARAT TERMINAL</span></div><div style={{ display: "grid", gridTemplateColumns: "repeat(4, auto)", gap: 18, alignItems: "center", color: t.subtext, fontSize: 11, fontWeight: 850, textTransform: "uppercase" }}><span>Last Result <b style={{ color: last?.result === "win" ? COLORS.green : last?.result === "loss" ? COLORS.red : t.text, marginLeft: 5 }}>{last?.result ?? "—"}</b></span><span>Last Side <b style={{ color: t.text, marginLeft: 5 }}>{last ? formatSpinAsBaccarat(last.outcome) : "—"}</b></span><span>Last Hand <b style={{ color: t.text, marginLeft: 5 }}>{last ? formatSpinAsBaccarat(last.outcome) : "—"}</b></span><span>Next <b style={{ color: headerAccent, marginLeft: 5 }}>Manual</b></span></div></header>;
  };

  const Dashboard = () => <section style={{ display: "grid", gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr) minmax(280px, 340px)", gap: 14, alignItems: "start", width: "100%", maxWidth: "100%", overflow: "hidden" }}><div style={{ display: "grid", gap: 14, minWidth: 0, maxWidth: "100%", overflow: "hidden", boxSizing: "border-box" }}><SignalPanel /><CompactMetrics /></div><div style={{ display: "grid", gap: 14, minWidth: 0, maxWidth: "100%", overflow: "hidden", boxSizing: "border-box" }}><BaccaratManualSimulator /><BankrollChart /><BaccaratTable /><StreamsPanel /><EngineStrip /></div><div style={{ display: "grid", gap: 14, minWidth: 0, maxWidth: "100%", overflow: "hidden", boxSizing: "border-box" }}><RecentLog />{isPulseOnlyMode ? null : <><DpiTerminalPanel /><SignalDpiSpreadPanel /></>}<AxisDirectionalAccuracyPanel /><ComparisonTable compact /></div></section>;
  const Analytics = () => <section style={{ display: "grid", gap: 14 }}><LiveExecutionPerformancePanel /><RawSignalEngineAnalyticsPanel /><SpreadOverrideAnalyticsPanel /><CompactStreakAnalyticsPanel /><CollapsiblePanel id="advancedAnalyticsDiagnostics" title="Advanced Diagnostics"><div style={{ display: "grid", gap: 14 }}><EngineIntelligencePanel /><EngineSpecificPulseDiagnosticsPanel /></div></CollapsiblePanel></section>;
  const Reports = () => {
    const resolvedRows = displayHistory.filter((row) => row.result === "win" || row.result === "loss");
    const reportWins = resolvedRows.filter((row) => row.result === "win").length;
    const reportLosses = resolvedRows.filter((row) => row.result === "loss").length;
    const reportExposure = resolvedRows.reduce((sum, row) => sum + Math.abs(Number(row.exposure || 0)), 0);
    const reportProfitFactor = (() => {
      const grossWins = resolvedRows.filter((row) => row.net > 0).reduce((sum, row) => sum + row.net, 0);
      const grossLosses = Math.abs(resolvedRows.filter((row) => row.net < 0).reduce((sum, row) => sum + row.net, 0));
      if (!grossLosses) return grossWins > 0 ? "∞" : "0.00";
      return (grossWins / grossLosses).toFixed(2);
    })();

    const overrideRows = displayHistory.filter((row) => row.pulseDiagnostics?.spreadOverride?.active);
    const settledOverrideRows = overrideRows.filter((row) => row.result === "win" || row.result === "loss");
    const overrideWins = settledOverrideRows.filter((row) => row.result === "win").length;
    const overrideLosses = settledOverrideRows.filter((row) => row.result === "loss").length;
    const overrideNet = settledOverrideRows.reduce((sum, row) => sum + Number(row.net || 0), 0);
    const overrideExposure = settledOverrideRows.reduce((sum, row) => sum + Math.abs(Number(row.exposure || 0)), 0);
    const overrideRoi = overrideExposure ? (overrideNet / overrideExposure) * 100 : 0;
    const overrideWr = settledOverrideRows.length ? (overrideWins / settledOverrideRows.length) * 100 : 0;

    const overrideTriggers = new Map<string, { breakOutcome: string; pattern: string; rows: Step[] }>();
    overrideRows.forEach((row) => {
      const ov = row.pulseDiagnostics?.spreadOverride;
      const key = `${ov?.breakSpin ?? "live"}-${ov?.pattern ?? "override"}`;
      if (!overrideTriggers.has(key)) overrideTriggers.set(key, { breakOutcome: ov?.breakOutcome ?? "—", pattern: ov?.pattern ?? "—", rows: [] });
      overrideTriggers.get(key)?.rows.push(row);
    });
    const triggerList = Array.from(overrideTriggers.values());
    const bankerBreaks = triggerList.filter((item) => item.breakOutcome === "B").length;
    const playerBreaks = triggerList.filter((item) => item.breakOutcome === "P").length;
    const avgOverrideDuration = triggerList.length ? triggerList.reduce((sum, item) => sum + item.rows.length, 0) / triggerList.length : 0;

    const limitHits = displayHistory.filter((row) => row.note.toLowerCase().includes("limit")).length;
    const recoveryRows = displayHistory.filter((row) => row.etrBetType === "recovery");
    const recoveryWins = recoveryRows.filter((row) => row.result === "win").length;
    const recoverySuccessRate = recoveryRows.length ? (recoveryWins / recoveryRows.length) * 100 : 0;
    const verdict = net > 0 && streakStats.largestLossStreak <= 4
      ? "Profitable / Controlled"
      : net > 0
      ? "Profitable / Volatile"
      : streakStats.largestLossStreak >= 6
      ? "Loss / High Streak Risk"
      : "Loss / Controlled Risk";

    const reportText = [
      "EDGELAB Baccarat Session Audit",
      `Hands: ${displayHistory.length}`,
      `Starting Bankroll: ${startingBankroll}`,
      `Ending Bankroll: ${bankroll}`,
      `Net P&L: ${net}`,
      `ROI: ${roi}`,
      `Win Rate: ${winRate}`,
      `Profit Factor: ${reportProfitFactor}`,
      `Largest Loss Streak: ${streakStats.largestLossStreak}`,
      `Max Active Drawdown: ${activeDrawdown.toFixed(0)} (${activeDrawdownPct.toFixed(1)}%)`,
      `Spread Override Triggers: ${triggerList.length}`,
      `Override WR: ${settledOverrideRows.length ? overrideWr.toFixed(1) + "%" : "No override hands"}`,
      `Override ROI: ${settledOverrideRows.length ? overrideRoi.toFixed(1) + "%" : "No override hands"}`,
      `Verdict: ${verdict}`,
    ].join("\n");

    return (
      <section style={{ display: "grid", gap: 14 }}>
        <Panel title="Import Historical Baccarat Session">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", gap: 10, alignItems: "center" }}>
            <label style={{ border: `1px solid ${t.borderStrong}`, background: t.input, color: t.text, borderRadius: 12, padding: "10px 12px", fontSize: 12, fontWeight: 950, cursor: "pointer", textAlign: "center" }}>
              Upload Baccarat CSV
              <input type="file" accept=".csv,text/csv" onChange={handleBaccaratCsvUpload} style={{ display: "none" }} />
            </label>
            <button onClick={replayUploadedDataset} disabled={!uploadedDataset?.outcomes.length} style={{ border: `1px solid ${uploadedDataset?.outcomes.length ? COLORS.green : t.border}`, background: uploadedDataset?.outcomes.length ? "rgba(34,197,94,0.13)" : t.panel2, color: uploadedDataset?.outcomes.length ? COLORS.green : t.subtext, borderRadius: 12, padding: "10px 12px", fontSize: 12, fontWeight: 950, cursor: uploadedDataset?.outcomes.length ? "pointer" : "not-allowed" }}>Replay Dataset</button>
            <button onClick={clearUploadedDataset} disabled={!uploadedDataset} style={{ border: `1px solid ${t.border}`, background: t.panel2, color: uploadedDataset ? t.text : t.subtext, borderRadius: 12, padding: "10px 12px", fontSize: 12, fontWeight: 950, cursor: uploadedDataset ? "pointer" : "not-allowed" }}>Clear</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
            <MiniMetric label="Dataset" value={uploadedDataset?.name ?? "None"} />
            <MiniMetric label="Playable Hands" value={uploadedDataset?.outcomes.length ?? 0} accent={uploadedDataset?.outcomes.length ? COLORS.green : t.subtext} />
            <MiniMetric label="Rows Read" value={uploadedDataset?.rowCount ?? 0} />
            <MiniMetric label="Validation Issues" value={uploadedDataset?.errors.length ?? 0} accent={uploadedDataset?.errors.length ? COLORS.amber : COLORS.green} />
          </div>
          <div style={{ color: t.subtext, fontSize: 11, fontWeight: 800, marginTop: 10, lineHeight: 1.45 }}>
            Supported format: hand,outcome with P/Player or B/Banker. Replay is instant, capped at 10,000 hands, cached into the live session, and does not run Monte Carlo or background recalculation.
          </div>
          {datasetNotice ? <div style={{ color: COLORS.cyan, fontSize: 11, fontWeight: 900, marginTop: 8 }}>{datasetNotice}</div> : null}
          {uploadedDataset?.errors?.length ? <div style={{ marginTop: 8, color: COLORS.amber, fontSize: 11, fontWeight: 850, lineHeight: 1.45 }}>{uploadedDataset.errors.map((error) => <div key={error}>• {error}</div>)}</div> : null}
        </Panel>

        <Panel title="Session Summary">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
            <MiniMetric label="Start" value={startingBankroll.toLocaleString()} />
            <MiniMetric label="Ending" value={bankroll.toLocaleString()} accent={net >= 0 ? COLORS.green : COLORS.red} />
            <MiniMetric label="Net P&L" value={`${net >= 0 ? "+" : ""}${net.toLocaleString()}`} accent={net >= 0 ? COLORS.green : COLORS.red} />
            <MiniMetric label="ROI" value={roi} accent={net >= 0 ? COLORS.green : COLORS.red} />
            <MiniMetric label="Hands" value={displayHistory.length} />
            <MiniMetric label="Resolved" value={resolvedRows.length} />
            <MiniMetric label="Win Rate" value={winRate} accent={reportWins >= reportLosses ? COLORS.green : COLORS.red} />
            <MiniMetric label="Verdict" value={verdict} accent={net >= 0 ? COLORS.green : COLORS.red} />
          </div>
        </Panel>

        <Panel title="Engine Performance Report">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
            <MiniMetric label="Wins" value={reportWins} accent={COLORS.green} />
            <MiniMetric label="Losses" value={reportLosses} accent={COLORS.red} />
            <MiniMetric label="Profit Factor" value={reportProfitFactor} accent={Number(reportProfitFactor) >= 1 ? COLORS.green : COLORS.red} />
            <MiniMetric label="Total Exposure" value={reportExposure.toLocaleString()} />
          </div>
          <div style={{ color: t.subtext, fontSize: 11, fontWeight: 800, marginTop: 10 }}>
            Reports are session-level audit summaries. Live engine ranking and detailed shadow comparisons remain in Analytics.
          </div>
        </Panel>

        <Panel title="Spread Override Audit">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
            <MiniMetric label="Triggers" value={triggerList.length} accent={triggerList.length ? COLORS.cyan : t.subtext} />
            <MiniMetric label="Banker Breaks" value={bankerBreaks} accent={COLORS.amber} />
            <MiniMetric label="Player Breaks" value={playerBreaks} accent={COLORS.amber} />
            <MiniMetric label="Avg Duration" value={triggerList.length ? avgOverrideDuration.toFixed(1) : "—"} />
            <MiniMetric label="Override WR" value={settledOverrideRows.length ? `${overrideWr.toFixed(1)}%` : "—"} accent={overrideWins >= overrideLosses ? COLORS.green : COLORS.red} />
            <MiniMetric label="Override ROI" value={settledOverrideRows.length ? `${overrideRoi.toFixed(1)}%` : "—"} accent={overrideRoi >= 0 ? COLORS.green : COLORS.red} />
            <MiniMetric label="Override Net" value={settledOverrideRows.length ? `${overrideNet >= 0 ? "+" : ""}${overrideNet.toLocaleString()}` : "—"} accent={overrideNet >= 0 ? COLORS.green : COLORS.red} />
            <MiniMetric label="Active Now" value={history.at(-1)?.pulseDiagnostics?.spreadOverride?.active ? "YES" : "NO"} accent={history.at(-1)?.pulseDiagnostics?.spreadOverride?.active ? COLORS.green : t.subtext} />
          </div>
        </Panel>

        <Panel title="Risk & Drawdown Report">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
            <MiniMetric label="High Water" value={peakBankroll.toLocaleString()} />
            <MiniMetric label="Active Drawdown" value={activeDrawdown.toLocaleString()} accent={activeDrawdown > 0 ? COLORS.red : COLORS.green} />
            <MiniMetric label="Drawdown %" value={`${activeDrawdownPct.toFixed(1)}%`} accent={activeDrawdownPct > 8 ? COLORS.red : activeDrawdownPct > 4 ? COLORS.amber : COLORS.green} />
            <MiniMetric label="Largest Loss" value={`L${streakStats.largestLossStreak}`} accent={COLORS.red} />
            <MiniMetric label="Largest Win" value={`W${streakStats.largestWinStreak}`} accent={COLORS.green} />
            <MiniMetric label="Limit Hits" value={limitHits} accent={limitHits ? COLORS.amber : COLORS.green} />
            <MiniMetric label="Recovery Hands" value={recoveryRows.length} />
            <MiniMetric label="Recovery Success" value={recoveryRows.length ? `${recoverySuccessRate.toFixed(1)}%` : "—"} accent={recoverySuccessRate >= 50 ? COLORS.green : COLORS.red} />
          </div>
        </Panel>

        <Panel title="Pattern Failure Analysis">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
            <MiniMetric label="Current Streak" value={streakStats.currentType === "win" ? `W${streakStats.currentWinStreak}` : streakStats.currentType === "loss" ? `L${streakStats.currentLossStreak}` : "—"} accent={streakStats.currentType === "win" ? COLORS.green : streakStats.currentType === "loss" ? COLORS.red : t.subtext} />
            <MiniMetric label="Loss Severity" value={lossStreakSeverity} accent={lossStreakSeverity === "Critical" || lossStreakSeverity === "Pressure" ? COLORS.red : lossStreakSeverity === "Elevated" ? COLORS.amber : COLORS.green} />
            <MiniMetric label="Avg Win Streak" value={streakStats.avgWinStreak.toFixed(1)} accent={COLORS.green} />
            <MiniMetric label="Avg Loss Streak" value={streakStats.avgLossStreak.toFixed(1)} accent={COLORS.red} />
          </div>
        </Panel>

        <Panel title="Session Audit Summary">
          <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, background: t.panel2, padding: 12, color: t.text, fontSize: 12, fontWeight: 850, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{reportText}</div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button
              onClick={() => navigator.clipboard?.writeText(reportText)}
              style={{ border: `1px solid ${t.borderStrong}`, background: t.input, color: t.text, borderRadius: 10, padding: "9px 12px", fontSize: 11, fontWeight: 950, cursor: "pointer" }}
            >
              Copy Session Report
            </button>
          </div>
        </Panel>

        <BankrollChart />
      </section>
    );
  };
  const Sessions = () => <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}><Panel title="Saved Sessions"><div style={{ display: "grid", gap: 10 }}><Button onClick={() => setShowSave(true)} variant="secondary">Save Current Session</Button><Select value={selectedSession} onChange={(e: any) => { const name = e.target.value; setSelectedSession(name); if (name) recoverSession(name); }} options={["", ...savedSessions.map(s => s.name)]} /><div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}><Button onClick={deleteSession} variant="danger" disabled={!selectedSession}>Delete</Button><Button variant="secondary" onClick={() => window.print()} disabled={!history.length}>Print/PDF</Button><Button variant="secondary" onClick={downloadCSV} disabled={!history.length}>CSV</Button></div></div></Panel><Panel title="Merge Sessions"><select multiple value={selectedMerge} onChange={(e: any) => setSelectedMerge(Array.from(e.target.selectedOptions).map((o: any) => o.value))} style={{ width: "100%", minHeight: 180, padding: 10, borderRadius: 10, background: t.input, color: t.text, border: `1px solid ${t.borderStrong}` }}>{savedSessions.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}</select><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}><Button onClick={mergeSelected} disabled={!selectedMerge.length}>Merge Selected</Button><Button variant="secondary" onClick={() => setSelectedMerge([])} disabled={!selectedMerge.length}>Clear</Button></div></Panel><div style={{ gridColumn: "1 / -1" }}><RecentLog /></div></section>;

  return <div style={{ minHeight: "100vh", background: t.appBg, color: t.text, fontFamily: "Sora, Arial, sans-serif", display: "grid", gridTemplateColumns: "82px minmax(0, 1fr)" }}>
    <Modal open={showSave}><div style={{ fontSize: 20, fontWeight: 950, marginBottom: 10 }}>Save Current Session</div><Input type="text" value={sessionName} onChange={(e: any) => setSessionName(e.target.value)} placeholder="Session name" /><div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}><div style={{ width: 130 }}><Button variant="secondary" onClick={() => setShowSave(false)}>Cancel</Button></div><div style={{ width: 130 }}><Button onClick={saveSession}>Save</Button></div></div></Modal>
    <Modal open={showSettings}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}><div><div style={{ fontSize: 22, fontWeight: 950 }}>Settings</div><div style={{ fontSize: 13, color: t.subtext, marginTop: 4 }}>Terminal display preferences and table limits.</div></div><button onClick={() => setShowSettings(false)} style={{ border: 0, background: "transparent", fontSize: 24, fontWeight: 900, cursor: "pointer", color: t.subtext }}>×</button></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><button onClick={() => setAppearance("light")} style={{ height: 42, borderRadius: 10, border: `2px solid ${appearance === "light" ? COLORS.blue : t.borderStrong}`, background: "#fff", color: "#0f172a", fontWeight: 950 }}>Light</button><button onClick={() => setAppearance("dark")} style={{ height: 42, borderRadius: 10, border: `2px solid ${appearance === "dark" ? COLORS.cyan : t.borderStrong}`, background: "#020617", color: "#fff", fontWeight: 950 }}>Dark</button></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}><div><div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Table Limit</div><NumericInput value={tableLimit} min={1} onCommit={(n: number) => { setTableLimit(n); setHistory(runStrategy(history.map((h) => h.outcome), strategy, baseUnit, startingBankroll, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, n, perNumberLimit, tierExecution, markovEnabled, exposureCapPercent, cadenceEnabled, scoutEnabled)); }} /></div><div><div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Per Hand Limit</div><NumericInput value={perNumberLimit} min={1} onCommit={(n: number) => { setPerNumberLimit(n); setHistory(runStrategy(history.map((h) => h.outcome), strategy, baseUnit, startingBankroll, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, n, tierExecution, markovEnabled, exposureCapPercent, cadenceEnabled, scoutEnabled)); }} /></div><div><div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Exposure Cap %</div><NumericInput value={exposureCapPercent} min={0.1} max={100} allowDecimal={true} onCommit={(n: number) => { setExposureCapPercent(n); setHistory(runStrategy(history.map((h) => h.outcome), strategy, baseUnit, startingBankroll, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, tierExecution, markovEnabled, n, cadenceEnabled, scoutEnabled)); }} /></div></div><div style={{ marginTop: 10, color: t.subtext, fontSize: 11, fontWeight: 800, lineHeight: 1.45 }}>Exposure Cap default is 2% of current bankroll and can be increased here. Limits are enforced on every strategy replay. Unit bet is capped by both the per-hand limit and the total table limit across the active Baccarat side.</div><div style={{ marginTop: 14, border: `1px solid ${t.border}`, background: t.panel2, borderRadius: 12, padding: 12 }}><div style={{ fontSize: 12, fontWeight: 950, color: t.text, marginBottom: 8 }}>Tier Execution Rules</div><div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}><button onClick={() => { const next = !executeWeak; setExecuteWeak(next); setHistory(runStrategy(history.map((h) => h.outcome), strategy, baseUnit, startingBankroll, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, { ...tierExecution, executeWeak: next }, markovEnabled, exposureCapPercent, cadenceEnabled, scoutEnabled)); }} style={{ height: 38, borderRadius: 10, border: `1px solid ${executeWeak ? COLORS.green : t.borderStrong}`, background: executeWeak ? "rgba(34,197,94,0.13)" : t.input, color: executeWeak ? COLORS.green : t.subtext, fontWeight: 950, cursor: "pointer" }}>Weak {executeWeak ? "ON" : "OFF"}</button><button onClick={() => { const next = !executeObservation; setExecuteObservation(next); setHistory(runStrategy(history.map((h) => h.outcome), strategy, baseUnit, startingBankroll, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, { ...tierExecution, executeObservation: next }, markovEnabled, exposureCapPercent, cadenceEnabled, scoutEnabled)); }} style={{ height: 38, borderRadius: 10, border: `1px solid ${!executeObservation ? COLORS.green : t.borderStrong}`, background: !executeObservation ? "rgba(34,197,94,0.13)" : t.input, color: !executeObservation ? COLORS.green : t.subtext, fontWeight: 950, cursor: "pointer" }}>Observe {!executeObservation ? "ON" : "OFF"}</button></div><div style={{ marginTop: 9, color: t.subtext, fontSize: 11, fontWeight: 800 }}>Default: Weak ON, Observe OFF.</div></div><div style={{ marginTop: 14, border: `1px solid ${t.border}`, background: t.panel2, borderRadius: 12, padding: 12 }}><div style={{ fontSize: 12, fontWeight: 950, color: t.text, marginBottom: 8 }}>Saved Control Settings</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><Button onClick={saveControlSettings}>Save Controls</Button><Button variant="secondary" onClick={clearSavedControlSettings}>Clear Saved</Button></div>{settingsSavedNotice ? <div style={{ marginTop: 9, color: COLORS.green, fontSize: 11, fontWeight: 900 }}>{settingsSavedNotice}</div> : null}</div><div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}><div style={{ width: 130 }}><Button onClick={() => setShowSettings(false)}>Done</Button></div></div></Modal>
    {showGlossary ? <div
      style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.72)", zIndex: 9998, padding: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={() => setShowGlossary(false)}
    >
      <div
        style={{ width: "100%", maxWidth: 760, maxHeight: "86vh", overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", background: t.panel, borderRadius: 16, border: `1px solid ${t.borderStrong}`, boxShadow: t.shadow, padding: 18, color: t.text, position: "relative", zIndex: 9999 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ position: "sticky", top: -18, zIndex: 10000, background: t.panel, borderBottom: `1px solid ${t.border}`, padding: "0 0 10px 0", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 950 }}>Term Glossary</div>
            <div style={{ fontSize: 13, color: t.subtext, marginTop: 4 }}>Quick reference for EDGELAB Baccarat Pulse.</div>
          </div>
          <button onClick={() => setShowGlossary(false)} style={{ border: `1px solid ${t.borderStrong}`, background: t.input, borderRadius: 10, width: 42, height: 38, fontSize: 24, fontWeight: 900, cursor: "pointer", color: t.text, flexShrink: 0, lineHeight: 1 }}>×</button>
        </div>
        {[["Auto Simulation Optimization", "Performance pass that batches Run Auto results, prevents repeated replay loops during simulation, memoizes shadow comparisons, and calculates recent accuracy from stored forecast rows."], ["Bankroll", "Current simulated bankroll after settled hands."], ["Base Unit / Hand", "The starting wager amount per active Player/Banker hand before strategy scaling and limit enforcement."], ["Confidence-65", "Only executes when final confidence is 65 or higher."], ["Confidence-75", "Only executes when final confidence is 75 or higher."], ["Controlled Prediction", "Mid-high confidence tier. The forecast is usable, but not at the strongest level."], ["DPI", "Directional Pressure Index. Locked engine-independent pressure counter calculated from the raw Player/Banker stream using BB Straight settlement only; it does not change when switching PULSE, Markov, BB Straight, or BB Inverted."], ["DPI Zone", "Summary of pressure level: Neutral, Pressure, or Transition."], ["Engine Shadow Comparison", "Replays BB Straight, BB Inverted, Markov, and each +Pulse pairing against the same Player/Banker hand history. There is no standalone Pulse engine."], ["Entropy", "Diagnostics only. Entropy no longer controls Baccarat Pulse execution."], ["ESI", "Engine Strength Index. A composite Live Engine Rankings score that combines win rate, ROI adjustment, and active engine status to estimate current engine quality."], ["Execution Accuracy", "Performance of actual bettable signals only. Advisory-only tiers are recorded as pushes/no-bets and do not affect bankroll, DPI, ROI, or win/loss totals."], ["Execution Compression", "Baccarat execution uses one Player/Banker dimension; roulette 3D compression is not used."], ["Exposure Cap", "Caps the active wager to the configured percentage of current bankroll. Default is 2%, adjustable in Settings."], ["ETR", "DPI heat recovery strategy that can raise unit size after pressure/loss conditions."], ["ETR-C", "Controlled ETR variant that caps and steps recovery exposure."], ["Fibonacci", "True Fibonacci progression: loss advances one step, win moves back two steps, push/no-bet holds the current step."], ["Flat", "Uses the base unit per active Player/Banker hand whenever a signal qualifies."], ["Inverted BB Mode", "Uses the mirrored Boolean structure only when the DPI threshold is reached; DPI calculation itself remains unchanged."], ["Limit Hit", "Occurs when the requested unit size is reduced by the table limit or per-hand limit."], ["Martingale", "Doubles the unit after each resolved loss and resets to base unit after a win."], ["D'Alembert", "Adds one base unit after each loss and steps back after wins."], ["ReverseD'Alembert", "Adds one base unit after wins and resets/steps down after losses."], ["1-3-2-6", "Positive progression sequence with dedicated oneThreeTwoSixStep state: 1x, 3x, 2x, 6x. It advances after real wins, resets after real losses, and does not use ETR recoveryStep or DPI."], ["Neural Assist", "Diagnostics only. It does not replace the selected engine forecast."], ["Directional Observe", "Lowest PULSE forecast state after enough hands. It preserves a directional lean but is advisory only by default and is not settled as a win/loss."], ["Per Hand Limit", "Maximum bet allowed per Baccarat hand. Default can be changed in Settings."], ["Persistence Durability", "Baccarat side-stream stability check used as structural health context only."], ["Progressive Confidence", "Scales unit size upward when final confidence reaches stronger tiers."], ["PULSE", "Baccarat-native advisory layer attached to BB Straight, BB Inverted, or Markov. Active components are Persistence/Stability Analysis, Confidence Modulation, Execution Filtering, Adaptive Tier Engine, Loss Protection, simplified Player/Banker Entropy Governance, and Consensus/Re-Entry Governance. Governance is rebalanced so Weak executes by default, holds are rarer, and re-entry is faster. DPI Structural Gate now checks DPI velocity and stabilization before trusting confidence rebounds. Unified Structural Pressure and Shadow Recovery are removed. Clickable Streak Analysis is detached as a standalone Analytics/Research tool." ], ["Recovery State", "ETR / ETR-C state: off, armed, or recovery. Armed occurs after a flat loss followed by a flat win in Inverted Control; the next hand starts recovery."], ["Saved Control Settings", "Settings option that saves bankroll, base unit, strategy, auto hands, PULSE/BB/Markov state, table limits, Exposure Cap %, tier execution rules, and appearance for the next login."], ["SIG", "Signals. In Engine Shadow Comparison, SIG is the number of actionable/executed signals produced by that engine during the replay/session."], ["Signal Accuracy", "Forecast accuracy view that can study all PULSE tiers, including advisory-only Directional Observe states."], ["Signal State", "Live decision panel showing the selected engine forecast, Pulse confidence, and execution tier."], ["Step Recovery", "Controlled staged recovery: 1x, 2x, 3x, then 4x base by loss depth."], ["Straight BB Mode", "Runs the locked Straight Boolean table from hand 1."], ["Strategy Comparison", "Replays all strategy models from the same Player/Banker outcomes to compare ending bankroll, ROI, drawdown, profit factor, and other metrics."], ["Strong Prediction", "Highest-confidence PULSE tier. Indicates strong agreement across the current PULSE memory layers and confidence calibration."], ["Table Limit", "Maximum total wager allowed on the active Baccarat hand. Default is $10,000 and can be changed in Settings."], ["Tier Execution Rules", "Settings controls that decide whether Weak and Directional Observe tiers are actually executed or only tracked as advisory forecasts."], ["Weak Prediction", "Lower confidence active forecast. Directional bias exists, but the stream is less stable."]].map(([term, def]) => <div key={term} style={{ borderBottom: `1px solid ${t.border}`, padding: "13px 0" }}><div style={{ fontSize: 16, fontWeight: 950 }}>{term}</div><div style={{ fontSize: 13, color: t.subtext, marginTop: 4, lineHeight: 1.45 }}>{def}</div></div>)}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16, paddingBottom: 4 }}><div style={{ width: 130 }}><Button onClick={() => setShowGlossary(false)}>Done</Button></div></div>
      </div>
    </div> : null}
    <aside style={{ background: t.railBg, borderRight: `1px solid ${t.border}`, padding: "14px 9px", display: "grid", gridTemplateRows: "auto 1fr auto", gap: 14 }}><div aria-label="EDGELAB mark" role="img" style={{ width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}><div style={{ display: "grid", gap: 5, width: 28 }}><span style={{ display: "block", width: 28, height: 2, borderRadius: 2, background: headerLogoFill }} /><span style={{ display: "block", width: 28, height: 2, borderRadius: 2, background: headerLogoFill }} /><span style={{ display: "block", width: 28, height: 2, borderRadius: 2, background: headerLogoFill }} /></div></div><nav style={{ display: "grid", gap: 8, alignContent: "start" }}>{VIEWS.map(v => <button key={v} onClick={() => setActiveView(v)} style={{ width: "100%", minHeight: 50, borderRadius: 14, border: `1px solid ${activeView === v ? "rgba(34,199,243,0.42)" : "transparent"}`, background: activeView === v ? "rgba(34,199,243,0.14)" : "transparent", color: activeView === v ? headerAccent : t.subtext, fontWeight: 900, fontSize: 10, cursor: "pointer" }}>{v}</button>)}</nav><div style={{ display: "grid", gap: 8 }}><button onClick={() => setShowSettings(true)} style={{ height: 42, borderRadius: 12, border: `1px solid ${t.border}`, background: "transparent", color: t.subtext, fontWeight: 900, cursor: "pointer" }}>⚙</button><button onClick={() => setShowGlossary(true)} style={{ height: 42, borderRadius: 12, border: `1px solid ${t.border}`, background: "transparent", color: t.subtext, fontWeight: 900, cursor: "pointer" }}>?</button></div></aside>
    <main style={{ padding: 16, minWidth: 0, maxWidth: "100%", overflowX: "hidden", overflowY: "visible" }}><TerminalHeader />
      <ControlsPanel />
      {activeView === "Dashboard" ? <Dashboard /> : null}{activeView === "Analytics" ? <Analytics /> : null}{activeView === "Reports" ? <Reports /> : null}{activeView === "Sessions" ? <Sessions /> : null}

    </main>
  </div>;
}









