"use client";

import React, { useMemo, useState } from "react";

type SpinValue = number | "00";
type Result = "win" | "loss" | "push";
type TierLabel = "Strong Prediction" | "Controlled Prediction" | "Weak Prediction" | "Directional Observe" | "No Prediction" | "BB Straight" | "BB Inverted" | "BB Inverted Armed" | "Disabled";
type GroupKey = "BHE" | "BHO" | "BLE" | "BLO" | "RHE" | "RHO" | "RLE" | "RLO";
type Strategy =
  | "Flat"
  | "Martingale 3"
  | "Martingale 5"
  | "Martingale 7"
  | "Step Recovery"
  | "Exposure Cap"
  | "Confidence-65"
  | "Confidence-75"
  | "Progressive Confidence";
type Appearance = "dark" | "light";
type ViewKey = "Dashboard" | "Analytics" | "Reports" | "Sessions";
type BBMode = "BB Off" | "BB Straight" | "BB Inverted";
type ExecutionMode = "Stream Direct" | "Neighbor Expansion" | "Edge Expansion" | "Hybrid Coverage";

type Step = {
  spin: number;
  outcome: SpinValue;
  outcomeGroup: GroupKey;
  predictedGroup: GroupKey | null;
  predictedNumbers: SpinValue[];
  forecastGroup?: GroupKey | null;
  forecastNumbers?: SpinValue[];
  confidence: number;
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
};

type SavedSession = {
  name: string;
  createdAt: string;
  startingBankroll: number;
  baseUnit: number;
  tableLimit?: number;
  perNumberLimit?: number;
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
  autoSpins: number;
  strategy: Strategy;
  pulseEnabled: boolean;
  bbStraightEnabled: boolean;
  bbInvertedEnabled: boolean;
  markovEnabled: boolean;
  executionMode: ExecutionMode;
  executeWeak: boolean;
  executeObservation: boolean;
  appearance: Appearance;
};

const DEFAULT_STARTING_BANKROLL = 5000;
const DEFAULT_BASE_UNIT = 25;
const DEFAULT_AUTO_SPINS = 80;
const DEFAULT_TABLE_LIMIT = 10000;
const DEFAULT_PER_NUMBER_LIMIT = 300;
const DEFAULT_EXECUTE_WEAK = true;
const DEFAULT_EXECUTE_OBSERVATION = false;
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
const STORAGE_KEY = "edgelab_pulse_roulette_terminal_v4";
const CONTROL_SETTINGS_KEY = "edgelab_pulse_roulette_control_settings_v1";
const STRATEGIES: Strategy[] = [
  "Flat",
  "Martingale 3",
  "Martingale 5",
  "Martingale 7",
  "Step Recovery",
  "Exposure Cap",
  "Confidence-65",
  "Confidence-75",
  "Progressive Confidence",
];
const VIEWS: ViewKey[] = ["Dashboard", "Analytics", "Reports", "Sessions"];
const EXECUTION_MODES: ExecutionMode[] = ["Stream Direct", "Neighbor Expansion", "Edge Expansion", "Hybrid Coverage"];
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
// Separate from Neighbor Expansion.
// Edge Expansion = core group + only these one-number edge adds.
const EDGE_EXPANSION: Partial<Record<GroupKey, SpinValue[]>> = {
  BHE: [9],
  RHE: [2],
  BHO: [1],
  RHO: [10],
  RLE: [2],
  BLO: [1],
};

// NEIGHBOR EXPANSION MAP
// These added numbers are an execution overlay used by Neighbor Expansion.
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
  if (history.length < 6) {
    return {
      group: null as GroupKey | null,
      numbers: [] as SpinValue[],
      confidence: 0,
      tier: "No Prediction",
      reason: "Need at least 6 spins.",
      dimensionTDA: {
        min: DEFAULT_DIMENSION_GATE_MIN,
        passed: false,
        color: 0,
        range: 0,
        parity: 0,
        failed: ["Color", "Range", "Parity"],
      },
    };
  }

  const groups = groupSeries(history);
  const bits = groups.map(groupToBits);
  const colorBits = bits.map((b) => b[0]);
  const rangeBits = bits.map((b) => b[1]);
  const parityBits = bits.map((b) => b[2]);
  const chaos = entropy(groups);

  type AxisName = "Color" | "Range" | "Parity";
  type BinaryPrediction = { bit: 0 | 1; strength: number; name: string };
  type PredictorName = "Markov" | "Streak" | "Reversal" | "Frequency" | "Recency" | "Entropy";
  type BinaryAxisForecast = {
    bit: 0 | 1;
    confidence: number;
    margin: number;
    reliability: number;
    agreement: number;
    score0: number;
    score1: number;
    leaders: string;
  };

  const oppositeBit = (bit: 0 | 1) => (bit === 0 ? 1 : 0) as 0 | 1;

  const safeMajority = (values: (0 | 1)[], fallback: 0 | 1 = 0): 0 | 1 => {
    if (!values.length) return fallback;
    const ones = values.filter((v) => v === 1).length;
    const zeros = values.length - ones;
    return zeros >= ones ? 0 : 1;
  };

  const weightedRecentBit = (values: (0 | 1)[], fallback: 0 | 1 = 0): BinaryPrediction => {
    if (!values.length) return { bit: fallback, strength: 0.5, name: "Recency" };
    const recent = values.slice(-10);
    let zeroScore = 0;
    let oneScore = 0;
    recent.forEach((bit, index) => {
      const weight = 0.65 + ((index + 1) / recent.length) * 0.85;
      if (bit === 0) zeroScore += weight;
      else oneScore += weight;
    });
    const total = Math.max(1, zeroScore + oneScore);
    const bit = zeroScore >= oneScore ? 0 : 1;
    return { bit: bit as 0 | 1, strength: 0.7 + Math.abs(zeroScore - oneScore) / total, name: "Recency" };
  };

  const markovPrediction = (values: (0 | 1)[]): BinaryPrediction => {
    if (values.length < 4) return weightedRecentBit(values, values.at(-1) ?? 0);
    const scores: Record<0 | 1, number> = { 0: 0, 1: 0 };
    const addPatternScore = (depth: number, weight: number) => {
      if (values.length <= depth) return;
      const pattern = values.slice(-depth).join("");
      for (let i = 0; i <= values.length - depth - 1; i += 1) {
        if (values.slice(i, i + depth).join("") === pattern) {
          const next = values[i + depth];
          const recency = (i + depth + 1) / values.length;
          scores[next] += weight * (0.65 + recency * 0.35);
        }
      }
    };
    addPatternScore(3, 3.0);
    addPatternScore(2, 2.0);
    addPatternScore(1, 1.1);
    if (scores[0] === 0 && scores[1] === 0) return weightedRecentBit(values, values.at(-1) ?? 0);
    const bit = scores[0] >= scores[1] ? 0 : 1;
    const total = Math.max(1, scores[0] + scores[1]);
    return { bit: bit as 0 | 1, strength: 0.8 + Math.abs(scores[0] - scores[1]) / total, name: "Markov" };
  };

  const streakPrediction = (values: (0 | 1)[]): BinaryPrediction => {
    if (!values.length) return { bit: 0, strength: 0.5, name: "Streak" };
    const run = getCurrentBitRun(values);
    const bit = run.length >= 2 ? run.bit : weightedRecentBit(values, run.bit).bit;
    return { bit, strength: Math.min(1.65, 0.72 + run.length * 0.16), name: "Streak" };
  };

  const reversalPrediction = (values: (0 | 1)[]): BinaryPrediction => {
    if (values.length < 4) return { bit: oppositeBit(values.at(-1) ?? 0), strength: 0.55, name: "Reversal" };
    const recent = values.slice(-8);
    let alternations = 0;
    for (let i = 1; i < recent.length; i += 1) if (recent[i] !== recent[i - 1]) alternations += 1;
    const run = getCurrentBitRun(values);
    const last = values[values.length - 1];
    const bit = alternations >= Math.max(3, recent.length - 3) || run.length >= 4 ? oppositeBit(last) : last;
    const strength = alternations >= 5 || run.length >= 4 ? 1.32 : 0.76;
    return { bit, strength, name: "Reversal" };
  };

  const frequencyPrediction = (values: (0 | 1)[]): BinaryPrediction => {
    const recent = values.slice(-18);
    if (!recent.length) return { bit: 0, strength: 0.5, name: "Frequency" };
    const ones = recent.filter((v) => v === 1).length;
    const zeros = recent.length - ones;
    const imbalance = Math.abs(zeros - ones) / recent.length;
    // Mild mean-reversion: if one side is heavily overrepresented, expect the opposite side to appear.
    const bit = zeros > ones ? 1 : 0;
    return { bit: bit as 0 | 1, strength: 0.68 + imbalance * 0.95, name: "Frequency" };
  };

  const entropyPrediction = (values: (0 | 1)[]): BinaryPrediction => {
    const recent = values.slice(-12);
    if (recent.length < 4) return weightedRecentBit(values, values.at(-1) ?? 0);
    const ones = recent.filter((v) => v === 1).length;
    const zeros = recent.length - ones;
    const p0 = zeros / recent.length;
    const p1 = ones / recent.length;
    const h = -(p0 ? p0 * Math.log2(p0) : 0) - (p1 ? p1 * Math.log2(p1) : 0);
    const last = values[values.length - 1];
    const run = getCurrentBitRun(values);
    const bit = h < 0.88 ? safeMajority(recent, last) : run.length >= 3 ? oppositeBit(last) : weightedRecentBit(values, last).bit;
    return { bit, strength: h < 0.88 ? 1.18 : 0.86, name: "Entropy" };
  };

  const rawPredictors: Record<PredictorName, (values: (0 | 1)[]) => BinaryPrediction> = {
    Markov: markovPrediction,
    Streak: streakPrediction,
    Reversal: reversalPrediction,
    Frequency: frequencyPrediction,
    Recency: (values) => weightedRecentBit(values, values.at(-1) ?? 0),
    Entropy: entropyPrediction,
  };

  const predictorReliability = (values: (0 | 1)[], name: PredictorName) => {
    const start = Math.max(4, values.length - 34);
    let wins = 0;
    let trials = 0;
    for (let i = start; i < values.length; i += 1) {
      const prior = values.slice(0, i);
      if (prior.length < 4) continue;
      const prediction = rawPredictors[name](prior);
      if (prediction.bit === values[i]) wins += 1;
      trials += 1;
    }
    // Bayesian beta prior prevents tiny samples from over-dominating.
    const reliability = (wins + 2) / (trials + 4);
    return { wins, trials, reliability };
  };

  const entropyRegime = chaos >= 62 ? "High" : chaos >= 45 ? "Medium" : "Low";

  const entropyModelModifier = (name: PredictorName) => {
    // CONTROLLED ENTROPY REGIME WEIGHTING
    // Entropy is used only as a weighting modifier, not as a dominant engine.
    // High entropy slightly favors reversal/recency behavior and slightly suppresses
    // slower trend/persistence models. Low entropy slightly favors Markov/streak.
    // Guardrails later prevent chaos weighting from creating Strong by itself.
    if (entropyRegime === "High") {
      if (name === "Reversal") return 1.18;
      if (name === "Recency") return 1.10;
      if (name === "Entropy") return 1.08;
      if (name === "Markov") return 0.92;
      if (name === "Streak") return 0.88;
      if (name === "Frequency") return 1.02;
    }
    if (entropyRegime === "Medium") {
      if (name === "Reversal") return 1.08;
      if (name === "Recency") return 1.05;
      if (name === "Entropy") return 1.04;
      return 1.0;
    }
    if (name === "Markov") return 1.08;
    if (name === "Streak") return 1.06;
    if (name === "Reversal") return 0.96;
    return 1.0;
  };

  const predictAxis = (values: (0 | 1)[], axis: AxisName): BinaryAxisForecast => {
    const predictorNames = Object.keys(rawPredictors) as PredictorName[];
    const score: Record<0 | 1, number> = { 0: 0, 1: 0 };
    const details = predictorNames.map((name) => {
      const prediction = rawPredictors[name](values);
      const rel = predictorReliability(values, name);
      // Reliability range is intentionally narrow so no single predictor dominates the whole axis.
      const reliabilityWeight = 0.72 + rel.reliability * 1.18;
      const sampleWeight = Math.min(1.15, 0.75 + rel.trials / 40);
      const regimeWeight = entropyModelModifier(name);
      const weight = prediction.strength * reliabilityWeight * sampleWeight * regimeWeight;
      score[prediction.bit] += weight;
      return { name, prediction, ...rel, weight };
    });

    const bit = score[0] >= score[1] ? 0 : 1;
    const total = Math.max(1, score[0] + score[1]);
    const margin = Math.abs(score[0] - score[1]) / total;
    const supporting = details.filter((d) => d.prediction.bit === bit);
    const agreement = supporting.length / Math.max(1, details.length);
    const reliability = supporting.reduce((sum, d) => sum + d.reliability, 0) / Math.max(1, supporting.length);
    const leaders = details
      .slice()
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 2)
      .map((d) => `${d.name}:${d.prediction.bit}`)
      .join("/");

    let confidence = Math.max(
      43,
      Math.min(
        92,
        Math.round(46 + margin * 32 + agreement * 10 + (reliability - 0.5) * 22)
      )
    );

    return {
      bit: bit as 0 | 1,
      confidence,
      margin,
      reliability,
      agreement,
      score0: score[0],
      score1: score[1],
      leaders,
    };
  };

  // DIMENSION MARKOV PULSE ARCHITECTURE - Color Markov + Range Markov + Parity Markov, then TDA, then final basket
  // Live PULSE forecast order is intentionally:
  // 1. Predict Color as a binary stream using several small predictors.
  // 2. Predict Range as a binary stream using the same predictor pool.
  // 3. Predict Parity as a binary stream using the same predictor pool.
  // 4. Use Bayesian reliability to weight whichever predictors are working now.
  // 5. Combine the three predicted bits into the final group.
  // 6. Apply confidence tier and Neural Assist after this forecast.
  // BB logic below remains locked and separate.
  const colorForecast = predictAxis(colorBits, "Color");
  const rangeForecast = predictAxis(rangeBits, "Range");
  const parityForecast = predictAxis(parityBits, "Parity");

  const originalPulseBits: [0 | 1, 0 | 1, 0 | 1] = [colorForecast.bit, rangeForecast.bit, parityForecast.bit];
  const weakDimensionSubstitution = getWeakDimensionSubstitution(history, originalPulseBits);
  const bestGroup = weakDimensionSubstitution.adjustedGroup;
  const axisConfidences = [colorForecast.confidence, rangeForecast.confidence, parityForecast.confidence];
  const avgAxisConfidence = axisConfidences.reduce((sum, value) => sum + value, 0) / axisConfidences.length;
  const minAxisConfidence = Math.min(...axisConfidences);
  const maxAxisConfidence = Math.max(...axisConfidences);
  const axisSpreadPenalty = Math.min(9, (maxAxisConfidence - minAxisConfidence) / 3.25);
  const marginBoost = Math.round((colorForecast.margin + rangeForecast.margin + parityForecast.margin) * 10);
  const reliabilityBoost = Math.round(((colorForecast.reliability + rangeForecast.reliability + parityForecast.reliability) / 3 - 0.5) * 16);
  const agreementBoost = Math.round(((colorForecast.agreement + rangeForecast.agreement + parityForecast.agreement) / 3 - 0.5) * 12);
  const lowEntropyBoost = chaos <= 35 ? 5 : chaos <= 48 ? 2 : 0;
  const entropyPenalty = chaos >= 72 ? 5 : chaos >= 60 ? 3 : chaos >= 50 ? 1 : 0;
  const entropyAdaptiveLift = entropyRegime === "High" ? 2 : entropyRegime === "Medium" ? 1 : 0;
  const weakestAxisGuard = minAxisConfidence < 50 ? -5 : minAxisConfidence >= 63 ? 4 : 0;
  const chaosStrongGuard = entropyRegime === "High" && minAxisConfidence < 66 ? 73 : 100;

  let confidence = Math.max(
    38,
    Math.min(
      chaosStrongGuard,
      Math.round(avgAxisConfidence + marginBoost + reliabilityBoost + agreementBoost + lowEntropyBoost + entropyAdaptiveLift + weakestAxisGuard - entropyPenalty - axisSpreadPenalty)
    )
  );

  if (weakDimensionSubstitution.active) {
    confidence = Math.max(38, confidence - weakDimensionSubstitution.penalty);
  }

  const tier =
    confidence >= 78
      ? "Strong Prediction"
      : confidence >= 65
      ? "Controlled Prediction"
      : confidence >= 50
      ? "Weak Prediction"
      : "Directional Observe";

  const dimensionTDAMin = DEFAULT_DIMENSION_GATE_MIN;
  const axisRows = [
    { key: "color" as AxisKey, name: "Color", confidence: colorForecast.confidence, stability: getAxisStabilityScore(colorBits), persistence: getAxisPersistenceScore(colorBits, colorForecast.bit) },
    { key: "range" as AxisKey, name: "Range", confidence: rangeForecast.confidence, stability: getAxisStabilityScore(rangeBits), persistence: getAxisPersistenceScore(rangeBits, rangeForecast.bit) },
    { key: "parity" as AxisKey, name: "Parity", confidence: parityForecast.confidence, stability: getAxisStabilityScore(parityBits), persistence: getAxisPersistenceScore(parityBits, parityForecast.bit) },
  ];

  // TDA STABILITY GATE
  // Prior TDA only checked the current confidence of Color / Range / Parity.
  // That allowed executions during dimensional migration: the axes looked aligned
  // right now, but the alignment was rotating too quickly to be durable.
  // This gate requires each trusted axis to have both confidence and persistence.
  const tdaStabilityMin = 48;
  const strongStabilityMin = 56;
  const persistenceMin = PERSISTENCE_GATE_MIN;
  const strongPersistenceMin = STRONG_PERSISTENCE_MIN;
  const passedAxes = axisRows.filter((axis) => axis.confidence >= dimensionTDAMin);
  const stablePassedAxes = axisRows.filter((axis) => axis.confidence >= dimensionTDAMin && axis.stability >= tdaStabilityMin && axis.persistence >= persistenceMin);
  const fullConfidencePass = passedAxes.length === 3;
  const averageAxisPersistence = axisRows.reduce((sum, axis) => sum + axis.persistence, 0) / 3;
  const lowestAxisPersistence = Math.min(...axisRows.map((axis) => axis.persistence));
  const fullStabilityPass = stablePassedAxes.length === 3 && axisRows.reduce((sum, axis) => sum + axis.stability, 0) / 3 >= strongStabilityMin && averageAxisPersistence >= strongPersistenceMin;
  const fullTdaPass = fullConfidencePass && fullStabilityPass;
  const compressed2DPass = !fullTdaPass && stablePassedAxes.length >= 2 && confidence >= 50;
  const adaptiveMode: AdaptiveTDAMode = fullTdaPass ? "FULL_3D" : compressed2DPass ? "COMPRESSED_2D" : "OBSERVE";
  const activeAxes = fullTdaPass
    ? axisRows.map((axis) => axis.key)
    : compressed2DPass
    ? stablePassedAxes
        .slice()
        .sort((a, b) => (b.confidence + b.stability + b.persistence) - (a.confidence + a.stability + a.persistence))
        .slice(0, 2)
        .map((axis) => axis.key)
    : [];
  const adaptiveNumbers = getAdaptiveDimensionNumbers(bestGroup as GroupKey, activeAxes);
  const averageAxisStability = axisRows.reduce((sum, axis) => sum + axis.stability, 0) / 3;
  const lowestAxisStability = Math.min(...axisRows.map((axis) => axis.stability));
  const dimensionStability = Math.round((minAxisConfidence * 0.25) + (avgAxisConfidence * 0.10) + (averageAxisStability * 0.28) + (lowestAxisStability * 0.10) + (averageAxisPersistence * 0.20) + (lowestAxisPersistence * 0.07));
  const migrationRisk = Math.max(0, Math.min(100, Math.round((maxAxisConfidence - minAxisConfidence) * 1.2 + (100 - minAxisConfidence) * 0.20 + (100 - averageAxisStability) * 0.45 + (100 - averageAxisPersistence) * 0.45)));
  const unstableAxes = axisRows.filter((axis) => axis.confidence >= dimensionTDAMin && axis.stability < tdaStabilityMin).map((axis) => axis.name);
  const weakPersistenceAxes = axisRows.filter((axis) => axis.confidence >= dimensionTDAMin && axis.persistence < persistenceMin).map((axis) => axis.name);
  const dimensionTDA = {
    min: dimensionTDAMin,
    passed: fullTdaPass || compressed2DPass,
    fullPass: fullTdaPass,
    compressed: compressed2DPass,
    mode: adaptiveMode,
    modeLabel: getTdaModeLabel(adaptiveMode),
    activeAxes,
    adaptiveNumbers,
    color: colorForecast.confidence,
    range: rangeForecast.confidence,
    parity: parityForecast.confidence,
    colorStability: axisRows[0].stability,
    rangeStability: axisRows[1].stability,
    parityStability: axisRows[2].stability,
    colorPersistence: axisRows[0].persistence,
    rangePersistence: axisRows[1].persistence,
    parityPersistence: axisRows[2].persistence,
    persistence: Math.round(averageAxisPersistence),
    lowestPersistence: lowestAxisPersistence,
    stability: dimensionStability,
    migrationRisk,
    unstable: unstableAxes,
    weakPersistence: weakPersistenceAxes,
    stabilityMin: tdaStabilityMin,
    persistenceMin,
    failed: [
      ...axisRows.filter((axis) => axis.confidence < dimensionTDAMin).map((axis) => axis.name),
      ...unstableAxes.map((axis) => `${axis} Stability`),
      ...weakPersistenceAxes.map((axis) => `${axis} Persistence`),
    ],
  };

  const reason =
    adaptiveMode === "OBSERVE"
      ? `TDA hold · ${dimensionTDA.failed.join("/") || "Axis"} failed confidence, stability, or persistence check.`
      : adaptiveMode === "COMPRESSED_2D"
      ? `Adaptive TDA · 2D compression active on ${activeAxes.join("+")} after stability/persistence check.`
      : confidence < 50
      ? "Directional Observe · Bayesian dimension forecast held for safety."
      : entropyRegime === "High"
      ? "Bayesian dimension-first PULSE forecast · entropy weighting active."
      : "Bayesian dimension-first PULSE forecast.";

  return {
    group: bestGroup as GroupKey,
    // Keep the visible forecast tied to the 3D group only.
    // Adaptive 2D compression is reserved for Hybrid Coverage execution only,
    // so Neighbor Expansion cannot display or execute the wrong group-side basket.
    numbers: GROUPS[bestGroup as GroupKey],
    confidence,
    tier,
    reason,
    dimensionTDA,
    weakDimensionSubstitution,
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

function isActivePulseRow(row: Step) {
  return row.result !== "push" && row.note.startsWith("PULSE");
}

function isProtectionHoldRow(row: Step) {
  return row.result === "push" && row.note.startsWith("Pulse Loss Protection");
}

function getActivePulseLossStreak(history: Step[]) {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const row = history[i];

    // A prior protection hold starts a new loss-count cycle. This prevents
    // the old 3-loss block from repeatedly retriggering after re-entry.
    if (isProtectionHoldRow(row)) break;

    if (isActivePulseRow(row) && row.result === "loss") {
      streak += 1;
      continue;
    }

    if (isActivePulseRow(row) && row.result === "win") break;

    // Advisory/no-bet pushes do not reset the active PULSE loss streak.
    if (row.result === "push") continue;

    // A non-PULSE settled result means another engine broke the live PULSE sequence.
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
  const rows = getRecentActivePulseRows(history, DIS_STAGE3_WINDOW);
  const recent5 = rows.slice(-DIS_STAGE1_WINDOW);
  const recent6 = rows.slice(-DIS_STAGE2_WINDOW);
  const recent8 = rows.slice(-DIS_STAGE3_WINDOW);

  const lossCount5 = recent5.filter((row) => row.result === "loss").length;
  const lossCount6 = recent6.filter((row) => row.result === "loss").length;
  const lossCount8 = recent8.filter((row) => row.result === "loss").length;

  const axisMisses = { color: 0, range: 0, parity: 0 };
  const axisTrials = { color: 0, range: 0, parity: 0 };

  rows.forEach((row) => {
    if (!row.predictedGroup || !row.outcomeGroup) return;
    const predicted = groupToBits(row.predictedGroup as GroupKey);
    const actual = groupToBits(row.outcomeGroup as GroupKey);

    axisTrials.color += 1;
    axisTrials.range += 1;
    axisTrials.parity += 1;

    if (predicted[0] !== actual[0]) axisMisses.color += 1;
    if (predicted[1] !== actual[1]) axisMisses.range += 1;
    if (predicted[2] !== actual[2]) axisMisses.parity += 1;
  });

  const colorRate = axisTrials.color ? axisMisses.color / axisTrials.color : 0;
  const rangeRate = axisTrials.range ? axisMisses.range / axisTrials.range : 0;
  const parityRate = axisTrials.parity ? axisMisses.parity / axisTrials.parity : 0;
  const worstAxisRate = Math.max(colorRate, rangeRate, parityRate);
  const worstAxis =
    worstAxisRate === colorRate ? "Color" :
    worstAxisRate === rangeRate ? "Range" :
    "Parity";

  let level = 0;
  let penalty = 0;
  let cap: null | TierLabel = null;
  let label = "Clear";

  if (recent8.length >= DIS_STAGE3_WINDOW && lossCount8 >= DIS_STAGE3_MISSES && worstAxisRate >= 0.62) {
    level = 3;
    penalty = DIS_STAGE3_PENALTY;
    cap = "Weak Prediction";
    label = "Fast Invalidate";
  } else if (recent6.length >= DIS_STAGE2_WINDOW && lossCount6 >= DIS_STAGE2_MISSES && worstAxisRate >= 0.58) {
    level = 2;
    penalty = DIS_STAGE2_PENALTY;
    cap = "Weak Prediction";
    label = "Invalidating";
  } else if (recent5.length >= DIS_STAGE1_WINDOW && lossCount5 >= DIS_STAGE1_MISSES && worstAxisRate >= 0.54) {
    level = 1;
    penalty = DIS_STAGE1_PENALTY;
    cap = "Controlled Prediction";
    label = "Watch";
  }

  return {
    level,
    penalty,
    cap,
    label,
    lossCount5,
    lossCount6,
    lossCount8,
    worstAxis,
    worstAxisRate: Math.round(worstAxisRate * 100),
    axisMisses,
    axisTrials,
  };
}


function getAxisRecentAccuracyFromRows(history: Step[], axis: "color" | "range" | "parity", window = WDS_WINDOW) {
  const rows: Step[] = [];
  for (let i = history.length - 1; i >= 0 && rows.length < window; i -= 1) {
    const row = history[i];
    if (isActivePulseRow(row) && row.predictedGroup && row.outcomeGroup) rows.push(row);
  }
  if (rows.length < WDS_MIN_TRIALS) return { trials: rows.length, wins: 0, rate: 0.5, weak: false };
  const axisIndex = axis === "color" ? 0 : axis === "range" ? 1 : 2;
  let wins = 0;
  rows.forEach((row) => {
    const predicted = groupToBits(row.predictedGroup as GroupKey);
    const actual = groupToBits(row.outcomeGroup as GroupKey);
    if (predicted[axisIndex] === actual[axisIndex]) wins += 1;
  });
  const rate = wins / rows.length;
  return { trials: rows.length, wins, rate, weak: rate < WDS_ACCURACY_MIN };
}

function getWeakDimensionSubstitution(history: Step[], originalBits: [0 | 1, 0 | 1, 0 | 1]) {
  const color = getAxisRecentAccuracyFromRows(history, "color");
  const range = getAxisRecentAccuracyFromRows(history, "range");
  const parity = getAxisRecentAccuracyFromRows(history, "parity");
  const axes = [
    { name: "Color" as const, index: 0, ...color },
    { name: "Range" as const, index: 1, ...range },
    { name: "Parity" as const, index: 2, ...parity },
  ];
  const weakest = axes.filter((a) => a.weak).sort((a, b) => a.rate - b.rate)[0];
  const originalGroup = bitsToGroup(originalBits[0], originalBits[1], originalBits[2]);
  if (!weakest) {
    return { active: false, substitutedAxis: null as null | "Color" | "Range" | "Parity", originalBits, adjustedBits: originalBits, originalGroup, adjustedGroup: originalGroup, penalty: 0, axisRates: { color: Math.round(color.rate * 100), range: Math.round(range.rate * 100), parity: Math.round(parity.rate * 100) } };
  }
  const adjustedBits = [...originalBits] as [0 | 1, 0 | 1, 0 | 1];
  adjustedBits[weakest.index] = adjustedBits[weakest.index] === 0 ? 1 : 0;
  return { active: true, substitutedAxis: weakest.name, originalBits, adjustedBits, originalGroup, adjustedGroup: bitsToGroup(adjustedBits[0], adjustedBits[1], adjustedBits[2]), penalty: WDS_CONFIDENCE_PENALTY, axisRates: { color: Math.round(color.rate * 100), range: Math.round(range.rate * 100), parity: Math.round(parity.rate * 100) } };
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
  const pulse = pulseGroup ?? forecast(history).group;
  const straight = bbStraightForecast(history).group;
  const inverted = bbInvertedForecast(history).group;
  const groups = [pulse, straight, inverted].filter(Boolean) as GroupKey[];
  if (!groups.length) return 0;
  const maxAgreement = Math.max(...groups.map((group) => groups.filter((value) => value === group).length));
  return Math.round((maxAgreement / groups.length) * 100);
}

function getReEntryScore(history: Step[], rawPulse: any, adjustedConfidence: number) {
  const priorHistory = history.slice(0, -1);
  const priorRawPulse = priorHistory.length >= 6 ? forecast(priorHistory) : null;
  const currentEntropy = entropy(groupSeries(history));
  const priorEntropy = priorHistory.length ? entropy(groupSeries(priorHistory)) : currentEntropy;
  const currentAgreement = getForecastAgreementScore(history, rawPulse.group);
  const priorAgreement = priorHistory.length >= 6 ? getForecastAgreementScore(priorHistory, priorRawPulse?.group ?? null) : currentAgreement;
  const lastPulseLoss = getLastActivePulseLoss(history);
  const dimensionTDA = rawPulse?.dimensionTDA;

  const checks = {
    tdaPass: !!dimensionTDA?.passed,
    confidenceFloor: adjustedConfidence >= 60,
    confidenceRising: priorRawPulse ? adjustedConfidence >= priorRawPulse.confidence : adjustedConfidence >= 60,
    entropyStableOrFalling: currentEntropy <= priorEntropy + 2,
    forecastChanged: !lastPulseLoss?.forecastGroup || rawPulse.group !== lastPulseLoss.forecastGroup,
    memoryAgreementImproving: currentAgreement >= priorAgreement,
  };

  const score =
    (checks.tdaPass ? 25 : 0) +
    (checks.confidenceFloor ? 20 : 0) +
    (checks.confidenceRising ? 15 : 0) +
    (checks.entropyStableOrFalling ? 15 : 0) +
    (checks.forecastChanged ? 10 : 0) +
    (checks.memoryAgreementImproving ? 15 : 0);

  return {
    score,
    threshold: PULSE_REENTRY_THRESHOLD,
    passed: score >= PULSE_REENTRY_THRESHOLD,
    checks,
    currentEntropy,
    priorEntropy,
    currentAgreement,
    priorAgreement,
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
  const rawPulse = forecast(history);
  const straight = bbStraightForecast(history);
  const inverted = bbInvertedForecast(history);
  const e = entropy(groupSeries(history));
  const recent = getPulseRecentAccuracy(history, 20);
  const neuralReady = history.length >= 6 && !!rawPulse.group;

  if (!neuralReady) {
    return {
      rawPulse,
      straight,
      inverted,
      entropy: e,
      recent,
      aligned: false,
      neuralReady,
      neuralScore: 0,
      status: "No Data",
      adjustment: 0,
      adjustedConfidence: rawPulse.confidence,
      adjustedTier: rawPulse.tier,
      adjustedReason: rawPulse.reason,
    };
  }

  const aligned = [straight.group, inverted.group].includes(rawPulse.group);
  const neuralScore = Math.max(0, Math.min(100, Math.round((recent.rate * 45) + (aligned ? 25 : 8) + (100 - e) * 0.25)));
  const status = neuralScore >= 70 ? "Agree" : neuralScore >= 52 ? "Caution" : "Conflict";
  const adjustment = neuralScore >= 70 ? 6 : neuralScore >= 52 ? 0 : -8;
  const adjustedConfidence = Math.max(0, Math.min(100, rawPulse.confidence + adjustment));
  const adjustedTier = getPulseTier(adjustedConfidence);
  const adjustedReason = getPulseReason(adjustedConfidence);

  return {
    rawPulse,
    straight,
    inverted,
    entropy: e,
    recent,
    aligned,
    neuralReady,
    neuralScore,
    status,
    adjustment,
    adjustedConfidence,
    adjustedTier,
    adjustedReason,
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

function getNeuralCalibratedPulse(history: Step[]) {
  const neural = getNeuralAssistMetrics(history);
  const rawPulse = neural.rawPulse;
  const pulseLossStreak = getActivePulseLossStreak(history);
  const rv = getPulseRvMetrics(history);
  const e = entropy(groupSeries(history));

  // HARMONIZED FILTER ARCHITECTURE
  // PULSE is the only forecast engine.
  // Neural Assist is diagnostics only here; it no longer modifies live confidence.
  // Consensus is the only execution gate.
  // ARV handles reversal detection. RV is diagnostics only.
  // Entropy is an environment warning and only blocks at extreme readings.
  // Loss pressure applies a temporary confidence penalty after 3 active PULSE losses.
  const lossPressureActive = pulseLossStreak >= PULSE_LOSS_PROTECTION_TRIGGER && !!rawPulse.group;
  const lossPressurePenalty = lossPressureActive ? 12 : 0;
  const entropyExtreme = e >= ENTROPY_EXTREME_BLOCK;
  const entropyPenalty = entropyExtreme ? 10 : 0;
  const rvPenalty = 0;

  const finalConfidence = Math.max(0, Math.min(100, rawPulse.confidence - lossPressurePenalty - entropyPenalty));
  let finalTier = entropyExtreme ? "Directional Observe" : getPulseTier(finalConfidence);

  const reasonParts: string[] = [];
  if (lossPressureActive) reasonParts.push(`Pulse Loss Pressure -${lossPressurePenalty}`);
  if (entropyExtreme) reasonParts.push(`Entropy Extreme ${e}%`);
  const finalReason = reasonParts.length
    ? `${reasonParts.join(" · ")}.`
    : rawPulse.reason;

  return {
    ...rawPulse,
    confidence: finalConfidence,
    tier: finalTier,
    reason: finalReason,
    rawConfidence: rawPulse.confidence,
    neuralScore: neural.neuralScore,
    neuralAdjustment: 0,
    neuralStatus: neural.status,
    neuralDiagnosticConfidence: neural.adjustedConfidence,
    neuralDiagnosticAdjustment: neural.adjustment,
    pulseLossStreak,
    lossPressureActive,
    lossPressurePenalty,
    lossProtectionActive: lossPressureActive,
    lossProtectionHold: false,
    lossProtectionPenalty: lossPressurePenalty,
    reEntryScore: 0,
    reEntryThreshold: 0,
    reEntryPassed: true,
    reEntryChecks: null,
    rv,
    rvStructuralGovernance: { level: "Disabled", score: 0, penalty: 0, blockExecution: false },
    rvPenalty: 0,
    rvStructuralLevel: "Disabled",
    rvStructuralScore: 0,
    entropyExtreme,
    rvStructuralBlock: false,
    entropyValue: e,
    entropyPenalty,
    disLevel: 0,
    disPenalty: 0,
    disLabel: "Disabled",
    disWorstAxis: "None",
    disWorstAxisRate: 0,
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
  // Stream Direct and Neighbor Expansion must stay tied to the exact 3D group basket.
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
  // LOCKED SESSION DPI RULE
  // Session DPI mechanics never invert and never change below -5.
  // Win moves +1 toward zero, loss moves -1, push is neutral.
  // DPI is capped at 0 and can extend negatively without a lower bound.
  return history.reduce((sum, h) => {
    const delta = h.result === "win" ? 1 : h.result === "loss" ? -1 : 0;
    return capDpi(sum + delta);
  }, 0);
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
  if (result === "win") return capDpi(value + 1);
  if (result === "loss") return capDpi(value - 1);
  return value;
}

function getAxisBbDpiValues(history: Step[], bbInvertedEnabled = false) {
  // LOCKED INDEPENDENT AXIS BB + DPI RULE
  // Color, Range, and Parity are settled as three separate BB STRAIGHT streams.
  // DPI moves from each axis BB Straight settlement result, not from raw color/range/parity
  // direction and not from the final combined roulette group result.
  //
  // CRITICAL LOCK:
  // Inverted BB mode may change the active forecast/execution interpretation,
  // but it must NOT change the DPI counting engine.
  // DPI itself never flips, never mirrors, and never changes behavior below -5.
  // That means the DPI panel always remains a same-rule pressure counter:
  // - BB Straight WIN moves +1 toward 0.
  // - BB Straight LOSS moves -1.
  // - Push is neutral.
  // - Count never rises above 0.
  //
  // This prevents the exact bug where enabling Inverted mode made a sequence like
  // 0 1 1 0 1 1 1 0 1 end at -4 instead of the locked -6.
  void bbInvertedEnabled;

  let color = 0;
  let range = 0;
  let parity = 0;

  const colorBits: (0 | 1)[] = [];
  const rangeBits: (0 | 1)[] = [];
  const parityBits: (0 | 1)[] = [];

  history.forEach((row) => {
    const [colorBit, rangeBit, parityBit] = groupToBits(row.outcomeGroup);

    const colorResult = settleStraightBbAxis(colorBits, colorBit);
    const rangeResult = settleStraightBbAxis(rangeBits, rangeBit);
    const parityResult = settleStraightBbAxis(parityBits, parityBit);

    color = updateDpiFromResult(color, colorResult);
    range = updateDpiFromResult(range, rangeResult);
    parity = updateDpiFromResult(parity, parityResult);

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


function bbStraightForecast(history: Step[]) {
  if (!history.length) {
    return { group: "BHE" as GroupKey, numbers: GROUPS.BHE, confidence: 0, tier: "BB Straight", reason: "Locked Boolean BB Straight initial base recommendation." };
  }

  const locked = getLockedBbAxisGroup(history, false);
  const group = locked.group;
  return {
    group,
    numbers: group ? GROUPS[group] : [],
    confidence: 0,
    tier: "BB Straight",
    axisDpi: locked.axisDpi,
    axisModes: locked.axisModes,
    reason: "Locked BB Straight recommendation from independent Color/Range/Parity axis assembly."
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
// INDEPENDENT MARKOV PLAY MODE
// Markov is a standalone Play Mode like BB Straight / BB Inverted.
// It does NOT read or modify BB Logic or DPI.
// Memory depth = 3. Forecast begins after 6 prior spins.
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

function getMarkovAxisConfidence(bits: (0 | 1)[], predicted: 0 | 1, depth = 3) {
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
      reason: "Markov waiting for 6-spin memory.",
    };
  }

  const bitRows = groupSeries(history).map(groupToBits);
  const colorBits = bitRows.map((b) => b[0]);
  const rangeBits = bitRows.map((b) => b[1]);
  const parityBits = bitRows.map((b) => b[2]);

  const color = getMarkovNextBit(colorBits, 3);
  const range = getMarkovNextBit(rangeBits, 3);
  const parity = getMarkovNextBit(parityBits, 3);

  const group = bitsToGroup(color, range, parity);
  const colorConfidence = getMarkovAxisConfidence(colorBits, color, 3);
  const rangeConfidence = getMarkovAxisConfidence(rangeBits, range, 3);
  const parityConfidence = getMarkovAxisConfidence(parityBits, parity, 3);
  const confidence = Math.round((colorConfidence + rangeConfidence + parityConfidence) / 3);

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
    reason: `Independent Markov · depth 3 · Color ${colorConfidence}% / Range ${rangeConfidence}% / Parity ${parityConfidence}%.`,
    markovDepth: 3,
    markovAxisConfidence: { color: colorConfidence, range: rangeConfidence, parity: parityConfidence },
  };
}

function getEngineModeLabel(pulseEnabled: boolean, bbStraightEnabled: boolean, bbInvertedEnabled: boolean, markovEnabled = false) {
  const bbMode = markovEnabled ? "Markov" : bbStraightEnabled && bbInvertedEnabled ? "Inverted BB" : bbStraightEnabled ? "Straight BB" : "BB Off";
  if (pulseEnabled && bbMode !== "BB Off") return `PULSE + ${bbMode}`;
  if (pulseEnabled) return "Pulse Only";
  return bbMode === "BB Off" ? "Disabled" : bbMode;
}

function getActiveDecision(history: Step[], pulseEnabled: boolean, bbStraightEnabled: boolean, bbInvertedEnabled: boolean, markovEnabled = false) {
  const pulse = getNeuralCalibratedPulse(history);
  const straight = bbStraightForecast(history);
  const inverted = bbInvertedForecast(history);
  const markov = markovForecast(history);
  const mode = getEngineModeLabel(pulseEnabled, bbStraightEnabled, bbInvertedEnabled, markovEnabled);

  // HARD PLAY-MODE AUTHORITY
  // PULSE is enhancer-only. It cannot create standalone execution.
  if (!bbStraightEnabled && !bbInvertedEnabled && !markovEnabled) {
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

function applyPulseEnhancerToDecision(decision: any, pulse: any, pulseEnabled: boolean, history: Step[] = []) {
  if (!pulseEnabled || !decision?.group || decision?.source === "NONE") return decision;

  const resync = getAxisResyncState(history);
  const consistency = getForecastConsistencyState(history, decision);
  const entropyChaos = getEntropyChaosInfluence(history);

  const structural = getStructuralPulseRead(
    history,
    decision,
    resync,
    consistency,
    entropyChaos
  );

  // Keep and strengthen directional tools:
  // - Single-Axis Correction
  // - Chaos Hold
  // - Re-Sync Detection
  // - Axis Drift Velocity
  // - Transition Acceleration
  // - Forecast Family Saturation
  // - Forecast Compression
  // - Directional Rebuild Engine

  const correction = getPulseAxisCorrection(
    history,
    decision,
    resync,
    entropyChaos
  );

  const rebuild = getDirectionalRebuildEngine(
    history,
    correction.group ? { ...decision, group: correction.group } : decision,
    resync,
    structural,
    entropyChaos
  );

  const finalGroup = rebuild.selectedGroup ?? correction.group ?? decision.group;

  const directionalScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        structural.score +
        (rebuild.selectedGroup !== decision.group ? 8 : 0) +
        (resync.improvingCount || 0) * 4 -
        (resync.weakCount || 0) * 3
      )
    )
  );

  const tier =
    directionalScore >= 76
      ? "Strong Prediction"
      : directionalScore >= 60
      ? "Controlled Prediction"
      : directionalScore >= 48
      ? "Weak Prediction"
      : "Directional Observe";

  return {
    ...decision,
    originalGroup: decision.group,
    forecastGroup: decision.group,
    group: finalGroup,
    numbers: GROUPS[finalGroup],
    confidence: directionalScore,
    tier,
    pulseEnhanced: true,
    pulseDiagnostics: {
      resync,
      consistency,
      entropyChaos,
      structural,
      correction,
      rebuild,
    },
    pulseGate: {
      allow: true,
      correctionMode: correction.mode,
      rebuildReason: rebuild.selectedReason,
      transitionStatus: structural.transition.status,
      driftStatus: structural.drift.status,
      familyStatus: structural.family.status,
      compressionStatus: structural.compression.status,
    },
    reason:
      `${decision.reason ?? ""} · ` +
      `PULSE Directional Layer · ` +
      `${rebuild.selectedReason} · ` +
      `${structural.transition.status} · ` +
      `${structural.drift.status} · ` +
      `${structural.family.status} · ` +
      `${structural.compression.status}.`,
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
  const perNumberCap = Math.max(1, perNumberLimit);
  return Math.max(1, Math.floor(Math.min(rawUnit, tableUnitCap, perNumberCap)));
}

function getUnitBet(
  strategy: Strategy,
  baseUnit: number,
  confidence: number,
  history: Step[],
  executionBasketSize = 1,
  bankroll = 0,
  tableLimit = DEFAULT_TABLE_LIMIT,
  perNumberLimit = DEFAULT_PER_NUMBER_LIMIT
) {
  const lossStreak = getLossStreak(history);
  let rawUnit = baseUnit;

  if (strategy === "Martingale 3") rawUnit = baseUnit * Math.pow(2, Math.floor(lossStreak / 3));
  else if (strategy === "Martingale 5") rawUnit = baseUnit * Math.pow(2, Math.floor(lossStreak / 5));
  else if (strategy === "Martingale 7") rawUnit = baseUnit * Math.pow(2, Math.floor(lossStreak / 7));
  else if (strategy === "Step Recovery") {
    if (lossStreak <= 2) rawUnit = baseUnit;
    else if (lossStreak <= 5) rawUnit = baseUnit * 2;
    else if (lossStreak <= 8) rawUnit = baseUnit * 3;
    else rawUnit = baseUnit * 4;
  } else if (strategy === "Exposure Cap") {
    const maxExposure = Math.max(baseUnit, bankroll * 0.02);
    rawUnit = Math.max(1, Math.floor(maxExposure / Math.max(1, executionBasketSize)));
  } else if (strategy === "Progressive Confidence") {
    if (confidence >= 85) rawUnit = baseUnit * 3;
    else if (confidence >= 75) rawUnit = baseUnit * 2;
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
  // Neighbor Expansion uses only the neighbor expansion map.
  // It intentionally does NOT include Edge Expansion numbers.
  return getPulseOnlyNeighbors(group, source);
}

function getEdgeExpansionNumbers(group: GroupKey | null) {
  // Edge Expansion uses only the one-number edge map.
  // It intentionally does NOT include Neighbor Expansion numbers.
  return group ? EDGE_EXPANSION[group] ?? [] : [];
}

function getOverlayNumbersForExecutionMode(group: GroupKey | null, executionMode: ExecutionMode, source?: string) {
  if (!group) return [] as SpinValue[];
  if (executionMode === "Neighbor Expansion") return getNeighborExpansionNumbers(group, source);
  if (executionMode === "Edge Expansion") return getEdgeExpansionNumbers(group);
  if (executionMode === "Hybrid Coverage") return uniqueNumbers([...getNeighborExpansionNumbers(group, source), ...getEdgeExpansionNumbers(group)]);
  return [] as SpinValue[];
}

function getWheelNeighbors(group: GroupKey | null, source?: string, executionMode: ExecutionMode = "Stream Direct") {
  // Wheel Overlay display follows the selected Execution Mode.
  return getOverlayNumbersForExecutionMode(group, executionMode, source);
}

function getExecutionNumbers(group: GroupKey | null, executionMode: ExecutionMode, source?: string, decision?: any) {
  if (!group) return [];
  const streamNumbers = getCoreExecutionNumbers(group, source, decision, executionMode);
  const overlayNumbers = getOverlayNumbersForExecutionMode(group, executionMode, source);
  return uniqueNumbers([...streamNumbers, ...overlayNumbers]);
}

function getWheelAlignment(group: GroupKey | null, executionMode: ExecutionMode, source?: string) {
  if (!group) return 0;
  if (executionMode === "Stream Direct") return 100;
  const neighbors = getOverlayNumbersForExecutionMode(group, executionMode, source);
  if (!neighbors.length) return 100;
  const core = GROUPS[group];
  const compatible = neighbors.filter((n) => numberToGroup(n) === group).length;
  return Math.round(((core.length + compatible) / (core.length + neighbors.length)) * 100);
}

function hasStreamConflict(group: GroupKey | null, executionMode: ExecutionMode, source?: string) {
  if (!group || executionMode === "Stream Direct") return false;
  return getOverlayNumbersForExecutionMode(group, executionMode, source).some((n) => numberToGroup(n) !== group);
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

function settleSpin(history: Step[], outcome: SpinValue, baseUnit: number, startingBankroll: number, strategy: Strategy, pulseEnabled: boolean, bbStraightEnabled: boolean, bbInvertedEnabled: boolean, executionMode: ExecutionMode = "Stream Direct", tableLimit = DEFAULT_TABLE_LIMIT, perNumberLimit = DEFAULT_PER_NUMBER_LIMIT, tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION, markovEnabled = false): Step {
  const f = getActiveDecision(history, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, markovEnabled);
  const bankroll = history.at(-1)?.bankroll ?? startingBankroll;
  const executionAllowed = shouldExecuteTier(f.tier, f.source, tierExecution, (f as any).rv, (f as any).entropyExtreme);
  const dimensionTDAAllowed = true; // TDA diagnostic only, not a hard gate.
  const active = f.source !== "NONE" && (!(f as any).pulseGate || (f as any).pulseGate.allow) && shouldBet(strategy, f.confidence, pulseEnabled, f.group) && executionAllowed ;
  const previewNumbers = active && f.group ? getExecutionNumbers(f.group, executionMode, f.source, f) : [];
  const streamNumbers = active && f.group ? getCoreExecutionNumbers(f.group, f.source, f, executionMode) : [];
  const wheelNeighbors = active && f.group ? getWheelNeighbors(f.group, f.source, executionMode) : [];
  const numbers = previewNumbers;
  const activeBasket = executionMode === "Stream Direct" ? streamNumbers : numbers;
  const unit = active ? getUnitBet(strategy, baseUnit, f.confidence, history, activeBasket.length, bankroll, tableLimit, perNumberLimit) : 0;
  const exposure = activeBasket.length * unit;

  // FINAL FORECAST / SETTLEMENT LOCK
  // The active forecast group is captured once before settlement.
  // Core settlement compares the outcome's group to that exact forecast group.
  // Overlay settlement remains separate and only applies to wheel-neighbor coverage.
  const lockedForecastGroup = active ? f.group : null;
  const lockedOutcomeGroup = numberToGroup(outcome);

  const neighborExpansionNumbers = active && lockedForecastGroup
    ? getNeighborExpansionNumbers(lockedForecastGroup, f.source)
    : [];
  const edgeExpansionNumbers = active && lockedForecastGroup
    ? getEdgeExpansionNumbers(lockedForecastGroup)
    : [];

  const overlayAllowed = executionMode !== "Stream Direct";

  const activeOverlayNeighbors =
    executionMode === "Neighbor Expansion"
      ? neighborExpansionNumbers
      : executionMode === "Edge Expansion"
      ? edgeExpansionNumbers
      : executionMode === "Hybrid Coverage"
      ? uniqueNumbers([...neighborExpansionNumbers, ...edgeExpansionNumbers])
      : [];

  // EXECUTION-BASKET SETTLEMENT LOCK
  // Stream Direct settles against the core group only.
  // Neighbor Expansion / Edge Expansion / Hybrid Coverage settle against the exact expanded execution basket.
  // This prevents Neighbor Expansion hits, such as BHE + 7, from being recorded as losses/pushes.
  const executionBasket = active ? activeBasket : [];
  const coreHit = active && lockedForecastGroup ? streamNumbers.includes(outcome) : false;
  const overlayHit = active && lockedForecastGroup && overlayAllowed ? executionBasket.includes(outcome) && !coreHit : false;
  const combinedHit = active && lockedForecastGroup ? executionBasket.includes(outcome) : false;
  const coreResult: Result = active && lockedForecastGroup ? (coreHit ? "win" : "loss") : "push";
  const overlayResult: Result = active && lockedForecastGroup && overlayAllowed && activeOverlayNeighbors.length ? (overlayHit ? "win" : "loss") : "push";
  let result: Result = "push";
  let net = 0;

  if (active && f.group) {
    if (combinedHit) {
      result = "win";
      net = 35 * unit - (activeBasket.length - 1) * unit;
    } else {
      result = "loss";
      net = -exposure;
    }
  }

  return {
    spin: history.length + 1,
    outcome,
    outcomeGroup: lockedOutcomeGroup,
    predictedGroup: lockedForecastGroup,
    predictedNumbers: numbers,
    forecastGroup: f.group,
    forecastNumbers: f.group ? GROUPS[f.group] : [],
    confidence: f.confidence,
    tier: f.tier,
    result,
    unitBet: unit,
    exposure,
    net,
    bankroll: bankroll + net,
    note: active
      ? `${f.source} ${f.group} · ${f.source === "PULSE" && (f as any).dimensionTDA?.compressed ? "2D Compression · " : ""}${f.source === "PULSE" ? `${f.confidence}% · ` : ""}${executionMode}${overlayHit ? " · Wheel Overlay Hit" : ""}${hasStreamConflict(f.group, executionMode, f.source) ? " · Stream Conflict" : ""}`
      : !dimensionTDAAllowed
      ? `TDA · No Bet · ${((f as any).dimensionTDA?.failed ?? []).join("/") || "Axis"} below ${((f as any).dimensionTDA?.min ?? DEFAULT_DIMENSION_GATE_MIN)}%`
      : f.source === "PULSE" && (f as any).entropyExtreme
      ? `Entropy Extreme · No Bet · entropy ${((f as any).entropyValue ?? 0)}%`
      : getTierExecutionNote(f.tier, f.group, f.group ? GROUPS[f.group] : []),
    executionMode,
    coreResult,
    overlayResult,
    wheelNeighbors: executionMode === "Stream Direct" ? [] : activeOverlayNeighbors,
    wheelAlignment: getWheelAlignment(f.group, executionMode, f.source),
    streamConflict: hasStreamConflict(f.group, executionMode, f.source),
    pulseGate: (f as any).pulseGate ?? null,
    pulseDiagnostics: (f as any).pulseDiagnostics ?? null,
  };
}



function getShadowDecision(history: Step[], engine: "PULSE" | "BB_STRAIGHT" | "BB_INVERTED") {
  const mode =
    engine === "PULSE"
      ? "Pulse Shadow"
      : engine === "BB_STRAIGHT"
      ? "Straight BB Shadow"
      : "Inverted BB Shadow";

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

  return {
    ...bbInvertedForecast(history),
    source: "BB_INVERTED" as const,
    mode,
  };
}

function settleSpinShadow(history: Step[], outcome: SpinValue, baseUnit: number, startingBankroll: number, strategy: Strategy, engine: "PULSE" | "BB_STRAIGHT" | "BB_INVERTED", executionMode: ExecutionMode = "Stream Direct", tableLimit = DEFAULT_TABLE_LIMIT, perNumberLimit = DEFAULT_PER_NUMBER_LIMIT, tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION): Step {
  const f = getShadowDecision(history, engine);
  const bankroll = history.at(-1)?.bankroll ?? startingBankroll;
  const executionAllowed = shouldExecuteTier(f.tier, f.source, tierExecution, (f as any).rv, (f as any).entropyExtreme);
  const dimensionTDAAllowed = true; // TDA diagnostic only, not a hard gate.
  const active = shouldBet(strategy, f.confidence, engine === "PULSE", f.group) && executionAllowed ;
  const previewNumbers = active && f.group ? getExecutionNumbers(f.group, executionMode, f.source, f) : [];
  const streamNumbers = active && f.group ? getCoreExecutionNumbers(f.group, f.source, f, executionMode) : [];
  const wheelNeighbors = active && f.group ? getWheelNeighbors(f.group, f.source) : [];
  const numbers = previewNumbers;
  const activeBasket = executionMode === "Stream Direct" ? streamNumbers : numbers;
  const unit = active ? getUnitBet(strategy, baseUnit, f.confidence, history, activeBasket.length, bankroll, tableLimit, perNumberLimit) : 0;
  const exposure = activeBasket.length * unit;

  // FINAL FORECAST / SETTLEMENT LOCK
  // The active forecast group is captured once before settlement.
  // Core settlement compares the outcome's group to that exact forecast group.
  // Overlay settlement remains separate and only applies to wheel-neighbor coverage.
  const lockedForecastGroup = active ? f.group : null;
  const lockedOutcomeGroup = numberToGroup(outcome);

  const neighborExpansionNumbers = active && lockedForecastGroup
    ? getNeighborExpansionNumbers(lockedForecastGroup, f.source)
    : [];
  const edgeExpansionNumbers = active && lockedForecastGroup
    ? getEdgeExpansionNumbers(lockedForecastGroup)
    : [];

  const overlayAllowed = executionMode !== "Stream Direct";

  const activeOverlayNeighbors =
    executionMode === "Neighbor Expansion"
      ? neighborExpansionNumbers
      : executionMode === "Edge Expansion"
      ? edgeExpansionNumbers
      : executionMode === "Hybrid Coverage"
      ? uniqueNumbers([...neighborExpansionNumbers, ...edgeExpansionNumbers])
      : [];

  // EXECUTION-BASKET SETTLEMENT LOCK
  // Stream Direct settles against the core group only.
  // Neighbor Expansion / Edge Expansion / Hybrid Coverage settle against the exact expanded execution basket.
  // This prevents Neighbor Expansion hits, such as BHE + 7, from being recorded as losses/pushes.
  const executionBasket = active ? activeBasket : [];
  const coreHit = active && lockedForecastGroup ? streamNumbers.includes(outcome) : false;
  const overlayHit = active && lockedForecastGroup && overlayAllowed ? executionBasket.includes(outcome) && !coreHit : false;
  const combinedHit = active && lockedForecastGroup ? executionBasket.includes(outcome) : false;
  const coreResult: Result = active && lockedForecastGroup ? (coreHit ? "win" : "loss") : "push";
  const overlayResult: Result = active && lockedForecastGroup && overlayAllowed && activeOverlayNeighbors.length ? (overlayHit ? "win" : "loss") : "push";
  let result: Result = "push";
  let net = 0;

  if (active && f.group) {
    if (combinedHit) {
      result = "win";
      net = 35 * unit - (activeBasket.length - 1) * unit;
    } else {
      result = "loss";
      net = -exposure;
    }
  }

  return {
    spin: history.length + 1,
    outcome,
    outcomeGroup: lockedOutcomeGroup,
    predictedGroup: lockedForecastGroup,
    predictedNumbers: numbers,
    forecastGroup: f.group,
    forecastNumbers: f.group ? GROUPS[f.group] : [],
    confidence: f.confidence,
    tier: f.tier,
    result,
    unitBet: unit,
    exposure,
    net,
    bankroll: bankroll + net,
    note: active
      ? `${f.source} shadow ${f.group} · ${f.source === "PULSE" && (f as any).dimensionTDA?.compressed ? "2D Compression · " : ""}${executionMode}${overlayHit ? " · Wheel Overlay Hit" : ""}`
      : !dimensionTDAAllowed
      ? `TDA · No Bet · ${((f as any).dimensionTDA?.failed ?? []).join("/") || "Axis"} below ${((f as any).dimensionTDA?.min ?? DEFAULT_DIMENSION_GATE_MIN)}%`
      : getTierExecutionNote(f.tier, f.group, f.group ? GROUPS[f.group] : []),
    executionMode,
    coreResult,
    overlayResult,
    wheelNeighbors: executionMode === "Stream Direct" ? [] : activeOverlayNeighbors,
    wheelAlignment: getWheelAlignment(f.group, executionMode, f.source),
    streamConflict: hasStreamConflict(f.group, executionMode, f.source),
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

function settleSpinNeuralShadow(history: Step[], outcome: SpinValue, baseUnit: number, startingBankroll: number, strategy: Strategy, executionMode: ExecutionMode = "Stream Direct", tableLimit = DEFAULT_TABLE_LIMIT, perNumberLimit = DEFAULT_PER_NUMBER_LIMIT, tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION): Step {
  const f = getNeuralShadowDecision(history);
  const bankroll = history.at(-1)?.bankroll ?? startingBankroll;
  const executionAllowed = shouldExecuteTier(f.tier, f.source, tierExecution, (f as any).rv, (f as any).entropyExtreme);
  const dimensionTDAAllowed = true; // TDA diagnostic only, not a hard gate.
  const active = shouldBet(strategy, f.confidence, true, f.group) && executionAllowed ;
  const previewNumbers = active && f.group ? getExecutionNumbers(f.group, executionMode, f.source, f) : [];
  const streamNumbers = active && f.group ? getCoreExecutionNumbers(f.group, f.source, f, executionMode) : [];
  const wheelNeighbors = active && f.group ? getWheelNeighbors(f.group, f.source) : [];
  const numbers = previewNumbers;
  const activeBasket = executionMode === "Stream Direct" ? streamNumbers : numbers;
  const unit = active ? getUnitBet(strategy, baseUnit, f.confidence, history, activeBasket.length, bankroll, tableLimit, perNumberLimit) : 0;
  const exposure = activeBasket.length * unit;

  // FINAL FORECAST / SETTLEMENT LOCK
  // The active forecast group is captured once before settlement.
  // Core settlement compares the outcome's group to that exact forecast group.
  // Overlay settlement remains separate and only applies to wheel-neighbor coverage.
  const lockedForecastGroup = active ? f.group : null;
  const lockedOutcomeGroup = numberToGroup(outcome);

  const neighborExpansionNumbers = active && lockedForecastGroup
    ? getNeighborExpansionNumbers(lockedForecastGroup, f.source)
    : [];
  const edgeExpansionNumbers = active && lockedForecastGroup
    ? getEdgeExpansionNumbers(lockedForecastGroup)
    : [];

  const overlayAllowed = executionMode !== "Stream Direct";

  const activeOverlayNeighbors =
    executionMode === "Neighbor Expansion"
      ? neighborExpansionNumbers
      : executionMode === "Edge Expansion"
      ? edgeExpansionNumbers
      : executionMode === "Hybrid Coverage"
      ? uniqueNumbers([...neighborExpansionNumbers, ...edgeExpansionNumbers])
      : [];

  // EXECUTION-BASKET SETTLEMENT LOCK
  // Stream Direct settles against the core group only.
  // Neighbor Expansion / Edge Expansion / Hybrid Coverage settle against the exact expanded execution basket.
  // This prevents Neighbor Expansion hits, such as BHE + 7, from being recorded as losses/pushes.
  const executionBasket = active ? activeBasket : [];
  const coreHit = active && lockedForecastGroup ? streamNumbers.includes(outcome) : false;
  const overlayHit = active && lockedForecastGroup && overlayAllowed ? executionBasket.includes(outcome) && !coreHit : false;
  const combinedHit = active && lockedForecastGroup ? executionBasket.includes(outcome) : false;
  const coreResult: Result = active && lockedForecastGroup ? (coreHit ? "win" : "loss") : "push";
  const overlayResult: Result = active && lockedForecastGroup && overlayAllowed && activeOverlayNeighbors.length ? (overlayHit ? "win" : "loss") : "push";
  let result: Result = "push";
  let net = 0;

  if (active && f.group) {
    if (combinedHit) {
      result = "win";
      net = 35 * unit - (activeBasket.length - 1) * unit;
    } else {
      result = "loss";
      net = -exposure;
    }
  }

  return {
    spin: history.length + 1,
    outcome,
    outcomeGroup: lockedOutcomeGroup,
    predictedGroup: lockedForecastGroup,
    predictedNumbers: numbers,
    forecastGroup: f.group,
    forecastNumbers: f.group ? GROUPS[f.group] : [],
    confidence: f.confidence,
    tier: f.tier,
    result,
    unitBet: unit,
    exposure,
    net,
    bankroll: bankroll + net,
    note: active ? `NEURAL SHADOW ${f.group} · ${f.confidence}% · ${executionMode}${overlayHit ? " · Wheel Overlay Hit" : ""}` : getTierExecutionNote(f.tier, f.group, f.group ? GROUPS[f.group] : []),
    executionMode,
    coreResult,
    overlayResult,
    wheelNeighbors: executionMode === "Stream Direct" ? [] : activeOverlayNeighbors,
    wheelAlignment: getWheelAlignment(f.group, executionMode, f.source),
    streamConflict: hasStreamConflict(f.group, executionMode, f.source),
  };
}

function runNeuralShadowStrategy(outcomes: SpinValue[], strategy: Strategy, baseUnit: number, startingBankroll: number, executionMode: ExecutionMode = "Stream Direct", tableLimit = DEFAULT_TABLE_LIMIT, perNumberLimit = DEFAULT_PER_NUMBER_LIMIT, tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION) {
  const rows: Step[] = [];
  outcomes.forEach((o) => rows.push(settleSpinNeuralShadow(rows, o, baseUnit, startingBankroll, strategy, executionMode, tableLimit, perNumberLimit, tierExecution)));
  return rows;
}

function runShadowStrategy(outcomes: SpinValue[], strategy: Strategy, baseUnit: number, startingBankroll: number, engine: "PULSE" | "BB_STRAIGHT" | "BB_INVERTED", executionMode: ExecutionMode = "Stream Direct", tableLimit = DEFAULT_TABLE_LIMIT, perNumberLimit = DEFAULT_PER_NUMBER_LIMIT, tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION) {
  const rows: Step[] = [];
  outcomes.forEach((o) => rows.push(settleSpinShadow(rows, o, baseUnit, startingBankroll, strategy, engine, executionMode, tableLimit, perNumberLimit, tierExecution)));
  return rows;
}

function runStrategy(outcomes: SpinValue[], strategy: Strategy, baseUnit: number, startingBankroll: number, pulseEnabled: boolean, bbStraightEnabled: boolean, bbInvertedEnabled: boolean, executionMode: ExecutionMode = "Stream Direct", tableLimit = DEFAULT_TABLE_LIMIT, perNumberLimit = DEFAULT_PER_NUMBER_LIMIT, tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION, markovEnabled = false) {
  const rows: Step[] = [];
  outcomes.forEach((o) => rows.push(settleSpin(rows, o, baseUnit, startingBankroll, strategy, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, tierExecution, markovEnabled)));
  return rows;
}


function runComboShadowStrategy(
  outcomes: SpinValue[],
  strategy: Strategy,
  baseUnit: number,
  startingBankroll: number,
  combo: "PULSE_STRAIGHT" | "PULSE_INVERTED",
  executionMode: ExecutionMode = "Stream Direct",
  tableLimit = DEFAULT_TABLE_LIMIT,
  perNumberLimit = DEFAULT_PER_NUMBER_LIMIT,
  tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION
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
        true,
        combo === "PULSE_INVERTED",
        executionMode,
        tableLimit,
        perNumberLimit,
        tierExecution
      )
    );
  });
  return rows;
}

function runComparisonStrategyReplay(outcomes: SpinValue[], comparisonStrategy: Strategy, baseUnit: number, startingBankroll: number, pulseEnabled: boolean, bbStraightEnabled: boolean, bbInvertedEnabled: boolean, executionMode: ExecutionMode = "Stream Direct", tableLimit = DEFAULT_TABLE_LIMIT, perNumberLimit = DEFAULT_PER_NUMBER_LIMIT, tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION, markovEnabled = false) {
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
        markovEnabled
      )
    );
  });
  return replayRows;
}

function randomSpin(): SpinValue {
  return ALL_NUMBERS[Math.floor(Math.random() * ALL_NUMBERS.length)];
}

export default function Page() {
  const [history, setHistory] = useState<Step[]>([]);
  const [startingBankroll, setStartingBankroll] = useState(DEFAULT_STARTING_BANKROLL);
  const [baseUnit, setBaseUnit] = useState(DEFAULT_BASE_UNIT);
  const [tableLimit, setTableLimit] = useState(DEFAULT_TABLE_LIMIT);
  const [perNumberLimit, setPerNumberLimit] = useState(DEFAULT_PER_NUMBER_LIMIT);
  const [autoSpins, setAutoSpins] = useState(DEFAULT_AUTO_SPINS);
  const [strategy, setStrategy] = useState<Strategy>(DEFAULT_STRATEGY);
  const [pulseEnabled, setPulseEnabled] = useState(true);
  const [bbMode, setBbMode] = useState<BBMode>("BB Straight");
  const [bbStraightEnabled, setBbStraightEnabled] = useState(false);
  const [bbInvertedEnabled, setBbInvertedEnabled] = useState(false);
  const [markovEnabled, setMarkovEnabled] = useState(false);
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
  const f = useMemo(() => getActiveDecision(history, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, markovEnabled), [history, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, markovEnabled]);
  const wheelNeighbors = useMemo(() => getWheelNeighbors(f.group, f.source, executionMode), [f.group, f.source, executionMode]);
  const executionNumbers = useMemo(() => getExecutionNumbers(f.group, executionMode, f.source, f), [f.group, executionMode, f.source]);
  const wheelAlignment = useMemo(() => getWheelAlignment(f.group, executionMode, f.source), [f.group, executionMode, f.source]);
  const streamConflict = useMemo(() => hasStreamConflict(f.group, executionMode, f.source), [f.group, executionMode, f.source]);
  const bankroll = history.at(-1)?.bankroll ?? startingBankroll;
  const net = bankroll - startingBankroll;
  const wins = history.filter((h) => h.result === "win").length;
  const losses = history.filter((h) => h.result === "loss").length;
  const pushes = history.filter((h) => h.result === "push").length;
  const resolved = wins + losses;
  const winRate = resolved ? `${((wins / resolved) * 100).toFixed(1)}%` : "0.0%";
  const roi = history.length ? `${((net / startingBankroll) * 100).toFixed(1)}%` : "0.0%";
  const lossStreak = getLossStreak(history);
  const recoveryState = lossStreak >= 7 ? "recovery" : lossStreak >= 4 ? "watch" : "off";
  const dpiValue = getDpiValue(history);
  const dpiZone = dpiValue <= -7 ? "Transition" : dpiValue <= -3 ? "Pressure" : "Neutral";
  const recent = [...history].reverse().slice(0, 24);
  const rawOutcomes = useMemo(() => history.map((h) => h.outcome), [history]);
  const isPulseOnlyMode = pulseEnabled && !bbStraightEnabled && !bbInvertedEnabled;
  const streakStats = useMemo(() => getStreakStats(history), [history]);
  const peakBankroll = history.reduce((peak, row) => Math.max(peak, row.bankroll), startingBankroll);
  const activeDrawdown = Math.max(0, peakBankroll - bankroll);
  const activeDrawdownPct = peakBankroll ? (activeDrawdown / peakBankroll) * 100 : 0;
  const lossStreakSeverity = getLossStreakSeverity(streakStats.currentLossStreak);

  const chartData = [{ spin: 0, bankroll: startingBankroll }, ...history.map((h) => ({ spin: h.spin, bankroll: h.bankroll }))];
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
      setAutoSpins(Number(saved.autoSpins) || DEFAULT_AUTO_SPINS);
      if (saved.strategy && STRATEGIES.includes(saved.strategy)) setStrategy(saved.strategy);
      if (typeof saved.pulseEnabled === "boolean") setPulseEnabled(saved.pulseEnabled);
      if (typeof saved.bbStraightEnabled === "boolean") setBbStraightEnabled(saved.bbStraightEnabled);
      if (typeof saved.bbInvertedEnabled === "boolean") setBbInvertedEnabled(saved.bbInvertedEnabled);
      if (typeof saved.markovEnabled === "boolean") setMarkovEnabled(saved.markovEnabled);
      if (saved.executionMode && EXECUTION_MODES.includes(saved.executionMode)) setExecutionMode(saved.executionMode);
      if (typeof saved.executeWeak === "boolean") setExecuteWeak(saved.executeWeak);
      if (typeof saved.executeObservation === "boolean") setExecuteObservation(saved.executeObservation);
      if (saved.appearance === "light" || saved.appearance === "dark") setAppearance(saved.appearance);
    } catch {
      localStorage.removeItem(CONTROL_SETTINGS_KEY);
    }
  }, []);

  const addSpin = (value: SpinValue) => setHistory((h) => [...h, settleSpin(h, value, baseUnit, startingBankroll, strategy, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, tierExecution, markovEnabled)]);
  const rebuild = (start = startingBankroll, unit = baseUnit, nextStrategy = strategy, nextPulse = pulseEnabled) => {
    setHistory(runStrategy(history.map((h) => h.outcome), nextStrategy, unit, start, nextPulse, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, tierExecution, markovEnabled));
  };

  const applyPulseMode = () => {
    const nextPulse = !pulseEnabled;
    setPulseEnabled(nextPulse);

    const outcomes = history.map((h) => h.outcome);
    if (outcomes.length) {
      setHistory(
        runStrategy(
          outcomes,
          strategy,
          baseUnit,
          startingBankroll,
          nextPulse,
          bbStraightEnabled,
          bbInvertedEnabled,
          executionMode,
          tableLimit,
          perNumberLimit,
          tierExecution,
          markovEnabled
        )
      );
    }
  };


  const applyBBMode = (nextStraight: boolean, nextInverted: boolean) => {
    setBbStraightEnabled(nextStraight);
    setBbInvertedEnabled(nextInverted);
    setMarkovEnabled(false);

    const outcomes = history.map((h) => h.outcome);
    if (outcomes.length) {
      setHistory(runStrategy(outcomes, strategy, baseUnit, startingBankroll, pulseEnabled, nextStraight, nextInverted, executionMode, tableLimit, perNumberLimit, tierExecution, false));
    }
  };

  const applyMarkovMode = () => {
    setBbStraightEnabled(false);
    setBbInvertedEnabled(false);
    setMarkovEnabled(true);

    const outcomes = history.map((h) => h.outcome);
    if (outcomes.length) {
      setHistory(runStrategy(outcomes, strategy, baseUnit, startingBankroll, pulseEnabled, false, false, executionMode, tableLimit, perNumberLimit, tierExecution, true));
    }
  };
  const applyExecutionMode = (nextMode: ExecutionMode) => {
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
          markovEnabled
        )
      );
    }
  };

  const runAuto = () => {
    setAutoRunning(true);
    window.setTimeout(() => {
      const rows: Step[] = [];
      for (let i = 0; i < autoSpins; i += 1) {
        rows.push(settleSpin(rows, randomSpin(), baseUnit, startingBankroll, strategy, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, tierExecution, markovEnabled));
      }
      setHistory(rows);
      setAutoRunning(false);
    }, 0);
  };
  const reset = () => {
    setHistory([]);
    setStartingBankroll(DEFAULT_STARTING_BANKROLL);
    setBaseUnit(DEFAULT_BASE_UNIT);
    setTableLimit(DEFAULT_TABLE_LIMIT);
    setPerNumberLimit(DEFAULT_PER_NUMBER_LIMIT);
    setAutoSpins(DEFAULT_AUTO_SPINS);
    setStrategy(DEFAULT_STRATEGY);
    setPulseEnabled(true);
    setBbStraightEnabled(false);
    setBbMode("BB Off");
    setBbInvertedEnabled(false);
    setMarkovEnabled(false);
    setExecutionMode("Stream Direct");
    setExecuteWeak(DEFAULT_EXECUTE_WEAK);
    setExecuteObservation(DEFAULT_EXECUTE_OBSERVATION);
  };

  const saveSession = () => {
    const name = sessionName.trim();
    if (!name) return;
    const next: SavedSession = { name, createdAt: new Date().toISOString(), startingBankroll, baseUnit, tableLimit, perNumberLimit, autoSpins, strategy, pulseEnabled, bbMode, bbStraightEnabled, bbInvertedEnabled, executeWeak, executeObservation, executionMode, history };
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
    setAutoSpins(s.autoSpins);
    setStrategy(s.strategy);
    setPulseEnabled(s.pulseEnabled);
    setBbStraightEnabled(s.bbStraightEnabled ?? false);
    setBbInvertedEnabled(s.bbInvertedEnabled ?? false);
    setExecuteWeak(s.executeWeak ?? DEFAULT_EXECUTE_WEAK);
    setExecuteObservation(s.executeObservation ?? DEFAULT_EXECUTE_OBSERVATION);
    setBbMode(s.bbMode);
    setExecutionMode(s.executionMode ?? "Stream Direct");
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
    sessions.forEach((s) => s.history.forEach((h) => rows.push(settleSpin(rows, h.outcome, baseUnit, startingBankroll, strategy, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, tierExecution, markovEnabled))));
    setHistory(rows);
  };

  const saveControlSettings = () => {
    const saved: SavedControlSettings = {
      startingBankroll,
      baseUnit,
      tableLimit,
      perNumberLimit,
      autoSpins,
      strategy,
      pulseEnabled,
      bbStraightEnabled,
      bbInvertedEnabled,
      markovEnabled,
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
    ["Spin", "Outcome", "Group", "Forecast", "Executed Prediction", "ExecutionMode", "Numbers", "WheelNeighbors", "WheelAlignment", "StreamConflict", "CoreResult", "OverlayResult", "CombinedResult", "Confidence", "Tier", "Unit", "Exposure", "Net", "Bankroll", "Note"],
    ...history.map((h) => [h.spin, String(h.outcome), h.outcomeGroup, h.forecastGroup ?? "", h.predictedGroup ?? "", h.executionMode, h.predictedNumbers.join(" "), h.wheelNeighbors.join(" "), h.wheelAlignment, h.streamConflict ? "YES" : "NO", h.coreResult, h.overlayResult, h.result, h.confidence, h.tier, h.unitBet, h.exposure, h.net, h.bankroll, h.note]),
  ];
  const downloadCSV = () => {
    const csv = rowsForExport().map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join(String.fromCharCode(10));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "edgelab_pulse_roulette_session.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const comparison = useMemo(() => {
    return STRATEGIES.map((comparisonStrategy) => {
      const rows = runComparisonStrategyReplay(
        rawOutcomes,
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
        markovEnabled
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
  }, [rawOutcomes, baseUnit, startingBankroll, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, tierExecution, markovEnabled]);


  const pulseShadowRows = useMemo(
    () => runShadowStrategy(rawOutcomes, strategy, baseUnit, startingBankroll, "PULSE", executionMode, tableLimit, perNumberLimit, tierExecution),
    [rawOutcomes, strategy, baseUnit, startingBankroll, executionMode, tableLimit, perNumberLimit, tierExecution]
  );
  const straightShadowRows = useMemo(
    () => runShadowStrategy(rawOutcomes, strategy, baseUnit, startingBankroll, "BB_STRAIGHT", executionMode, tableLimit, perNumberLimit, tierExecution),
    [rawOutcomes, strategy, baseUnit, startingBankroll, executionMode, tableLimit, perNumberLimit, tierExecution]
  );
  const invertedShadowRows = useMemo(
    () => runShadowStrategy(rawOutcomes, strategy, baseUnit, startingBankroll, "BB_INVERTED", executionMode, tableLimit, perNumberLimit, tierExecution),
    [rawOutcomes, strategy, baseUnit, startingBankroll, executionMode, tableLimit, perNumberLimit, tierExecution]
  );

  const pulseStraightShadowRows = useMemo(
    () => runComboShadowStrategy(rawOutcomes, strategy, baseUnit, startingBankroll, "PULSE_STRAIGHT", executionMode, tableLimit, perNumberLimit, tierExecution),
    [rawOutcomes, strategy, baseUnit, startingBankroll, executionMode, tableLimit, perNumberLimit, tierExecution]
  );
  const markovShadowRows = useMemo(
    () => runShadowStrategy(rawOutcomes, strategy, baseUnit, startingBankroll, "MARKOV", executionMode, tableLimit, perNumberLimit, tierExecution),
    [rawOutcomes, strategy, baseUnit, startingBankroll, executionMode, tableLimit, perNumberLimit, tierExecution]
  );

  const pulseMarkovShadowRows = useMemo(
    () => runComboShadowStrategy(rawOutcomes, strategy, baseUnit, startingBankroll, "PULSE_MARKOV", executionMode, tableLimit, perNumberLimit, tierExecution),
    [rawOutcomes, strategy, baseUnit, startingBankroll, executionMode, tableLimit, perNumberLimit, tierExecution]
  );

  const pulseInvertedShadowRows = useMemo(
    () => runComboShadowStrategy(rawOutcomes, strategy, baseUnit, startingBankroll, "PULSE_INVERTED", executionMode, tableLimit, perNumberLimit, tierExecution),
    [rawOutcomes, strategy, baseUnit, startingBankroll, executionMode, tableLimit, perNumberLimit, tierExecution]
  );

  const Panel = ({ title, children, style = {} }: any) => (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 16, padding: 12, boxShadow: t.shadow, color: t.text, ...style }}>
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
      <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 16, padding: 12, boxShadow: t.shadow, color: t.text, ...style, ...collapsedStyle }}>
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
    const isObservationForecast = f.tier === "Directional Observe" || dimensionTDABlocked;
    const displayPrediction = isObservationForecast ? "OBSERVE" : (f.group ?? "OBSERVE");
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
    const displayedTierLabel = dimensionTDABlocked ? "TDA HOLD" : f.tier;
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
    const statusReason = isObservationForecast
      ? dimensionTDABlocked
        ? "TDA Hold · No Bet"
        : "No Bet"
      : f.group
      ? `Numbers: ${f.numbers.join(", ")}`
      : "Awaiting signal.";
    return <Panel title="Signal State" style={{ minHeight: 344 }}>
      <button onClick={applyPulseMode} style={{ width: "100%", height: 34, borderRadius: 10, border: `1px solid ${pulseEnabled ? COLORS.cyan : COLORS.red}`, background: pulseEnabled ? "rgba(34,199,243,0.16)" : "rgba(239,68,68,0.10)", color: pulseEnabled ? COLORS.cyan : COLORS.red, fontWeight: 950, cursor: "pointer", marginBottom: 8 }}>{pulseEnabled ? "PULSE ON" : "PULSE OFF"}</button>
      <div style={{ fontSize: 10, color: t.subtext, fontWeight: 950, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>Play Mode</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
        <button onClick={() => applyBBMode(false, false)} style={{ height: 34, borderRadius: 10, border: `1px solid ${!bbStraightEnabled && !bbInvertedEnabled && !markovEnabled ? COLORS.red : t.borderStrong}`, background: !bbStraightEnabled && !bbInvertedEnabled && !markovEnabled ? "rgba(239,68,68,0.10)" : t.input, color: !bbStraightEnabled && !bbInvertedEnabled && !markovEnabled ? COLORS.red : t.subtext, fontWeight: 950, cursor: "pointer", whiteSpace: "nowrap", fontSize: 12 }}>OFF</button>
        <button onClick={() => applyBBMode(true, false)} style={{ height: 34, borderRadius: 10, border: `1px solid ${bbStraightEnabled && !bbInvertedEnabled && !markovEnabled ? COLORS.blue : t.borderStrong}`, background: bbStraightEnabled && !bbInvertedEnabled && !markovEnabled ? "rgba(37,99,235,0.14)" : t.input, color: bbStraightEnabled && !bbInvertedEnabled && !markovEnabled ? COLORS.blue : t.subtext, fontWeight: 950, cursor: "pointer", whiteSpace: "nowrap", fontSize: 11 }}>STRAIGHT</button>
        <button onClick={() => applyBBMode(true, true)} style={{ height: 34, borderRadius: 10, border: `1px solid ${bbStraightEnabled && bbInvertedEnabled && !markovEnabled ? COLORS.amber : t.borderStrong}`, background: bbStraightEnabled && bbInvertedEnabled && !markovEnabled ? "rgba(245,158,11,0.12)" : t.input, color: bbStraightEnabled && bbInvertedEnabled && !markovEnabled ? COLORS.amber : t.subtext, fontWeight: 950, cursor: "pointer", whiteSpace: "nowrap", fontSize: 11 }}>INVERTED</button>
        <button onClick={applyMarkovMode} style={{ height: 34, borderRadius: 10, border: `1px solid ${markovEnabled ? COLORS.green : t.borderStrong}`, background: markovEnabled ? "rgba(34,197,94,0.13)" : t.input, color: markovEnabled ? COLORS.green : t.subtext, fontWeight: 950, cursor: "pointer", whiteSpace: "nowrap", fontSize: 11 }}>MARKOV</button>
      </div>
      <div style={{ textAlign: "center", padding: "10px 0" }}>
        <div style={{ fontSize: 11, color: t.subtext, fontWeight: 950 }}>FINAL PREDICTION</div>
        <div style={{ fontSize: 50, fontWeight: 950, color: f.group && !isObservationForecast ? COLORS.cyan : t.subtext, lineHeight: 1, marginTop: 8 }}>{displayPrediction}</div>
        <div style={{ fontSize: 13, color: executionColor, fontWeight: 900, marginTop: 10 }}>{statusReason}</div>
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
        <div style={{ textAlign: "center", marginTop: 10, color: t.subtext, fontSize: 12, fontWeight: 800 }}>{pulseEnabled ? (dimensionTDABlocked ? `TDA HOLD · Forecast Tier: ${forecastTierLabel}` : f.tier) : "Pulse Disabled"}</div>
      </div>
    </Panel>;
  };
  const CompactMetrics = () => <CollapsiblePanel id="compactMetrics" title="Compact Metrics"><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><MiniMetric label="Bankroll" value={bankroll.toLocaleString()} accent={net >= 0 ? COLORS.green : COLORS.red} /><MiniMetric label="Net" value={net.toLocaleString()} accent={net >= 0 ? COLORS.green : COLORS.red} /><MiniMetric label="Win Rate" value={winRate} /><MiniMetric label="ROI" value={roi} /><MiniMetric label="DPI Zone" value={dpiZone} accent={dpiZone === "Transition" ? COLORS.red : dpiZone === "Pressure" ? COLORS.amber : COLORS.green} /><MiniMetric label="Recovery" value={recoveryState} accent={recoveryState === "recovery" ? COLORS.red : recoveryState === "watch" ? COLORS.amber : COLORS.green} /></div></CollapsiblePanel>;
  const AxisDirectionalAccuracyPanel = () => {
    return null;
  };

  const BankrollChart = () => {
    const streakBands = streakStats.segments.filter((segment) => segment.length >= 2);
    const buildStreakAudit = (band: { type: "win" | "loss"; startSpin: number; endSpin: number; length: number }) => {
      const rows = history.filter((row) => row.spin >= band.startSpin && row.spin <= band.endSpin);
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
      const tdaHolds = rows.filter((row) => row.note.includes("TDA") || !row.predictedGroup).length;
      const executed = rows.filter((row) => row.predictedGroup).length;
      const coreMisses = rows.filter((row) => row.coreResult === "loss").length;
      const overlayMisses = rows.filter((row) => row.overlayResult === "loss").length;
      const tiers = Array.from(new Set(rows.map((row) => row.tier))).join(" / ");
      const settlementMismatchCount = rows.filter((row) => row.predictedGroup && row.predictedGroup === row.outcomeGroup && row.result !== "win").length;
      const diagnosis = settlementMismatchCount > 0
        ? `SETTLEMENT WARNING: ${settlementMismatchCount} matching forecast/outcome rows did not settle as WIN.`
        : band.type === "loss"
        ? e >= 62
          ? "Primary read: entropy/chaos expansion during loss block."
          : tdaHolds > Math.max(1, rows.length / 2)
          ? "Primary read: TDA stability/persistence failed or execution was held often."
          : avgConfidence < 55
          ? "Primary read: confidence decay / weak signal quality."
          : "Primary read: forecast basket missed despite active signal."
        : "Winning streak block. Shows what aligned during this run.";
      return {
        rows,
        title: `${band.type === "loss" ? "LOSS" : "WIN"} STREAK ANALYSIS`,
        summary: [
          `Spins: ${band.startSpin}-${band.endSpin} · Length: ${band.length}`,
          `Bankroll: ${startBankroll} → ${endBankroll} · Net: ${netChange}`,
          `Avg Confidence: ${avgConfidence.toFixed(1)}% · Entropy: ${e}%`,
          `Executed: ${executed}/${rows.length} · Diagnostic Holds: ${tdaHolds}`,
          `Core Misses: ${coreMisses} · Overlay Misses: ${overlayMisses}`,
          `Tier Path: ${tiers || "—"}`,
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
            <div style={{ color: t.subtext, fontSize: 12, fontWeight: 800, marginTop: 4 }}>Full Forecast ↔ Outcome settlement audit</div>
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
                <th style={{ padding: "8px 10px" }}>Spin</th>
                <th style={{ padding: "8px 10px" }}>Forecast</th>
                <th style={{ padding: "8px 10px" }}>Outcome</th>
                <th style={{ padding: "8px 10px" }}>Final</th>
                <th style={{ padding: "8px 10px" }}>Core</th>
                <th style={{ padding: "8px 10px" }}>Overlay</th>
                <th style={{ padding: "8px 10px" }}>Mode</th>
                <th style={{ padding: "8px 10px" }}>Tier</th>
                <th style={{ padding: "8px 10px" }}>Conf</th>
                <th style={{ padding: "8px 10px" }}>Net</th>
                <th style={{ padding: "8px 10px" }}>Note</th>
              </tr>
            </thead>
            <tbody>
              {audit.rows.map((row) => {
                const forecastLabel = row.predictedGroup ?? row.forecastGroup ?? "HOLD";
                const outcomeLabel = `${String(row.outcome)}(${row.outcomeGroup})`;
                const executionLabel = row.predictedGroup ? "EXEC" : "HOLD";
                return <tr key={`audit-${row.spin}`} style={{ borderBottom: `1px solid ${t.border}`, background: row.result === "win" ? "rgba(34,197,94,0.07)" : row.result === "loss" ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.05)" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 950 }}>{row.spin}</td>
                  <td style={{ padding: "8px 10px", color: COLORS.cyan, fontWeight: 950 }}>{forecastLabel}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 900 }}>{outcomeLabel}</td>
                  <td style={{ padding: "8px 10px", color: resultColor(row.result), fontWeight: 950 }}>{row.result.toUpperCase()}</td>
                  <td style={{ padding: "8px 10px", color: resultColor(row.coreResult), fontWeight: 900 }}>{row.coreResult.toUpperCase()}</td>
                  <td style={{ padding: "8px 10px", color: resultColor(row.overlayResult), fontWeight: 900 }}>{row.overlayResult.toUpperCase()}</td>
                  <td style={{ padding: "8px 10px", color: executionLabel === "EXEC" ? COLORS.blue : t.subtext, fontWeight: 950 }}>{executionLabel}</td>
                  <td style={{ padding: "8px 10px" }}>{row.tier}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 900 }}>{row.confidence}%</td>
                  <td style={{ padding: "8px 10px", color: row.net > 0 ? COLORS.green : row.net < 0 ? COLORS.red : t.subtext, fontWeight: 900 }}>{row.net}</td>
                  <td style={{ padding: "8px 10px", color: t.subtext, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis" }}>{row.note}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "12px 18px", borderTop: `1px solid ${t.border}`, color: audit.diagnosis.includes("WARNING") ? COLORS.red : t.subtext, fontSize: 12, fontWeight: 900, lineHeight: 1.45 }}>
          {audit.diagnosis}
        </div>
      </div>
    </div>;
  };


    return <><StreakAuditModal /><CollapsiblePanel id="bankrollChart" title="Live Bankroll Chart" style={{ minHeight: "unset", overflow: "hidden" }}><div style={{ width: "100%", overflow: "hidden" }}><svg viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "auto", maxHeight: 360, display: "block", background: t.panel2, borderRadius: 12 }}>
      {streakBands.map((band, index) => {
        const x1 = x(Math.max(0, band.startSpin - 1));
        const x2 = x(Math.max(band.startSpin, band.endSpin));
        const fill = band.type === "win" ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.11)";
        const stroke = band.type === "win" ? "rgba(34,197,94,0.22)" : "rgba(239,68,68,0.24)";
        return <g key={`${band.type}-${band.startSpin}-${band.endSpin}-${index}`} style={{ cursor: "pointer" }} onClick={() => setSelectedStreakBand(band)}><rect x={x1} y={pt} width={Math.max(3, x2 - x1)} height={chartH - pt - pb} fill={fill} stroke={stroke} strokeWidth="1" /><text x={x1 + 5} y={pt + 14} fill={band.type === "win" ? COLORS.green : COLORS.red} fontSize="10" fontWeight="900">{band.type === "win" ? "W" : "L"}{band.length}</text></g>;
      })}
      {chartTicks.map((tick) => { const yy = y(tick); return <g key={tick}><line x1={pl} x2={chartW - pr} y1={yy} y2={yy} stroke={t.border} /><text x={pl - 10} y={yy + 4} textAnchor="end" fill={t.subtext} fontSize="12" fontWeight="900">{tick.toLocaleString()}</text></g>; })}<line x1={pl} x2={chartW - pr} y1={y(startingBankroll)} y2={y(startingBankroll)} stroke="rgba(250,204,21,0.72)" strokeDasharray="4 4" /><text x={chartW - pr - 130} y={y(startingBankroll) - 6} fill={COLORS.yellow} fontSize="12" fontWeight="800">Start {startingBankroll}</text><polyline points={chartPoints} fill="none" stroke={COLORS.cyan} strokeWidth="3" />{chartData.length > 1 ? <circle cx={x(maxSpin)} cy={y(chartData.at(-1)!.bankroll)} r="5" fill={COLORS.cyan} /> : null}<g transform={`translate(${pl},${chartH - 16})`}><rect x="0" y="-10" width="10" height="10" fill="rgba(34,197,94,0.18)" stroke="rgba(34,197,94,0.32)" /><text x="16" y="0" fill={t.subtext} fontSize="10" fontWeight="900">Win streak zone</text><rect x="126" y="-10" width="10" height="10" fill="rgba(239,68,68,0.18)" stroke="rgba(239,68,68,0.32)" /><text x="142" y="0" fill={t.subtext} fontSize="10" fontWeight="900">Loss streak zone</text></g></svg></div></CollapsiblePanel></>;
  };
  const RouletteTable = () => <Panel title="Manual Spin Input"><div style={{ display: "grid", gridTemplateColumns: "68px 1fr", gap: 8, background: "#064e3b", borderRadius: 14, padding: 10 }}><div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 6 }}>{["00" as SpinValue, 0].map(n => <button key={String(n)} onClick={() => addSpin(n)} style={rouletteButtonStyle(n)}>{String(n)}</button>)}</div><div style={{ display: "grid", gridTemplateRows: "repeat(3, 1fr)", gap: 6 }}>{ROULETTE_GRID.map((row, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 6 }}>{row.map(n => <button key={String(n)} onClick={() => addSpin(n)} style={rouletteButtonStyle(n)}>{String(n)}</button>)}</div>)}</div></div></Panel>;
  const RecentLog = () => <CollapsiblePanel id="sessionLog" title="Session Log" style={{ minHeight: 408 }}><div style={{ maxHeight: 356, overflowY: "auto", display: "grid", gap: 8 }}>{recent.length === 0 ? <div style={{ color: t.subtext, fontSize: 13 }}>No spins yet.</div> : recent.map(s => <div key={s.spin} style={{ border: `1px solid ${t.border}`, borderRadius: 12, padding: 9, background: t.panel2 }}><div style={{ display: "flex", justifyContent: "space-between", fontWeight: 950, fontSize: 12 }}><span>Spin {s.spin}: {String(s.outcome)} · {s.outcomeGroup}</span><span style={{ color: s.result === "win" ? COLORS.green : s.result === "loss" ? COLORS.red : t.subtext }}>{s.result.toUpperCase()}</span></div><div style={{ fontSize: 12, color: t.subtext, marginTop: 6 }}>Forecast: <b style={{ color: t.text }}>{s.forecastGroup ?? s.predictedGroup ?? "No Forecast"}</b> · Executed: <b style={{ color: t.text }}>{s.predictedGroup ?? "No Bet"}</b> · {s.executionMode} · Conf: <b style={{ color: t.text }}>{Math.round(s.confidence)}%</b><br />Core {s.coreResult.toUpperCase()} · Overlay {s.overlayResult.toUpperCase()} · Combined {s.result.toUpperCase()}<br />Unit {s.unitBet} · Exposure {s.exposure} · Net {s.net}<br />Bankroll {s.bankroll}</div></div>)}</div></CollapsiblePanel>;
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
  const StreamsPanel = () => {
    const liveDecision = f as any;
    const lastRow = history.at(-1) as any;

    const liveGate = liveDecision?.pulseGate;
    const lastGate = lastRow?.pulseGate;
    const gate = liveGate ?? lastGate ?? {};

    const liveDiagnostics = liveDecision?.pulseDiagnostics;
    const lastDiagnostics = lastRow?.pulseDiagnostics;
    const diagnostics = liveDiagnostics ?? lastDiagnostics ?? {};

    const axisRows =
      typeof getAxisDirectionalDiagnostics === "function"
        ? getAxisDirectionalDiagnostics(history)
        : [];

    const correction = diagnostics?.correction ?? {};
    const structural = diagnostics?.structural ?? {};

    const resyncValue =
      gate.resyncStatus ??
      structural?.status ??
      "Waiting";

    const driftValue =
      gate.driftStatus ??
      structural?.drift?.status ??
      "Waiting";

    const correctionValue =
      gate.correctionMode ??
      axisRows.find((a: any) => a.accuracy < 48)
        ? `${axisRows.find((a: any) => a.accuracy < 48)?.axis ?? "Axis"} Flip`
        : correction?.mode ?? "None";

    const chaosHoldValue =
      correction?.mode === "Chaos Hold"
        ? `${correction.correctedAxis ?? "Axis"} Hold`
        : "Clear";

    const saturationValue =
      axisRows.filter((a: any) => a.accuracy < 48).length >= 1
        ? "Dimension Saturation"
        : gate.familyStatus ??
          structural?.family?.status ??
          "Clear";

    const compressionValue =
      axisRows.filter((a: any) => a.accuracy < 46).length >= 2
        ? "Compressed Drift"
        : gate.compressionStatus ??
          structural?.compression?.status ??
          "Diverse";

    return (
      <CollapsiblePanel id="pulseDiagnostics" title="PULSE Diagnostics">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8 }}>
          <MiniMetric
            label="Re-Sync"
            value={resyncValue}
            accent={String(resyncValue).includes("Aligned") || String(resyncValue).includes("Converging") ? COLORS.green : String(resyncValue).includes("Conflict") || String(resyncValue).includes("Breaking") ? COLORS.red : COLORS.amber}
          />
          <MiniMetric
            label="Drift Velocity"
            value={driftValue}
            accent={String(driftValue).includes("Improving") || String(driftValue).includes("Recover") ? COLORS.green : String(driftValue).includes("Breaking") ? COLORS.red : COLORS.amber}
          />
          <MiniMetric
            label="Axis Correction"
            value={correctionValue}
            accent={correctionValue && correctionValue !== "None" ? COLORS.cyan : t.subtext}
          />
          <MiniMetric
            label="Chaos Hold"
            value={chaosHoldValue}
            accent={chaosHoldValue === "Clear" ? COLORS.green : COLORS.amber}
          />
          <MiniMetric
            label="Saturation"
            value={saturationValue}
            accent={String(saturationValue).includes("Saturated") ? COLORS.red : COLORS.green}
          />
          <MiniMetric
            label="Compression"
            value={compressionValue}
            accent={String(compressionValue).includes("Compressed") ? COLORS.red : COLORS.green}
          />
        </div>
      </CollapsiblePanel>
    );
  };

  const WheelOverlayPanel = () => <CollapsiblePanel id="wheelNeighborOverlay" title="Wheel Neighbor Overlay"><div style={{ display: "grid", gap: 10 }}><div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}><MiniMetric label="Execution" value={executionMode} accent={executionMode === "Stream Direct" ? COLORS.cyan : COLORS.amber} /><MiniMetric label="Wheel Align" value={`${wheelAlignment}%`} accent={streamConflict ? COLORS.amber : COLORS.green} /><MiniMetric label="Base Forecast" value={f.group ?? "—"} /><MiniMetric label="Conflict" value={streamConflict ? "YES" : "NO"} accent={streamConflict ? COLORS.red : COLORS.green} /></div><div style={{ border: `1px solid ${t.border}`, borderRadius: 12, background: t.panel2, padding: 10 }}><div style={{ fontSize: 11, color: t.subtext, fontWeight: 900, marginBottom: 6 }}>Neighbor Rules</div><div style={{ color: t.text, fontSize: 13, lineHeight: 1.55 }}>Edge Expansion: BHE + 9 · RHE + 2 · BHO + 1 · RHO + 10 · RLE + 2 · BLO + 1<br />PULSE-only: BHE + 1/3/5/7/9 · BHO + 1/12/14/16/18 · BLE + 19/21/23/25/27 · BLO + 0/30/32/34/36 · RHE + 2/11/13/15/17 · RHO + 2/4/6/8/10 · RLE + 00/29/31/33/35 · RLO + 20/22/24/26/28</div></div><div style={{ border: `1px solid ${streamConflict ? COLORS.amber : t.border}`, borderRadius: 12, background: streamConflict ? "rgba(245,158,11,0.10)" : t.panel2, padding: 10 }}><div style={{ fontSize: 11, color: t.subtext, fontWeight: 900, marginBottom: 6 }}>Hybrid Bet Builder</div><div style={{ color: t.text, fontSize: 13, lineHeight: 1.55 }}>Stream: {f.numbers.length ? f.numbers.join(", ") : "—"}</div><div style={{ color: t.text, fontSize: 13, lineHeight: 1.55 }}>Neighbors: {wheelNeighbors.length ? wheelNeighbors.join(", ") : "—"}</div><div style={{ color: t.text, fontSize: 13, lineHeight: 1.55 }}>Execution Numbers: {executionNumbers.length ? executionNumbers.join(", ") : "—"}</div>{streamConflict ? <div style={{ color: COLORS.amber, fontSize: 12, fontWeight: 900, marginTop: 8 }}>Stream Conflict Detected: overlay numbers do not match the core forecast stream.</div> : null}</div></div></CollapsiblePanel>;

  const DimensionTDAPanel = () => {
  return null;
};

  const DpiTerminalPanel = () => {
    const axis = getDimensionDpis(history, f.group, bbInvertedEnabled);
    const axisRows = [
      { title: "COLOR", label: axis.color.label, value: axis.color.value },
      { title: "RANGE", label: axis.range.label, value: axis.range.value },
      { title: "PARITY", label: axis.parity.label, value: axis.parity.value },
    ];
    const zoneFor = (v: number) => v <= -5 ? "Transition" : v <= -2 ? "Pressure" : "Neutral";
    const accentFor = (v: number) => v <= -5 ? COLORS.red : v <= -2 ? COLORS.amber : COLORS.green;
    const barWidth = (v: number) => `${Math.min(100, Math.max(8, Math.abs(v) * 18))}%`;

    return <CollapsiblePanel id="bbDimensionDpi" title="Directional Pressure Index"><div style={{ display: "grid", gap: 10 }}>
      {axisRows.map((row) => {
        const zone = zoneFor(row.value);
        const accent = accentFor(row.value);
        return <div key={row.title} style={{ border: `1px solid ${t.border}`, background: dpiRowBg, borderRadius: 12, padding: "10px 11px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "62px 1fr 38px", gap: 9, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, color: t.subtext, fontWeight: 950, letterSpacing: 0.8, textTransform: "uppercase" }}>{row.title}</div>
              <div style={{ marginTop: 3, fontSize: 12, color: t.text, fontWeight: 900 }}>{row.label}</div>
            </div>
            <div>
              <div style={{ height: 9, borderRadius: 999, background: dpiTrackBg, overflow: "hidden", border: `1px solid ${t.border}` }}>
                <div style={{ width: barWidth(row.value), height: "100%", borderRadius: 999, background: accent, boxShadow: `0 0 12px ${accent}66` }} />
              </div>
              <div style={{ marginTop: 5, fontSize: 10, color: accent, fontWeight: 950, textTransform: "uppercase", letterSpacing: 0.5 }}>{zone}</div>
            </div>
            <div style={{ color: accent, fontSize: 22, fontWeight: 950, textAlign: "center", lineHeight: 1 }}>{row.value}</div>
          </div>
        </div>;
      })}
      <div style={{ border: `1px solid ${t.border}`, background: t.panel2, borderRadius: 12, padding: "10px 11px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 10, color: t.subtext, fontWeight: 950, letterSpacing: 0.8, textTransform: "uppercase" }}>Combined Signal</div>
        <div style={{ fontSize: 15, fontWeight: 950, color: t.text, textAlign: "center" }}>{axis.color.label} / {axis.range.label} / {axis.parity.label}</div>
      </div>
    </div></CollapsiblePanel>;
  };

  const ControlsPanel = () => <section style={{ marginBottom: 14, display: "grid", gap: 10 }}><button onClick={() => setControlsOpen(v => !v)} style={{ height: 42, borderRadius: 14, border: `1px solid ${t.border}`, background: t.panel, color: t.text, fontWeight: 950, cursor: "pointer", textAlign: "left", padding: "0 14px" }}>{controlsOpen ? "▾" : "▸"} Controls</button>{controlsOpen ? <Panel><div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr)) repeat(3, 118px)", gap: 10, alignItems: "end" }}><div><div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Starting Bankroll</div><Input type="number" value={startingBankroll} onChange={(e: any) => { const n = Number(e.target.value) || DEFAULT_STARTING_BANKROLL; setStartingBankroll(n); rebuild(n, baseUnit, strategy); }} /></div><div><div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Base Unit / Number</div><Input type="number" value={baseUnit} onChange={(e: any) => { const n = Number(e.target.value) || DEFAULT_BASE_UNIT; setBaseUnit(n); rebuild(startingBankroll, n, strategy); }} /></div><div><div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Strategy</div><Select value={strategy} onChange={(e: any) => { const s = e.target.value as Strategy; setStrategy(s); rebuild(startingBankroll, baseUnit, s); }} options={STRATEGIES} /></div><div><div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Execution Mode</div><Select value={executionMode} onChange={(e: any) => applyExecutionMode(e.target.value as ExecutionMode)} options={EXECUTION_MODES} /></div><div><div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Auto Spins</div><Input type="number" value={autoSpins} onChange={(e: any) => setAutoSpins(Number(e.target.value) || DEFAULT_AUTO_SPINS)} /></div><Button onClick={runAuto} disabled={autoRunning}>{autoRunning ? "Running..." : "Run Auto"}</Button><Button variant="secondary" onClick={() => setHistory(h => h.slice(0, -1))} disabled={!history.length}>Undo</Button><Button variant="secondary" onClick={reset}>Reset</Button></div></Panel> : null}</section>;

  const EngineStrip = () => {
    const rows = [
      { name: "PULSE", on: pulseEnabled && !bbStraightEnabled && !bbInvertedEnabled, sim: pulseShadowRows, accent: COLORS.cyan },
      { name: "PULSE + Straight BB", on: pulseEnabled && bbStraightEnabled && !bbInvertedEnabled, sim: pulseStraightShadowRows, accent: COLORS.blue },
      { name: "PULSE + Inverted BB", on: pulseEnabled && bbStraightEnabled && bbInvertedEnabled, sim: pulseInvertedShadowRows, accent: COLORS.amber },
      { name: "Straight BB", on: !pulseEnabled && bbStraightEnabled && !bbInvertedEnabled, sim: straightShadowRows, accent: COLORS.blue },
      { name: "Inverted BB", on: !pulseEnabled && bbInvertedEnabled, sim: invertedShadowRows, accent: COLORS.amber },
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
    { name: "PULSE", on: pulseEnabled && !bbStraightEnabled && !bbInvertedEnabled && !markovEnabled, sim: pulseShadowRows },
    { name: "PULSE + BB Straight", on: pulseEnabled && bbStraightEnabled && !bbInvertedEnabled, sim: pulseStraightShadowRows },
    { name: "PULSE + Inverted", on: pulseEnabled && bbInvertedEnabled, sim: pulseInvertedShadowRows },
    { name: "PULSE + Markov", on: pulseEnabled && markovEnabled, sim: pulseMarkovShadowRows },
    { name: "BB Straight", on: !pulseEnabled && bbStraightEnabled && !bbInvertedEnabled, sim: straightShadowRows },
    { name: "Inverted", on: !pulseEnabled && bbInvertedEnabled, sim: invertedShadowRows },
    { name: "Markov", on: !pulseEnabled && markovEnabled, sim: markovShadowRows },
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
    const correct = signalRows.filter((r) => r.forecastGroup === r.outcomeGroup).length;
    const rawAccuracy = signalRows.length ? (correct / signalRows.length) * 100 : 0;
    const edge = rawAccuracy - 12.5;

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
      const isCorrect = row.forecastGroup === row.outcomeGroup;

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
    const rows = [
      {
        name: "PULSE",
        metrics: getRawSignalMetrics(pulseShadowRows),
      },
      {
        name: "PULSE + BB Straight",
        metrics: getRawSignalMetrics(pulseStraightShadowRows),
      },
      {
        name: "PULSE + Inverted",
        metrics: getRawSignalMetrics(pulseInvertedShadowRows),
      },
      {
        name: "PULSE + Markov",
        metrics: getRawSignalMetrics(pulseMarkovShadowRows),
      },
      {
        name: "BB Straight",
        metrics: getRawSignalMetrics(straightShadowRows),
      },
      {
        name: "Inverted",
        metrics: getRawSignalMetrics(invertedShadowRows),
      },
      {
        name: "Markov",
        metrics: getRawSignalMetrics(markovShadowRows),
      },
    ];

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
                    {row.name}
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

const RawSignalEngineAnalyticsPanel = () => {
    const rows = getEngineComparisonRows().map((row) => ({ ...row, metrics: getRawSignalMetrics(row.sim) }));
    const scoreColor = (v: number) => v >= 55 ? COLORS.green : v >= 45 ? COLORS.amber : COLORS.red;
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
    return <Panel title="Streak Risk Analytics"><div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}><MiniMetric label="Current Streak" value={currentLabel} accent={currentAccent} /><MiniMetric label="Largest Win" value={streakStats.largestWinStreak} accent={COLORS.green} /><MiniMetric label="Largest Loss" value={streakStats.largestLossStreak} accent={COLORS.red} /><MiniMetric label="Loss Severity" value={lossStreakSeverity} accent={severityAccent} /></div><div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 8 }}><MiniMetric label="Avg Win Streak" value={streakStats.avgWinStreak.toFixed(1)} accent={COLORS.green} /><MiniMetric label="Avg Loss Streak" value={streakStats.avgLossStreak.toFixed(1)} accent={COLORS.red} /><MiniMetric label="High Water" value={peakBankroll.toLocaleString()} /><MiniMetric label="Active DD" value={`${activeDrawdown.toLocaleString()} / ${activeDrawdownPct.toFixed(1)}%`} accent={activeDrawdown > 0 ? COLORS.red : COLORS.green} /></div><div style={{ marginTop: 10, border: `1px solid ${t.border}`, background: t.panel2, borderRadius: 12, padding: 10, color: t.subtext, fontSize: 11, fontWeight: 800, lineHeight: 1.45 }}></div></Panel>;
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

    return <CollapsiblePanel id="last20Spins" title="Last 20 Spins" style={{ overflow: "hidden", minWidth: 0 }}>
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

  const RouletteWheelPanel = () => {
    const wheelOrder: SpinValue[] = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, "00", 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];
    const winning = history.at(-1)?.outcome;
    const coreNumbers = f.group ? GROUPS[f.group] : [];
    const core = new Set(coreNumbers.map(String));
    const neigh = new Set(wheelNeighbors.map(String));
    const center = 150;
    const outerR = 126;
    const innerR = 100;
    const neighborLineR = 91;
    const coreLineR = 76;
    const segmentGap = 0.004;
    const slotAngle = (Math.PI * 2) / wheelOrder.length;
    const neighborAccent = "#1d8ff2";
    const coreAccent = COLORS.amber;

    const polar = (r: number, angle: number) => ({
      x: center + Math.cos(angle) * r,
      y: center + Math.sin(angle) * r,
    });

    const ringSegmentPath = (index: number) => {
      const startAngle = index * slotAngle - Math.PI / 2 + segmentGap;
      const endAngle = (index + 1) * slotAngle - Math.PI / 2 - segmentGap;
      const p1 = polar(outerR, startAngle);
      const p2 = polar(outerR, endAngle);
      const p3 = polar(innerR, endAngle);
      const p4 = polar(innerR, startAngle);
      return `M ${p1.x} ${p1.y} A ${outerR} ${outerR} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${innerR} ${innerR} 0 0 0 ${p4.x} ${p4.y} Z`;
    };

    const numberFill = (value: SpinValue) => {
      const isZero = value === 0 || value === "00";
      if (isZero) return "rgba(21,128,61,0.90)";
      return RED_NUMBERS.has(value) ? "rgba(153,27,27,0.92)" : "rgba(17,24,39,0.96)";
    };

    const overlayChips = [
      ...wheelNeighbors.map((value) => ({ value, radius: neighborLineR, accent: neighborAccent, label: "neighbor" })),
      ...coreNumbers.map((value) => ({ value, radius: coreLineR, accent: coreAccent, label: "core" })),
    ];

    return <CollapsiblePanel id="rouletteWheelOverlay" title="Wheel Neighbor Overlay">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
        <MiniMetric label="Group" value={f.group ?? "—"} accent={COLORS.red} />
        <MiniMetric label="Last" value={winning !== undefined ? String(winning) : "—"} accent={winning !== undefined ? (winning === 0 || winning === "00" ? COLORS.green : RED_NUMBERS.has(winning) ? COLORS.red : t.text) : undefined} />
        <MiniMetric label="Execution" value={executionMode} accent={executionMode === "Stream Direct" ? COLORS.cyan : executionMode === "Neighbor Expansion" ? COLORS.amber : COLORS.blue} />
        <MiniMetric label="Align" value={`${wheelAlignment}%`} accent={streamConflict ? COLORS.amber : COLORS.cyan} />
      </div>

      <svg width="100%" viewBox="0 0 300 318" style={{ background: t.panel2, border: `1px solid ${t.border}`, borderRadius: 14, overflow: "visible" }}>
        <defs>
          <radialGradient id="wheelGlow" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="rgba(34,199,243,0.08)" />
            <stop offset="68%" stopColor="rgba(2,6,23,0.02)" />
            <stop offset="100%" stopColor="rgba(34,199,243,0.10)" />
          </radialGradient>
          <filter id="softBlueGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="softAmberGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <circle cx={center} cy={center} r={137} fill="url(#wheelGlow)" stroke="rgba(148,163,184,0.14)" strokeWidth="1" />
        <circle cx={center} cy={center} r={outerR + 2} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />
        <circle cx={center} cy={center} r={innerR - 1} fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1" />

        {wheelOrder.map((n, i) => {
          const mid = i * slotAngle + slotAngle / 2 - Math.PI / 2;
          const textPoint = polar((outerR + innerR) / 2, mid);
          const key = String(n);
          const isWin = winning !== undefined && String(winning) === key;
          const isNeighbor = neigh.has(key);
          const isCore = core.has(key);
          return <g key={key}>
            <path d={ringSegmentPath(i)} fill={numberFill(n)} stroke={isWin ? COLORS.yellow : isNeighbor ? neighborAccent : isCore ? coreAccent : "rgba(255,255,255,0.42)"} strokeWidth={isWin ? 1.8 : isNeighbor || isCore ? 1.35 : 0.7} />
            <text x={textPoint.x} y={textPoint.y + 3} textAnchor="middle" fill="#f8fafc" fontSize={key === "00" ? "8.3" : "9"} fontWeight="950" transform={`rotate(${(mid * 180) / Math.PI + 90} ${textPoint.x} ${textPoint.y})`}>{key}</text>
          </g>;
        })}

        <circle cx={center} cy={center} r={neighborLineR} fill="none" stroke={neighborAccent} strokeWidth="1.2" opacity="0.95" filter="url(#softBlueGlow)" />
        <circle cx={center} cy={center} r={coreLineR} fill="none" stroke={coreAccent} strokeWidth="1.2" strokeDasharray="4 5" opacity="0.95" filter="url(#softAmberGlow)" />
        <circle cx={center} cy={center} r="48" fill="rgba(15,23,42,0.94)" stroke={t.borderStrong} strokeWidth="1" />

        {overlayChips.map((chip, idx) => {
          const wheelIndex = wheelOrder.findIndex((value) => String(value) === String(chip.value));
          if (wheelIndex < 0) return null;
          const angle = wheelIndex * slotAngle + slotAngle / 2 - Math.PI / 2;
          const point = polar(chip.radius, angle);
          const key = `${chip.label}-${String(chip.value)}-${idx}`;
          const isWin = winning !== undefined && String(winning) === String(chip.value);
          const chipRadius = isWin ? 9.4 : 8.4;
          return <g key={key}>
            <circle cx={point.x} cy={point.y} r={chipRadius} fill="rgba(2,6,23,0.94)" stroke={isWin ? COLORS.yellow : chip.accent} strokeWidth={isWin ? 2.1 : 1.5} />
            <text x={point.x} y={point.y + 3} textAnchor="middle" fill="#ffffff" fontSize={String(chip.value).length > 1 ? "6.5" : "7.4"} fontWeight="950">{String(chip.value)}</text>
          </g>;
        })}

        <text x={center} y={center - 5} textAnchor="middle" fill={COLORS.cyan} fontSize="17" fontWeight="950">{f.group ?? "—"}</text>
        <text x={center} y={center + 13} textAnchor="middle" fill={t.subtext} fontSize="9" fontWeight="850">wheel map</text>

        <g transform="translate(22,292)">
          <line x1="0" y1="0" x2="18" y2="0" stroke={neighborAccent} strokeWidth="2" />
          <text x="25" y="4" fill={t.text} fontSize="9" fontWeight="900">Neighbors</text>
          <line x1="92" y1="0" x2="112" y2="0" stroke={coreAccent} strokeWidth="2" strokeDasharray="4 4" />
          <text x="119" y="4" fill={t.text} fontSize="9" fontWeight="900">Core</text>
          <circle cx="178" cy="0" r="5" fill={COLORS.yellow} />
          <text x="187" y="4" fill={t.text} fontSize="9" fontWeight="900">Winning</text>
        </g>
      </svg>
    </CollapsiblePanel>;
  };


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
    return <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}><TrackPanel title="Color Track" values={colorVals} leftLabel="R" rightLabel="B" /><TrackPanel title="Range Track" values={rangeVals} leftLabel="HIGH" rightLabel="LOW" /><TrackPanel title="Parity Track" values={parityVals} leftLabel="ODD" rightLabel="EVEN" /></div>;
  };

  const TerminalHeader = () => {
    const last = history.at(-1);
    return <header style={{ minHeight: 62, display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 14, border: `1px solid ${t.border}`, borderRadius: 18, background: headerBg, padding: "0 16px", boxShadow: t.shadow, marginBottom: 14 }}><div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}><svg width="178" height="36" viewBox="100 125 1430 180" aria-label="EDGELAB" role="img" style={{ display: "block", flexShrink: 0 }}>
  <g transform="translate(120,140)">
    <rect x="0" y="0" width="120" height="18" fill={headerLogoFill} />
    <rect x="0" y="65" width="120" height="18" fill={headerLogoFill} />
    <rect x="0" y="130" width="120" height="18" fill={headerLogoFill} />
    <path d="M180 0 H260 Q340 0 340 74 Q340 148 260 148 H180 V110 H245 Q290 110 290 74 Q290 38 245 38 H180 Z" fill={headerLogoFill} />
    <path d="M430 0 H560 V38 H470 Q430 38 430 74 Q430 110 470 110 H560 V148 H450 Q380 148 380 74 Q380 0 450 0 Z" fill={headerLogoFill} />
    <rect x="505" y="65" width="70" height="18" fill={headerLogoFill} />
    <rect x="640" y="0" width="120" height="18" fill={headerLogoFill} />
    <rect x="640" y="65" width="120" height="18" fill="#9ACD32" />
    <rect x="640" y="130" width="120" height="18" fill={headerLogoFill} />
    <rect x="840" y="0" width="18" height="148" fill={headerLogoFill} />
    <rect x="840" y="130" width="100" height="18" fill={headerLogoFill} />
    <polygon points="1040,148 1090,0 1140,148 1100,148 1090,110 1080,148" fill={headerLogoFill} />
    <path d="M1240 0 H1330 Q1390 0 1390 40 Q1390 70 1360 82 Q1395 94 1395 125 Q1395 148 1335 148 H1240 V110 H1315 Q1345 110 1345 92 Q1345 74 1315 74 H1240 V38 H1315 Q1340 38 1340 20 Q1340 0 1310 0 H1240 Z" fill={headerLogoFill} />
  </g>
</svg><span style={{ height: 24, width: 1, background: t.borderStrong }} /><span style={{ color: headerAccent, fontWeight: 900, letterSpacing: 1.2, fontSize: 16 }}>ROULETTE TERMINAL</span></div><div style={{ display: "grid", gridTemplateColumns: "repeat(4, auto)", gap: 18, alignItems: "center", color: t.subtext, fontSize: 11, fontWeight: 850, textTransform: "uppercase" }}><span>Last Result <b style={{ color: last?.result === "win" ? COLORS.green : last?.result === "loss" ? COLORS.red : t.text, marginLeft: 5 }}>{last?.result ?? "—"}</b></span><span>Last Group <b style={{ color: t.text, marginLeft: 5 }}>{last?.outcomeGroup ?? "—"}</b></span><span>Last Spin <b style={{ color: t.text, marginLeft: 5 }}>{last ? String(last.outcome) : "—"}</b></span><span>Next <b style={{ color: headerAccent, marginLeft: 5 }}>Manual</b></span></div></header>;
  };

  const Dashboard = () => <section style={{ display: "grid", gridTemplateColumns: "minmax(320px, 360px) minmax(520px, 1fr) minmax(360px, 430px)", gap: 14, alignItems: "start", minWidth: 1240, overflow: "visible" }}><div style={{ display: "grid", gap: 14, minWidth: 0 }}><SignalPanel /><CompactMetrics /><RouletteWheelPanel /></div><div style={{ display: "grid", gap: 14, minWidth: 0, overflow: "hidden" }}><RouletteTable /><Last20SpinsStrip /><BankrollChart /><StreamsPanel /><EngineStrip /></div><div style={{ display: "grid", gap: 14, minWidth: 0 }}><RecentLog />{isPulseOnlyMode ? null : <DpiTerminalPanel />}<AxisDirectionalAccuracyPanel /><ComparisonTable compact /></div></section>;
  const Analytics = () => <section style={{ display: "grid", gap: 14 }}><LiveExecutionPerformancePanel /><EngineIntelligencePanel /><div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}><NeuralConfidenceDiagnosticsPanel /></div><StreakAnalyticsPanel /><ComparisonTable title="Strategy Stability Matrix" /></section>;
  const Reports = () => <section style={{ display: "grid", gap: 14 }}><Panel title="Report Summary"><div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}><MiniMetric label="Start" value={startingBankroll} /><MiniMetric label="Ending" value={bankroll} /><MiniMetric label="Net" value={net} /><MiniMetric label="ROI" value={roi} /><MiniMetric label="Win Rate" value={winRate} /><MiniMetric label="Spins" value={history.length} /></div></Panel><BankrollChart /><ComparisonTable title="Report Comparison" /><RecentLog /></section>;
  const Sessions = () => <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}><Panel title="Saved Sessions"><div style={{ display: "grid", gap: 10 }}><Button onClick={() => setShowSave(true)} variant="secondary">Save Current Session</Button><Select value={selectedSession} onChange={(e: any) => { const name = e.target.value; setSelectedSession(name); if (name) recoverSession(name); }} options={["", ...savedSessions.map(s => s.name)]} /><div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}><Button onClick={deleteSession} variant="danger" disabled={!selectedSession}>Delete</Button><Button variant="secondary" onClick={() => window.print()} disabled={!history.length}>Print/PDF</Button><Button variant="secondary" onClick={downloadCSV} disabled={!history.length}>CSV</Button></div></div></Panel><Panel title="Merge Sessions"><select multiple value={selectedMerge} onChange={(e: any) => setSelectedMerge(Array.from(e.target.selectedOptions).map((o: any) => o.value))} style={{ width: "100%", minHeight: 180, padding: 10, borderRadius: 10, background: t.input, color: t.text, border: `1px solid ${t.borderStrong}` }}>{savedSessions.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}</select><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}><Button onClick={mergeSelected} disabled={!selectedMerge.length}>Merge Selected</Button><Button variant="secondary" onClick={() => setSelectedMerge([])} disabled={!selectedMerge.length}>Clear</Button></div></Panel><div style={{ gridColumn: "1 / -1" }}><RecentLog /></div></section>;

  return <div style={{ minHeight: "100vh", background: t.appBg, color: t.text, fontFamily: "Arial, sans-serif", display: "grid", gridTemplateColumns: "82px 1fr" }}>
    <Modal open={showSave}><div style={{ fontSize: 20, fontWeight: 950, marginBottom: 10 }}>Save Current Session</div><Input type="text" value={sessionName} onChange={(e: any) => setSessionName(e.target.value)} placeholder="Session name" /><div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}><div style={{ width: 130 }}><Button variant="secondary" onClick={() => setShowSave(false)}>Cancel</Button></div><div style={{ width: 130 }}><Button onClick={saveSession}>Save</Button></div></div></Modal>
    <Modal open={showSettings}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}><div><div style={{ fontSize: 22, fontWeight: 950 }}>Settings</div><div style={{ fontSize: 13, color: t.subtext, marginTop: 4 }}>Terminal display preferences and table limits.</div></div><button onClick={() => setShowSettings(false)} style={{ border: 0, background: "transparent", fontSize: 24, fontWeight: 900, cursor: "pointer", color: t.subtext }}>×</button></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><button onClick={() => setAppearance("light")} style={{ height: 42, borderRadius: 10, border: `2px solid ${appearance === "light" ? COLORS.blue : t.borderStrong}`, background: "#fff", color: "#0f172a", fontWeight: 950 }}>Light</button><button onClick={() => setAppearance("dark")} style={{ height: 42, borderRadius: 10, border: `2px solid ${appearance === "dark" ? COLORS.cyan : t.borderStrong}`, background: "#020617", color: "#fff", fontWeight: 950 }}>Dark</button></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}><div><div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Table Limit</div><Input type="number" value={tableLimit} onChange={(e: any) => { const n = Number(e.target.value) || DEFAULT_TABLE_LIMIT; setTableLimit(n); setHistory(runStrategy(history.map((h) => h.outcome), strategy, baseUnit, startingBankroll, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, n, perNumberLimit, tierExecution)); }} /></div><div><div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Per Number Limit</div><Input type="number" value={perNumberLimit} onChange={(e: any) => { const n = Number(e.target.value) || DEFAULT_PER_NUMBER_LIMIT; setPerNumberLimit(n); setHistory(runStrategy(history.map((h) => h.outcome), strategy, baseUnit, startingBankroll, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, n, tierExecution)); }} /></div></div><div style={{ marginTop: 10, color: t.subtext, fontSize: 11, fontWeight: 800, lineHeight: 1.45 }}>Limits are enforced on every strategy replay. Unit bet is capped by both the straight-up per-number limit and the total table limit across the active execution basket.</div><div style={{ marginTop: 14, border: `1px solid ${t.border}`, background: t.panel2, borderRadius: 12, padding: 12 }}><div style={{ fontSize: 12, fontWeight: 950, color: t.text, marginBottom: 8 }}>Tier Execution Rules</div><div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}><button onClick={() => { const next = !executeWeak; setExecuteWeak(next); setHistory(runStrategy(history.map((h) => h.outcome), strategy, baseUnit, startingBankroll, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, { ...tierExecution, executeWeak: next })); }} style={{ height: 38, borderRadius: 10, border: `1px solid ${executeWeak ? COLORS.green : t.borderStrong}`, background: executeWeak ? "rgba(34,197,94,0.13)" : t.input, color: executeWeak ? COLORS.green : t.subtext, fontWeight: 950, cursor: "pointer" }}>Weak {executeWeak ? "ON" : "OFF"}</button><button onClick={() => { const next = !executeObservation; setExecuteObservation(next); setHistory(runStrategy(history.map((h) => h.outcome), strategy, baseUnit, startingBankroll, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, { ...tierExecution, executeObservation: next })); }} style={{ height: 38, borderRadius: 10, border: `1px solid ${executeObservation ? COLORS.red : t.borderStrong}`, background: executeObservation ? "rgba(239,68,68,0.11)" : t.input, color: executeObservation ? COLORS.red : t.subtext, fontWeight: 950, cursor: "pointer" }}>Observe {executeObservation ? "ON" : "OFF"}</button></div><div style={{ marginTop: 9, color: t.subtext, fontSize: 11, fontWeight: 800 }}>Default: Weak ON, Observation OFF.</div></div><div style={{ marginTop: 14, border: `1px solid ${t.border}`, background: t.panel2, borderRadius: 12, padding: 12 }}><div style={{ fontSize: 12, fontWeight: 950, color: t.text, marginBottom: 8 }}>Saved Control Settings</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><Button onClick={saveControlSettings}>Save Controls</Button><Button variant="secondary" onClick={clearSavedControlSettings}>Clear Saved</Button></div>{settingsSavedNotice ? <div style={{ marginTop: 9, color: COLORS.green, fontSize: 11, fontWeight: 900 }}>{settingsSavedNotice}</div> : null}</div><div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}><div style={{ width: 130 }}><Button onClick={() => setShowSettings(false)}>Done</Button></div></div></Modal>
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
            <div style={{ fontSize: 13, color: t.subtext, marginTop: 4 }}>Quick reference for EDGELAB PULSE Roulette.</div>
          </div>
          <button onClick={() => setShowGlossary(false)} style={{ border: `1px solid ${t.borderStrong}`, background: t.input, borderRadius: 10, width: 42, height: 38, fontSize: 24, fontWeight: 900, cursor: "pointer", color: t.text, flexShrink: 0, lineHeight: 1 }}>×</button>
        </div>
        {[["Auto Simulation Optimization", "Performance pass that batches Run Auto results, prevents repeated replay loops during simulation, memoizes shadow comparisons, and calculates recent accuracy from stored forecast rows."], ["Bankroll", "Current simulated bankroll after settled spins."], ["Base Unit / Number", "The starting wager amount per active number before strategy scaling and limit enforcement."], ["Confidence-65", "Only executes when final confidence is 65 or higher."], ["Confidence-75", "Only executes when final confidence is 75 or higher."], ["Adaptive TDA", " upgrade that allows full 3D execution when all dimensions pass, or controlled 2D compression when two dimensions pass and one dimension is weakening."], ["Controlled Prediction", "Mid-high confidence tier. The forecast is usable, but not at the strongest level."], ["DPI", "Directional Pressure Index. A pressure-state counter that tracks execution stress and recovery conditions; it is not the primary PULSE forecasting engine."], ["DPI Zone", "Summary of pressure level: Neutral, Pressure, or Transition."], ["Engine Shadow Comparison", "Replays PULSE, Straight BB, and Inverted BB against the same spin history so their results can be compared even when they are not live."], ["Entropy Regime Weighting", "Controlled PULSE modifier that slightly adjusts predictor weights based on chaos level. High entropy can favor reversal/recency models, but it cannot dominate the forecast or create Strong by itself."], ["ESI", "Engine Strength Index. A composite Live Engine Rankings score that combines win rate, ROI adjustment, and active engine status to estimate current engine quality."], ["Execution Accuracy", "Performance of actual bettable signals only. Advisory-only tiers are recorded as pushes/no-bets and do not affect bankroll, DPI, ROI, or win/loss totals."], ["Execution Compression", "PULSE-only execution behavior that can widen from a strict 3D group to a 2D straight-up number basket when one dimension loses stability but two dimensions remain qualified."], ["Execution Mode", "Controls whether the system uses Stream Direct, Neighbor Expansion, Edge Expansion, or Hybrid Coverage."], ["Edge Expansion", "Adds only the one-number edge map to the core stream forecast: BHE+9, RHE+2, BHO+1, RHO+10, RLE+2, BLO+1. It does not include Neighbor Expansion numbers."], ["Exposure Cap", "Caps total active basket exposure relative to bankroll and basket size."], ["Flat", "Uses the base unit per active number whenever a signal qualifies."], ["Hybrid Coverage", "Combines core stream numbers with both Neighbor Expansion and Edge Expansion coverage."], ["Inverted BB Mode", "Uses the mirrored Boolean structure only when the DPI threshold is reached; DPI calculation itself remains unchanged."], ["Limit Hit", "Occurs when the requested unit size is reduced by the table limit or per-number limit."], ["Martingale 3", "Doubles the unit after each 3-loss block. More aggressive than Martingale 5 and Martingale 7, especially with expanded number baskets."], ["Martingale 5", "Doubles the unit after each 5-loss block. Medium progression between Martingale 3 and Martingale 7."], ["Martingale 7", "Doubles the unit after each 7-loss block."], ["Neighbor Expansion", "Adds only the PULSE neighbor expansion map to the core stream forecast. It does not include Edge Expansion numbers."], ["Neural Assist", "Diagnostics-only model in the harmonized architecture. It shows recent accuracy, agreement, and entropy context but does not modify live PULSE confidence."], ["Directional Observe", "Lowest PULSE forecast state after enough spins. It preserves a directional lean but is advisory only by default and is not settled as a win/loss."], ["Per Number Limit", "Maximum straight-up bet allowed on each number. Default is $300 and can be changed in Settings."], ["Persistence Durability", "TDA sub-filter that checks whether a predicted Color, Range, or Parity alignment has held long enough to trust execution. It is designed to reduce false-positive passes during transitional rotation."], ["Progressive Confidence", "Scales unit size upward when final confidence reaches stronger tiers."], ["PULSE", "Primary forecasting engine. It predicts Color, Range, and Parity as separate binary streams first, combines them into the final 8-state group forecast, then lets Adaptive TDA decide whether to execute full 3D, compressed 2D, or Observe." ], ["PULSE-Only Expansion", "Additional coverage numbers that are applied only when the active source is PULSE and the execution mode uses Neighbor Expansion or Hybrid Coverage. BB Straight and BB Inverted do not use these added numbers."], ["Recovery State", "Loss-pressure state: off, watch, or recovery."], ["Saved Control Settings", "Settings option that saves bankroll, base unit, strategy, auto spins, PULSE/BB state, execution mode, table limits, tier execution rules, and appearance for the next login."], ["SIG", "Signals. In Engine Shadow Comparison, SIG is the number of actionable/executed signals produced by that engine during the replay/session."], ["Signal Accuracy", "Forecast accuracy view that can study all PULSE tiers, including advisory-only Directional Observe states."], ["Signal State", "Live decision panel showing the final prediction, TDA status, final Neural-adjusted PULSE confidence, and signal tier."], ["Step Recovery", "Controlled staged recovery: 1x, 2x, 3x, then 4x base by loss depth."], ["Straight BB Mode", "Runs the locked Straight Boolean table from spin 1."], ["Strategy Comparison", "Replays all strategy models from the same raw outcomes to compare ending bankroll, ROI, drawdown, profit factor, and other metrics."], ["Stream Conflict", "Warning shown when neighbor expansion numbers do not match the core forecast stream group."], ["Stream Direct", "Executes only the core predicted group numbers."], ["Strong Prediction", "Highest-confidence PULSE tier. Indicates strong agreement across the current PULSE memory layers and confidence calibration."], ["Table Limit", "Maximum total wager allowed across the active execution basket. Default is $10,000 and can be changed in Settings."], ["TDA", ". Structural diagnostic layer only. TDA no longer independently vetoes execution; Consensus is the final execution authority. Full 3D execution requires Color, Range, and Parity to pass confidence, stability, and persistence. Adaptive 2D compression can execute when two dimensions pass and one dimension is unstable; otherwise the signal stays OBSERVE / No Bet."], ["Tier Execution Rules", "Settings controls that decide whether Weak and Directional Observe tiers are actually executed or only tracked as advisory forecasts."], ["Weak Prediction", "Lower confidence active forecast. Directional bias exists, but the stream is less stable."], ["Wheel Neighbor Overlay", "Execution layer that adds selected wheel-neighbor numbers without changing the core stream forecast."]].map(([term, def]) => <div key={term} style={{ borderBottom: `1px solid ${t.border}`, padding: "13px 0" }}><div style={{ fontSize: 16, fontWeight: 950 }}>{term}</div><div style={{ fontSize: 13, color: t.subtext, marginTop: 4, lineHeight: 1.45 }}>{def}</div></div>)}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16, paddingBottom: 4 }}><div style={{ width: 130 }}><Button onClick={() => setShowGlossary(false)}>Done</Button></div></div>
      </div>
    </div> : null}
    <aside style={{ background: t.railBg, borderRight: `1px solid ${t.border}`, padding: "14px 9px", display: "grid", gridTemplateRows: "auto 1fr auto", gap: 14 }}><div style={{ width: 48, height: 48, borderRadius: 14, background: sidebarIconBg, border: sidebarIconBorder, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", boxShadow: sidebarIconShadow }}><svg width="31" height="31" viewBox="0 0 64 64"><rect x="8" y="8" width="48" height="48" rx="12" fill={isDark ? "rgba(0,0,0,0.34)" : "rgba(255,255,255,0.70)"} stroke={isDark ? "rgba(255,255,255,0.18)" : "#cbd5e1"}/><rect x="20" y="18" width="24" height="6" rx="1" fill={isDark ? "#fff" : "#0f172a"}/><rect x="20" y="29" width="24" height="6" rx="1" fill="#86c914"/><rect x="20" y="40" width="24" height="6" rx="1" fill={isDark ? "#fff" : "#0f172a"}/></svg></div><nav style={{ display: "grid", gap: 8, alignContent: "start" }}>{VIEWS.map(v => <button key={v} onClick={() => setActiveView(v)} style={{ width: "100%", minHeight: 50, borderRadius: 14, border: `1px solid ${activeView === v ? "rgba(34,199,243,0.42)" : "transparent"}`, background: activeView === v ? "rgba(34,199,243,0.14)" : "transparent", color: activeView === v ? headerAccent : t.subtext, fontWeight: 900, fontSize: 10, cursor: "pointer" }}>{v}</button>)}</nav><div style={{ display: "grid", gap: 8 }}><button onClick={() => setShowSettings(true)} style={{ height: 42, borderRadius: 12, border: `1px solid ${t.border}`, background: "transparent", color: t.subtext, fontWeight: 900, cursor: "pointer" }}>⚙</button><button onClick={() => setShowGlossary(true)} style={{ height: 42, borderRadius: 12, border: `1px solid ${t.border}`, background: "transparent", color: t.subtext, fontWeight: 900, cursor: "pointer" }}>?</button></div></aside>
    <main style={{ padding: 16, overflowX: "auto", overflowY: "visible" }}><TerminalHeader />
      <ControlsPanel />
      {activeView === "Dashboard" ? <Dashboard /> : null}{activeView === "Analytics" ? <Analytics /> : null}{activeView === "Reports" ? <Reports /> : null}{activeView === "Sessions" ? <Sessions /> : null}

    </main>
  </div>;
}









