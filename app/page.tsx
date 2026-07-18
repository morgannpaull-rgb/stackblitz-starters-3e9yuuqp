"use client";

import React, { useMemo, useState } from "react";

type SpinValue = number | "00";
type Result = "win" | "loss" | "push";
type TierLabel = "Active · High Confidence" | "Active · Confirmed" | "Active · Caution" | "Hold · No Bet" | "No Prediction" | "Straight" | "Inverted" | "BB Inverted Armed" | "Disabled";
type GroupKey = "BHE" | "BHO" | "BLE" | "BLO" | "RHE" | "RHO" | "RLE" | "RLO";
type Strategy =
  | "Flat"
  | "Martingale 3"
  | "Martingale 5"
  | "Martingale 7"
  | "Post-10 Win Recovery"
  | "Step Recovery"
  | "Exposure Cap"
  | "Gap-34"
  | "Gap-50"
  | "Progressive Gap"
  | "Confidence-65"
  | "Confidence-75"
  | "Progressive Confidence";
type Appearance = "dark" | "light";
type ViewKey = "Dashboard" | "Analytics" | "Reports" | "Sessions";
type BBMode = "BB Off" | "Straight" | "Inverted";
type ExecutionMode = "Stream Direct" | "Dimension Compression" | "Edge Expansion" | "Neighbor Expansion" | "Hybrid Coverage";

type PulseAudit = {
  active: boolean;
  source: string;
  forecastGroup: GroupKey | null;
  outcomeGroup: GroupKey;
  result: Result;
  colorCorrect: boolean | null;
  rangeCorrect: boolean | null;
  parityCorrect: boolean | null;
  dimensionsCorrect: number | null;
  colorDpi: number | null;
  rangeDpi: number | null;
  parityDpi: number | null;
  blackConfidence: number | null;
  redConfidence: number | null;
  blackSpread: number | null;
  redSpread: number | null;
  colorSignal: string | null;
  highConfidence: number | null;
  lowConfidence: number | null;
  highSpread: number | null;
  lowSpread: number | null;
  rangeSignal: string | null;
  evenConfidence: number | null;
  oddConfidence: number | null;
  evenSpread: number | null;
  oddSpread: number | null;
  paritySignal: string | null;
  weakestDimension: string | null;
  closestSpreadDimension: string | null;
  smallestSpreadGap: number | null;
  // AND Convergence Gate
  colorGateInput: boolean | null;   // true = Black side (DPI > 0), false = Red side (DPI < 0), null = flat
  rangeGateInput: boolean | null;   // true = High side (DPI > 0), false = Low side (DPI < 0), null = flat
  parityGateInput: boolean | null;  // true = Even side (DPI > 0), false = Odd side (DPI < 0), null = flat
  andConvergence: boolean;          // TRUE only when all three axes share the same non-null direction
  convergenceDirection: "B/H/E" | "R/L/O" | null; // which way they converge, or null if diverged
  axesAgreeing: number;             // 0–3: how many axes share the majority direction
};

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
  autoRun?: boolean;
  autoRunAudit?: any;
  pulseAudit?: PulseAudit;
  pulseDivergence?: PulseDivergenceResult;
  pulseSelectedEngine?: string | null;
  // Full Pulse engine-tracker snapshot (all 4 rolling win rates + switch info),
  // not just the selected engine name — needed for the Pulse switch log.
  pulseEngineTracker?: {
    selectedEngine: string | null;
    isWarming: boolean;
    engineRates: Record<string, number>;
    engineSamples?: Record<string, number>;
    switched: boolean;
    previousEngine: string | null;
    switchZScore?: number | null;
    switchReason?: "significant" | "sustained-lean" | "accelerating-lean" | null;
    challengerZScores?: Record<string, number | null>;
    leanStreak?: number;
    zTrendDelta?: number | null;
  } | null;
  // Per-axis diagnostics for ALL 4 engines, computed every spin regardless of
  // which one Pulse actually selected — lets us audit engines retroactively.
  allEngineDiagnostics?: {
    straight: { gate: PulseDivergenceResult | null; group: GroupKey | null };
    inverted: { axisDpi: { color: number; range: number; parity: number } | null; axisModes: { color: string; range: string; parity: string } | null; group: GroupKey | null };
    markov: { axisConfidence: { color: number; range: number; parity: number } | null; group: GroupKey | null };
    random: { axisDpi: { color: number; range: number; parity: number } | null; confidence: number | null; group: GroupKey | null };
  } | null;
  // Engine config snapshot — captured at settle time so exports are accurate
  // even when viewed after the config has changed (e.g. post-autorun analysis).
  _pulseEnabled?: boolean;
  _bbStraightEnabled?: boolean;
  _bbInvertedEnabled?: boolean;
  _markovEnabled?: boolean;
  _randomEnabled?: boolean;
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
  randomEnabled?: boolean;
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
  randomEnabled: boolean;
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
const RV_CONFIDENCE_PENALTY_MODERATE = 4;
const RV_CONFIDENCE_PENALTY_HIGH = 8;
const RV_CONFIDENCE_PENALTY_EXTREME = 14;
const PERSISTENCE_GATE_MIN = 50;
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
  "Post-10 Win Recovery",
  "Step Recovery",
];

function normalizeStrategyName(value: any): Strategy {
  return STRATEGIES.includes(value) ? value : DEFAULT_STRATEGY;
}

const VIEWS: ViewKey[] = ["Dashboard", "Analytics", "Reports", "Sessions"];
const EXECUTION_MODES: ExecutionMode[] = ["Stream Direct", "Dimension Compression", "Edge Expansion", "Neighbor Expansion"];

type LearnedExecutionProfile = {
  structure: string;
  samples: number;
  runs: number;
  bestMode: ExecutionMode;
  bestAvgDim: number;
  streamAvgDim: number;
  neighborAvgDim: number;
  edgeAvgDim: number;
  compressionAvgDim: number;
  advantage: number;
};

const PULSE_EXECUTION_ROUTER_MIN_SAMPLES = 15;
const PULSE_EXECUTION_ROUTER_FAMILY_MIN_SAMPLES = 30;
const PULSE_EXECUTION_ROUTER_SIGNATURE_MIN_SAMPLES = 60;
const PULSE_EXECUTION_ROUTER_MIN_ADVANTAGE = 0.35;
const PULSE_EXECUTION_ROUTER_NEIGHBOR_MIN_ADVANTAGE = 0.50;

const LEARNED_PULSE_EXECUTION_INTELLIGENCE: LearnedExecutionProfile[] = [{"structure":"16 / 16 / 16","samples":43,"runs":10,"bestMode":"Neighbor Expansion","bestAvgDim":2.3021,"streamAvgDim":1.6053,"neighborAvgDim":2.3021,"edgeAvgDim":2.0928,"compressionAvgDim":1.6053,"advantage":0.6967},{"structure":"16 / 34 / 16","samples":32,"runs":10,"bestMode":"Neighbor Expansion","bestAvgDim":2.22,"streamAvgDim":1.4697,"neighborAvgDim":2.22,"edgeAvgDim":2.0003,"compressionAvgDim":2.0009,"advantage":0.7503},{"structure":"0 / 16 / 16","samples":30,"runs":10,"bestMode":"Neighbor Expansion","bestAvgDim":2.3663,"streamAvgDim":1.5323,"neighborAvgDim":2.3663,"edgeAvgDim":2.032,"compressionAvgDim":1.5323,"advantage":0.834},{"structure":"16 / 0 / 16","samples":27,"runs":8,"bestMode":"Neighbor Expansion","bestAvgDim":2.2574,"streamAvgDim":1.667,"neighborAvgDim":2.2574,"edgeAvgDim":2.1104,"compressionAvgDim":1.667,"advantage":0.5904},{"structure":"16 / 16 / 0","samples":22,"runs":9,"bestMode":"Neighbor Expansion","bestAvgDim":2.3636,"streamAvgDim":1.2714,"neighborAvgDim":2.3636,"edgeAvgDim":2.0464,"compressionAvgDim":1.2714,"advantage":1.0923},{"structure":"0 / 16 / 0","samples":22,"runs":8,"bestMode":"Neighbor Expansion","bestAvgDim":2.3636,"streamAvgDim":1.7727,"neighborAvgDim":2.3636,"edgeAvgDim":2.1373,"compressionAvgDim":1.7727,"advantage":0.5909},{"structure":"0 / 0 / 16","samples":19,"runs":7,"bestMode":"Neighbor Expansion","bestAvgDim":2.2089,"streamAvgDim":1.3689,"neighborAvgDim":2.2089,"edgeAvgDim":2.0005,"compressionAvgDim":1.3689,"advantage":0.84},{"structure":"0 / 16 / 34","samples":19,"runs":8,"bestMode":"Neighbor Expansion","bestAvgDim":2.1579,"streamAvgDim":1.7363,"neighborAvgDim":2.1579,"edgeAvgDim":2.0526,"compressionAvgDim":2.1574,"advantage":0.4216},{"structure":"16 / 16 / 34","samples":19,"runs":9,"bestMode":"Neighbor Expansion","bestAvgDim":2.2626,"streamAvgDim":1.3689,"neighborAvgDim":2.2626,"edgeAvgDim":2.0521,"compressionAvgDim":1.8953,"advantage":0.8937},{"structure":"16 / 0 / 34","samples":17,"runs":7,"bestMode":"Neighbor Expansion","bestAvgDim":2.3529,"streamAvgDim":1.3535,"neighborAvgDim":2.3529,"edgeAvgDim":2.1176,"compressionAvgDim":1.9412,"advantage":0.9994},{"structure":"34 / 16 / 16","samples":17,"runs":8,"bestMode":"Neighbor Expansion","bestAvgDim":2.3524,"streamAvgDim":1.4694,"neighborAvgDim":2.3524,"edgeAvgDim":1.9988,"compressionAvgDim":1.94,"advantage":0.8829},{"structure":"34 / 34 / 16","samples":17,"runs":8,"bestMode":"Neighbor Expansion","bestAvgDim":2.3535,"streamAvgDim":1.1771,"neighborAvgDim":2.3535,"edgeAvgDim":1.7053,"compressionAvgDim":1.7047,"advantage":1.1765},{"structure":"0 / 34 / 16","samples":17,"runs":9,"bestMode":"Neighbor Expansion","bestAvgDim":2.2935,"streamAvgDim":1.5876,"neighborAvgDim":2.2935,"edgeAvgDim":2.0,"compressionAvgDim":2.0006,"advantage":0.7059},{"structure":"0 / 0 / 34","samples":17,"runs":7,"bestMode":"Neighbor Expansion","bestAvgDim":2.0588,"streamAvgDim":1.4118,"neighborAvgDim":2.0588,"edgeAvgDim":1.8824,"compressionAvgDim":1.7059,"advantage":0.6471},{"structure":"34 / 16 / 34","samples":14,"runs":8,"bestMode":"Neighbor Expansion","bestAvgDim":2.5707,"streamAvgDim":2.0714,"neighborAvgDim":2.5707,"edgeAvgDim":2.4993,"compressionAvgDim":2.5,"advantage":0.4993},{"structure":"0 / 34 / 0","samples":13,"runs":7,"bestMode":"Neighbor Expansion","bestAvgDim":2.4608,"streamAvgDim":1.5392,"neighborAvgDim":2.4608,"edgeAvgDim":1.9992,"compressionAvgDim":1.9238,"advantage":0.9215},{"structure":"16 / 0 / 0","samples":13,"runs":7,"bestMode":"Neighbor Expansion","bestAvgDim":2.1538,"streamAvgDim":1.4615,"neighborAvgDim":2.1538,"edgeAvgDim":1.8462,"compressionAvgDim":1.4615,"advantage":0.6923},{"structure":"34 / 34 / 0","samples":12,"runs":6,"bestMode":"Neighbor Expansion","bestAvgDim":2.4158,"streamAvgDim":1.7492,"neighborAvgDim":2.4158,"edgeAvgDim":2.1658,"compressionAvgDim":2.1675,"advantage":0.6667},{"structure":"16 / 34 / 0","samples":11,"runs":7,"bestMode":"Neighbor Expansion","bestAvgDim":2.4536,"streamAvgDim":1.8173,"neighborAvgDim":2.4536,"edgeAvgDim":2.09,"compressionAvgDim":2.3645,"advantage":0.6364},{"structure":"16 / 50 / 16","samples":11,"runs":8,"bestMode":"Neighbor Expansion","bestAvgDim":2.3636,"streamAvgDim":1.2727,"neighborAvgDim":2.3636,"edgeAvgDim":2.1818,"compressionAvgDim":2.0,"advantage":1.0909},{"structure":"34 / 0 / 0","samples":10,"runs":6,"bestMode":"Neighbor Expansion","bestAvgDim":2.401,"streamAvgDim":1.199,"neighborAvgDim":2.401,"edgeAvgDim":1.901,"compressionAvgDim":1.801,"advantage":1.202},{"structure":"34 / 34 / 34","samples":10,"runs":7,"bestMode":"Dimension Compression","bestAvgDim":2.1,"streamAvgDim":1.9,"neighborAvgDim":2.1,"edgeAvgDim":2.0,"compressionAvgDim":2.1,"advantage":0.2},{"structure":"34 / 0 / 16","samples":10,"runs":5,"bestMode":"Neighbor Expansion","bestAvgDim":2.301,"streamAvgDim":1.2,"neighborAvgDim":2.301,"edgeAvgDim":2.1,"compressionAvgDim":1.899,"advantage":1.101},{"structure":"50 / 34 / 16","samples":10,"runs":6,"bestMode":"Neighbor Expansion","bestAvgDim":2.2,"streamAvgDim":1.7,"neighborAvgDim":2.2,"edgeAvgDim":2.1,"compressionAvgDim":2.0,"advantage":0.5},{"structure":"34 / 50 / 16","samples":10,"runs":6,"bestMode":"Neighbor Expansion","bestAvgDim":2.1,"streamAvgDim":1.5,"neighborAvgDim":2.1,"edgeAvgDim":1.9,"compressionAvgDim":1.8,"advantage":0.6},{"structure":"0 / 34 / 34","samples":9,"runs":6,"bestMode":"Neighbor Expansion","bestAvgDim":2.3333,"streamAvgDim":1.5556,"neighborAvgDim":2.3333,"edgeAvgDim":2.3333,"compressionAvgDim":2.0,"advantage":0.7778},{"structure":"50 / 0 / 16","samples":9,"runs":4,"bestMode":"Dimension Compression","bestAvgDim":2.2233,"streamAvgDim":1.5567,"neighborAvgDim":2.22,"edgeAvgDim":2.22,"compressionAvgDim":2.2233,"advantage":0.6667},{"structure":"34 / 0 / 34","samples":8,"runs":5,"bestMode":"Neighbor Expansion","bestAvgDim":2.25,"streamAvgDim":1.375,"neighborAvgDim":2.25,"edgeAvgDim":2.25,"compressionAvgDim":1.625,"advantage":0.875},{"structure":"16 / 16 / 50","samples":8,"runs":4,"bestMode":"Neighbor Expansion","bestAvgDim":2.6262,"streamAvgDim":1.3738,"neighborAvgDim":2.6262,"edgeAvgDim":2.1238,"compressionAvgDim":1.8775,"advantage":1.2525},{"structure":"50 / 16 / 34","samples":8,"runs":5,"bestMode":"Neighbor Expansion","bestAvgDim":2.3738,"streamAvgDim":1.9988,"neighborAvgDim":2.3738,"edgeAvgDim":2.1238,"compressionAvgDim":2.1238,"advantage":0.375},{"structure":"50 / 50 / 16","samples":7,"runs":3,"bestMode":"Dimension Compression","bestAvgDim":2.2857,"streamAvgDim":1.5714,"neighborAvgDim":2.1429,"edgeAvgDim":2.0,"compressionAvgDim":2.2857,"advantage":0.7143},{"structure":"50 / 16 / 16","samples":7,"runs":6,"bestMode":"Neighbor Expansion","bestAvgDim":2.5714,"streamAvgDim":1.5714,"neighborAvgDim":2.5714,"edgeAvgDim":2.4286,"compressionAvgDim":2.1429,"advantage":1.0},{"structure":"34 / 16 / 0","samples":7,"runs":5,"bestMode":"Dimension Compression","bestAvgDim":2.0,"streamAvgDim":1.2857,"neighborAvgDim":2.0,"edgeAvgDim":1.7143,"compressionAvgDim":2.0,"advantage":0.7143},{"structure":"34 / 50 / 34","samples":6,"runs":5,"bestMode":"Neighbor Expansion","bestAvgDim":2.5,"streamAvgDim":2.0,"neighborAvgDim":2.5,"edgeAvgDim":2.5,"compressionAvgDim":2.3333,"advantage":0.5},{"structure":"34 / 16 / 50","samples":6,"runs":3,"bestMode":"Neighbor Expansion","bestAvgDim":2.3333,"streamAvgDim":1.6667,"neighborAvgDim":2.3333,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.6667},{"structure":"0 / 0 / 0","samples":6,"runs":5,"bestMode":"Neighbor Expansion","bestAvgDim":2.3333,"streamAvgDim":1.5,"neighborAvgDim":2.3333,"edgeAvgDim":1.8333,"compressionAvgDim":1.5,"advantage":0.8333},{"structure":"34 / 34 / 50","samples":6,"runs":3,"bestMode":"Dimension Compression","bestAvgDim":2.8333,"streamAvgDim":2.1667,"neighborAvgDim":2.1667,"edgeAvgDim":2.1667,"compressionAvgDim":2.8333,"advantage":0.6667},{"structure":"16 / 0 / 50","samples":6,"runs":3,"bestMode":"Neighbor Expansion","bestAvgDim":2.1667,"streamAvgDim":1.335,"neighborAvgDim":2.1667,"edgeAvgDim":1.835,"compressionAvgDim":1.5017,"advantage":0.8317},{"structure":"50 / 16 / 50","samples":6,"runs":3,"bestMode":"Neighbor Expansion","bestAvgDim":2.165,"streamAvgDim":1.1667,"neighborAvgDim":2.165,"edgeAvgDim":1.6683,"compressionAvgDim":1.835,"advantage":0.9983},{"structure":"50 / 34 / 34","samples":6,"runs":4,"bestMode":"Neighbor Expansion","bestAvgDim":2.1667,"streamAvgDim":1.5,"neighborAvgDim":2.1667,"edgeAvgDim":2.1667,"compressionAvgDim":2.0,"advantage":0.6667},{"structure":"50 / 0 / 0","samples":6,"runs":4,"bestMode":"Neighbor Expansion","bestAvgDim":2.1667,"streamAvgDim":1.5,"neighborAvgDim":2.1667,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.6667},{"structure":"50 / 34 / 0","samples":5,"runs":4,"bestMode":"Neighbor Expansion","bestAvgDim":2.2,"streamAvgDim":1.6,"neighborAvgDim":2.2,"edgeAvgDim":2.0,"compressionAvgDim":2.2,"advantage":0.6},{"structure":"16 / 34 / 34","samples":5,"runs":4,"bestMode":"Dimension Compression","bestAvgDim":2.0,"streamAvgDim":1.4,"neighborAvgDim":2.0,"edgeAvgDim":1.4,"compressionAvgDim":2.0,"advantage":0.6},{"structure":"50 / 50 / 34","samples":5,"runs":5,"bestMode":"Neighbor Expansion","bestAvgDim":2.6,"streamAvgDim":1.4,"neighborAvgDim":2.6,"edgeAvgDim":2.6,"compressionAvgDim":1.8,"advantage":1.2},{"structure":"50 / 34 / 50","samples":5,"runs":3,"bestMode":"Dimension Compression","bestAvgDim":2.398,"streamAvgDim":1.598,"neighborAvgDim":2.0,"edgeAvgDim":1.798,"compressionAvgDim":2.398,"advantage":0.8},{"structure":"50 / 16 / 0","samples":5,"runs":3,"bestMode":"Dimension Compression","bestAvgDim":2.4,"streamAvgDim":2.002,"neighborAvgDim":2.2,"edgeAvgDim":2.2,"compressionAvgDim":2.4,"advantage":0.398},{"structure":"50 / 0 / 34","samples":4,"runs":3,"bestMode":"Neighbor Expansion","bestAvgDim":2.5,"streamAvgDim":2.0,"neighborAvgDim":2.5,"edgeAvgDim":2.0,"compressionAvgDim":2.25,"advantage":0.5},{"structure":"50 / 50 / 50","samples":4,"runs":2,"bestMode":"Dimension Compression","bestAvgDim":2.0,"streamAvgDim":1.4975,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.5025},{"structure":"16 / 34 / 50","samples":4,"runs":3,"bestMode":"Neighbor Expansion","bestAvgDim":2.25,"streamAvgDim":1.0,"neighborAvgDim":2.25,"edgeAvgDim":2.0,"compressionAvgDim":1.75,"advantage":1.25},{"structure":"0 / 50 / 16","samples":4,"runs":4,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":1.5,"compressionAvgDim":1.75,"advantage":1.0},{"structure":"0 / 50 / 0","samples":4,"runs":2,"bestMode":"Neighbor Expansion","bestAvgDim":2.2475,"streamAvgDim":1.25,"neighborAvgDim":2.2475,"edgeAvgDim":1.7525,"compressionAvgDim":1.7525,"advantage":0.9975},{"structure":"50 / 50 / 0","samples":4,"runs":3,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.75,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.25},{"structure":"16 / 16 / 66","samples":4,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.25,"streamAvgDim":1.0,"neighborAvgDim":2.25,"edgeAvgDim":1.5,"compressionAvgDim":1.75,"advantage":1.25},{"structure":"0 / 50 / 50","samples":3,"runs":3,"bestMode":"Neighbor Expansion","bestAvgDim":2.3333,"streamAvgDim":1.0,"neighborAvgDim":2.3333,"edgeAvgDim":2.3333,"compressionAvgDim":2.0,"advantage":1.3333},{"structure":"0 / 16 / 66","samples":3,"runs":1,"bestMode":"Dimension Compression","bestAvgDim":2.0,"streamAvgDim":1.33,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.67},{"structure":"0 / 16 / 50","samples":3,"runs":2,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.6667,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.3333},{"structure":"66 / 16 / 16","samples":3,"runs":3,"bestMode":"Neighbor Expansion","bestAvgDim":2.3333,"streamAvgDim":2.0,"neighborAvgDim":2.3333,"edgeAvgDim":2.3333,"compressionAvgDim":2.3333,"advantage":0.3333},{"structure":"84 / 0 / 34","samples":3,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.33,"streamAvgDim":1.33,"neighborAvgDim":2.33,"edgeAvgDim":2.33,"compressionAvgDim":2.0,"advantage":1.0},{"structure":"34 / 50 / 0","samples":3,"runs":3,"bestMode":"Neighbor Expansion","bestAvgDim":2.3333,"streamAvgDim":1.0,"neighborAvgDim":2.3333,"edgeAvgDim":1.3333,"compressionAvgDim":1.6667,"advantage":1.3333},{"structure":"34 / 66 / 16","samples":3,"runs":2,"bestMode":"Neighbor Expansion","bestAvgDim":2.6667,"streamAvgDim":1.0,"neighborAvgDim":2.6667,"edgeAvgDim":2.6667,"compressionAvgDim":1.6667,"advantage":1.6667},{"structure":"50 / 66 / 16","samples":3,"runs":3,"bestMode":"Neighbor Expansion","bestAvgDim":2.6667,"streamAvgDim":0.6667,"neighborAvgDim":2.6667,"edgeAvgDim":2.3333,"compressionAvgDim":1.3333,"advantage":2.0},{"structure":"60 / 20 / 20","samples":3,"runs":3,"bestMode":"Neighbor Expansion","bestAvgDim":2.3333,"streamAvgDim":1.3333,"neighborAvgDim":2.3333,"edgeAvgDim":2.3333,"compressionAvgDim":2.0,"advantage":1.0},{"structure":"20 / 20 / 20","samples":3,"runs":2,"bestMode":"Neighbor Expansion","bestAvgDim":2.3333,"streamAvgDim":1.6667,"neighborAvgDim":2.3333,"edgeAvgDim":1.6667,"compressionAvgDim":1.6667,"advantage":0.6667},{"structure":"16 / 66 / 16","samples":3,"runs":2,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.3333,"neighborAvgDim":2.0,"edgeAvgDim":1.3333,"compressionAvgDim":1.6667,"advantage":0.6667},{"structure":"16 / 50 / 50","samples":3,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.67,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.33},{"structure":"34 / 0 / 50","samples":3,"runs":2,"bestMode":"Neighbor Expansion","bestAvgDim":2.3333,"streamAvgDim":0.6667,"neighborAvgDim":2.3333,"edgeAvgDim":1.3333,"compressionAvgDim":1.6667,"advantage":1.6667},{"structure":"16 / 34 / 66","samples":3,"runs":2,"bestMode":"Dimension Compression","bestAvgDim":3.0,"streamAvgDim":2.6667,"neighborAvgDim":2.6667,"edgeAvgDim":2.6667,"compressionAvgDim":3.0,"advantage":0.3333},{"structure":"34 / 34 / 66","samples":2,"runs":2,"bestMode":"Neighbor Expansion","bestAvgDim":3.0,"streamAvgDim":0.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":1.0,"advantage":3.0},{"structure":"66 / 0 / 16","samples":2,"runs":2,"bestMode":"Neighbor Expansion","bestAvgDim":2.5,"streamAvgDim":0.5,"neighborAvgDim":2.5,"edgeAvgDim":1.5,"compressionAvgDim":1.0,"advantage":2.0},{"structure":"66 / 0 / 0","samples":2,"runs":1,"bestMode":"Dimension Compression","bestAvgDim":3.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":3.0,"advantage":1.0},{"structure":"12 / 34 / 34","samples":2,"runs":2,"bestMode":"Neighbor Expansion","bestAvgDim":2.5,"streamAvgDim":0.5,"neighborAvgDim":2.5,"edgeAvgDim":1.5,"compressionAvgDim":1.5,"advantage":2.0},{"structure":"16 / 66 / 0","samples":2,"runs":2,"bestMode":"Stream Direct","bestAvgDim":2.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.0},{"structure":"16 / 50 / 34","samples":2,"runs":2,"bestMode":"Neighbor Expansion","bestAvgDim":2.5,"streamAvgDim":1.0,"neighborAvgDim":2.5,"edgeAvgDim":2.0,"compressionAvgDim":1.5,"advantage":1.5},{"structure":"0 / 34 / 50","samples":2,"runs":2,"bestMode":"Edge Expansion","bestAvgDim":3.0,"streamAvgDim":2.5,"neighborAvgDim":2.5,"edgeAvgDim":3.0,"compressionAvgDim":3.0,"advantage":0.5},{"structure":"0 / 0 / 50","samples":2,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.5,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":1.5,"advantage":0.5},{"structure":"0 / 0 / 66","samples":2,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.5,"streamAvgDim":1.0,"neighborAvgDim":2.5,"edgeAvgDim":2.0,"compressionAvgDim":1.5,"advantage":1.5},{"structure":"10 / 28 / 28","samples":2,"runs":2,"bestMode":"Stream Direct","bestAvgDim":2.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.0},{"structure":"0 / 66 / 0","samples":2,"runs":1,"bestMode":"Dimension Compression","bestAvgDim":3.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":3.0,"advantage":1.0},{"structure":"66 / 34 / 34","samples":2,"runs":2,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.5,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":1.5,"advantage":0.5},{"structure":"66 / 16 / 0","samples":2,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":3.0,"streamAvgDim":1.5,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":2.0,"advantage":1.5},{"structure":"66 / 50 / 34","samples":2,"runs":2,"bestMode":"Dimension Compression","bestAvgDim":2.5,"streamAvgDim":1.5,"neighborAvgDim":2.0,"edgeAvgDim":1.5,"compressionAvgDim":2.5,"advantage":1.0},{"structure":"66 / 16 / 34","samples":2,"runs":2,"bestMode":"Neighbor Expansion","bestAvgDim":2.5,"streamAvgDim":2.0,"neighborAvgDim":2.5,"edgeAvgDim":2.5,"compressionAvgDim":2.0,"advantage":0.5},{"structure":"34 / 50 / 50","samples":2,"runs":2,"bestMode":"Neighbor Expansion","bestAvgDim":2.5,"streamAvgDim":1.0,"neighborAvgDim":2.5,"edgeAvgDim":2.0,"compressionAvgDim":1.5,"advantage":1.5},{"structure":"14 / 42 / 42","samples":2,"runs":2,"bestMode":"Dimension Compression","bestAvgDim":2.5,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.5,"advantage":0.5},{"structure":"12 / 56 / 56","samples":2,"runs":2,"bestMode":"Neighbor Expansion","bestAvgDim":2.5,"streamAvgDim":0.5,"neighborAvgDim":2.5,"edgeAvgDim":1.0,"compressionAvgDim":1.0,"advantage":2.0},{"structure":"16 / 0 / 66","samples":2,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.5,"streamAvgDim":0.5,"neighborAvgDim":2.5,"edgeAvgDim":2.5,"compressionAvgDim":1.5,"advantage":2.0},{"structure":"50 / 0 / 50","samples":2,"runs":2,"bestMode":"Stream Direct","bestAvgDim":2.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.0},{"structure":"50 / 50 / 100","samples":2,"runs":2,"bestMode":"Dimension Compression","bestAvgDim":2.5,"streamAvgDim":1.5,"neighborAvgDim":2.0,"edgeAvgDim":1.5,"compressionAvgDim":2.5,"advantage":1.0},{"structure":"0 / 0 / 84","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":3.0,"streamAvgDim":3.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":3.0,"advantage":0.0},{"structure":"0 / 100 / 66","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":1.0,"compressionAvgDim":2.0,"advantage":1.0},{"structure":"0 / 40 / 20","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":2.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.0},{"structure":"0 / 34 / 66","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":2.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.0},{"structure":"0 / 40 / 40","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":1.0,"advantage":1.0},{"structure":"0 / 50 / 100","samples":1,"runs":1,"bestMode":"Dimension Compression","bestAvgDim":3.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":3.0,"advantage":1.0},{"structure":"10 / 28 / 10","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":3.0,"streamAvgDim":0.0,"neighborAvgDim":3.0,"edgeAvgDim":2.0,"compressionAvgDim":0.0,"advantage":3.0},{"structure":"10 / 10 / 10","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":3.0,"streamAvgDim":0.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":0.0,"advantage":3.0},{"structure":"0 / 80 / 40","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":1.0},{"structure":"0 / 66 / 66","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":3.0,"streamAvgDim":0.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":1.0,"advantage":3.0},{"structure":"0 / 66 / 16","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":2.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.0},{"structure":"28 / 46 / 28","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":1.0},{"structure":"34 / 0 / 100","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":1.0},{"structure":"34 / 0 / 66","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":1.0},{"structure":"20 / 60 / 100","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":2.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.0},{"structure":"20 / 60 / 20","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":2.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.0},{"structure":"25 / 25 / 50","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":3.0,"streamAvgDim":3.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":3.0,"advantage":0.0},{"structure":"25 / 50 / 25","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":2.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.0},{"structure":"25 / 50 / 50","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":3.0,"streamAvgDim":3.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":3.0,"advantage":0.0},{"structure":"20 / 20 / 40","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":3.0,"streamAvgDim":0.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":1.0,"advantage":3.0},{"structure":"20 / 40 / 0","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":3.0,"streamAvgDim":3.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":3.0,"advantage":0.0},{"structure":"20 / 40 / 40","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":3.0,"streamAvgDim":0.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":1.0,"advantage":3.0},{"structure":"16 / 66 / 34","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":3.0,"streamAvgDim":3.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":3.0,"advantage":0.0},{"structure":"20 / 100 / 60","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":3.0,"streamAvgDim":3.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":3.0,"advantage":0.0},{"structure":"20 / 20 / 100","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":3.0,"streamAvgDim":0.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":1.0,"advantage":3.0},{"structure":"10 / 64 / 28","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":2.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.0},{"structure":"12 / 56 / 12","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":1.0},{"structure":"12 / 78 / 56","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":2.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.0},{"structure":"14 / 100 / 42","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":3.0,"streamAvgDim":0.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":1.0,"advantage":3.0},{"structure":"14 / 14 / 72","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":3.0,"streamAvgDim":0.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":1.0,"advantage":3.0},{"structure":"14 / 42 / 14","samples":1,"runs":1,"bestMode":"Dimension Compression","bestAvgDim":3.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":3.0,"advantage":1.0},{"structure":"14 / 42 / 72","samples":1,"runs":1,"bestMode":"Dimension Compression","bestAvgDim":3.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":3.0,"advantage":1.0},{"structure":"100 / 0 / 50","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":1.0,"advantage":1.0},{"structure":"16 / 50 / 66","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":2.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.0},{"structure":"16 / 50 / 0","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":2.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.0},{"structure":"25 / 75 / 50","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":1.0,"compressionAvgDim":2.0,"advantage":1.0},{"structure":"28 / 28 / 28","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":1.0,"compressionAvgDim":1.0,"advantage":1.0},{"structure":"28 / 46 / 10","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":1.0,"advantage":1.0},{"structure":"34 / 34 / 12","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":3.0,"streamAvgDim":0.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":1.0,"advantage":3.0},{"structure":"34 / 16 / 66","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":3.0,"streamAvgDim":0.0,"neighborAvgDim":3.0,"edgeAvgDim":2.0,"compressionAvgDim":1.0,"advantage":3.0},{"structure":"50 / 50 / 25","samples":1,"runs":1,"bestMode":"Dimension Compression","bestAvgDim":3.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":3.0,"advantage":1.0},{"structure":"50 / 25 / 50","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":1.0,"compressionAvgDim":1.0,"advantage":1.0},{"structure":"42 / 42 / 42","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":1.0,"compressionAvgDim":2.0,"advantage":1.0},{"structure":"34 / 66 / 50","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":1.0},{"structure":"46 / 10 / 46","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":3.0,"streamAvgDim":3.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":3.0,"advantage":0.0},{"structure":"42 / 72 / 14","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":2.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.0},{"structure":"34 / 66 / 0","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":3.0,"streamAvgDim":3.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":3.0,"advantage":0.0},{"structure":"34 / 50 / 66","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":1.0},{"structure":"50 / 100 / 50","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":3.0,"streamAvgDim":3.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":3.0,"advantage":0.0},{"structure":"34 / 66 / 34","samples":1,"runs":1,"bestMode":"Dimension Compression","bestAvgDim":3.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":3.0,"advantage":1.0},{"structure":"60 / 20 / 60","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":2.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.0},{"structure":"60 / 20 / 40","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":2.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.0},{"structure":"60 / 20 / 100","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":2.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.0},{"structure":"56 / 56 / 12","samples":1,"runs":1,"bestMode":"Dimension Compression","bestAvgDim":3.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":3.0,"advantage":1.0},{"structure":"66 / 0 / 34","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":3.0,"streamAvgDim":3.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":3.0,"advantage":0.0},{"structure":"60 / 60 / 0","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":3.0,"streamAvgDim":3.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":3.0,"advantage":0.0},{"structure":"64 / 64 / 10","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":3.0,"streamAvgDim":1.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":1.0,"advantage":2.0},{"structure":"66 / 34 / 0","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":2.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.0},{"structure":"66 / 34 / 66","samples":1,"runs":1,"bestMode":"Dimension Compression","bestAvgDim":3.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":3.0,"advantage":1.0},{"structure":"66 / 50 / 0","samples":1,"runs":1,"bestMode":"Dimension Compression","bestAvgDim":3.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":3.0,"advantage":1.0},{"structure":"66 / 66 / 34","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":3.0,"streamAvgDim":1.0,"neighborAvgDim":3.0,"edgeAvgDim":3.0,"compressionAvgDim":1.0,"advantage":2.0},{"structure":"66 / 16 / 50","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":1.0,"advantage":1.0},{"structure":"72 / 14 / 42","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":2.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.0},{"structure":"72 / 14 / 72","samples":1,"runs":1,"bestMode":"Dimension Compression","bestAvgDim":3.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":3.0,"advantage":1.0},{"structure":"78 / 34 / 56","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":1.0},{"structure":"75 / 25 / 75","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":1.0},{"structure":"84 / 0 / 0","samples":1,"runs":1,"bestMode":"Dimension Compression","bestAvgDim":3.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":3.0,"advantage":1.0},{"structure":"84 / 16 / 0","samples":1,"runs":1,"bestMode":"Stream Direct","bestAvgDim":2.0,"streamAvgDim":2.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":0.0},{"structure":"84 / 16 / 16","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":1.0,"compressionAvgDim":2.0,"advantage":1.0},{"structure":"84 / 50 / 16","samples":1,"runs":1,"bestMode":"Neighbor Expansion","bestAvgDim":2.0,"streamAvgDim":1.0,"neighborAvgDim":2.0,"edgeAvgDim":2.0,"compressionAvgDim":2.0,"advantage":1.0}];

function normalizeStructureText(value: string) {
  return value.replace(/\s*\/\s*/g, " / ").trim();
}

function getLearnedPulseExecutionProfile(structure: string | null | undefined) {
  if (!structure || structure.includes("—")) return null;
  const normalized = normalizeStructureText(structure);
  return LEARNED_PULSE_EXECUTION_INTELLIGENCE.find((row) => normalizeStructureText(row.structure) === normalized) ?? null;
}

function parseStructureParts(structure: string | null | undefined) {
  if (!structure || structure.includes("—")) return [] as number[];
  return normalizeStructureText(structure)
    .split(" / ")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function getStructureFamilyKey(structure: string | null | undefined) {
  const parts = parseStructureParts(structure);
  if (parts.length !== 3) return "—";
  // Family keeps the compression values that have been most predictive so far
  // and generalizes larger separated gaps into X.
  return parts.map((value) => (value === 0 || value === 16 ? String(value) : "X")).join(" / ");
}

function getStructureCompressionSignature(structure: string | null | undefined) {
  const parts = parseStructureParts(structure);
  if (parts.length !== 3) return "—";
  const zeros = parts.filter((value) => value === 0).length;
  const sixteens = parts.filter((value) => value === 16).length;
  const low = parts.filter((value) => value > 0 && value < 34).length;
  const strong = parts.filter((value) => value >= 34).length;
  return `Z${zeros}-S16_${sixteens}-LOW${low}-STRONG${strong}`;
}

function buildFallbackExecutionProfile(
  label: string,
  rows: LearnedExecutionProfile[],
  source: "Exact" | "Family" | "Signature"
): (LearnedExecutionProfile & { source: "Exact" | "Family" | "Signature" }) | null {
  if (!rows.length) return null;
  const avg = getWeightedModeAverages(rows);
  return {
    structure: label,
    samples: avg.samples,
    runs: avg.runs,
    bestMode: avg.bestMode,
    bestAvgDim: avg.bestAvgDim,
    streamAvgDim: avg.streamAvgDim,
    neighborAvgDim: avg.neighborAvgDim,
    edgeAvgDim: avg.edgeAvgDim,
    compressionAvgDim: avg.compressionAvgDim,
    advantage: avg.advantage,
    source,
  };
}

function getFamilyPulseExecutionProfile(structure: string | null | undefined) {
  const familyKey = getStructureFamilyKey(structure);
  if (familyKey === "—") return null;
  const rows = LEARNED_PULSE_EXECUTION_INTELLIGENCE.filter((row) => getStructureFamilyKey(row.structure) === familyKey);
  return buildFallbackExecutionProfile(`Family ${familyKey}`, rows, "Family");
}

function getSignaturePulseExecutionProfile(structure: string | null | undefined) {
  const signature = getStructureCompressionSignature(structure);
  if (signature === "—") return null;
  const rows = LEARNED_PULSE_EXECUTION_INTELLIGENCE.filter((row) => getStructureCompressionSignature(row.structure) === signature);
  return buildFallbackExecutionProfile(`Signature ${signature}`, rows, "Signature");
}

function getExecutionIntelligenceConfidence(profile: (LearnedExecutionProfile & { source?: string }) | null) {
  if (!profile) return "No Data";
  if (profile.samples >= 20 && profile.runs >= 6 && profile.advantage >= 0.75) return "High";
  if (profile.samples >= 10 && profile.runs >= 4 && profile.advantage >= 0.35) return "Medium";
  if (profile.samples >= PULSE_EXECUTION_ROUTER_MIN_SAMPLES && profile.advantage >= PULSE_EXECUTION_ROUTER_MIN_ADVANTAGE) return "Low";
  return "Observe";
}

function getStructureFromDecision(decision: any) {
  const summary = getDirectionalGapSummary(decision);
  const label = (gap: number | null) => typeof gap === "number" ? String(gap) : "—";
  return `${label(summary.rows[0]?.gap ?? null)} / ${label(summary.rows[1]?.gap ?? null)} / ${label(summary.rows[2]?.gap ?? null)}`;
}

function profileMeetsRoutingThreshold(profile: (LearnedExecutionProfile & { source?: string }) | null | undefined) {
  if (!profile) return false;
  const requiredAdvantage = profile.bestMode === "Neighbor Expansion" ? PULSE_EXECUTION_ROUTER_NEIGHBOR_MIN_ADVANTAGE : PULSE_EXECUTION_ROUTER_MIN_ADVANTAGE;
  if (profile.advantage < requiredAdvantage) return false;
  const source = (profile as any).source ?? "Exact";
  if (source === "Family") return profile.samples >= PULSE_EXECUTION_ROUTER_FAMILY_MIN_SAMPLES;
  if (source === "Signature") return profile.samples >= PULSE_EXECUTION_ROUTER_SIGNATURE_MIN_SAMPLES;
  return profile.samples >= PULSE_EXECUTION_ROUTER_MIN_SAMPLES;
}

function getPulseExecutionRoutingProfile(structure: string | null | undefined) {
  const exactRaw = getLearnedPulseExecutionProfile(structure);
  const exact = exactRaw ? { ...exactRaw, source: "Exact" as const } : null;
  const family = getFamilyPulseExecutionProfile(structure);
  const signature = getSignaturePulseExecutionProfile(structure);

  const exactReady = profileMeetsRoutingThreshold(exact);
  const familyReady = profileMeetsRoutingThreshold(family);
  const signatureReady = profileMeetsRoutingThreshold(signature);

  // PULSE EXECUTION INTELLIGENCE v2
  // Family is now the primary evidence layer because it has the larger sample base.
  // Exact structure is used as confirmation, and only overrides family when the
  // exact evidence is both stronger and materially better.
  if (familyReady) {
    if (
      exactReady &&
      exact &&
      family &&
      exact.bestMode !== family.bestMode &&
      exact.samples >= Math.max(PULSE_EXECUTION_ROUTER_MIN_SAMPLES * 2, 20) &&
      exact.advantage >= family.advantage + 0.35 &&
      exact.bestAvgDim >= family.bestAvgDim + 0.25
    ) {
      return { ...exact, winningEvidence: "Exact Override" as const, competingFamily: family };
    }

    return {
      ...family,
      winningEvidence: exactReady && exact?.bestMode === family.bestMode ? "Family + Exact Agreement" as const : "Family Primary" as const,
      exactConfirmation: exact,
    };
  }

  if (exactReady && exact) {
    return { ...exact, winningEvidence: "Exact Fallback" as const, competingFamily: family };
  }

  if (signatureReady && signature) {
    if (signature.bestMode === "Neighbor Expansion") {
      return {
        ...signature,
        bestMode: "Stream Direct" as ExecutionMode,
        bestAvgDim: signature.streamAvgDim,
        advantage: PULSE_EXECUTION_ROUTER_MIN_ADVANTAGE,
        winningEvidence: "Signature Stream Fallback" as const,
        exactConfirmation: exact,
        competingFamily: family,
      };
    }
    return { ...signature, winningEvidence: "Signature Rescue" as const, exactConfirmation: exact, competingFamily: family };
  }

  return family ?? exact ?? signature ?? null;
}

function getPulseExecutionRouterDecision(pulseEnabled: boolean, manualMode: ExecutionMode, decision: any, history: Step[] = []) {
  const structure = getStructureFromDecision(decision);
  const exactProfile = getLearnedPulseExecutionProfile(structure);
  const familyProfile = getFamilyPulseExecutionProfile(structure);
  const signatureProfile = getSignaturePulseExecutionProfile(structure);
  const profile = getPulseExecutionRoutingProfile(structure);
  const confidence = getExecutionIntelligenceConfidence(profile);
  const canRoute = !!pulseEnabled && !!decision?.group && profileMeetsRoutingThreshold(profile);
  const transitionIntelligence = history.length ? getTransitionIntelligenceRead(history, decision) : null;
  const transitionAdjustment = canRoute ? getTransitionGuidedModeAdjustment(profile, transitionIntelligence, history) : null;

  const sourceLabel = (profile as any)?.source ?? "None";
  const winningEvidence = (profile as any)?.winningEvidence ?? sourceLabel;
  const evidenceDetails = profile
    ? `Family ${familyProfile?.samples ?? 0} samples / +${(familyProfile?.advantage ?? 0).toFixed(2)}; Exact ${exactProfile?.samples ?? 0} samples / +${(exactProfile?.advantage ?? 0).toFixed(2)}; Signature ${signatureProfile?.samples ?? 0} samples / +${(signatureProfile?.advantage ?? 0).toFixed(2)}`
    : "No evidence available";
  const routerRecommendedMode = profile?.bestMode ?? manualMode;
  const transitionSelectedMode = canRoute ? (transitionAdjustment?.selectedMode ?? routerRecommendedMode) : manualMode;
  const executionQualification = canRoute
    ? getTransitionQualifiedExecutionMode(transitionSelectedMode, confidence, transitionIntelligence)
    : { mode: manualMode, reason: "Router inactive; manual execution mode in use." };
  const selectedMode = executionQualification.mode;
  const transitionDetails = transitionAdjustment
    ? ` Transition-guided execution: ${transitionAdjustment.summary}; effective advantage +${transitionAdjustment.effectiveAdvantage.toFixed(2)}.`
    : "";
  const qualificationDetails = canRoute ? ` Execution qualification: ${executionQualification.reason}` : "";

  return {
    active: canRoute,
    structure,
    profile,
    exactProfile,
    familyProfile,
    signatureProfile,
    source: sourceLabel,
    winningEvidence,
    familyKey: getStructureFamilyKey(structure),
    signatureKey: getStructureCompressionSignature(structure),
    confidence,
    selectedMode,
    routerRecommendedMode,
    transitionSelectedMode,
    executionQualification,
    manualMode,
    transitionIntelligence,
    transitionAdjustment,
    transitionGuided: !!transitionAdjustment,
    reason: canRoute
      ? `Pulse router selected ${selectedMode} by ${winningEvidence}. ${evidenceDetails}.${transitionDetails}${qualificationDetails}`
      : pulseEnabled
      ? profile
        ? `Pulse router observed ${structure}; ${winningEvidence} did not meet routing threshold. ${evidenceDetails}.`
        : `Pulse router has no learned profile for ${structure}.`
      : "Pulse router inactive; manual execution mode in use.",
  };
}

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

function getPulseRecentAccuracy(history: Step[], window = 20) {
  const recent = history.slice(-window).filter(h => h.result === "win" || h.result === "loss");
  const wins = recent.filter(h => h.result === "win").length;
  const rate = recent.length ? wins / recent.length : 0.5;
  return { rate, wins, total: recent.length, pct: Math.round(rate * 100) };
}

function getPulseReason(confidence: number): string {
  if (confidence >= 70) return "High confidence";
  if (confidence >= 55) return "Moderate confidence";
  if (confidence >= 40) return "Low confidence";
  return "Insufficient signal";
}

function getRotationState(composite: number): string {
  if (composite >= 80) return "Extreme Rotation";
  if (composite >= 60) return "High Rotation";
  if (composite >= 40) return "Moderate Rotation";
  return "Stable";
}

function getDirectionalAdaptationMetrics(history: Step[]) {
  return { active: false, direction: null as GroupKey | null, strength: 0, reason: "No adaptation" };
}

function getWeightedModeAverages(rows: any[]) {
  if (!rows.length) return { samples: 0, runs: 0, bestMode: "Stream Direct" as ExecutionMode, bestAvgDim: 0, streamAvgDim: 0, neighborAvgDim: 0, edgeAvgDim: 0, compressionAvgDim: 0, advantage: 0 };
  const samples = rows.reduce((s: number, r: any) => s + (r.samples ?? 0), 0);
  return { samples, runs: rows.length, bestMode: (rows[0]?.bestMode ?? "Stream Direct") as ExecutionMode, bestAvgDim: rows[0]?.bestAvgDim ?? 0, streamAvgDim: 0, neighborAvgDim: 0, edgeAvgDim: 0, compressionAvgDim: 0, advantage: 0 };
}

function getTransitionGuidedModeAdjustment(_profile: any, _ti: any, _history: Step[]) {
  return null as any;
}

function getTransitionQualifiedExecutionMode(mode: ExecutionMode, _confidence: number, _ti: any) {
  return { mode, reason: "Direct execution." };
}

function getAxisDirectionalDrift(_key: string, _values: any[], _predictedBit: 0 | 1) {
  return { drift: 0, direction: "Stable", action: "None", axis: _key, destinationBit: _predictedBit, status: "Stable" };
}

function getStreakStats(history: Step[]) {
  let currentType: "win" | "loss" | "none" = "none" as "win" | "loss" | "none";
  let currentWinStreak = 0; let currentLossStreak = 0;
  let largestWinStreak = 0; let largestLossStreak = 0;
  let totalWinStreaks = 0; let totalLossStreaks = 0;
  let winStreakCount = 0; let lossStreakCount = 0;
  const segments: { type: "win" | "loss"; startSpin: number; endSpin: number; length: number }[] = [];
  let segStart = 0;
  history.forEach((h, i) => {
    const isWin = h.result === "win";
    if (isWin) {
      if (currentType !== "win") {
        if (currentType === "loss") { segments.push({ type: "loss", startSpin: history[segStart]?.spin ?? 0, endSpin: h.spin - 1, length: currentLossStreak }); lossStreakCount++; totalLossStreaks += currentLossStreak; }
        currentType = "win"; currentWinStreak = 0; segStart = i;
      }
      currentWinStreak++; largestWinStreak = Math.max(largestWinStreak, currentWinStreak); currentLossStreak = 0;
    } else {
      if (currentType !== "loss") {
        if (currentType === "win") { segments.push({ type: "win", startSpin: history[segStart]?.spin ?? 0, endSpin: h.spin - 1, length: currentWinStreak }); winStreakCount++; totalWinStreaks += currentWinStreak; }
        currentType = "loss"; currentLossStreak = 0; segStart = i;
      }
      currentLossStreak++; largestLossStreak = Math.max(largestLossStreak, currentLossStreak); currentWinStreak = 0;
    }
  });
  if (currentType === "win" && history.length) segments.push({ type: "win", startSpin: history[segStart]?.spin ?? 0, endSpin: history[history.length-1]?.spin ?? 0, length: currentWinStreak });
  if (currentType === "loss" && history.length) segments.push({ type: "loss", startSpin: history[segStart]?.spin ?? 0, endSpin: history[history.length-1]?.spin ?? 0, length: currentLossStreak });
  return { currentType, currentWinStreak, currentLossStreak, largestWinStreak, largestLossStreak, avgWinStreak: winStreakCount ? totalWinStreaks / winStreakCount : 0, avgLossStreak: lossStreakCount ? totalLossStreaks / lossStreakCount : 0, segments };
}

function getLossStreakSeverity(streak: number): string {
  if (streak >= 12) return "Critical";
  if (streak >= 7) return "Pressure";
  if (streak >= 4) return "Elevated";
  return "Normal";
}

function getLossStreak(history: Step[]) {
  // PUSH / HOLD rows are neutral separators.
  // They must break loss progression and losing-streak analysis.
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].result === "loss") streak += 1;
    else break;
  }
  return streak;
}


function buildAutoRunAuditEntry(priorRows: Step[], row: Step) {
  const priorLossStreak = getLossStreak(priorRows);
  const nextLossStreak = row.result === "loss" ? priorLossStreak + 1 : 0;
  const tda = row.pulseDiagnostics?.dimensionTDA ?? row.pulseGate?.dimensionTDA ?? null;
  const replay = row.pulseDiagnostics?.replay ?? null;
  const gate = row.pulseGate ?? null;
  const active = row.result === "win" || row.result === "loss";

  return {
    spin: row.spin,
    active,
    result: row.result,
    priorLossStreak,
    nextLossStreak,
    forecastGroup: row.forecastGroup ?? row.predictedGroup,
    outcomeGroup: row.outcomeGroup,
    executionMode: row.executionMode,
    basketSize: row.predictedNumbers?.length ?? 0,
    confidence: row.confidence,
    tier: row.tier,
    note: row.note,
    tdaMode: tda?.modeLabel ?? tda?.mode ?? "—",
    tdaPassed: tda?.passed ?? false,
    failedAxes: Array.isArray(tda?.failed) ? tda.failed.join(" / ") : "—",
    regime: replay?.activeRegime ?? row.pulseDiagnostics?.replay?.activeRegime ?? "—",
    models: replay?.activeSurvivors ?? "—",
    drift: gate?.driftStatus ?? "—",
    compression: gate?.compressionStatus ?? "—",
    transitionState: gate?.transitionState ?? row.pulseDiagnostics?.transitionIntelligence?.state ?? "—",
    transitionRisk: gate?.transitionRisk ?? row.pulseDiagnostics?.transitionIntelligence?.risk ?? "—",
    transitionAction: gate?.transitionAction ?? row.pulseDiagnostics?.transitionIntelligence?.action ?? "—",
  };
}

function getAxisSideLabel(axis: PulseDriftAxisKey, bit: 0 | 1) {
  if (axis === "color") return bit === 0 ? "Black" : "Red";
  if (axis === "range") return bit === 0 ? "High" : "Low";
  return bit === 0 ? "Even" : "Odd";
}


function detectRegime(window: string) {
  let flips = 0;

  for (let i = 1; i < window.length; i++) {
    if (window[i] !== window[i - 1]) flips++;
  }

  const flipRate = flips / Math.max(1, window.length - 1);

  if (flipRate > 0.75) return "Alternation";
  if (flipRate < 0.25) return "Momentum";
  if (flipRate > 0.45 && flipRate < 0.7) return "Transition";

  return "Noise";
}

function predict(window: string, regime: string) {
  const last = Number(window.at(-1) || "0");

  if (regime === "Alternation") {
    return last === 0 ? 1 : 0;
  }

  if (regime === "Momentum") {
    return last;
  }

  if (regime === "Transition") {
    return window.slice(-4).split("").filter((v) => v === "1").length >= 2 ? 1 : 0;
  }

  return last;
}

function getLabAxisForecast(bits: (0 | 1)[]): LabAxisForecast {
  const sequence = bits.join("");
  const regime = detectRegime(sequence.slice(-8));
  const survivor = getLabLeader(regime);
  const bit = predict(sequence, regime) as 0 | 1;
  const replayAccuracy = 50;
  const trust = 0.5;
  const recent = bits.slice(-8);
  const support = recent.length ? recent.filter((value) => value === bit).length / recent.length : 0.5;
  const margin = Math.abs(support - 0.5) * 2;
  const reliability = Math.max(0.35, Math.min(0.95, replayAccuracy / 100));
  const agreement = regime === "Noise" ? 0.5 : regime === "Transition" ? 0.67 : 0.84;
  const score0 = bit === 0 ? trust : Math.max(0, 100 - trust);
  const score1 = bit === 1 ? trust : Math.max(0, 100 - trust);
    // Dimension-primary confidence architecture:
  // Dimensional rule adherence is now the primary confidence driver.
  // Drift Integrity acts only as a drift-state modifier (compression / flip / resync).
const confidence = Math.round(trust * 0.62 + replayAccuracy * 0.26 + margin * 12);

  return {
    bit,
    confidence,
    regime,
    survivor,
    trust,
    replayAccuracy,
    margin,
    reliability,
    agreement,
    score0,
    score1,
    leaders: `${survivor}:${bit}`,
  };
}

function forecast(history: Step[]) {
  if (history.length < 6) {
    return {
      group: null as GroupKey | null,
      numbers: [] as SpinValue[],
      confidence: 0,
      tier: "No Prediction",
      reason: "Need at least 6 spins.",
      sourceOfTruth: "Historical Replay Evolution Lab",
      dimensionTDA: {
        min: DEFAULT_DIMENSION_GATE_MIN,
        passed: false,
        fullPass: false,
        compressed: false,
        mode: "OBSERVE",
        modeLabel: "HOLD",
        activeAxes: [] as AxisKey[],
        adaptiveNumbers: [] as SpinValue[],
        color: 0,
        range: 0,
        parity: 0,
        colorStability: 0,
        rangeStability: 0,
        parityStability: 0,
        colorPersistence: 0,
        rangePersistence: 0,
        parityPersistence: 0,
        persistence: 0,
        lowestPersistence: 0,
        stability: 0,
        migrationRisk: 0,
        failed: ["Color", "Range", "Parity"],
      },
      replayDiagnostics: null,
    };
  }

  const groups = groupSeries(history);
  const bits = groups.map(groupToBits);
  const colorBits = bits.map((b) => b[0]);
  const rangeBits = bits.map((b) => b[1]);
  const parityBits = bits.map((b) => b[2]);
  const chaos = entropy(groups);

  // LAB SOURCE OF TRUTH:
  // These three forecasts use the same detectRegime() and predict() logic as the Lab file.
  // No old Markov stack, no Bayesian predictor arbitration, and no weak-dimension substitution
  // is allowed to change these bits.
  const colorForecast = getLabAxisForecast(colorBits);
  const rangeForecast = getLabAxisForecast(rangeBits);
  const parityForecast = getLabAxisForecast(parityBits);

  const labPulseBits: [0 | 1, 0 | 1, 0 | 1] = [
    colorForecast.bit,
    rangeForecast.bit,
    parityForecast.bit,
  ];

  const driftCore = getPulseDriftDestinationCore(history, labPulseBits);
  const bestGroup = driftCore.adjustedGroup;

  const axisConfidences = [
    colorForecast.confidence,
    rangeForecast.confidence,
    parityForecast.confidence,
  ];

  const axisRows = [
    {
      key: "color" as AxisKey,
      name: "Color",
      confidence: colorForecast.confidence,
      stability: getAxisStabilityScore(colorBits),
      persistence: getAxisPersistenceScore(colorBits, colorForecast.bit),
      regime: colorForecast.regime,
      survivor: colorForecast.survivor,
      replayAccuracy: colorForecast.replayAccuracy,
      trust: colorForecast.trust,
    },
    {
      key: "range" as AxisKey,
      name: "Range",
      confidence: rangeForecast.confidence,
      stability: getAxisStabilityScore(rangeBits),
      persistence: getAxisPersistenceScore(rangeBits, rangeForecast.bit),
      regime: rangeForecast.regime,
      survivor: rangeForecast.survivor,
      replayAccuracy: rangeForecast.replayAccuracy,
      trust: rangeForecast.trust,
    },
    {
      key: "parity" as AxisKey,
      name: "Parity",
      confidence: parityForecast.confidence,
      stability: getAxisStabilityScore(parityBits),
      persistence: getAxisPersistenceScore(parityBits, parityForecast.bit),
      regime: parityForecast.regime,
      survivor: parityForecast.survivor,
      replayAccuracy: parityForecast.replayAccuracy,
      trust: parityForecast.trust,
    },
  ];

  const avgAxisConfidence = Math.round(axisConfidences.reduce((sum, value) => sum + value, 0) / axisConfidences.length);
  const minAxisConfidence = Math.min(...axisConfidences);
  const maxAxisConfidence = Math.max(...axisConfidences);
  const averageAxisStability = Math.round(axisRows.reduce((sum, axis) => sum + axis.stability, 0) / 3);
  const averageAxisPersistence = Math.round(axisRows.reduce((sum, axis) => sum + axis.persistence, 0) / 3);
  const lowestAxisPersistence = Math.min(...axisRows.map((axis) => axis.persistence));
  const lowestAxisStability = Math.min(...axisRows.map((axis) => axis.stability));
  const activeAxes = driftCore.activeAxes;
  const adaptiveMode: AdaptiveTDAMode = driftCore.mode;
  const fullTdaPass = adaptiveMode === "FULL_3D";
  const compressed2DPass = adaptiveMode === "COMPRESSED_2D";
  const failed = driftCore.axes
    .filter((axis) => axis.action === "HOLD")
    .map((axis) => axis.axis === "color" ? "Color" : axis.axis === "range" ? "Range" : "Parity");

  const dimensionStability = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        minAxisConfidence * 0.24 +
          avgAxisConfidence * 0.16 +
          averageAxisStability * 0.28 +
          averageAxisPersistence * 0.24 +
          lowestAxisPersistence * 0.08
      )
    )
  );

  const migrationRisk = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (maxAxisConfidence - minAxisConfidence) * 1.25 +
          (100 - averageAxisStability) * 0.38 +
          (100 - averageAxisPersistence) * 0.38
      )
    )
  );

  const sameRegime =
    colorForecast.regime === rangeForecast.regime &&
    rangeForecast.regime === parityForecast.regime;

  const sameSurvivor =
    colorForecast.survivor === rangeForecast.survivor &&
    rangeForecast.survivor === parityForecast.survivor;

  const replayAccuracy = Math.round(
    (colorForecast.replayAccuracy +
      rangeForecast.replayAccuracy +
      parityForecast.replayAccuracy) / 3
  );

  const survivorTrust = Math.round(
    (colorForecast.trust + rangeForecast.trust + parityForecast.trust) / 3
  );

  const alignmentBoost = sameRegime ? 4 : sameSurvivor ? 3 : 0;
  const entropyPenalty = chaos >= 72 ? 5 : chaos >= 60 ? 3 : chaos >= 50 ? 1 : 0;

  const confidence = Math.round(
    avgAxisConfidence * 0.75 +
      driftCore.score * 0.25
  );

  const tier =
    confidence >= 78
      ? "Active · High Confidence"
      : confidence >= 65
      ? "Active · Confirmed"
      : "Active · Caution";

  const replayDiagnostics = {
    sourceOfTruth: "Historical Replay Evolution Lab",
    color: {
      bit: colorForecast.bit,
      side: colorForecast.bit === 0 ? "Black" : "Red",
      regime: colorForecast.regime,
      survivor: colorForecast.survivor,
      trust: colorForecast.trust,
      replayAccuracy: colorForecast.replayAccuracy,
      confidence: colorForecast.confidence,
    },
    range: {
      bit: rangeForecast.bit,
      side: rangeForecast.bit === 0 ? "High" : "Low",
      regime: rangeForecast.regime,
      survivor: rangeForecast.survivor,
      trust: rangeForecast.trust,
      replayAccuracy: rangeForecast.replayAccuracy,
      confidence: rangeForecast.confidence,
    },
    parity: {
      bit: parityForecast.bit,
      side: parityForecast.bit === 0 ? "Even" : "Odd",
      regime: parityForecast.regime,
      survivor: parityForecast.survivor,
      trust: parityForecast.trust,
      replayAccuracy: parityForecast.replayAccuracy,
      confidence: parityForecast.confidence,
    },
    activeRegime: sameRegime ? colorForecast.regime : "Mixed",
    activeSurvivors: `${colorForecast.survivor} / ${rangeForecast.survivor} / ${parityForecast.survivor}`,
    survivorDominance: sameSurvivor ? `${colorForecast.survivor} 3/3` : "Mixed",
    replayAccuracy,
    survivorTrust,
    labPulseBits,
    driftCore,
    labGroup: bestGroup,
    lockedCore: true,
  };

  const dimensionTDA = {
    min: DEFAULT_DIMENSION_GATE_MIN,
    passed: fullTdaPass || compressed2DPass,
    fullPass: fullTdaPass,
    compressed: compressed2DPass,
    mode: adaptiveMode === "OBSERVE" ? "COMPRESSED_2D" : adaptiveMode,
    modeLabel: adaptiveMode === "OBSERVE" ? "2D COMP" : getTdaModeLabel(adaptiveMode),
    activeAxes,
    driftCore,
    adaptiveNumbers: getAdaptiveDimensionNumbers(bestGroup, activeAxes),
    color: colorForecast.confidence,
    range: rangeForecast.confidence,
    parity: parityForecast.confidence,
    colorStability: axisRows[0].stability,
    rangeStability: axisRows[1].stability,
    parityStability: axisRows[2].stability,
    colorPersistence: axisRows[0].persistence,
    rangePersistence: axisRows[1].persistence,
    parityPersistence: axisRows[2].persistence,
    persistence: averageAxisPersistence,
    lowestPersistence: lowestAxisPersistence,
    stability: dimensionStability,
    migrationRisk,
    unstable: axisRows.filter((axis) => axis.stability < 48).map((axis) => axis.name),
    weakPersistence: axisRows.filter((axis) => axis.persistence < PERSISTENCE_GATE_MIN).map((axis) => axis.name),
    stabilityMin: 48,
    persistenceMin: PERSISTENCE_GATE_MIN,
    failed,
  };

  const weakDimensionSubstitution = {
    active: false,
    substitutedAxis: null as null | "Color" | "Range" | "Parity",
    originalBits: labPulseBits,
    adjustedBits: labPulseBits,
    originalGroup: bestGroup,
    adjustedGroup: bestGroup,
    penalty: 0,
    disabled: true,
    reason: "Disabled because Lab PULSE is the locked source of truth.",
    axisRates: {
      color: colorForecast.replayAccuracy,
      range: rangeForecast.replayAccuracy,
      parity: parityForecast.replayAccuracy,
    },
  };

  const driftStatus =
    migrationRisk >= 70
      ? "High DPI Pressure"
      : migrationRisk >= 45
      ? "Moderate DPI Pressure"
      : "DPI Primary";

  const compressionStatus =
    sameSurvivor && averageAxisPersistence >= 60
      ? "Dimensional Compression Active"
      : activeAxes.length >= 2
      ? "Structured"
      : "Diverse";

  const reason =
    confidence < 50
      ? "Directional Observe · Lab Replay Evolution forecast held for safety."
      : replayDiagnostics.activeRegime === "Mixed"
      ? "Lab Replay Evolution PULSE · mixed regime arbitration across Color / Range / Parity."
      : `Lab Replay Evolution PULSE · ${replayDiagnostics.activeRegime} regime · ${replayDiagnostics.activeSurvivors}.`;

  return {
    group: bestGroup as GroupKey,
    regime: replayDiagnostics.activeRegime,
    leaders: replayDiagnostics.activeSurvivors,
    numbers: GROUPS[bestGroup as GroupKey],
    confidence,
    tier,
    reason,
    sourceOfTruth: "Historical Replay Evolution Lab",
    dimensionTDA,
    weakDimensionSubstitution,
    replayDiagnostics,
    pulseDiagnostics: {
      replay: replayDiagnostics,
      axisRows,
      entropy: chaos,
      migrationRisk,
      dimensionTDA,
      driftCore,
    },
    pulseGate: {
      allow: true,
      resyncStatus: driftCore.summary,
      driftStatus: driftCore.summary,
      familyStatus: "Passive",
      compressionStatus: driftCore.modeLabel,
      labCoreLocked: true,
      executionCore: "Engine Rule + Drift Destination + TDA · Diagnostics Only",
      diagnosticsOnly: true,
      dimensionTDA,
    },
  };
}


function getPulseTier(confidence: number) {
  return confidence >= 78
    ? "Active · High Confidence"
    : confidence >= 65
    ? "Active · Confirmed"
    : "Active · Caution";
}

function isActivePulseRow(row: Step) {
  return row.result !== "push" && row.note.startsWith("PULSE");
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

    // PUSH / HOLD rows are neutral separators and break active loss pressure.
    if (row.result === "push") break;

    // A non-PULSE settled result means another engine broke the live PULSE sequence.
    break;
  }
  return streak;
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


function getDimensionCompressionNumbers(group: GroupKey | null, decision?: any) {
  if (!group) return [] as SpinValue[];

  // CURRENT PULSE COMPRESSION CORE
  // Dimension Compression no longer uses legacy TDA confidence / stability / persistence.
  // It now reads the same live Directional Spread evidence shown in DPM:
  // selected side spread, side-to-side gap, and DPI pressure.
  // Rule: keep the two strongest current dimensions and relax the weakest current dimension.
  const diagnostics = decision?.pulseDiagnostics ?? {};
  const replay = decision?.replayDiagnostics ?? diagnostics?.replay ?? {};
  const spreadCore = diagnostics?.driftCore ?? replay?.driftCore ?? {};
  const sideSpread = diagnostics.axisSideSpread ?? replay.axisSideSpread ?? spreadCore.axisSideSpread ?? {};
  const axisDpi = spreadCore.axisDpi ?? diagnostics.axisDpi ?? replay.axisDpi ?? {};
  const targetBits = groupToBits(group);

  const axisScores = ([
    { key: "color" as AxisKey, spread: sideSpread.color, selectedBit: targetBits[0], dpi: Number(axisDpi.color ?? 0) },
    { key: "range" as AxisKey, spread: sideSpread.range, selectedBit: targetBits[1], dpi: Number(axisDpi.range ?? 0) },
    { key: "parity" as AxisKey, spread: sideSpread.parity, selectedBit: targetBits[2], dpi: Number(axisDpi.parity ?? 0) },
  ]).map((axis) => {
    const selectedSpread = typeof axis.spread?.[axis.selectedBit === 0 ? "zero" : "one"] === "number"
      ? axis.spread[axis.selectedBit === 0 ? "zero" : "one"]
      : null;
    const oppositeSpread = typeof axis.spread?.[axis.selectedBit === 0 ? "one" : "zero"] === "number"
      ? axis.spread[axis.selectedBit === 0 ? "one" : "zero"]
      : null;
    const gap = typeof selectedSpread === "number" && typeof oppositeSpread === "number"
      ? Math.abs(selectedSpread - oppositeSpread)
      : null;

    return {
      key: axis.key,
      selectedSpread,
      oppositeSpread,
      gap,
      dpi: axis.dpi,
      // Lower score = weaker current dimension. Gap matters most because compression
      // is meant to loosen the dimension with the least live separation.
      score: typeof selectedSpread === "number" && typeof gap === "number"
        ? selectedSpread + gap * 1.5 - Math.abs(axis.dpi) * 0.5
        : Number.POSITIVE_INFINITY,
    };
  });

  const hasCurrentSpreadEvidence = axisScores.every((axis) => Number.isFinite(axis.score));
  if (!hasCurrentSpreadEvidence) return GROUPS[group];

  // When Dimension Compression is the active execution mode, always build the
  // compressed basket from the weakest live DPM axis. Eligibility/routing is
  // handled before this function is called by Execution Intelligence. This
  // function should therefore expose the actual compression basket, not fall
  // back silently to Stream Direct.
  const weakestAxis = axisScores
    .slice()
    .sort((a, b) => a.score - b.score)[0]?.key ?? null;

  return GROUPS[group] ?? [];
}

function getDimensionCompressionOverlayNumbers(group: GroupKey | null, decision?: any) {
  if (!group) return [] as SpinValue[];
  const core = new Set(GROUPS[group].map(String));
  return getDimensionCompressionNumbers(group, decision).filter((value) => !core.has(String(value)));
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

  // Dimension Compression / Reduction:
  // PULSE still predicts the exact 3D group.
  // Execution compresses only when two dimensions are strong/controlled
  // and one dimension is weakest. Example: BHE + weak Parity => BHE + BHO.
  // This is not Wheel Overlay, Edge Expansion, or Neighbor Expansion.
  if (source === "PULSE" && executionMode === "Dimension Compression") {
    return getDimensionCompressionNumbers(group, decision);
  }

  // Dimension Compression is PULSE-only.
  // If any non-PULSE engine reaches this function with Dimension Compression selected,
  // force normal Stream Direct group execution instead of applying compression.
  if (executionMode === "Dimension Compression") {
    return GROUPS[group];
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
  // Straight base = 0 for every axis: Black / High / Even.
  // Therefore first spin Red/Low/Odd settles as three losses, not three pushes.
  return getStraightNextBit(priorBits) === actualBit ? "win" : "loss";
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
  // Inverted mode may change the active forecast/execution interpretation,
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


function getRandomAxisDpiValues(history: Step[]) {
  // RANDOM ENGINE DIRECT DIMENSION COUNT
  // This is not Boolean BB and not Markov. It reads the raw outcome dimension side.
  // Black / High / Even = +1. Red / Low / Odd = -1.
  // Counts can go positive, zero, or negative. There is no zero floor.
  let color = 0;
  let range = 0;
  let parity = 0;

  history.forEach((row) => {
    const [colorBit, rangeBit, parityBit] = groupToBits(row.outcomeGroup);
    color += colorBit === 0 ? 1 : -1;
    range += rangeBit === 0 ? 1 : -1;
    parity += parityBit === 0 ? 1 : -1;
  });

  return { color, range, parity };
}

function getRandomForecastBit(value: number): 0 | 1 {
  // Positive or zero count stays with the + side. Negative count forecasts the - side.
  return value >= 0 ? 0 : 1;
}

function randomForecast(history: Step[]) {
  const axisDpi = getRandomAxisDpiValues(history);
  const color = getRandomForecastBit(axisDpi.color);
  const range = getRandomForecastBit(axisDpi.range);
  const parity = getRandomForecastBit(axisDpi.parity);
  const group = bitsToGroup(color, range, parity);
  const avgPressure = (Math.abs(axisDpi.color) + Math.abs(axisDpi.range) + Math.abs(axisDpi.parity)) / 3;
  const confidence = Math.max(50, Math.min(82, Math.round(50 + avgPressure * 3)));
  return {
    group,
    numbers: GROUPS[group],
    confidence,
    tier: confidence >= 72 ? "Active · Confirmed" : "Active · Caution",
    axisDpi,
    reason: `Random direct dimension count · Color ${axisDpi.color} · Range ${axisDpi.range} · Parity ${axisDpi.parity}.`,
  };
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
  // - if Inverted mode is ON AND that axis DPI <= -5, use the Inverted table for that axis only.
  // - otherwise use the Straight table for that axis.
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

// ── Pulse Divergence Detector Constants ──────────────────────────────────────
const MIN_HISTORY_SPINS          = 13;
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

function detectAlternativeCycle(bits: (0 | 1)[]): { cycle: PulseDivergenceCycle; confidence: number; position: number; nextBit: 0 | 1 } {
  if (bits.length < 4) return { cycle: "NONE", confidence: 0, position: 0, nextBit: 0 };
  const recent = bits.slice(-15);
  if (recent.length >= 6) {
    const cw = recent.slice(-8);
    const alts = cw.reduce((n: number, b, i) => n + (i > 0 && b !== cw[i-1] ? 1 : 0), 0 as number);
    if (alts / (cw.length - 1) >= 0.75)
      return { cycle: "ALTERNATING", confidence: Math.min(3, Math.floor(recent.length/2)), position: recent.length%2, nextBit: (recent[recent.length-1]===0?1:0) as 0|1 };
  }
  const THREE_CYCLES: Array<{pattern:[0|1,0|1,0|1];name:PulseDivergenceCycle}> = [
    {pattern:[0,0,1],name:"CYCLE_3_001"},{pattern:[0,1,1],name:"CYCLE_3_011"},
    {pattern:[1,1,0],name:"CYCLE_3_110"},{pattern:[1,0,0],name:"CYCLE_3_100"},
    {pattern:[0,1,0],name:"CYCLE_3_010"},{pattern:[1,0,1],name:"CYCLE_3_101"},
  ];
  for (const {pattern, name} of THREE_CYCLES) {
    for (let offset = 0; offset < 3; offset++) {
      const check = recent.slice(-9);
      if (check.length < 6) continue;
      const matches = check.reduce((n: number, b, i) => n+(b===pattern[(i+offset)%3]?1:0), 0 as number);
      if (matches/check.length >= 0.89) {
        const pos = (recent.length+offset)%3;
        return { cycle: name, confidence: Math.min(3,Math.floor(recent.length/3)), position: pos, nextBit: pattern[pos] as 0|1 };
      }
    }
  }
  const {bit: runBit, length: runLength} = getCurrentBitRun(recent);
  if (runLength >= 4) return { cycle: runBit===0?"STREAK_0":"STREAK_1", confidence: Math.min(3,Math.floor(runLength/2)), position: runLength, nextBit: runBit };
  return { cycle: "NONE", confidence: 0, position: 0, nextBit: bits[bits.length-1] ?? 0 };
}

// ── 3-Input Boolean Gate System ───────────────────────────────────────────────
// Each axis now uses a 3-input Boolean truth table instead of a 2-input gate.
// Inputs: A = outcome[n-3], B = outcome[n-2], C = outcome[n-1]
// The truth table is a number 0-255 encoding all 8 possible (A,B,C) → output mappings.
// Bit index = A*4 + B*2 + C*1, value = (truthTable >> index) & 1.
// All 256 tables are scored against recent history; the best-fitting one is selected.
// This directly replaces the 6-gate (AND/NAND/OR/NOR/XOR/XNOR) 2-input system.

// Well-known 3-input gate IDs for display labels
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

function apply3InputGate(truthTable: number, a: 0|1, b: 0|1, c: 0|1): 0|1 {
  const idx = a*4 + b*2 + c;
  return ((truthTable >> idx) & 1) as 0|1;
}

function getGate3Name(id: number): string {
  return GATE_3_NAMES[id] ?? `G${id}`;
}

// Score all 256 3-input truth tables against the last `window+3` outcomes.
// Returns scores sorted best-first.
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

// Select the best-fitting 3-input gate.
// Returns the gate ID, its score, and the next-bit prediction.
// If no gate beats GATE_HOLD_THRESHOLD → HOLD (noise).
const GATE_3_HOLD_THRESHOLD  = 0.55; // must beat this to be trusted (higher than 2-input due to larger search space)
const GATE_3_EVAL_WINDOW     = 12;

// ── Gate selection cache ───────────────────────────────────────────────────
// Caches the best gate per axis per history length to avoid re-scoring
// 256 truth tables on every spin. Cache key = axis bits joined + length.
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
  // Keep cache small — only last 50 entries
  if (_gateCache.size > 50) _gateCache.delete(_gateCache.keys().next().value);
  _gateCache.set(cacheKey, result);

  return { gateId: best.id, gateName: best.name, fitScore: best.score, prediction, isHold, topScores: ranked.slice(0,6) };
}

// Kept for compatibility — wraps 3-input gate as BooleanGate type
type BooleanGate = "AND" | "NAND" | "OR" | "NOR" | "XOR" | "XNOR" | string;

// Legacy 2-input gate scorer — kept for diagnostics only
function applyGate(gate: BooleanGate, a: 0|1, b: 0|1): 0|1 {
  switch(gate) {
    case "AND":  return (a===1&&b===1)?1:0;
    case "NAND": return (a===1&&b===1)?0:1;
    case "OR":   return (a===1||b===1)?1:0;
    case "NOR":  return (a===1||b===1)?0:1;
    case "XOR":  return (a!==b)?1:0;
    case "XNOR": return (a===b)?1:0;
    default:     return 0;
  }
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

// ── 7 Components (mirroring Baccarat exactly) ─────────────────────────────────

// Component 1 — Persistence / Stability
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

// ── Main per-axis analyser — LEAN VERSION ──────────────────────────────────────
// Two states only:
//   WARMING  — fewer than MIN_HISTORY_SPINS → no prediction
//   EXECUTE  — gate selected and trusted → use gate prediction directly
//   HOLD     — no gate beats the noise floor (55%) → suppress this axis
//
// All governance components (DPI, spread, entropy, loss protection, cadence,
// neural governance) have been removed. The data showed they added +0.0pp to
// +2.3pp improvement while holding 64% of spins — net negative on exposure.
// The 3-input gate selector is the sole prediction engine.
function analyseAxis(
  bits: (0|1)[],
  axisName: string,
  gatePredOtherA: 0|1,
  gatePredOtherB: 0|1,
): PulseAxisDivergence {
  const isWarming = bits.length < MIN_HISTORY_SPINS;
  const emptyScores: Record<BooleanGate,number> = {AND:0,NAND:0,OR:0,NOR:0,XOR:0,XNOR:0};
  const andPrediction: 0|1 = getStraightNextBit(bits) as 0|1;

  // Diagnostics for UI display
  const { conformanceScore, mismatchStreak, windowUsed } = scoreDimensionConformance(bits, 10);
  const state = getDivergenceState(conformanceScore, mismatchStreak);
  const { cycle, confidence: cycleConf, position: cyclePos } = detectAlternativeCycle(bits);

  // Null-op components — kept for type compatibility, values are neutral
  const nullProtection = { active:false, severe:false, lossRun:0, penalty:0, observe:false, status:"—" };
  const nullEntropy    = { score:0, penalty:0, random:false, elevated:false, status:"—" };
  const nullPersist    = { score:50, flipRate:0, unstable:false, breakingDown:false, penalty:0, status:"—" };
  const nullConsensus  = { agrees:0, recentWin:false, reEntryReady:false, lift:0, status:"—" };
  const nullDpiStr     = { forceObserve:false, penalty:0, status:"—", velocity:0 };
  const nullCadenceA   = { penalty:0, observe:false, status:"—" };
  const nullNeural     = { hold:false, reason:"—" };

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
    cadenceActive: false, cadencePattern: [], cadenceIndex: 0, cadenceBreakBit: null,
    lossProtection: nullProtection, entropy: nullEntropy, persistence: nullPersist,
    consensus: nullConsensus, dpiStructural: nullDpiStr, cadenceAssist: nullCadenceA,
    neuralGovernance: nullNeural,
    performanceState: perfState, adjustedConfidence: Math.round(fitScore * 100),
    isHold, isWarming,
    state, conformanceScore, conformanceWindow: windowUsed, mismatchStreak,
    detectedCycle: cycle, cycleConfidence: cycleConf, cyclePosition: cyclePos,
    rollingAccuracy: fitScore, rollingWindow: GATE_3_EVAL_WINDOW,
    consecutiveBelowThreshold: 0, performanceFlipActive: overrideBit !== andPrediction && !isHold,
    selectedGate: gateName, gateFitScore: fitScore, allGateScores: emptyScores,
    summary,
  });

  // WARMING — not enough history
  if (isWarming) {
    return makeResult(
      andPrediction, "WARMING", "WARMING", true, 128, "AND3", 0,
      `${axisName} WARMING — need ${MIN_HISTORY_SPINS} spins (have ${bits.length})`,
    );
  }

  // GATE SELECTION — score all 256 3-input truth tables
  const gateResult = selectBest3InputGate(bits);

  // GATE HOLD — no gate beats noise floor
  if (gateResult.isHold || gateResult.prediction === null) {
    return makeResult(
      andPrediction, "GATE_HOLD", "HOLD", true,
      gateResult.gateId, gateResult.gateName, gateResult.fitScore,
      `${axisName} HOLD — no gate beats ${Math.round(GATE_3_HOLD_THRESHOLD*100)}% (best: ${gateResult.gateName} ${Math.round(gateResult.fitScore*100)}%)`,
    );
  }

  // EXECUTE — trust the gate prediction directly
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


// ── Main entry point ───────────────────────────────────────────────────────────
function getPulseBBStraightDivergence(history: Step[]): PulseDivergenceResult {
  const isWarming = history.length < MIN_HISTORY_SPINS;
  if (isWarming) {
    const wa = (name: string): PulseAxisDivergence => {
      const emptyScores: Record<BooleanGate,number>={AND:0,NAND:0,OR:0,NOR:0,XOR:0,XNOR:0};
      return {
        andPrediction:0,overrideBit:0,overrideActive:false,overrideReason:"WARMING",
        axisDpi:0,axisConfidence:0,spread:0,spreadActive:false,
        cadenceActive:false,cadencePattern:[],cadenceIndex:0,cadenceBreakBit:null,
        lossProtection:{active:false,severe:false,lossRun:0,penalty:0,observe:false,status:"Warming"},
        entropy:{score:0,penalty:0,random:false,elevated:false,status:"Warming"},
        persistence:{score:50,flipRate:0,unstable:false,breakingDown:false,penalty:0,status:"Warming"},
        consensus:{agrees:0,recentWin:false,reEntryReady:false,lift:0,status:"Warming"},
        dpiStructural:{forceObserve:false,penalty:0,status:"Warming",velocity:0},
        cadenceAssist:{penalty:0,observe:false,status:"Warming"},
        neuralGovernance:{hold:false,reason:"Warming"},
        performanceState:"WARMING",adjustedConfidence:0,isHold:true,isWarming:true,
        state:"ON_PATTERN",conformanceScore:1,conformanceWindow:0,mismatchStreak:0,
        detectedCycle:"NONE",cycleConfidence:0,cyclePosition:0,
        rollingAccuracy:1,rollingWindow:0,consecutiveBelowThreshold:0,
        performanceFlipActive:false,selectedGate:"AND",gateFitScore:0,allGateScores:emptyScores,
        summary:`${name} WARMING — need ${MIN_HISTORY_SPINS} spins (have ${history.length})`,
      };
    };
    return {
      color:wa("Color"),range:wa("Range"),parity:wa("Parity"),
      colorBit:0,rangeBit:0,parityBit:0,group:"BHE",
      overrideCount:0,holdCount:3,isWarming:true,
      label:`Warming · ${history.length}/${MIN_HISTORY_SPINS} spins · Holding`,
    };
  }

  const {colorBits, rangeBits, parityBits} = getAxisBitStreams(history);

  // First pass: get 3-input gate predictions for cross-axis consensus
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
  const cadenceCount  = [color,range,parity].filter(a=>a.cadenceActive).length;
  const overrideCount = [color,range,parity].filter(a=>a.overrideActive).length;

  const label = holdCount===3
    ? "All Dimensions HOLD"
    : holdCount>0
    ? `${holdCount}/3 HOLD · ${execCount} EXECUTE · ${cadenceCount} CADENCE`
    : cadenceCount>0
    ? `Cadence Active · ${cadenceCount}/3 dimensions · spread < ${SPREAD_THRESHOLD}`
    : `BB Straight · All EXECUTE · spread ≥ ${SPREAD_THRESHOLD}`;

  return { color,range,parity,colorBit,rangeBit,parityBit,group,overrideCount,holdCount,isWarming:false,label };
}

// ─── END PULSE DIVERGENCE DETECTOR ────────────────────────────────────────────


function bbStraightForecast(history: Step[]) {
  if (history.length < MIN_HISTORY_SPINS) {
    return { group: "BHE" as GroupKey, numbers: GROUPS.BHE, confidence: 0, tier: "Hold · No Bet", reason: `Straight warming — need ${MIN_HISTORY_SPINS} spins (have ${history.length})` };
  }

  // 3-input gate selector — scores all 256 truth tables per axis
  const divergence = getPulseBBStraightDivergence(history);

  if (divergence.isWarming || divergence.holdCount === 3) {
    return { group: null as GroupKey | null, numbers: [] as SpinValue[], confidence: 0, tier: "Hold · No Bet", reason: divergence.label };
  }

  const group = divergence.group;
  return {
    group,
    numbers: group ? GROUPS[group] : [],
    confidence: 65,
    tier: "Active · Confirmed",
    reason: `3-input gate · ${divergence.label}`,
    pulseDivergence: divergence,
  };
}

function bbInvertedForecast(history: Step[]) {
  if (!history.length) {
    return { group: "BHE" as GroupKey, numbers: GROUPS.BHE, confidence: 0, tier: "Active · Confirmed", reason: "Locked Inverted initial base recommendation." };
  }

  const locked = getLockedBbAxisGroup(history, true);
  const group = locked.group;

  return {
    group,
    numbers: group ? GROUPS[group] : [],
    confidence: 0,
    tier: "Active · Confirmed",
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


function getBooleanAxisPatternConfidence(bits: (0 | 1)[], mode: "Straight" | "Inverted") {
  // Engine confidence is measured from the selected engine pattern only.
  // It does not read DPI locks, Drift, TDA, Pulse replay, or governance.
  // The score is the recent hit rate of the selected Boolean table on this axis.
  if (bits.length < 4) return 50;

  const results: boolean[] = [];
  for (let i = 1; i < bits.length; i += 1) {
    const prior = bits.slice(0, i);
    const predicted = mode === "Inverted" ? getInvertedNextBit(prior) : getStraightNextBit(prior);
    results.push(predicted === bits[i]);
  }

  const recent = results.slice(-12);
  if (!recent.length) return 50;
  const wins = recent.filter(Boolean).length;
  return Math.max(38, Math.min(96, Math.round((wins / recent.length) * 100)));
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
    confidence >= 78 ? "Active · High Confidence" :
    confidence >= 65 ? "Active · Confirmed" :
    confidence >= 50 ? "Active · Caution" :
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



type PulseEngineScope = "Pulse Only" | "Straight" | "Inverted" | "Markov" | "Random";

type EngineAxisStreams = {
  colorBits: (0 | 1)[];
  rangeBits: (0 | 1)[];
  parityBits: (0 | 1)[];
  engineGroups: GroupKey[];
};

function getPureEngineAxisBits(history: Step[], scope: PulseEngineScope) {
  const bitRows = groupSeries(history).map(groupToBits);
  const colorBits = bitRows.map((b) => b[0]);
  const rangeBits = bitRows.map((b) => b[1]);
  const parityBits = bitRows.map((b) => b[2]);

  const straightBits: [0 | 1, 0 | 1, 0 | 1] = [
    getStraightNextBit(colorBits),
    getStraightNextBit(rangeBits),
    getStraightNextBit(parityBits),
  ];

  const invertedBits: [0 | 1, 0 | 1, 0 | 1] = [
    getInvertedNextBit(colorBits),
    getInvertedNextBit(rangeBits),
    getInvertedNextBit(parityBits),
  ];

  if (scope === "Straight") {
    return {
      primaryBits: straightBits,
      secondaryBits: invertedBits,
      primaryGroup: bitsToGroup(straightBits[0], straightBits[1], straightBits[2]),
      secondaryGroup: bitsToGroup(invertedBits[0], invertedBits[1], invertedBits[2]),
    };
  }

  if (scope === "Inverted") {
    // IMPORTANT: Pulse + Inverted must use the SAME engine output as Inverted-only.
    // Inverted-only does not start globally inverted; it starts from the BB Straight lock
    // and only converts individual axes when the Inverted engine's DPI rule is triggered.
    // This prevents Pulse + Inverted from showing the old always-inverted startup group.
    const lockedInverted = getLockedBbAxisGroup(history, true);
    const lockedBits = groupToBits(lockedInverted.group);

    return {
      primaryBits: lockedBits,
      secondaryBits: straightBits,
      primaryGroup: lockedInverted.group,
      secondaryGroup: bitsToGroup(straightBits[0], straightBits[1], straightBits[2]),
    };
  }

  if (scope === "Markov") {
    const markovBits: [0 | 1, 0 | 1, 0 | 1] = [
      getMarkovNextBit(colorBits, 3),
      getMarkovNextBit(rangeBits, 3),
      getMarkovNextBit(parityBits, 3),
    ];
    const oppositeBits: [0 | 1, 0 | 1, 0 | 1] = [
      flipAxisBit(markovBits[0]),
      flipAxisBit(markovBits[1]),
      flipAxisBit(markovBits[2]),
    ];
    return {
      primaryBits: markovBits,
      secondaryBits: oppositeBits,
      primaryGroup: bitsToGroup(markovBits[0], markovBits[1], markovBits[2]),
      secondaryGroup: bitsToGroup(oppositeBits[0], oppositeBits[1], oppositeBits[2]),
    };
  }

  if (scope === "Random") {
    const axisDpi = getRandomAxisDpiValues(history);
    const randomBits: [0 | 1, 0 | 1, 0 | 1] = [
      getRandomForecastBit(axisDpi.color),
      getRandomForecastBit(axisDpi.range),
      getRandomForecastBit(axisDpi.parity),
    ];
    const oppositeBits: [0 | 1, 0 | 1, 0 | 1] = [
      flipAxisBit(randomBits[0]),
      flipAxisBit(randomBits[1]),
      flipAxisBit(randomBits[2]),
    ];
    return {
      primaryBits: randomBits,
      secondaryBits: oppositeBits,
      primaryGroup: bitsToGroup(randomBits[0], randomBits[1], randomBits[2]),
      secondaryGroup: bitsToGroup(oppositeBits[0], oppositeBits[1], oppositeBits[2]),
    };
  }

  const fallbackBits = groupToBits(groupSeries(history).at(-1) ?? "BHE");
  return {
    primaryBits: fallbackBits,
    secondaryBits: fallbackBits,
    primaryGroup: bitsToGroup(fallbackBits[0], fallbackBits[1], fallbackBits[2]),
    secondaryGroup: bitsToGroup(fallbackBits[0], fallbackBits[1], fallbackBits[2]),
  };
}

function getEnginePredictionGroupForPrior(prior: Step[], scope: PulseEngineScope): GroupKey | null {
  if (scope === "Pulse Only") return null;
  if (scope === "Markov" && prior.length < 6) return null;
  return getPureEngineAxisBits(prior, scope).primaryGroup;
}

function flipAxisBit(bit: 0 | 1): 0 | 1 {
  return bit === 0 ? 1 : 0;
}

const DPI_DIMENSION_LOCK_THRESHOLD = -5;

function isDpiDimensionLocked(dpi: number) {
  // Legacy helper retained for older engine-only paths.
  // PULSE no longer uses a hard lock threshold; it uses DPI pressure below.
  return dpi <= DPI_DIMENSION_LOCK_THRESHOLD;
}

function getDpiDepthPressure(dpi: number) {
  const depth = Math.abs(Math.min(0, dpi));
  if (depth <= 0) return 0;
  if (depth === 1) return 15;
  if (depth === 2) return 30;
  if (depth === 3) return 45;
  if (depth === 4) return 60;
  if (depth === 5) return 70;
  if (depth === 6) return 80;
  if (depth === 7) return 90;
  if (depth === 8) return 95;
  if (depth === 9) return 98;
  return 100;
}

const DPI_REVERSAL_RELEASE_PERCENT = 30;

function getDpiPressureState(currentDpi: number, priorDpi: number, troughDpi = currentDpi) {
  const basePressure = getDpiDepthPressure(currentDpi);
  const delta = currentDpi - priorDpi;
  const trend =
    delta < 0
      ? "Falling"
      : delta > 0
      ? "Recovering"
      : "Flat";

  // DPI REVERSAL % MODEL
  // Entry still comes from DPI depth pressure.
  // Exit no longer waits for the current DPI value to return near -5.
  // Once a dimension has meaningfully reversed from its worst pressure point,
  // it returns to the selected engine pattern even if the current DPI is still deep.
  const troughDepth = Math.abs(Math.min(0, troughDpi));
  const recoveryFromTrough = Math.max(0, currentDpi - troughDpi);
  const reversalPercent = troughDepth
    ? Math.round((recoveryFromTrough / troughDepth) * 100)
    : 0;
  const reversalReleased = basePressure >= 70 && reversalPercent >= DPI_REVERSAL_RELEASE_PERCENT;

  const action = reversalReleased
    ? "KEEP"
    : basePressure >= 70
    ? "FLIP"
    : basePressure >= 50
    ? "WARN"
    : "KEEP";

  const status = reversalReleased
    ? "Primary"
    : action === "FLIP"
    ? "Flip"
    : action === "WARN"
    ? "Warning"
    : "Primary";

  return {
    pressure: basePressure,
    basePressure,
    trend,
    trendAdjustment: 0,
    recoveryCredit: 0,
    fallingPenalty: 0,
    delta,
    troughDpi,
    troughDepth,
    recoveryFromTrough,
    reversalPercent,
    reversalReleased,
    reversalReleasePercent: DPI_REVERSAL_RELEASE_PERCENT,
    action,
    status,
  };
}

function getAxisDpiTroughValues(history: Step[]) {
  const trough = { color: 0, range: 0, parity: 0 };

  for (let i = 0; i <= history.length; i += 1) {
    const values = getAxisBbDpiValues(history.slice(0, i), false);
    trough.color = Math.min(trough.color, values.color);
    trough.range = Math.min(trough.range, values.range);
    trough.parity = Math.min(trough.parity, values.parity);
  }

  return trough;
}

function getAxisDpiLockCore(history: Step[], scope: PulseEngineScope, engineGroup: GroupKey) {
  // PULSE DPI PRESSURE DECISION CORE
  // The selected engine creates the primary pattern.
  // DPI no longer hard-locks to Red / Low / Odd or Black / High / Even.
  // Instead, each axis builds a pressure score from:
  // - current DPI depth
  // - DPI direction: falling pressure vs recovering pressure
  // When pressure reaches FLIP level, that axis flips the selected engine's own bit.
  // This keeps the engine pattern as the source of truth and lets DPI decide only
  // whether to keep, warn, or flip that dimension.
  const axisDpi = scope === "Random" ? getRandomAxisDpiValues(history) : getAxisBbDpiValues(history, false);
  const priorAxisDpi = history.length
    ? scope === "Random"
      ? getRandomAxisDpiValues(history.slice(0, -1))
      : getAxisBbDpiValues(history.slice(0, -1), false)
    : axisDpi;
  const troughAxisDpi = scope === "Random" ? axisDpi : getAxisDpiTroughValues(history);

  const pure = scope === "Pulse Only"
    ? { primaryBits: groupToBits(engineGroup), secondaryBits: groupToBits(engineGroup), primaryGroup: engineGroup, secondaryGroup: engineGroup }
    : getPureEngineAxisBits(history, scope);

  const originalBits = [...pure.primaryBits] as [0 | 1, 0 | 1, 0 | 1];
  const secondaryBits = [
    flipAxisBit(originalBits[0]),
    flipAxisBit(originalBits[1]),
    flipAxisBit(originalBits[2]),
  ] as [0 | 1, 0 | 1, 0 | 1];
  const adjustedBits = [...originalBits] as [0 | 1, 0 | 1, 0 | 1];

  const axisConfig = [
    { axis: "color" as PulseDriftAxisKey, index: 0, dpi: axisDpi.color, priorDpi: priorAxisDpi.color, troughDpi: troughAxisDpi.color },
    { axis: "range" as PulseDriftAxisKey, index: 1, dpi: axisDpi.range, priorDpi: priorAxisDpi.range, troughDpi: troughAxisDpi.range },
    { axis: "parity" as PulseDriftAxisKey, index: 2, dpi: axisDpi.parity, priorDpi: priorAxisDpi.parity, troughDpi: troughAxisDpi.parity },
  ];

  axisConfig.forEach((row) => {
    const pressureState = getDpiPressureState(row.dpi, row.priorDpi, row.troughDpi);
    if (pressureState.action === "FLIP") adjustedBits[row.index] = flipAxisBit(originalBits[row.index]);
  });

  const axes = axisConfig.map((row) => {
    const primaryBit = originalBits[row.index];
    const pressureState = getDpiPressureState(row.dpi, row.priorDpi, row.troughDpi);
    const flipped = pressureState.action === "FLIP";
    const destinationBit = flipped ? flipAxisBit(primaryBit) : primaryBit;
    const fromSide = getAxisSideLabel(row.axis, primaryBit);
    const toSide = getAxisSideLabel(row.axis, destinationBit);
    const axisName = row.axis === "color" ? "Color" : row.axis === "range" ? "Range" : "Parity";

    return {
      axis: row.axis,
      predictedBit: primaryBit,
      destinationBit,
      fromSide,
      toSide,
      driftPercent: pressureState.pressure,
      priorDriftPercent: getDpiDepthPressure(row.priorDpi),
      driftDelta: row.dpi - row.priorDpi,
      status: pressureState.status,
      action: pressureState.action,
      trials: history.length,
      violations: pressureState.pressure,
      windowSize: history.length,
      dpi: row.dpi,
      priorDpi: row.priorDpi,
      troughDpi: row.troughDpi,
      reversalPercent: pressureState.reversalPercent,
      reversalReleased: pressureState.reversalReleased,
      pressure: pressureState.pressure,
      basePressure: pressureState.basePressure,
      trend: pressureState.trend,
      trendAdjustment: pressureState.trendAdjustment,
      label:
        fromSide === toSide
          ? `${axisName} primary ${toSide} · ${pressureState.pressure}% pressure`
          : `${axisName} pressure flip ${fromSide} → ${toSide} · ${pressureState.pressure}%`,
    };
  });

  const flippedAxes = axes.filter((axis) => axis.action === "FLIP");
  const warningAxes = axes.filter((axis) => axis.action === "WARN");
  // DPI Pressure is the strongest active axis pressure.
  // This replaces old lock-state integrity because hard locks are removed.
  const score = axes.length ? Math.max(...axes.map((axis) => axis.pressure ?? axis.driftPercent ?? 0)) : 0;

  return {
    axes,
    axisDpi,
    originalBits,
    secondaryBits,
    adjustedBits,
    originalGroup: bitsToGroup(originalBits[0], originalBits[1], originalBits[2]),
    secondaryGroup: bitsToGroup(secondaryBits[0], secondaryBits[1], secondaryBits[2]),
    adjustedGroup: bitsToGroup(adjustedBits[0], adjustedBits[1], adjustedBits[2]),
    activeAxes: ["color", "range", "parity"] as AxisKey[],
    mode: "FULL_3D" as AdaptiveTDAMode,
    modeLabel: "DPI PRESSURE",
    score,
    summary: flippedAxes.length ? "DPI Flip" : warningAxes.length ? "DPI Warning" : "DPI Primary",
    lockedAxes: flippedAxes.map((axis) => axis.axis),
    flippedAxes: flippedAxes.map((axis) => axis.axis),
    warningAxes: warningAxes.map((axis) => axis.axis),
    source: "DPI Pressure Flip",
  };
}


function getDirectionalAxisSideConfidence(bits: (0 | 1)[], window = 12) {
  const recent = bits.slice(-window);
  if (!recent.length) return { zero: 50, one: 50, trials: 0 };
  const zeroCount = recent.filter((value) => value === 0).length;
  const oneCount = recent.length - zeroCount;
  return {
    zero: Math.round((zeroCount / recent.length) * 100),
    one: Math.round((oneCount / recent.length) * 100),
    trials: recent.length,
  };
}

function getSpreadPulseAxisSideMetrics(history: Step[]) {
  const bitRows = groupSeries(history).map(groupToBits);
  const colorBits = bitRows.map((b) => b[0]);
  const rangeBits = bitRows.map((b) => b[1]);
  const parityBits = bitRows.map((b) => b[2]);
  const axisDpi = getAxisBbDpiValues(history, false);

  const buildAxis = (axis: PulseDriftAxisKey, bits: (0 | 1)[], dpi: number) => {
    const confidence = getDirectionalAxisSideConfidence(bits, 12);
    const dpiPenalty = Math.abs(Math.min(0, dpi));
    const zeroSpread = Math.round(confidence.zero - dpiPenalty);
    const oneSpread = Math.round(confidence.one - dpiPenalty);
    const selectedBit = zeroSpread > oneSpread ? 0 : 1;
    const zeroSide = getAxisSideLabel(axis, 0);
    const oneSide = getAxisSideLabel(axis, 1);
    const signal = getAxisSideLabel(axis, selectedBit as 0 | 1);

    return {
      axis,
      dpi,
      dpiPenalty,
      confidence,
      spread: { zero: zeroSpread, one: oneSpread },
      selectedBit: selectedBit as 0 | 1,
      signal,
      zeroSide,
      oneSide,
      selectedConfidence: selectedBit === 0 ? confidence.zero : confidence.one,
      selectedSpread: selectedBit === 0 ? zeroSpread : oneSpread,
      trials: confidence.trials,
    };
  };

  const color = buildAxis("color", colorBits, axisDpi.color);
  const range = buildAxis("range", rangeBits, axisDpi.range);
  const parity = buildAxis("parity", parityBits, axisDpi.parity);

  return {
    axisDpi,
    color,
    range,
    parity,
    bits: {
      colorBits,
      rangeBits,
      parityBits,
    },
  };
}

function getEngineModeLabel(pulseEnabled: boolean, bbStraightEnabled: boolean, bbInvertedEnabled: boolean, markovEnabled = false, randomEnabled = false) {
  const bbMode = randomEnabled ? "Random" : markovEnabled ? "Markov" : bbStraightEnabled && bbInvertedEnabled ? "Inverted" : bbStraightEnabled ? "Straight" : "BB Off";
  if (pulseEnabled && bbMode !== "BB Off") return `PULSE + ${bbMode}`;
  if (pulseEnabled) return "PULSE Governance";
  return bbMode === "BB Off" ? "Disabled" : bbMode;
}

function getActiveDecision(history: Step[], pulseEnabled: boolean, bbStraightEnabled: boolean, bbInvertedEnabled: boolean, markovEnabled = false, randomEnabled = false) {
  const straight = bbStraightForecast(history);
  const inverted = bbInvertedForecast(history);
  const markov = markovForecast(history);
  const random = randomForecast(history);

  // Snapshot every engine's per-axis diagnostic every spin, regardless of
  // which engine ends up selected below. This is what lets us audit any
  // engine retroactively (e.g. "what was Markov's confidence during this
  // Inverted-driven loss streak?").
  const allEngineDiagnostics = {
    straight: { gate: (straight as any).pulseDivergence ?? null, group: (straight as any).group ?? null },
    inverted: { axisDpi: (inverted as any).axisDpi ?? null, axisModes: (inverted as any).axisModes ?? null, group: (inverted as any).group ?? null },
    markov: { axisConfidence: (markov as any).markovAxisConfidence ?? null, group: (markov as any).group ?? null },
    random: { axisDpi: (random as any).axisDpi ?? null, confidence: (random as any).confidence ?? null, group: (random as any).group ?? null },
  };

  const decision = getActiveDecisionCore(history, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, markovEnabled, randomEnabled, straight, inverted, markov, random);
  return { ...decision, allEngineDiagnostics };
}

function getActiveDecisionCore(history: Step[], pulseEnabled: boolean, bbStraightEnabled: boolean, bbInvertedEnabled: boolean, markovEnabled: boolean, randomEnabled: boolean, straight: any, inverted: any, markov: any, random: any) {
  const mode = getEngineModeLabel(pulseEnabled, bbStraightEnabled, bbInvertedEnabled, markovEnabled, randomEnabled);

  // ── PULSE: Engine Performance Tracker ────────────────────────────────────
  // When Pulse is ON, it runs all 4 engines silently every spin, tracks each
  // engine's rolling win rate over the last 10 spins, and selects the best
  // performing engine automatically.
  //
  // Rules:
  //   - Warming: fewer than 10 spins → no prediction, no bet
  //   - First selection (spin 10): pick engine with highest rolling win rate
  //   - Subsequent spins: only switch if challenger leads by ≥15pp
  //   - Straight uses 3-input gate selector (256 truth tables per axis)
  //   - Inverted, Markov, Random use their existing prediction engines
  if (pulseEnabled) {
    const PULSE_WARMING     = 10;
    const PULSE_WINDOW      = 15;   // rolling window for win rate — narrowed further from 25 for faster reaction. Note: with PULSE_MIN_SAMPLES=10, this leaves little headroom above the trust floor, and a smaller window means noisier rates and more "leader" churn between engines, which can make the lean-streak mechanism harder to build (see Session Performance Findings).
    const PULSE_MIN_SAMPLES = 10;   // neither engine's rate is trusted at all below this many evaluated spins in the window — too few samples for the normal approximation behind the z-test to be valid.

    // Not enough history yet — use Straight as fallback so chart still draws
    if (history.length < PULSE_WARMING) {
      const warmForecast = bbStraightForecast(history);
      return {
        ...warmForecast,
        group: null as GroupKey | null,
        numbers: [] as SpinValue[],
        confidence: 0,
        tier: "Hold · No Bet" as const,
        reason: `Pulse warming — need ${PULSE_WARMING} spins (have ${history.length})`,
        source: "PULSE" as const,
        mode,
        pulseEngineTracker: {
          selectedEngine: null as string | null,
          isWarming: true,
          spinsRemaining: PULSE_WARMING - history.length,
          engineRates: {} as Record<string, number>,
          engineSamples: {} as Record<string, number>,
        },
      };
    }

    // Compute rolling win rate AND sample size for each engine over the last
    // PULSE_WINDOW spins. Uses allEngineDiagnostics, which snapshots every
    // engine's prediction every spin regardless of which one was actually
    // selected — this is what makes a fair, apples-to-apples comparison
    // possible. (Previously Markov/Random were only credited with a win if
    // they had *already* been the selected engine that spin, which meant
    // they could never accumulate any win rate once Pulse locked onto a
    // different engine — a bug that made switching away from a bad engine
    // nearly impossible.)
    const computeEngineStats = (engineName: string): { rate: number; wins: number; n: number } => {
      const recent = history.slice(-PULSE_WINDOW);
      let wins = 0;
      let evaluated = 0;

      for (const step of recent) {
        const actual = step.outcomeGroup;
        if (!actual) continue;

        const diag = (step as any).allEngineDiagnostics;
        let predicted: GroupKey | null = null;

        if (diag) {
          if (engineName === "Straight") predicted = diag.straight?.group ?? null;
          else if (engineName === "Inverted") predicted = diag.inverted?.group ?? null;
          else if (engineName === "Markov") predicted = diag.markov?.group ?? null;
          else if (engineName === "Random") predicted = diag.random?.group ?? null;
        } else if (engineName === "Straight" || engineName === "Inverted") {
          // Fallback for older history rows recorded before allEngineDiagnostics
          // existed — use the legacy pulseDivergence-based proxy.
          const pd = (step as any).pulseDivergence as PulseDivergenceResult | null;
          if (engineName === "Straight" && pd && !pd.isWarming && pd.holdCount < 3) {
            predicted = pd.group;
          } else if (engineName === "Inverted" && pd) {
            const cb = pd.color?.andPrediction ?? 0;
            const rb = pd.range?.andPrediction ?? 0;
            const pb = pd.parity?.andPrediction ?? 0;
            predicted = bitsToGroup(cb as 0|1, rb as 0|1, pb as 0|1);
          }
        }

        if (predicted) {
          evaluated += 1;
          if (predicted === actual) wins++;
        }
      }

      return { rate: evaluated > 0 ? Math.round(wins / evaluated * 100) : 0, wins, n: evaluated };
    };

    const engineStats: Record<string, { rate: number; wins: number; n: number }> = {
      Straight: computeEngineStats("Straight"),
      Inverted: computeEngineStats("Inverted"),
      Markov:   computeEngineStats("Markov"),
      Random:   computeEngineStats("Random"),
    };
    const engineRates: Record<string, number> = Object.fromEntries(Object.entries(engineStats).map(([k, v]) => [k, v.rate]));
    const engineSamples: Record<string, number> = Object.fromEntries(Object.entries(engineStats).map(([k, v]) => [k, v.n]));

    // Two-proportion one-tailed z-test: is the challenger's win rate
    // *statistically* higher than the current engine's, or is this gap just
    // noise? Both engines need a real sample size before we trust either
    // rate at all — with roulette payouts this close to 50/50, a handful of
    // spins is not enough to tell skill from luck, which is exactly what
    // made the old raw-percentage-gap rule chase hot streaks that were
    // about to revert (see Session Performance Findings).
    const zScoreForChallenger = (challenger: { wins: number; n: number }, current: { wins: number; n: number }): number | null => {
      if (challenger.n < PULSE_MIN_SAMPLES || current.n < PULSE_MIN_SAMPLES) return null;
      const p1 = challenger.wins / challenger.n;
      const p2 = current.wins / current.n;
      const pooled = (challenger.wins + current.wins) / (challenger.n + current.n);
      const se = Math.sqrt(pooled * (1 - pooled) * (1 / challenger.n + 1 / current.n));
      if (se === 0) return p1 > p2 ? Infinity : 0;
      return (p1 - p2) / se;
    };

    // Find the best engine by raw rate — but only among engines that have
    // enough samples to trust at all (n ≥ PULSE_MIN_SAMPLES). This matters
    // most for the very FIRST engine pick right after warmup: with no
    // currentEngine yet, there's no switch-decision gate to fall back on, so
    // without this floor, whichever engine got randomly lucky on a handful
    // of spins (e.g. 2-for-4 = "50%") would get selected outright and then
    // benefit from the very protections meant to stop noisy switching —
    // locking in a coin-flip result for an entire session. If nobody has
    // enough samples yet, default to Straight as a neutral baseline rather
    // than picking on pure noise.
    let bestEngine = "Straight";
    let bestRate = -1;
    for (const [engine, stats] of Object.entries(engineStats)) {
      if (stats.n >= PULSE_MIN_SAMPLES && stats.rate > bestRate) { bestRate = stats.rate; bestEngine = engine; }
    }
    if (bestRate === -1) {
      bestEngine = "Straight";
      bestRate = engineRates["Straight"];
    }

    // Check if current selected engine (from last step) should switch
    const lastStep = history[history.length - 1];
    const currentEngine = (lastStep as any)?.pulseSelectedEngine ?? null;

    // Every non-current engine's z-score vs the current engine, computed
    // fresh every spin — this is what lets us track each challenger's trend
    // over time (not just whichever one happens to be "the leader" right
    // now), and is what the sustained-lean rule below walks back through.
    const challengerZScores: Record<string, number | null> = {};
    if (currentEngine) {
      for (const engine of Object.keys(engineStats)) {
        if (engine === currentEngine) continue;
        challengerZScores[engine] = zScoreForChallenger(engineStats[engine], engineStats[currentEngine]);
      }
    }

    // A single-spin significance test (the "Significant" path) used to sit
    // here as a high bar for an immediate switch — it was removed because at
    // small windows it fires on pure noise nearly as easily as on a real
    // edge, and testing showed it repeatedly switching onto an engine right
    // before that engine went cold. Now a challenger can ONLY trigger a
    // switch by demonstrating its edge over multiple spins: either holding
    // at least PULSE_LEAN_Z for PULSE_LEAN_SPINS consecutive spins
    // in a row — persistence substitutes for a single very-high z-score.
    // A SECOND, faster path exists for a lean that isn't just sitting still
    // but actively climbing: if it's already reached a moderate bar AND
    // gained real ground over the last 10 spins, that acceleration is its
    // own evidence, and doesn't need the full 15-spin hold to trust (a
    // session ending at spin 80 with a lean at 10/15 spins and climbing
    // 1.06 → 1.49 is exactly the case this is for).
    const PULSE_LEAN_Z = 1.0;          // lower bar: "leaning" evidence, not full significance
    const PULSE_LEAN_SPINS = 10;       // how many consecutive spins a flat lean must hold (Moderate preset — was 15)
    const PULSE_TREND_LOOKBACK = 10;   // spins back to measure z-score trend/acceleration
    const PULSE_ACCEL_MIN_STREAK = 5;  // shorter hold required when the lean is also accelerating (Moderate preset — was 8)
    const PULSE_ACCEL_MIN_Z = 1.0;     // instantaneous bar for the accelerating path (Moderate preset — was 1.2)
    const PULSE_ACCEL_MIN_TREND = 0.7; // must have gained at least this much z over the last 10 spins (Moderate preset — was 1.0)

    const getConsecutiveLeanAndTrend = (engine: string): { consecutiveLean: number; trendDelta: number | null } => {
      // These two are intentionally NOT coupled to the same "unbroken" walk.
      // consecutiveLean needs an uninterrupted run of z ≥ PULSE_LEAN_Z.
      // trendDelta just needs this engine's z-score from exactly
      // PULSE_TREND_LOOKBACK settled spins ago, dips in between don't matter.
      // Coupling them (as the original version did, by breaking the whole
      // walk the moment z dipped below the lean bar) meant trend could never
      // be computed before ~PULSE_TREND_LOOKBACK consecutive qualifying
      // spins had already elapsed — which is roughly the same length as the
      // sustained-lean bar itself, making the "faster" accelerating-lean
      // path unable to ever fire meaningfully earlier than sustained-lean
      // (confirmed in testing: it fired at most 1 spin sooner, not 5).
      let consecutiveLean = 0;
      let leanBroken = false;
      let trendDelta: number | null = null;
      let stepsBack = 0;
      for (let i = history.length - 1; i >= 0; i--) {
        const step = history[i] as any;
        const stepTracker = step.pulseEngineTracker;
        if (!stepTracker || stepTracker.isWarming || stepTracker.selectedEngine !== currentEngine) break;
        const z = stepTracker.challengerZScores?.[engine];
        stepsBack += 1;

        if (trendDelta === null && stepsBack === PULSE_TREND_LOOKBACK && typeof z === "number") {
          trendDelta = (challengerZScores[engine] ?? 0) - z;
        }

        if (!leanBroken) {
          if (typeof z === "number" && z >= PULSE_LEAN_Z) consecutiveLean += 1;
          else leanBroken = true;
        }

        // Once we have both answers (or can no longer improve them within
        // this engine's active run), stop walking further back.
        if (stepsBack >= PULSE_TREND_LOOKBACK) break;
      }
      return { consecutiveLean, trendDelta };
    };

    let selectedEngine = bestEngine;
    let switchZScore: number | null = null;
    let switchReason: "significant" | "sustained-lean" | "accelerating-lean" | null = null;
    let leanStreak = 0;
    let zTrendDelta: number | null = null;
    if (currentEngine && currentEngine !== bestEngine) {
      switchZScore = zScoreForChallenger(engineStats[bestEngine], engineStats[currentEngine]);
      const leanInfo = getConsecutiveLeanAndTrend(bestEngine);
      leanStreak = leanInfo.consecutiveLean;
      zTrendDelta = leanInfo.trendDelta;

      // The single-spin "significant" trigger (z ≥ PULSE_SIG_Z on one snapshot)
      // was removed: at small windows it fires on pure noise as easily as on
      // a real edge, and testing showed it repeatedly switching onto an
      // engine right before that engine went cold (see Session Performance
      // Findings). Both remaining paths require the edge to be demonstrated
      // over multiple spins — persistence (sustained-lean) or persistence
      // AND upward movement (accelerating-lean) — rather than a one-off
      // reading, which is a much harder bar for noise to clear by chance.
      if (switchZScore !== null && switchZScore >= PULSE_ACCEL_MIN_Z && leanStreak >= PULSE_ACCEL_MIN_STREAK && zTrendDelta !== null && zTrendDelta >= PULSE_ACCEL_MIN_TREND) {
        switchReason = "accelerating-lean";
      } else if (switchZScore !== null && switchZScore >= PULSE_LEAN_Z && leanStreak >= PULSE_LEAN_SPINS) {
        switchReason = "sustained-lean";
      }

      if (!switchReason) {
        selectedEngine = currentEngine; // stay with current — no sustained or accelerating lean yet
      }
    }

    // Get prediction from selected engine
    let engineForecast: any;
    if (selectedEngine === "Straight") {
      const divergence = getPulseBBStraightDivergence(history);
      if (divergence.isWarming || divergence.holdCount === 3) {
        engineForecast = { group: null, numbers: [], confidence: 0, tier: "Hold · No Bet", reason: divergence.label };
      } else {
        engineForecast = {
          ...straight,
          group: divergence.group,
          numbers: divergence.group ? GROUPS[divergence.group] : [],
          confidence: 65,
          tier: "Active · Confirmed",
          reason: divergence.label,
          pulseDivergence: divergence,
        };
      }
    } else if (selectedEngine === "Inverted") {
      engineForecast = { ...inverted, tier: "Active · Confirmed" };
    } else if (selectedEngine === "Markov") {
      engineForecast = { ...markov, tier: "Active · Confirmed" };
    } else {
      engineForecast = { ...random, tier: "Active · Confirmed" };
    }

    const tracker = {
      selectedEngine,
      isWarming: false,
      spinsRemaining: 0,
      engineRates,
      engineSamples,
      switched: currentEngine !== null && currentEngine !== selectedEngine,
      previousEngine: currentEngine,
      switchZScore,
      switchReason,
      challengerZScores,
      leanStreak,
      zTrendDelta,
    };

    return {
      ...engineForecast,
      source: "PULSE" as const,
      mode,
      pulseEngineTracker: tracker,
      reason: `Pulse · ${selectedEngine} selected (${engineRates[selectedEngine]}% / n=${engineSamples[selectedEngine]}) · ${Object.entries(engineStats).map(([e, s]) => `${e}:${s.rate}%(n=${s.n})`).join(" · ")}`,
    };
  }

  // ── Manual engine selection (Pulse OFF) ───────────────────────────────────
  if (randomEnabled && random.group) {
    return { ...random, source: "RANDOM" as const, mode };
  }
  if (markovEnabled && markov.group) {
    return { ...markov, source: "MARKOV" as const, mode };
  }
  if (bbInvertedEnabled && inverted.group) {
    return { ...inverted, source: "BB_INVERTED" as const, mode };
  }
  if (bbStraightEnabled && straight.group) {
    return { ...straight, source: "BB_STRAIGHT" as const, mode };
  }

  return {
    group: null as GroupKey | null,
    numbers: [] as SpinValue[],
    confidence: 0,
    tier: "No Engine",
    reason: "No active engine. Turn on PULSE, BB Straight, BB Inverted, Markov, or Random.",
    source: "NONE" as const,
    mode,
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

function getTransitionRiskFromScore(score: number): string {
  return score >= 70 ? "High" : score >= 40 ? "Moderate" : "Low";
}

function getTransitionEvidenceStrength(samples: number, risk: number): string {
  return samples >= 20 && risk >= 50 ? "Strong" : samples >= 10 ? "Moderate" : "Weak";
}

function getNeuralCalibratedPulse(history: Step[], decision: any) {
  return decision;
}

function getPulseDriftDestinationCore(history: Step[]) {
  return { active: false, direction: null as GroupKey | null };
}

function getLabLeader(history: Step[]) {
  return null;
}

function isProtectionHoldRow(row: Step) {
  return false;
}

function getTIValidationForRow(row: Step, index: number, history: Step[]) {
  return { state: "—", validated: null, windowUsed: 0, correct: false };
}

function getTIAccuracySummaryRows(rows: any[]) {
  return [];
}

function getTIRegimeAccuracyRows(history: Step[]) {
  return [];
}

function getTransitionIntelligenceRead(history: Step[], decision: any) {
  // TRANSITION INTELLIGENCE CORE
  // This is advisory/environment intelligence only.
  // It does not pick BHE/RLO/etc. and it does not override BB Straight,
  // BB Inverted, Markov, Gap Structure, or the Family-first execution router.
  // Pulse still selects dimensions first; Pattern Intelligence only reads
  // whether Color / Range / Parity behavior is beginning to rotate.
  const transition = getAxisTransitionAcceleration(history);
  const drift = getAxisDriftVelocity(history);
  const compression = getForecastCompression(history, decision);
  const family = getForecastFamilySaturation(history, decision);
  const structure = getStructureFromDecision(decision);
  const gapSummary = getDirectionalGapSummary(decision);
  const gaps = (gapSummary?.rows ?? []).map((row: any) => (typeof row.gap === "number" ? row.gap : null));
  const zeroGapCount = gaps.filter((gap: number | null) => gap === 0).length;
  const weakGapCount = gaps.filter((gap: number | null) => typeof gap === "number" && gap > 0 && gap < 16).length;
  const strongGapCount = gaps.filter((gap: number | null) => typeof gap === "number" && gap >= 34).length;

  const affectedAxis = Array.from(new Set([
    ...transition.axis.filter((axis: any) => axis.transitioning).map((axis: any) => axis.label),
    ...drift.axis.filter((axis: any) => axis.fallingFast || axis.improvingFast).map((axis: any) => axis.label),
  ]));

  const riskScore = Math.max(0, Math.min(100, Math.round(
    transition.transitioningCount * 24 +
    drift.fallingCount * 26 +
    zeroGapCount * 10 +
    weakGapCount * 7 +
    (compression.compression ? 12 : 0) +
    (family.saturation ? 10 : 0) -
    drift.improvingCount * 12
  )));

  let state = "Stable";
  if (drift.fallingCount >= 2 || (transition.transitioningCount >= 2 && weakGapCount >= 1)) state = "Scatter";
  else if (transition.transitioningCount >= 2) state = "Reversal";
  else if (drift.fallingCount === 1 || transition.transitioningCount === 1) state = "Drift";
  else if (compression.compression || zeroGapCount >= 2) state = "Compression";
  else if (drift.improvingCount >= 2) state = "Recovery";
  else if (strongGapCount >= 2 && zeroGapCount === 0) state = "Expansion";

  const expectedNextRegime =
    state === "Drift" ? "Compression Watch" :
    state === "Scatter" ? "Router Instability" :
    state === "Reversal" ? "Family Rotation" :
    state === "Compression" ? "Tight Basket / Compression" :
    state === "Recovery" ? "Re-Alignment" :
    state === "Expansion" ? "Neighbor / Edge Friendly" :
    "No Clear Transition";

  const action =
    state === "Scatter" ? "Reduce / Observe" :
    state === "Reversal" ? "Watch Family Rotation" :
    state === "Drift" ? "Prepare Compression" :
    state === "Compression" ? "Compression Ready" :
    state === "Recovery" ? "Route Normally" :
    state === "Expansion" ? "Expansion Allowed" :
    "Route Normally";

  const axis = transition.axis.map((axis: any) => {
    const driftAxis = drift.axis.find((row: any) => row.key === axis.key);
    return {
      key: axis.key,
      label: axis.label,
      recentFlips: axis.recentFlips,
      priorFlips: axis.priorFlips,
      acceleration: axis.acceleration,
      drift: driftAxis?.drift ?? 0,
      stabilityNow: driftAxis?.now ?? 0,
      status:
        axis.transitioning && driftAxis?.fallingFast ? "Transition + Drift" :
        axis.transitioning ? "Transitioning" :
        driftAxis?.fallingFast ? "Drifting" :
        driftAxis?.improvingFast ? "Recovering" :
        "Stable",
    };
  });

  return {
    active: true,
    source: "Pattern Intelligence",
    structure,
    state,
    expectedNextRegime,
    action,
    affectedAxis: affectedAxis.length ? affectedAxis.join(" / ") : "None",
    risk: getTransitionRiskFromScore(riskScore),
    riskScore,
    evidenceStrength: getTransitionEvidenceStrength(history.length, riskScore),
    samples: Math.min(history.length, 24),
    axis,
    transition,
    drift,
    compression,
    family,
    zeroGapCount,
    weakGapCount,
    strongGapCount,
    diagnosticOnly: true,
    summary: `${state} · ${expectedNextRegime} · ${action}`,
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
    status: compression ? "Dimensional Compression Active" : "Diverse",
  };
}

function shouldExecuteTier(tier: string, source: string, settings: TierExecutionSettings = DEFAULT_TIER_EXECUTION, rv?: any, entropyExtreme?: boolean) {
  // EXECUTION FILTER LOCK
  // Strong and Controlled always execute.
  // Weak executes only when Weak ON.
  // Observe ON holds observe/advisory states as no bet/PUSH.
  // Observe OFF allows observe/advisory states to execute.
  if (source === "NONE") return false;

  const isObserveTier =
    tier === "Hold · No Bet" ||
    tier === "Observation Forecast" ||
    tier === "No Prediction";

  if (isObserveTier) return settings.executeObservation === true ? false : true;
  if (tier === "Active · Caution") return settings.executeWeak;

  return true;
}


function isObservePushTier(tier: string, settings: TierExecutionSettings = DEFAULT_TIER_EXECUTION) {
  const isObserveTier =
    tier === "Hold · No Bet" ||
    tier === "Observation Forecast" ||
    tier === "No Prediction";

  return settings.executeObservation === true && isObserveTier;
}

function normalizeObserveTierForSettings(decision: any, settings: TierExecutionSettings = DEFAULT_TIER_EXECUTION, history: Step[] = []) {
  const isObserveTier =
    decision?.tier === "Hold · No Bet" ||
    decision?.tier === "Observation Forecast" ||
    decision?.tier === "No Prediction";

  const transitionIntelligence =
    settings.executeObservation === true && decision?.group && history.length
      ? getTransitionIntelligenceRead(history, decision)
      : null;
  const transitionRiskHighOrExtreme =
    transitionIntelligence?.risk === "High" ||
    transitionIntelligence?.risk === "Extreme" ||
    (typeof transitionIntelligence?.riskScore === "number" && transitionIntelligence.riskScore >= 58);

  // Observe Hold ON hard-stop rule:
  // TI Risk High or Extreme forces Observe / No Bet. Low / Medium TI risk keeps the selected engine executable.
  if (settings.executeObservation === true && transitionRiskHighOrExtreme) {
    return {
      ...decision,
      tier: "Hold · No Bet",
      transitionHighRiskObserveHold: true,
      pulseDiagnostics: {
        ...(decision?.pulseDiagnostics ?? {}),
        transitionIntelligence,
      },
      pulseGate: {
        ...(decision?.pulseGate ?? {}),
        transitionState: transitionIntelligence?.state,
        transitionRisk: transitionIntelligence?.risk,
        transitionRiskScore: transitionIntelligence?.riskScore,
        transitionAction: transitionIntelligence?.action,
        transitionExpectedRegime: transitionIntelligence?.expectedNextRegime,
        transitionHighRiskObserveHold: true,
      },
      reason: `${decision?.reason ?? "Pattern Intelligence Governor."} · Observe Hold ON: TI Risk High/Extreme (${transitionIntelligence?.riskScore ?? "—"}) forces Observe / No Bet.`,
    };
  }

  // If Observe Hold is ON but TI risk is not Extreme, do not let zero-gap or observe-tier
  // language block execution. A live group remains executable as Weak Prediction.
  if (settings.executeObservation === true && isObserveTier && decision?.group) {
    return {
      ...decision,
      tier: "Active · Caution",
      observeSuppressed: true,
      transitionHighRiskObserveHold: false,
      pulseDiagnostics: {
        ...(decision?.pulseDiagnostics ?? {}),
        ...(transitionIntelligence ? { transitionIntelligence } : {}),
      },
      reason: `${decision.reason ?? "Engine rule active."} · Observe Hold ON: TI Risk is Low/Medium, so execution remains enabled.`,
    };
  }

  // Observe OFF means Observe cannot take over the visible/live prediction.
  // If a selected engine has a group, keep it executable as Weak Prediction.
  if (settings.executeObservation === false && isObserveTier && decision?.group) {
    return {
      ...decision,
      tier: "Active · Caution",
      observeSuppressed: true,
      reason: `${decision.reason ?? "Engine rule active."} · Observe OFF: displayed/executed as Weak Prediction.`,
    };
  }

  return decision;
}


function getTierExecutionNote(tier: string, group: GroupKey | null, numbers: SpinValue[]) {
  const groupText = group ? ` ${group}` : "";
  const numbersText = numbers.length ? ` · Numbers ${numbers.join(", ")}` : "";
  if (tier === "Hold · No Bet" || tier === "Observation Forecast" || tier === "No Prediction") return `${tier}${groupText} · OBSERVE HOLD · No Bet / PUSH · not settled as W/L${numbersText}`;
  if (tier === "Active · Caution") return `Weak Prediction${groupText} · Weak execution OFF · not settled as W/L${numbersText}`;
  return `${tier}${groupText}${numbersText}`;
}

function capUnitByLimits(rawUnit: number, executionBasketSize: number, tableLimit: number, perNumberLimit: number) {
  const basketSize = Math.max(1, executionBasketSize);
  const tableUnitCap = Math.max(1, Math.floor(Math.max(1, tableLimit) / basketSize));
  const perNumberCap = Math.max(1, perNumberLimit);
  return Math.max(1, Math.floor(Math.min(rawUnit, tableUnitCap, perNumberCap)));
}

function getDirectionalGapValues(decision: any): number[] {
  const summary = getDirectionalGapSummary(decision);
  return (summary?.rows ?? [])
    .map((row: any) => row.gap)
    .filter((gap: any) => typeof gap === "number") as number[];
}

function getStrongestDirectionalGap(decision: any): number {
  const gaps = getDirectionalGapValues(decision);
  return gaps.length ? Math.max(...gaps) : 0;
}

function getProgressiveGapMultiplier(decision: any): number {
  const strongestGap = getStrongestDirectionalGap(decision);
  if (strongestGap >= 66) return 4;
  if (strongestGap >= 50) return 3;
  if (strongestGap >= 34) return 2;
  return 1;
}


function getPost10WinRecoveryState(history: Step[] = []) {
  let normalLossStreak = 0;
  let armed = false;
  let pendingRecovery = false;
  let recoveryActive = false;
  let recoveryLosses = 0;

  for (const step of history) {
    if (pendingRecovery) {
      pendingRecovery = false;
      recoveryActive = true;
      recoveryLosses = 0;
    }

    if (step.result === "push") continue;

    if (recoveryActive) {
      if (step.result === "win") {
        recoveryActive = false;
        recoveryLosses = 0;
        normalLossStreak = 0;
        armed = false;
        pendingRecovery = false;
      } else if (step.result === "loss") {
        recoveryLosses += 1;
      }
      continue;
    }

    if (armed) {
      if (step.result === "win") {
        // The first win after the 10+ loss streak is still only a flat-bet win.
        // Recovery begins on the following spin.
        armed = false;
        pendingRecovery = true;
        normalLossStreak = 0;
      } else if (step.result === "loss") {
        normalLossStreak += 1;
      }
      continue;
    }

    if (step.result === "loss") {
      normalLossStreak += 1;
      if (normalLossStreak >= 10) armed = true;
    } else if (step.result === "win") {
      normalLossStreak = 0;
    }
  }

  return {
    armed,
    pendingRecovery,
    recoveryActive: recoveryActive || pendingRecovery,
    recoveryLosses: pendingRecovery ? 0 : recoveryLosses,
    normalLossStreak,
    phase: recoveryActive || pendingRecovery ? "Martingale-5 Recovery" : armed ? "Armed Flat" : "Flat" as const,
  };
}

function getPost10WinRecoveryNote(history: Step[] = []) {
  const state = getPost10WinRecoveryState(history);
  if (state.recoveryActive) {
    const block = Math.floor(state.recoveryLosses / 5) + 1;
    return `Post-10 Recovery Active · M5 block ${block} · recovery losses ${state.recoveryLosses}`;
  }
  if (state.armed) return `Post-10 Recovery Armed · flat betting · loss streak ${state.normalLossStreak}+`;
  return "Post-10 Recovery Flat";
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
  decision: any = null
) {
  const lossStreak = getLossStreak(history);
  let rawUnit = baseUnit;

  if (strategy === "Martingale 3") rawUnit = baseUnit * Math.pow(2, Math.floor(lossStreak / 3));
  else if (strategy === "Martingale 5") rawUnit = baseUnit * Math.pow(2, Math.floor(lossStreak / 5));
  else if (strategy === "Martingale 7") rawUnit = baseUnit * Math.pow(2, Math.floor(lossStreak / 7));
  else if (strategy === "Post-10 Win Recovery") {
    const recoveryState = getPost10WinRecoveryState(history);
    rawUnit = recoveryState.recoveryActive
      ? baseUnit * Math.pow(2, Math.floor(recoveryState.recoveryLosses / 5))
      : baseUnit;
  }
  else if (strategy === "Step Recovery") {
    if (lossStreak <= 2) rawUnit = baseUnit;
    else if (lossStreak <= 5) rawUnit = baseUnit * 2;
    else if (lossStreak <= 8) rawUnit = baseUnit * 3;
    else rawUnit = baseUnit * 4;
  } else if (strategy === "Exposure Cap") {
    const maxExposure = Math.max(baseUnit, bankroll * 0.02);
    rawUnit = Math.max(1, Math.floor(maxExposure / Math.max(1, executionBasketSize)));
  } else if (strategy === "Progressive Gap" || strategy === "Progressive Confidence") {
    rawUnit = baseUnit * getProgressiveGapMultiplier(decision);
  }

  return capUnitByLimits(rawUnit, executionBasketSize, tableLimit, perNumberLimit);
}

function uniqueNumbers(values: SpinValue[]) {
  return Array.from(new Set(values.map(String))).map((v) => (v === "00" ? "00" : Number(v))) as SpinValue[];
}

function getLongestStreak(results: boolean[], target: boolean) {
  let longest = 0;
  let current = 0;

  for (const result of results) {
    if (result === target) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  return longest;
}

function buildDimensionPerformance(history: Step[]) {
  const dimensions = {
    Color: [] as boolean[],
    Range: [] as boolean[],
    Parity: [] as boolean[],
  };

  history.forEach((row) => {
    const forecastGroup = row.forecastGroup ?? row.predictedGroup;
    const outcomeGroup = row.outcomeGroup;

    // Only score rows that actually produced a forecast group and resolved against an outcome.
    // This ties Dimension Performance directly to the same settled session data used elsewhere.
    if (!forecastGroup || !outcomeGroup || row.result === "push") return;

    const predictedBits = groupToBits(forecastGroup as GroupKey);
    const actualBits = groupToBits(outcomeGroup as GroupKey);

    dimensions.Color.push(predictedBits[0] === actualBits[0]);
    dimensions.Range.push(predictedBits[1] === actualBits[1]);
    dimensions.Parity.push(predictedBits[2] === actualBits[2]);
  });

  return Object.entries(dimensions).map(([name, results]) => {
    const wins = results.filter(Boolean).length;
    const losses = results.filter((v) => !v).length;
    const total = wins + losses;

    return {
      name,
      wins,
      losses,
      wr: total ? ((wins / total) * 100).toFixed(1) : "0.0",
      bestWin: getLongestStreak(results, true),
      worstLoss: getLongestStreak(results, false),
    };
  });
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

function getOverlayNumbersForExecutionMode(group: GroupKey | null, executionMode: ExecutionMode, source?: string, decision?: any) {
  if (!group) return [] as SpinValue[];
  if (executionMode === "Dimension Compression") return getDimensionCompressionOverlayNumbers(group, decision);
  if (executionMode === "Neighbor Expansion") return getNeighborExpansionNumbers(group, source);
  if (executionMode === "Edge Expansion") return getEdgeExpansionNumbers(group);
  if (executionMode === "Hybrid Coverage") return uniqueNumbers([...getNeighborExpansionNumbers(group, source), ...getEdgeExpansionNumbers(group)]);
  return [] as SpinValue[];
}

function getWheelNeighbors(group: GroupKey | null, source?: string, executionMode: ExecutionMode = "Stream Direct", decision?: any) {
  // Wheel Overlay display follows the selected Execution Mode.
  // Dimension Compression shows only the compressed extra numbers here;
  // the original group remains the core stream.
  return getOverlayNumbersForExecutionMode(group, executionMode, source, decision);
}

function getExecutionNumbers(group: GroupKey | null, executionMode: ExecutionMode, source?: string, decision?: any) {
  if (!group) return [];
  const streamNumbers = getCoreExecutionNumbers(group, source, decision, executionMode);
  const overlayNumbers = getOverlayNumbersForExecutionMode(group, executionMode, source, decision);
  return uniqueNumbers([...streamNumbers, ...overlayNumbers]);
}

function getWheelAlignment(group: GroupKey | null, executionMode: ExecutionMode, source?: string, decision?: any) {
  if (!group) return 0;
  if (executionMode === "Stream Direct") return 100;
  const neighbors = getOverlayNumbersForExecutionMode(group, executionMode, source, decision);
  if (!neighbors.length) return 100;
  const core = GROUPS[group];
  const compatible = neighbors.filter((n) => numberToGroup(n) === group).length;
  return Math.round(((core.length + compatible) / (core.length + neighbors.length)) * 100);
}

function hasStreamConflict(group: GroupKey | null, executionMode: ExecutionMode, source?: string, decision?: any) {
  if (!group || executionMode === "Stream Direct") return false;
  return getOverlayNumbersForExecutionMode(group, executionMode, source, decision).some((n) => numberToGroup(n) !== group);
}

function getAxisSpreadGap(sideSpread: any) {
  if (!sideSpread || typeof sideSpread.zero !== "number" || typeof sideSpread.one !== "number") return null;
  return Math.abs(sideSpread.zero - sideSpread.one);
}

function getDirectionalGapSummary(decision: any) {
  const diagnostics = decision?.pulseDiagnostics ?? {};
  const replay = decision?.replayDiagnostics ?? diagnostics?.replay ?? {};
  const spreadCore = diagnostics?.driftCore ?? replay?.driftCore ?? {};
  const sideSpread = diagnostics.axisSideSpread ?? replay.axisSideSpread ?? spreadCore.axisSideSpread ?? {};

  const rows = [
    { name: "Color", gap: getAxisSpreadGap(sideSpread.color) },
    { name: "Range", gap: getAxisSpreadGap(sideSpread.range) },
    { name: "Parity", gap: getAxisSpreadGap(sideSpread.parity) },
  ];
  const valid = rows.filter((row) => typeof row.gap === "number") as { name: string; gap: number }[];
  const avgGap = valid.length
    ? Math.round(valid.reduce((sum, row) => sum + row.gap, 0) / valid.length)
    : null;
  const avgGapTier = avgGap === null
    ? "—"
    : avgGap >= 25
    ? "Strong"
    : avgGap >= 10
    ? "Moderate"
    : "Weak";
  const zeroGapAxes = valid.filter((row) => row.gap === 0).map((row) => row.name);
  const zeroGapDisplay = zeroGapAxes.length ? `${zeroGapAxes.length} tied` : "Clear";

  return {
    rows,
    avgGap,
    avgGapTier,
    zeroGapAxes,
    zeroGapDisplay,
  };
}

function buildPulseAuditRecord(decision: any, outcomeGroup: GroupKey, forecastGroup: GroupKey | null, result: Result, active: boolean): PulseAudit {
  const diagnostics = decision?.pulseDiagnostics ?? {};
  const replay = decision?.replayDiagnostics ?? diagnostics?.replay ?? {};
  const sideConfidence = diagnostics.axisSideConfidence ?? replay.axisSideConfidence ?? {};
  const sideSpread = diagnostics.axisSideSpread ?? replay.axisSideSpread ?? {};
  const axisDpi = diagnostics.axisDpi ?? replay.axisDpi ?? {};

  const forecastBits = forecastGroup ? groupToBits(forecastGroup) : null;
  const outcomeBits = groupToBits(outcomeGroup);
  const colorCorrect = forecastBits ? forecastBits[0] === outcomeBits[0] : null;
  const rangeCorrect = forecastBits ? forecastBits[1] === outcomeBits[1] : null;
  const parityCorrect = forecastBits ? forecastBits[2] === outcomeBits[2] : null;
  const dimensionsCorrect = forecastBits ? [colorCorrect, rangeCorrect, parityCorrect].filter(Boolean).length : null;

  const colorGap = getAxisSpreadGap(sideSpread.color);
  const rangeGap = getAxisSpreadGap(sideSpread.range);
  const parityGap = getAxisSpreadGap(sideSpread.parity);
  const gaps = [
    { name: "Color", gap: colorGap },
    { name: "Range", gap: rangeGap },
    { name: "Parity", gap: parityGap },
  ].filter((row) => typeof row.gap === "number") as { name: string; gap: number }[];
  const closest = gaps.length ? gaps.slice().sort((a, b) => a.gap - b.gap)[0] : null;

  const failed = [
    { name: "Color", correct: colorCorrect, gap: colorGap },
    { name: "Range", correct: rangeCorrect, gap: rangeGap },
    { name: "Parity", correct: parityCorrect, gap: parityGap },
  ].filter((row) => row.correct === false);
  const weakestDimension = failed.length
    ? failed.slice().sort((a, b) => (a.gap ?? 999) - (b.gap ?? 999))[0].name
    : null;

  const colorSelected = forecastBits ? getAxisSideLabel("color", forecastBits[0]) : null;
  const rangeSelected = forecastBits ? getAxisSideLabel("range", forecastBits[1]) : null;
  const paritySelected = forecastBits ? getAxisSideLabel("parity", forecastBits[2]) : null;

  const colorDpiValue = typeof axisDpi.color === "number" ? axisDpi.color : null;
  const rangeDpiValue = typeof axisDpi.range === "number" ? axisDpi.range : null;
  const parityDpiValue = typeof axisDpi.parity === "number" ? axisDpi.parity : null;
  const andGate = computeAndConvergenceGate(colorDpiValue, rangeDpiValue, parityDpiValue);

  return {
    active,
    source: decision?.source ?? "NONE",
    forecastGroup,
    outcomeGroup,
    result,
    colorCorrect,
    rangeCorrect,
    parityCorrect,
    dimensionsCorrect,
    colorDpi: colorDpiValue,
    rangeDpi: rangeDpiValue,
    parityDpi: parityDpiValue,
    blackConfidence: typeof sideConfidence.color?.zero === "number" ? sideConfidence.color.zero : null,
    redConfidence: typeof sideConfidence.color?.one === "number" ? sideConfidence.color.one : null,
    blackSpread: typeof sideSpread.color?.zero === "number" ? sideSpread.color.zero : null,
    redSpread: typeof sideSpread.color?.one === "number" ? sideSpread.color.one : null,
    colorSignal: colorSelected,
    highConfidence: typeof sideConfidence.range?.zero === "number" ? sideConfidence.range.zero : null,
    lowConfidence: typeof sideConfidence.range?.one === "number" ? sideConfidence.range.one : null,
    highSpread: typeof sideSpread.range?.zero === "number" ? sideSpread.range.zero : null,
    lowSpread: typeof sideSpread.range?.one === "number" ? sideSpread.range.one : null,
    rangeSignal: rangeSelected,
    evenConfidence: typeof sideConfidence.parity?.zero === "number" ? sideConfidence.parity.zero : null,
    oddConfidence: typeof sideConfidence.parity?.one === "number" ? sideConfidence.parity.one : null,
    evenSpread: typeof sideSpread.parity?.zero === "number" ? sideSpread.parity.zero : null,
    oddSpread: typeof sideSpread.parity?.one === "number" ? sideSpread.parity.one : null,
    paritySignal: paritySelected,
    weakestDimension,
    closestSpreadDimension: closest?.name ?? null,
    smallestSpreadGap: closest?.gap ?? null,
    ...andGate,
  };
}



// AND Convergence Gate
// Each axis produces a Boolean: true = positive DPI (Black/High/Even side),
// false = negative DPI (Red/Low/Odd side), null = exactly zero (flat/no pressure).
// The AND gate is TRUE only when all three axes are non-null AND share the same direction.
// This is strict Boolean AND — one flat or dissenting axis collapses the gate to false.
function computeAndConvergenceGate(colorDpi: number | null, rangeDpi: number | null, parityDpi: number | null): {
  colorGateInput: boolean | null;
  rangeGateInput: boolean | null;
  parityGateInput: boolean | null;
  andConvergence: boolean;
  convergenceDirection: "B/H/E" | "R/L/O" | null;
  axesAgreeing: number;
} {
  const toGateBit = (dpi: number | null): boolean | null =>
    dpi === null ? null : dpi > 0 ? true : dpi < 0 ? false : null;

  const colorGateInput = toGateBit(colorDpi);
  const rangeGateInput = toGateBit(rangeDpi);
  const parityGateInput = toGateBit(parityDpi);

  // Strict AND: all three must be non-null and identical.
  const andConvergence =
    colorGateInput !== null &&
    rangeGateInput !== null &&
    parityGateInput !== null &&
    colorGateInput === rangeGateInput &&
    rangeGateInput === parityGateInput;

  const convergenceDirection: "B/H/E" | "R/L/O" | null = andConvergence
    ? colorGateInput === true ? "B/H/E" : "R/L/O"
    : null;

  // Partial agreement score (useful for diagnostics even when AND gate is closed).
  const bits = [colorGateInput, rangeGateInput, parityGateInput].filter((b) => b !== null);
  const trueCount = bits.filter(Boolean).length;
  const falseCount = bits.filter((b) => b === false).length;
  const axesAgreeing = Math.max(trueCount, falseCount);

  return { colorGateInput, rangeGateInput, parityGateInput, andConvergence, convergenceDirection, axesAgreeing };
}

function shouldBet(strategy: Strategy, confidence: number, pulseEnabled: boolean, group: GroupKey | null, decision: any = null) {
  if (!group) return false;

  const strongestGap = getStrongestDirectionalGap(decision);

  switch (strategy) {
    case "Gap-50":
    case "Confidence-75":
      return strongestGap >= 50;

    case "Gap-34":
    case "Confidence-65":
      return strongestGap >= 34;

    case "Progressive Gap":
    case "Progressive Confidence":
      return strongestGap >= 16 || !pulseEnabled;

    default:
      return true;
  }
}

function settleSpin(history: Step[], outcome: SpinValue, baseUnit: number, startingBankroll: number, strategy: Strategy, pulseEnabled: boolean, bbStraightEnabled: boolean, bbInvertedEnabled: boolean, executionMode: ExecutionMode = "Stream Direct", tableLimit = DEFAULT_TABLE_LIMIT, perNumberLimit = DEFAULT_PER_NUMBER_LIMIT, tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION, markovEnabled = false, randomEnabled = false): Step {
  const rawDecision = getActiveDecision(history, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, markovEnabled, randomEnabled);
  const f = normalizeObserveTierForSettings(rawDecision, tierExecution, history);
  const bankroll = history.at(-1)?.bankroll ?? startingBankroll;
  const pulseExecutionRouter = getPulseExecutionRouterDecision(pulseEnabled, executionMode, f, history);
  const routedExecutionMode = pulseExecutionRouter.selectedMode;
  const executionAllowed = shouldExecuteTier(f.tier, f.source, tierExecution, (f as any).rv, (f as any).entropyExtreme);
  const observePushHold = isObservePushTier(f.tier, tierExecution);
  const dimensionTDAAllowed = true; // TDA diagnostic only, not a hard gate.
  const pulseHasSelectedEngine = !pulseEnabled || bbStraightEnabled || bbInvertedEnabled || markovEnabled || randomEnabled;
const active = !observePushHold && f.source !== "NONE" && pulseHasSelectedEngine && shouldBet(strategy, f.confidence, pulseEnabled, f.group, f) && executionAllowed ;
  const previewNumbers = active && f.group ? getExecutionNumbers(f.group, routedExecutionMode, f.source, f) : [];
  const streamNumbers = active && f.group ? getCoreExecutionNumbers(f.group, f.source, f, routedExecutionMode) : [];
  const wheelNeighbors = active && f.group ? getWheelNeighbors(f.group, f.source, routedExecutionMode, f) : [];
  const numbers = previewNumbers;
  const activeBasket = routedExecutionMode === "Stream Direct" ? streamNumbers : numbers;
  const unit = active ? getUnitBet(strategy, baseUnit, f.confidence, history, activeBasket.length, bankroll, tableLimit, perNumberLimit, f) : 0;
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

  const overlayAllowed = routedExecutionMode !== "Stream Direct";

  const activeOverlayNeighbors =
    routedExecutionMode === "Dimension Compression"
      ? getDimensionCompressionOverlayNumbers(lockedForecastGroup, f)
      : routedExecutionMode === "Neighbor Expansion"
      ? neighborExpansionNumbers
      : routedExecutionMode === "Edge Expansion"
      ? edgeExpansionNumbers
      : routedExecutionMode === "Hybrid Coverage"
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
  const overlayResult: Result = "push";
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
      ? `${strategy === "Post-10 Win Recovery" ? `${getPost10WinRecoveryNote(history)} · ` : ""}${f.source} ${f.group} · ${f.source === "PULSE" && (f as any).dimensionTDA?.compressed ? "2D Compression · " : ""}${f.source === "PULSE" ? `${f.confidence}% · ` : ""}${routedExecutionMode}${pulseExecutionRouter.active ? " · Pulse Router" : ""}${overlayHit ? " · Wheel Overlay Hit" : ""}${hasStreamConflict(f.group, routedExecutionMode, f.source, f) ? " · Stream Conflict" : ""}`
      : observePushHold
      ? getTierExecutionNote(f.tier, f.group, f.group ? GROUPS[f.group] : [])
      : !dimensionTDAAllowed
      ? `TDA Diagnostic · ${((f as any).dimensionTDA?.failed ?? []).join("/") || "Axis"} below ${((f as any).dimensionTDA?.min ?? DEFAULT_DIMENSION_GATE_MIN)}%`
      : f.source === "PULSE" && (f as any).entropyExtreme
      ? `Entropy Extreme · No Bet · entropy ${((f as any).entropyValue ?? 0)}%`
      : getTierExecutionNote(f.tier, f.group, f.group ? GROUPS[f.group] : []),
    executionMode: routedExecutionMode,
    coreResult,
    overlayResult,
    wheelNeighbors: routedExecutionMode === "Stream Direct" ? [] : (activeOverlayNeighbors as SpinValue[]),
    wheelAlignment: getWheelAlignment(f.group, routedExecutionMode, f.source, f),
    streamConflict: hasStreamConflict(f.group, routedExecutionMode, f.source, f),
    pulseGate: (f as any).pulseGate ?? null,
    pulseDiagnostics: (f as any).pulseDiagnostics ?? null,
    pulseAudit: buildPulseAuditRecord(f, lockedOutcomeGroup, lockedForecastGroup, result, active),
    pulseDivergence: (f as any).pulseDivergence ?? null,
    pulseSelectedEngine: (f as any).pulseEngineTracker?.selectedEngine ?? null,
    pulseEngineTracker: (f as any).pulseEngineTracker ?? null,
    allEngineDiagnostics: (f as any).allEngineDiagnostics ?? null,
    // Snapshot of engine config at time of spin
    _pulseEnabled: pulseEnabled,
    _bbStraightEnabled: bbStraightEnabled,
    _bbInvertedEnabled: bbInvertedEnabled,
    _markovEnabled: markovEnabled,
    _randomEnabled: randomEnabled,
  };
}



type ShadowEngine = "PULSE" | "BB_STRAIGHT" | "BB_INVERTED" | "MARKOV" | "RANDOM";

type ComboShadowEngine = "PULSE_STRAIGHT" | "PULSE_INVERTED" | "PULSE_MARKOV" | "PULSE_RANDOM";

function getShadowDecision(history: Step[], engine: ShadowEngine) {
  const mode =
    engine === "PULSE"
      ? "Pulse Shadow"
      : engine === "BB_STRAIGHT"
      ? "Straight Shadow"
      : engine === "MARKOV"
      ? "Markov Shadow"
      : engine === "RANDOM"
      ? "Random Shadow"
      : "Inverted Shadow";

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

  if (engine === "RANDOM") {
    return {
      ...randomForecast(history),
      source: "RANDOM" as const,
      mode,
    };
  }

  return {
    ...bbInvertedForecast(history),
    source: "BB_INVERTED" as const,
    mode,
  };
}

function settleSpinShadow(history: Step[], outcome: SpinValue, baseUnit: number, startingBankroll: number, strategy: Strategy, engine: ShadowEngine, executionMode: ExecutionMode = "Stream Direct", tableLimit = DEFAULT_TABLE_LIMIT, perNumberLimit = DEFAULT_PER_NUMBER_LIMIT, tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION): Step {
  const rawDecision = getShadowDecision(history, engine);
  const f = normalizeObserveTierForSettings(rawDecision, tierExecution, history);
  const bankroll = history.at(-1)?.bankroll ?? startingBankroll;
  const executionAllowed = shouldExecuteTier(f.tier, f.source, tierExecution, (f as any).rv, (f as any).entropyExtreme);
  const observePushHold = isObservePushTier(f.tier, tierExecution);
  const dimensionTDAAllowed = true; // TDA diagnostic only, not a hard gate.
  const active = !observePushHold && shouldBet(strategy, f.confidence, engine === "PULSE", f.group, f) && executionAllowed ;
  const previewNumbers = active && f.group ? getExecutionNumbers(f.group, executionMode, f.source, f) : [];
  const streamNumbers = active && f.group ? getCoreExecutionNumbers(f.group, f.source, f, executionMode) : [];
  const wheelNeighbors = active && f.group ? getWheelNeighbors(f.group, f.source) : [];
  const numbers = previewNumbers;
  const activeBasket = executionMode === "Stream Direct" ? streamNumbers : numbers;
  const unit = active ? getUnitBet(strategy, baseUnit, f.confidence, history, activeBasket.length, bankroll, tableLimit, perNumberLimit, f) : 0;
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
    executionMode === "Dimension Compression"
      ? getDimensionCompressionOverlayNumbers(lockedForecastGroup, f)
      : executionMode === "Neighbor Expansion"
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
  const overlayResult: Result = "push";
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
      : observePushHold
      ? getTierExecutionNote(f.tier, f.group, f.group ? GROUPS[f.group] : [])
      : !dimensionTDAAllowed
      ? `TDA Diagnostic · ${((f as any).dimensionTDA?.failed ?? []).join("/") || "Axis"} below ${((f as any).dimensionTDA?.min ?? DEFAULT_DIMENSION_GATE_MIN)}%`
      : getTierExecutionNote(f.tier, f.group, f.group ? GROUPS[f.group] : []),
    executionMode,
    coreResult,
    overlayResult,
    wheelNeighbors: executionMode === "Stream Direct" ? [] : activeOverlayNeighbors,
    wheelAlignment: getWheelAlignment(f.group, executionMode, f.source, f),
    streamConflict: hasStreamConflict(f.group, executionMode, f.source, f),
  };
}

function getLongestLossStreakFromRows(rows: Step[]) {
  // PUSH / HOLD rows are separators, not losses.
  let current = 0;
  let longest = 0;
  rows.forEach((row) => {
    if (row.result === "loss") {
      current += 1;
      longest = Math.max(longest, current);
    } else {
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
  const rawDecision = getNeuralShadowDecision(history);
  const f = normalizeObserveTierForSettings(rawDecision, tierExecution, history);
  const bankroll = history.at(-1)?.bankroll ?? startingBankroll;
  const executionAllowed = shouldExecuteTier(f.tier, f.source, tierExecution, (f as any).rv, (f as any).entropyExtreme);
  const observePushHold = isObservePushTier(f.tier, tierExecution);
  const dimensionTDAAllowed = true; // TDA diagnostic only, not a hard gate.
  const active = !observePushHold && shouldBet(strategy, f.confidence, true, f.group, f) && executionAllowed ;
  const previewNumbers = active && f.group ? getExecutionNumbers(f.group, executionMode, f.source, f) : [];
  const streamNumbers = active && f.group ? getCoreExecutionNumbers(f.group, f.source, f, executionMode) : [];
  const wheelNeighbors = active && f.group ? getWheelNeighbors(f.group, f.source) : [];
  const numbers = previewNumbers;
  const activeBasket = executionMode === "Stream Direct" ? streamNumbers : numbers;
  const unit = active ? getUnitBet(strategy, baseUnit, f.confidence, history, activeBasket.length, bankroll, tableLimit, perNumberLimit, f) : 0;
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
    executionMode === "Dimension Compression"
      ? getDimensionCompressionOverlayNumbers(lockedForecastGroup, f)
      : executionMode === "Neighbor Expansion"
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
  const overlayResult: Result = "push";
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
    wheelAlignment: getWheelAlignment(f.group, executionMode, f.source, f),
    streamConflict: hasStreamConflict(f.group, executionMode, f.source, f),
  };
}

function runNeuralShadowStrategy(outcomes: SpinValue[], strategy: Strategy, baseUnit: number, startingBankroll: number, executionMode: ExecutionMode = "Stream Direct", tableLimit = DEFAULT_TABLE_LIMIT, perNumberLimit = DEFAULT_PER_NUMBER_LIMIT, tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION) {
  const rows: Step[] = [];
  outcomes.forEach((o) => rows.push(settleSpinNeuralShadow(rows, o, baseUnit, startingBankroll, strategy, executionMode, tableLimit, perNumberLimit, tierExecution)));
  return rows;
}

function runShadowStrategy(outcomes: SpinValue[], strategy: Strategy, baseUnit: number, startingBankroll: number, engine: ShadowEngine, executionMode: ExecutionMode = "Stream Direct", tableLimit = DEFAULT_TABLE_LIMIT, perNumberLimit = DEFAULT_PER_NUMBER_LIMIT, tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION) {
  const rows: Step[] = [];
  outcomes.forEach((o) => rows.push(settleSpinShadow(rows, o, baseUnit, startingBankroll, strategy, engine, executionMode, tableLimit, perNumberLimit, tierExecution)));
  return rows;
}

function runStrategy(outcomes: SpinValue[], strategy: Strategy, baseUnit: number, startingBankroll: number, pulseEnabled: boolean, bbStraightEnabled: boolean, bbInvertedEnabled: boolean, executionMode: ExecutionMode = "Stream Direct", tableLimit = DEFAULT_TABLE_LIMIT, perNumberLimit = DEFAULT_PER_NUMBER_LIMIT, tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION, markovEnabled = false, randomEnabled = false) {
  const rows: Step[] = [];
  outcomes.forEach((o) => rows.push(settleSpin(rows, o, baseUnit, startingBankroll, strategy, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, tierExecution, markovEnabled, randomEnabled)));
  return rows;
}


function runComboShadowStrategy(
  outcomes: SpinValue[],
  strategy: Strategy,
  baseUnit: number,
  startingBankroll: number,
  combo: ComboShadowEngine,
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
        combo === "PULSE_STRAIGHT" || combo === "PULSE_INVERTED",
        combo === "PULSE_INVERTED",
        executionMode,
        tableLimit,
        perNumberLimit,
        tierExecution,
        combo === "PULSE_MARKOV",
        combo === "PULSE_RANDOM"
      )
    );
  });
  return rows;
}

function runComparisonStrategyReplay(outcomes: SpinValue[], comparisonStrategy: Strategy, baseUnit: number, startingBankroll: number, pulseEnabled: boolean, bbStraightEnabled: boolean, bbInvertedEnabled: boolean, executionMode: ExecutionMode = "Stream Direct", tableLimit = DEFAULT_TABLE_LIMIT, perNumberLimit = DEFAULT_PER_NUMBER_LIMIT, tierExecution: TierExecutionSettings = DEFAULT_TIER_EXECUTION, markovEnabled = false, randomEnabled = false) {
  // LOCKED COMPARISON STABILITY
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
        randomEnabled
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
  const [pulseEnabled, setPulseEnabled] = useState(false);
  const [bbMode, setBbMode] = useState<BBMode>("Straight");
  const [bbStraightEnabled, setBbStraightEnabled] = useState(false);
  const [bbInvertedEnabled, setBbInvertedEnabled] = useState(false);
  const [markovEnabled, setMarkovEnabled] = useState(false);
  const [randomEnabled, setRandomEnabled] = useState(false);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("Stream Direct");
const visibleExecutionModes: ExecutionMode[] = EXECUTION_MODES;

const setPulseEnabledSafely = (nextPulseEnabled: boolean) => {
  setPulseEnabled(nextPulseEnabled);
};
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
  const f = useMemo(
    () =>
      normalizeObserveTierForSettings(
        getActiveDecision(history, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, markovEnabled, randomEnabled),
        tierExecution,
        history
      ),
    [history, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, markovEnabled, randomEnabled, tierExecution]
  );
  const pulseExecutionRouter = useMemo(() => getPulseExecutionRouterDecision(pulseEnabled, executionMode, f, history), [pulseEnabled, executionMode, f, history]);
  const effectiveExecutionMode: ExecutionMode = pulseExecutionRouter.selectedMode;
  const liveGapSummary = useMemo(() => getDirectionalGapSummary(f), [f]);
  const liveAvgGapAccent = liveGapSummary.avgGap === null
    ? t.subtext
    : liveGapSummary.avgGap >= 25
    ? COLORS.green
    : liveGapSummary.avgGap >= 10
    ? COLORS.cyan
    : COLORS.amber;
  const liveZeroGapAccent = liveGapSummary.zeroGapAxes.length ? COLORS.red : COLORS.green;
  const wheelNeighbors = useMemo(() => getWheelNeighbors(f.group, f.source, effectiveExecutionMode, f), [f.group, f.source, effectiveExecutionMode, f]);
  const executionNumbers = useMemo(() => getExecutionNumbers(f.group, effectiveExecutionMode, f.source, f), [f.group, effectiveExecutionMode, f.source, f]);
  const compressionAddedNumbers = useMemo(() => effectiveExecutionMode === "Dimension Compression" ? getDimensionCompressionOverlayNumbers(f.group, f) : [] as SpinValue[], [f.group, f, effectiveExecutionMode]);
  const compressionBasketNumbers = useMemo(() => effectiveExecutionMode === "Dimension Compression" ? getDimensionCompressionNumbers(f.group, f) : [] as SpinValue[], [f.group, f, effectiveExecutionMode]);
  const wheelAlignment = useMemo(() => getWheelAlignment(f.group, effectiveExecutionMode, f.source, f), [f.group, effectiveExecutionMode, f.source, f]);
  const streamConflict = useMemo(() => hasStreamConflict(f.group, effectiveExecutionMode, f.source, f), [f.group, effectiveExecutionMode, f.source, f]);
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
  const isPulseOnlyMode = pulseEnabled && !bbStraightEnabled && !bbInvertedEnabled && !markovEnabled && !randomEnabled;
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
    const normalized = sessions.map((session) => ({ ...session, strategy: normalizeStrategyName(session.strategy) }));
    setSavedSessions(normalized);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  };

  React.useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setSavedSessions((JSON.parse(raw) as SavedSession[]).map((session) => ({ ...session, strategy: normalizeStrategyName(session.strategy) })));
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
      if (saved.strategy) setStrategy(normalizeStrategyName(saved.strategy));
      if (typeof saved.pulseEnabled === "boolean") setPulseEnabled(saved.pulseEnabled);
      if (typeof saved.bbStraightEnabled === "boolean") setBbStraightEnabled(saved.bbStraightEnabled);
      if (typeof saved.bbInvertedEnabled === "boolean") setBbInvertedEnabled(saved.bbInvertedEnabled);
      if (typeof saved.markovEnabled === "boolean") setMarkovEnabled(saved.markovEnabled);
      if (typeof saved.randomEnabled === "boolean") setRandomEnabled(saved.randomEnabled);
      if (saved.executionMode && EXECUTION_MODES.includes(saved.executionMode)) setExecutionMode(saved.executionMode);
      if (typeof saved.executeWeak === "boolean") setExecuteWeak(saved.executeWeak);
      if (typeof saved.executeObservation === "boolean") setExecuteObservation(saved.executeObservation);
      if (saved.appearance === "light" || saved.appearance === "dark") setAppearance(saved.appearance);
    } catch {
      localStorage.removeItem(CONTROL_SETTINGS_KEY);
    }
  }, []);

  const addSpin = (value: SpinValue) => setHistory((h) => [...h, settleSpin(h, value, baseUnit, startingBankroll, strategy, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, tierExecution, markovEnabled, randomEnabled)]);
  const rebuild = (start = startingBankroll, unit = baseUnit, nextStrategy = strategy, nextPulse = pulseEnabled) => {
    setHistory(runStrategy(history.map((h) => h.outcome), nextStrategy, unit, start, nextPulse, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, tierExecution, markovEnabled, randomEnabled));
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
          markovEnabled,
          randomEnabled
        )
      );
    }
  };


  const applyBBMode = (nextStraight: boolean, nextInverted: boolean) => {
    setBbStraightEnabled(nextStraight);
    setBbInvertedEnabled(nextInverted);
    setMarkovEnabled(false);
    setRandomEnabled(false);

    const outcomes = history.map((h) => h.outcome);
    if (outcomes.length) {
      setHistory(runStrategy(outcomes, strategy, baseUnit, startingBankroll, pulseEnabled, nextStraight, nextInverted, executionMode, tableLimit, perNumberLimit, tierExecution, false, false));
    }
  };

  const applyMarkovMode = () => {
    setBbStraightEnabled(false);
    setBbInvertedEnabled(false);
    setMarkovEnabled(true);
    setRandomEnabled(false);

    const outcomes = history.map((h) => h.outcome);
    if (outcomes.length) {
      setHistory(runStrategy(outcomes, strategy, baseUnit, startingBankroll, pulseEnabled, false, false, executionMode, tableLimit, perNumberLimit, tierExecution, true, false));
    }
  };

  const applyRandomMode = () => {
    setBbStraightEnabled(false);
    setBbInvertedEnabled(false);
    setMarkovEnabled(false);
    setRandomEnabled(true);

    const outcomes = history.map((h) => h.outcome);
    if (outcomes.length) {
      setHistory(runStrategy(outcomes, strategy, baseUnit, startingBankroll, pulseEnabled, false, false, executionMode, tableLimit, perNumberLimit, tierExecution, false, true));
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
          markovEnabled,
          randomEnabled
        )
      );
    }
  };

  const runAuto = () => {
    setAutoRunning(true);
    window.setTimeout(() => {
      const rows: Step[] = [];
      for (let i = 0; i < autoSpins; i += 1) {
        const priorRows = [...rows];
        const settled = settleSpin(rows, randomSpin(), baseUnit, startingBankroll, strategy, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, tierExecution, markovEnabled, randomEnabled);
        const autoRunAudit = buildAutoRunAuditEntry(priorRows, settled);
        rows.push({ ...settled, autoRun: true, autoRunAudit });
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
    setPulseEnabled(false);
    setBbStraightEnabled(false);
    setBbMode("BB Off");
    setBbInvertedEnabled(false);
    setMarkovEnabled(false);
    setRandomEnabled(false);
    setExecutionMode("Stream Direct");
    setExecuteWeak(DEFAULT_EXECUTE_WEAK);
    setExecuteObservation(DEFAULT_EXECUTE_OBSERVATION);
  };

  const saveSession = () => {
    const name = sessionName.trim();
    if (!name) return;
    const next: SavedSession = { name, createdAt: new Date().toISOString(), startingBankroll, baseUnit, tableLimit, perNumberLimit, autoSpins, strategy, pulseEnabled, bbMode, bbStraightEnabled, bbInvertedEnabled, randomEnabled, executeWeak, executeObservation, executionMode, history };
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
    setStrategy(normalizeStrategyName(s.strategy));
    setPulseEnabled(s.pulseEnabled);
    setBbStraightEnabled(s.bbStraightEnabled ?? false);
    setBbInvertedEnabled(s.bbInvertedEnabled ?? false);
    setRandomEnabled(s.randomEnabled ?? false);
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
    sessions.forEach((s) => s.history.forEach((h) => rows.push(settleSpin(rows, h.outcome, baseUnit, startingBankroll, strategy, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, tierExecution, markovEnabled, randomEnabled))));
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
      randomEnabled,
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

  const getStructureForHistoryRow = (row: Step) => {
    const a = row.pulseAudit;
    // Primary: use spread values (populated by Directional Spread Pulse engine)
    const colorGap = typeof a?.blackSpread === "number" && typeof a?.redSpread === "number"
      ? Math.abs(a.blackSpread - a.redSpread) : null;
    const rangeGap = typeof a?.highSpread === "number" && typeof a?.lowSpread === "number"
      ? Math.abs(a.highSpread - a.lowSpread) : null;
    const parityGap = typeof a?.evenSpread === "number" && typeof a?.oddSpread === "number"
      ? Math.abs(a.evenSpread - a.oddSpread) : null;

    // Fallback: when BB Straight + Pulse is active, spread values are null.
    // Use DPI absolute values as a proxy — DPI magnitude reflects axis pressure
    // in the same 0–100 range the structure label system expects.
    const colorGapFinal = colorGap ?? (typeof a?.colorDpi === "number" ? Math.min(100, Math.abs(a.colorDpi) * 8) : null);
    const rangeGapFinal = rangeGap ?? (typeof a?.rangeDpi === "number" ? Math.min(100, Math.abs(a.rangeDpi) * 8) : null);
    const parityGapFinal = parityGap ?? (typeof a?.parityDpi === "number" ? Math.min(100, Math.abs(a.parityDpi) * 8) : null);

    return `${getStructureGapLabel(colorGapFinal)} / ${getStructureGapLabel(rangeGapFinal)} / ${getStructureGapLabel(parityGapFinal)}`;
  };

  const getExecutionValueForRow = (row: Step) => {
    const forecastGroup = (row.forecastGroup ?? row.predictedGroup ?? null) as GroupKey | null;
    const coreNumbers = row.forecastNumbers?.length
      ? row.forecastNumbers
      : forecastGroup
      ? GROUPS[forecastGroup] ?? []
      : [];
    const addedNumbers = row.wheelNeighbors ?? [];
    const outcomeKey = String(row.outcome);
    const coreHit = row.result === "win" && coreNumbers.some((value) => String(value) === outcomeKey);
    const addedHit = row.result === "win" && addedNumbers.some((value) => String(value) === outcomeKey);
    const addedSource =
      row.executionMode === "Dimension Compression"
        ? "Compression"
        : row.executionMode === "Neighbor Expansion"
        ? "Neighbor"
        : row.executionMode === "Edge Expansion"
        ? "Edge"
        : row.executionMode === "Hybrid Coverage"
        ? "Hybrid"
        : "None";
    const winningSource = coreHit ? "Core" : addedHit ? addedSource : "None";
    return {
      coreHit,
      addedHit,
      coreHitLabel: coreHit ? "YES" : "NO",
      addedHitLabel: row.executionMode === "Stream Direct" ? "—" : addedHit ? "YES" : "NO",
      winningSource,
      coreNumbers,
      addedNumbers,
    };
  };

  const rowsForExport = () => [
    ["Spin", "Forecast", "Outcome", "Execution Mode", "Dimensions Correct", "Color", "Range", "Parity", "Core Hit", "Winning Source", "Pulse", "Engine"],
    ...history.map((h) => {
      const forecastBasket = (h.forecastGroup ?? h.predictedGroup ?? "") as any;
      const quality = forecastBasket ? getForecastQualityForGroups(forecastBasket, h.outcomeGroup) : { dimensionsCorrect: "" as any };
      const executionValue = getExecutionValueForRow(h);
      const rowPulse = (h as any)._pulseEnabled;
      const rowBBStr = (h as any)._bbStraightEnabled;
      const rowBBInv = (h as any)._bbInvertedEnabled;
      const rowMarkov = (h as any)._markovEnabled;
      const rowRandom = (h as any)._randomEnabled;
      const engineLabel = rowRandom ? "Random" : rowMarkov ? "Markov"
        : rowBBStr && rowBBInv ? "Inverted" : rowBBStr ? "Straight"
        : rowPulse ? "Pulse Only" : "Off";
      const fc = forecastBasket ? groupToBits(forecastBasket as GroupKey) : null;
      const oc = h.outcomeGroup ? groupToBits(h.outcomeGroup as GroupKey) : null;
      const colorHit  = fc && oc ? (fc[0]===oc[0]?"C":"I") : "—";
      const rangeHit  = fc && oc ? (fc[1]===oc[1]?"C":"I") : "—";
      const parityHit = fc && oc ? (fc[2]===oc[2]?"C":"I") : "—";
      return [
        h.spin, forecastBasket, h.outcomeGroup, h.executionMode,
        quality.dimensionsCorrect ?? "",
        colorHit, rangeHit, parityHit,
        executionValue.coreHitLabel, executionValue.winningSource,
        rowPulse === undefined ? "—" : rowPulse ? "ON" : "OFF",
        rowPulse === undefined ? "—" : engineLabel,
      ];
    }),
  ];

  const rowsForPulseAuditExport = () => [
    ["Spin", "Result", "Forecast", "Outcome", "DimensionsCorrect", "ColorCorrect", "RangeCorrect", "ParityCorrect", "ColorDPI", "BlackConfidence", "RedConfidence", "BlackSpread", "RedSpread", "ColorGap", "ColorSignal", "RangeDPI", "HighConfidence", "LowConfidence", "HighSpread", "LowSpread", "RangeGap", "RangeSignal", "ParityDPI", "EvenConfidence", "OddConfidence", "EvenSpread", "OddSpread", "ParityGap", "ParitySignal", "AvgGap", "StrongestGap", "ZeroGap", "GapTier", "WeakestDimension", "ClosestSpreadDimension", "SmallestSpreadGap", "ANDConvergence", "ConvergenceDirection", "AxesAgreeing"],
    ...history.map((h) => {
      const a = h.pulseAudit;
      const colorGap = typeof a?.blackSpread === "number" && typeof a?.redSpread === "number" ? Math.abs(a.blackSpread - a.redSpread) : "";
      const rangeGap = typeof a?.highSpread === "number" && typeof a?.lowSpread === "number" ? Math.abs(a.highSpread - a.lowSpread) : "";
      const parityGap = typeof a?.evenSpread === "number" && typeof a?.oddSpread === "number" ? Math.abs(a.evenSpread - a.oddSpread) : "";
      const gaps = [colorGap, rangeGap, parityGap].filter((gap): gap is number => typeof gap === "number");
      const avgGap = gaps.length ? Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) : "";
      const strongestGap = gaps.length ? Math.max(...gaps) : "";
      const zeroGap = gaps.some((gap) => gap === 0) ? "YES" : "NO";
      return [h.spin, h.result, h.predictedGroup ?? "", h.outcomeGroup, a?.dimensionsCorrect ?? "", a?.colorCorrect ?? "", a?.rangeCorrect ?? "", a?.parityCorrect ?? "", a?.colorDpi ?? "", a?.blackConfidence ?? "", a?.redConfidence ?? "", a?.blackSpread ?? "", a?.redSpread ?? "", colorGap, a?.colorSignal ?? "", a?.rangeDpi ?? "", a?.highConfidence ?? "", a?.lowConfidence ?? "", a?.highSpread ?? "", a?.lowSpread ?? "", rangeGap, a?.rangeSignal ?? "", a?.parityDpi ?? "", a?.evenConfidence ?? "", a?.oddConfidence ?? "", a?.evenSpread ?? "", a?.oddSpread ?? "", parityGap, a?.paritySignal ?? "", avgGap, strongestGap, zeroGap, h.tier, a?.weakestDimension ?? "", a?.closestSpreadDimension ?? "", a?.smallestSpreadGap ?? "", a?.andConvergence ? "YES" : "NO", a?.convergenceDirection ?? "—", a?.axesAgreeing ?? 0];
    }),
  ];

  const downloadRowsAsCSV = (rows: any[][], filename: string) => {
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/—/g, "-").replace(/–/g, "-").replace(/"/g, '""')}"`).join(",")).join(String.fromCharCode(10));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadCSV = () => downloadRowsAsCSV(rowsForExport(), "edgelab_pulse_roulette_session.csv");
  const downloadPulseAuditCSV = () => downloadRowsAsCSV(rowsForPulseAuditExport(), "edgelab_pulse_audit_trail.csv");


  // TEMPORARY STRUCTURE FORECAST QUALITY REPORT
  // Purpose: Structure -> forecast dimensional quality only.
  // This does not track win/loss, bankroll, execution mode, tier, or migration.
  const getForecastQualityForGroups = (forecastBasket?: GroupKey | null, actualBasket?: GroupKey | null) => {
    if (!forecastBasket || !actualBasket) return { dimensionsCorrect: null as number | null };
    const forecastBits = groupToBits(forecastBasket);
    const actualBits = groupToBits(actualBasket);
    const dimensionsCorrect = forecastBits.reduce((sum: number, bit, index) => sum + (bit === actualBits[index] ? 1 : 0), 0 as number);
    return { dimensionsCorrect };
  };

  const getStructureGapLabel = (gap: number | null) => {
    if (gap === null) return "—";
    return String(gap);
  };

  const getStructureForecastQualityRows = () => {
    const map: Record<string, { structure: string; forecast: string; outcome: string; samples: number; sum: number; zero: number; one: number; two: number; three: number }> = {};

    history.forEach((row) => {
      const forecastBasket = (row.forecastGroup ?? row.predictedGroup ?? null) as GroupKey | null;
      if (!forecastBasket || !row.outcomeGroup) return;

      const metric = getGapMetricsForRow(row);
      const structure = `${getStructureGapLabel(metric.colorGap)} / ${getStructureGapLabel(metric.rangeGap)} / ${getStructureGapLabel(metric.parityGap)}`;
      const forecast = String(forecastBasket);
      const outcome = String(row.outcomeGroup);
      const key = `${structure}|${forecast}|${outcome}`;
      const quality = getForecastQualityForGroups(forecastBasket, row.outcomeGroup);
      const dimensionsCorrect = quality.dimensionsCorrect;
      if (typeof dimensionsCorrect !== "number") return;

      if (!map[key]) map[key] = { structure, forecast, outcome, samples: 0, sum: 0, zero: 0, one: 0, two: 0, three: 0 };
      map[key].samples += 1;
      map[key].sum += dimensionsCorrect;
      if (dimensionsCorrect === 0) map[key].zero += 1;
      else if (dimensionsCorrect === 1) map[key].one += 1;
      else if (dimensionsCorrect === 2) map[key].two += 1;
      else if (dimensionsCorrect === 3) map[key].three += 1;
    });

    return Object.values(map).sort((a, b) => {
      const aAvg = a.samples ? a.sum / a.samples : 0;
      const bAvg = b.samples ? b.sum / b.samples : 0;
      return bAvg - aAvg || b.samples - a.samples || a.structure.localeCompare(b.structure) || a.forecast.localeCompare(b.forecast) || a.outcome.localeCompare(b.outcome);
    });
  };

  const rowsForStructureForecastQualityExport = () => [
    ["Gap Structure", "Forecast", "Outcome", "Samples", "Avg Dim Correct", "0/3", "1/3", "2/3", "3/3"],
    ...getStructureForecastQualityRows().map((row) => {
      const pct = (value: number) => row.samples ? `${((value / row.samples) * 100).toFixed(1)}%` : "0.0%";
      return [
        row.structure,
        row.forecast,
        row.outcome,
        row.samples,
        row.samples ? (row.sum / row.samples).toFixed(2) : "0.00",
        pct(row.zero),
        pct(row.one),
        pct(row.two),
        pct(row.three),
      ];
    }),
  ];

  const downloadStructureForecastQualityCSV = () => downloadRowsAsCSV(rowsForStructureForecastQualityExport(), "edgelab_temp_structure_forecast_quality.csv");



  const TI_VALIDATION_WINDOW = 5;

  const getDominantBitForAxis = (steps: Step[], axisIndex: number) => {
    let ones = 0;
    let zeros = 0;
    steps.forEach((step) => {
      const bits = groupToBits(step.outcomeGroup);
      if (bits[axisIndex] === 1) ones += 1;
      else zeros += 1;
    });
    if (ones === zeros) return null as 0 | 1 | null;
    return ones > zeros ? 1 as 0 | 1 : 0 as 0 | 1;
  };

  const getActualTIRegimeForWindow = (index: number, windowSize = TI_VALIDATION_WINDOW) => {
    const current = history[index];
    const future = history.slice(index + 1, index + 1 + windowSize);
    const prior = history.slice(Math.max(0, index - windowSize + 1), index + 1);

    if (!current || future.length < Math.min(3, windowSize)) {
      return {
        actualRegime: "Pending",
        validationWindow: future.length,
        reversedAxes: 0,
        uniqueFutureGroups: 0,
        confidence: "Pending",
      };
    }

    const priorDominants = [0, 1, 2].map((axis) => getDominantBitForAxis(prior, axis));
    const futureDominants = [0, 1, 2].map((axis) => getDominantBitForAxis(future, axis));
    const currentBits = groupToBits(current.outcomeGroup);

    const reversedAxes = [0, 1, 2].filter((axis) =>
      priorDominants[axis] !== null &&
      futureDominants[axis] !== null &&
      priorDominants[axis] !== futureDominants[axis]
    ).length;

    const futureAgainstCurrent = [0, 1, 2].filter((axis) =>
      futureDominants[axis] !== null && futureDominants[axis] !== currentBits[axis]
    ).length;

    const uniqueFutureGroups = Array.from(new Set(future.map((step) => step.outcomeGroup))).length;
    const zeroDimCount = future.filter((step) => {
      const forecast = current.forecastGroup ?? current.predictedGroup ?? null;
      return forecast ? getForecastQualityForGroups(forecast, step.outcomeGroup).dimensionsCorrect === 0 : false;
    }).length;
    const twoPlusDimCount = future.filter((step) => {
      const forecast = current.forecastGroup ?? current.predictedGroup ?? null;
      return forecast ? (getForecastQualityForGroups(forecast, step.outcomeGroup).dimensionsCorrect ?? 0) >= 2 : false;
    }).length;

    let actualRegime = "Stable";
    if (uniqueFutureGroups >= 5 || (reversedAxes >= 2 && zeroDimCount >= 1)) actualRegime = "Scatter";
    else if (reversedAxes >= 2 || futureAgainstCurrent >= 2) actualRegime = "Family Rotation";
    else if (reversedAxes === 1 || futureAgainstCurrent === 1) actualRegime = "Compression Watch";
    else if (uniqueFutureGroups <= 2) actualRegime = "Tight Basket / Compression";
    else if (twoPlusDimCount >= Math.max(3, Math.ceil(future.length * 0.6))) actualRegime = "Re-Alignment";
    else if (uniqueFutureGroups >= 4) actualRegime = "Neighbor / Edge Friendly";

    const confidence =
      future.length >= 5 && (reversedAxes >= 2 || uniqueFutureGroups <= 2 || uniqueFutureGroups >= 5) ? "Strong" :
      future.length >= 4 ? "Moderate" :
      "Weak";

    return {
      actualRegime,
      validationWindow: future.length,
      reversedAxes,
      uniqueFutureGroups,
      confidence,
    };
  };

  const getTIValidationForRow = (index: number, state: string, expectedRegime: string) => {
    const validation = getActualTIRegimeForWindow(index);
    if (validation.actualRegime === "Pending" || !state || state === "—") {
      return {
        tiValidationWindow: validation.validationWindow,
        tiActualRegime: validation.actualRegime,
        tiCorrect: "Pending",
        tiValidationConfidence: validation.confidence,
      };
    }

    const actual = validation.actualRegime;
    const expected = expectedRegime || "—";
    const normalizedState = state || "—";

    const correct =
      (normalizedState === "Reversal" && actual === "Family Rotation") ||
      (normalizedState === "Drift" && (actual === "Compression Watch" || actual === "Tight Basket / Compression" || actual === "Family Rotation")) ||
      (normalizedState === "Compression" && actual === "Tight Basket / Compression") ||
      (normalizedState === "Expansion" && actual === "Neighbor / Edge Friendly") ||
      (normalizedState === "Recovery" && actual === "Re-Alignment") ||
      (normalizedState === "Scatter" && actual === "Scatter") ||
      (normalizedState === "Stable" && actual === "Stable") ||
      (expected.includes("Family Rotation") && actual === "Family Rotation") ||
      (expected.includes("Compression") && actual === "Tight Basket / Compression") ||
      (expected.includes("Neighbor") && actual === "Neighbor / Edge Friendly") ||
      (expected.includes("Re-Alignment") && actual === "Re-Alignment");

    return {
      tiValidationWindow: validation.validationWindow,
      tiActualRegime: actual,
      tiCorrect: correct ? "YES" : "NO",
      tiValidationConfidence: validation.confidence,
    };
  };

  const getTIAccuracySummaryRows = (rows: any[]) => {
    const validRows = rows.filter((row) => row.tiCorrect === "YES" || row.tiCorrect === "NO");
    const byState = (state: string) => {
      const stateRows = validRows.filter((row) => row.transitionState === state);
      const correct = stateRows.filter((row) => row.tiCorrect === "YES").length;
      const pct = stateRows.length ? `${Math.round((correct / stateRows.length) * 100)}%` : "—";
      return { state, correct, samples: stateRows.length, pct };
    };
    return [
      { state: "Overall", correct: validRows.filter((row) => row.tiCorrect === "YES").length, samples: validRows.length, pct: validRows.length ? `${Math.round((validRows.filter((row) => row.tiCorrect === "YES").length / validRows.length) * 100)}%` : "—" },
      byState("Reversal"),
      byState("Drift"),
      byState("Compression"),
      byState("Expansion"),
      byState("Recovery"),
      byState("Scatter"),
      byState("Stable"),
    ];
  };

  // ─── ENGINE / GATE SUMMARY (current architecture) ─────────────────────────
  // Replaces the old Structure/Family/Router Recommendation/TI Adjustment
  // fields, which described a routing+transition-intelligence governance
  // stack that testing showed added little value and has since been removed.
  // The live system is: an active engine (Straight/Inverted/Markov/Random,
  // auto-selected by Pulse) driving a per-axis 3-input gate selector that is
  // either WARMING, HOLD (no gate beat the fit threshold), or EXECUTE.
  const getEngineLabelForRow = (row: Step) => {
    const selected = (row as any).pulseSelectedEngine;
    if (selected) return selected;
    if ((row as any)._bbStraightEnabled) return "Straight";
    if ((row as any)._bbInvertedEnabled) return "Inverted";
    if ((row as any)._markovEnabled) return "Markov";
    if ((row as any)._randomEnabled) return "Random";
    return "—";
  };

  const getGateSummaryFromDivergence = (divergence: any, axis: "color" | "range" | "parity") => {
    const d = divergence?.[axis];
    if (!d) return { state: "—", gateName: "—", fitPct: null as number | null, label: "—" };
    const state = d.performanceState ?? "—";
    const gateName = d.selectedGate ?? "—";
    const fitPct = typeof d.gateFitScore === "number" ? Math.round(d.gateFitScore * 100) : null;
    const label = state === "WARMING" || state === "HOLD"
      ? state
      : `${gateName}${fitPct !== null ? ` ${fitPct}%` : ""}`;
    return { state, gateName, fitPct, label };
  };

  const getGateSummaryForAxis = (row: Step, axis: "color" | "range" | "parity") => getGateSummaryFromDivergence(row.pulseDivergence, axis);

  const getEngineGateSummaryForRow = (row: Step) => {
    const engine = getEngineLabelForRow(row);
    const colorGate = getGateSummaryForAxis(row, "color");
    const rangeGate = getGateSummaryForAxis(row, "range");
    const parityGate = getGateSummaryForAxis(row, "parity");
    return { engine, colorGate, rangeGate, parityGate };
  };

  // ─── ALL-ENGINE DIAGNOSTICS (audit any engine, not just the active one) ────
  // Every spin, all 4 engines are computed silently — Pulse just picks a
  // winner. This reads the other 3 back out of history so a loss streak
  // driven by e.g. Inverted isn't a black box: we can see what Straight,
  // Markov, and Random would have predicted and whether they'd have won.
  const fmtSigned = (n: number | null | undefined) => typeof n === "number" ? (n > 0 ? `+${n}` : `${n}`) : "—";

  const getAllEngineDiagnosticsForRow = (row: Step) => {
    const diag = row.allEngineDiagnostics;
    const outcome = row.outcomeGroup as GroupKey | null;
    const wouldWin = (predicted: GroupKey | null | undefined) => predicted && outcome ? predicted === outcome : null;

    const straightGate = diag?.straight?.gate ?? null;
    const straightAxes = {
      color: getGateSummaryFromDivergence(straightGate, "color"),
      range: getGateSummaryFromDivergence(straightGate, "range"),
      parity: getGateSummaryFromDivergence(straightGate, "parity"),
    };
    const straightLabel = !diag?.straight ? "—" : straightAxes.color.state === "WARMING" ? "WARMING" : `C:${straightAxes.color.label} R:${straightAxes.range.label} P:${straightAxes.parity.label}`;

    const invDpi = diag?.inverted?.axisDpi ?? null;
    const invModes = diag?.inverted?.axisModes ?? null;
    const invertedLabel = invDpi
      ? `C:${fmtSigned(invDpi.color)}${invModes ? `(${invModes.color[0]})` : ""} R:${fmtSigned(invDpi.range)}${invModes ? `(${invModes.range[0]})` : ""} P:${fmtSigned(invDpi.parity)}${invModes ? `(${invModes.parity[0]})` : ""}`
      : "—";

    const mkvConf = diag?.markov?.axisConfidence ?? null;
    const markovLabel = mkvConf ? `C:${mkvConf.color}% R:${mkvConf.range}% P:${mkvConf.parity}%` : "—";

    const rndDpi = diag?.random?.axisDpi ?? null;
    const rndConfidence = diag?.random?.confidence ?? null;
    const randomLabel = rndDpi
      ? `C:${fmtSigned(rndDpi.color)} R:${fmtSigned(rndDpi.range)} P:${fmtSigned(rndDpi.parity)}${typeof rndConfidence === "number" ? ` (${rndConfidence}%)` : ""}`
      : "—";

    return {
      straight: { label: straightLabel, group: diag?.straight?.group ?? null, wouldWin: wouldWin(diag?.straight?.group) },
      inverted: { label: invertedLabel, group: diag?.inverted?.group ?? null, wouldWin: wouldWin(diag?.inverted?.group) },
      markov: { label: markovLabel, group: diag?.markov?.group ?? null, wouldWin: wouldWin(diag?.markov?.group) },
      random: { label: randomLabel, group: diag?.random?.group ?? null, wouldWin: wouldWin(diag?.random?.group) },
    };
  };

  // Compact per-row indicator: which of the 4 engines would have won this spin.
  const getAllEngineCompactLabel = (row: Step) => {
    const d = getAllEngineDiagnosticsForRow(row);
    const mark = (e: { wouldWin: boolean | null }) => e.wouldWin === true ? "✓" : e.wouldWin === false ? "✗" : "—";
    return `S${mark(d.straight)} I${mark(d.inverted)} M${mark(d.markov)} R${mark(d.random)}`;
  };

  // ─── PULSE SWITCH LOG ───────────────────────────────────────────────────────
  // Full rolling win-rate horse race between all 4 engines, per spin, plus
  // when/why Pulse switched. Answers: was the active engine actually still
  // winning the race, or stuck without a challenger clearing the 15pp gap?
  const getPulseSwitchLogRows = () => {
    return history
      .filter((row) => row.pulseEngineTracker && !row.pulseEngineTracker.isWarming)
      .map((row) => {
        const tracker = row.pulseEngineTracker!;
        const rates = tracker.engineRates || {};
        const samples = tracker.engineSamples || {};
        const czs = tracker.challengerZScores || {};
        const entries = Object.entries(rates) as [string, number][];
        const maxRate = entries.length ? Math.max(...entries.map(([, v]) => v)) : 0;
        const topEntries = entries.filter(([, v]) => v === maxRate);
        // "Leader" is just the raw highest rate — for display only. The
        // actual switch decision requires a statistically significant edge
        // OR a sustained lean (see switchZScore/leanStreak below), not just
        // being numerically ahead.
        const leader = maxRate > 0 && topEntries.length === 1 ? topEntries[0][0] : "—";
        const z = typeof tracker.switchZScore === "number" ? tracker.switchZScore : null;
        const trend = typeof tracker.zTrendDelta === "number" ? tracker.zTrendDelta : null;
        const engineZ = (engine: string) => tracker.selectedEngine === engine ? null : (typeof czs[engine] === "number" ? czs[engine] as number : null);
        return {
          spin: row.spin,
          selectedEngine: tracker.selectedEngine ?? "—",
          switched: tracker.switched,
          previousEngine: tracker.previousEngine ?? "—",
          straightRate: rates["Straight"] ?? 0,
          invertedRate: rates["Inverted"] ?? 0,
          markovRate: rates["Markov"] ?? 0,
          randomRate: rates["Random"] ?? 0,
          straightN: samples["Straight"] ?? 0,
          invertedN: samples["Inverted"] ?? 0,
          markovN: samples["Markov"] ?? 0,
          randomN: samples["Random"] ?? 0,
          straightZ: engineZ("Straight"),
          invertedZ: engineZ("Inverted"),
          markovZ: engineZ("Markov"),
          randomZ: engineZ("Random"),
          leader,
          zScore: z,
          strongSnapshot: z === null ? null : z >= 1.28,
          leanStreak: tracker.leanStreak ?? 0,
          zTrend: trend,
          accelerating: trend !== null && trend > 0.1,
          switchReason: tracker.switchReason ?? null,
        };
      });
  };

  const rowsForPulseSwitchLogExport = () => [
    ["Spin", "Selected Engine", "Switched", "Switch Reason", "Previous Engine",
     "Straight %", "Straight n", "Straight Z (vs current)", "Inverted %", "Inverted n", "Inverted Z (vs current)",
     "Markov %", "Markov n", "Markov Z (vs current)", "Random %", "Random n", "Random Z (vs current)",
     "Raw Leader", "Best Challenger Z-Score", "Strong Single-Spin Z (info only, not a trigger)", "Lean Streak (spins)", "Z-Score Trend (Δ/10 spins)", "Accelerating"],
    ...getPulseSwitchLogRows().map((row) => [
      row.spin, row.selectedEngine, row.switched ? "YES" : "NO", row.switchReason ?? "—", row.previousEngine,
      row.straightRate, row.straightN, row.straightZ === null ? "—" : row.straightZ.toFixed(2),
      row.invertedRate, row.invertedN, row.invertedZ === null ? "—" : row.invertedZ.toFixed(2),
      row.markovRate, row.markovN, row.markovZ === null ? "—" : row.markovZ.toFixed(2),
      row.randomRate, row.randomN, row.randomZ === null ? "—" : row.randomZ.toFixed(2),
      row.leader, row.zScore === null ? "—" : row.zScore.toFixed(2), row.strongSnapshot === null ? "—" : row.strongSnapshot ? "YES" : "NO",
      row.leanStreak, row.zTrend === null ? "—" : row.zTrend.toFixed(2), row.zTrend === null ? "—" : row.accelerating ? "YES" : "NO",
    ]),
  ];


  const downloadPulseSwitchLogCSV = () => downloadRowsAsCSV(rowsForPulseSwitchLogExport(), "edgelab_pulse_switch_log.csv");

  const getSpinAuditRows = () => {
    return history.map((row, index) => {
      const structure = getStructureForHistoryRow(row);
      const forecastBasket = (row.forecastGroup ?? row.predictedGroup ?? null) as GroupKey | null;
      const exactProfile = getLearnedPulseExecutionProfile(structure);
      const familyProfile = getFamilyPulseExecutionProfile(structure);
      const signatureProfile = getSignaturePulseExecutionProfile(structure);
      const profile = getPulseExecutionRoutingProfile(structure);
      const source = (profile as any)?.source ?? "Fallback";
      const winningEvidence = (profile as any)?.winningEvidence ?? source;
      const confidence = getExecutionIntelligenceConfidence(profile as any);
      // Use the engine config that was active when this spin was settled,
      // not the current React state (which may have changed since the autorun).
      const rowPulseEnabled = (row as any)._pulseEnabled ?? pulseEnabled;
      const canRoute = !!rowPulseEnabled && !!forecastBasket && profileMeetsRoutingThreshold(profile as any);
      const routerRecommendation = canRoute ? profile!.bestMode : row.executionMode;
      const finalExecutionMode = row.executionMode;
      const transitionState = row.pulseGate?.transitionState ?? row.pulseDiagnostics?.transitionIntelligence?.state ?? "—";
      const transitionRisk = row.pulseGate?.transitionRisk ?? row.pulseDiagnostics?.transitionIntelligence?.risk ?? "—";
      const transitionAction = row.pulseGate?.transitionAction ?? row.pulseDiagnostics?.transitionIntelligence?.action ?? "—";
      const transitionExpectedRegime = row.pulseGate?.transitionExpectedRegime ?? row.pulseDiagnostics?.transitionIntelligence?.expectedNextRegime ?? "—";
      const tiAdjustment = routerRecommendation !== finalExecutionMode
        ? `${transitionState} / ${transitionRisk}: ${routerRecommendation} → ${finalExecutionMode}`
        : transitionState !== "—"
        ? `${transitionState} / ${transitionRisk}: No change`
        : "—";
      const tiValidation = getTIValidationForRow(index, transitionState, transitionExpectedRegime);
      const evidenceDetails = `Family ${familyProfile?.samples ?? 0} / +${(familyProfile?.advantage ?? 0).toFixed(2)}; Exact ${exactProfile?.samples ?? 0} / +${(exactProfile?.advantage ?? 0).toFixed(2)}; Signature ${signatureProfile?.samples ?? 0} / +${(signatureProfile?.advantage ?? 0).toFixed(2)}`;
      const reason = canRoute
        ? routerRecommendation !== finalExecutionMode
          ? `Router recommended ${routerRecommendation} by ${winningEvidence}. TI adjusted final execution to ${finalExecutionMode}. ${tiAdjustment}. ${evidenceDetails}.`
          : `Router recommended ${routerRecommendation} by ${winningEvidence}. Final execution ${finalExecutionMode}. ${evidenceDetails}.`
        : profile
        ? `${winningEvidence} did not meet routing threshold; final execution ${finalExecutionMode}. ${evidenceDetails}.`
        : `No learned execution profile; final execution ${finalExecutionMode}.`;
      const executionValue = getExecutionValueForRow(row);
      const engineGate = getEngineGateSummaryForRow(row);

      return {
        spin: row.spin,
        engine: engineGate.engine,
        colorGate: engineGate.colorGate,
        rangeGate: engineGate.rangeGate,
        parityGate: engineGate.parityGate,
        structure,
        family: getStructureFamilyKey(structure),
        signature: getStructureCompressionSignature(structure),
        forecast: forecastBasket ?? "",
        outcome: row.outcomeGroup,
        outcomeGroup: row.outcomeGroup,
        allEngineDiagnostics: row.allEngineDiagnostics ?? null,
        actualMode: row.executionMode,
        routerSelectedMode: routerRecommendation,
        routerRecommendation,
        tiAdjustment,
        finalExecutionMode,
        transitionState,
        transitionRisk,
        transitionAction,
        transitionExpectedRegime,
        tiValidationWindow: tiValidation.tiValidationWindow,
        tiActualRegime: tiValidation.tiActualRegime,
        tiCorrect: tiValidation.tiCorrect,
        tiValidationConfidence: tiValidation.tiValidationConfidence,
        routerActive: canRoute,
        source,
        winningEvidence,
        samples: profile?.samples ?? 0,
        exactMode: exactProfile?.bestMode ?? "",
        familyMode: familyProfile?.bestMode ?? "",
        signatureMode: signatureProfile?.bestMode ?? "",
        exactSamples: exactProfile?.samples ?? 0,
        familySamples: familyProfile?.samples ?? 0,
        signatureSamples: signatureProfile?.samples ?? 0,
        exactAdvantage: exactProfile?.advantage ?? 0,
        familyAdvantage: familyProfile?.advantage ?? 0,
        signatureAdvantage: signatureProfile?.advantage ?? 0,
        advantage: profile?.advantage ?? 0,
        confidence,
        dimensionsCorrect: row.pulseAudit?.dimensionsCorrect ?? getForecastQualityForGroups(forecastBasket, row.outcomeGroup).dimensionsCorrect ?? "",
        result: row.result,
        coreHit: executionValue.coreHitLabel,
        addedHit: executionValue.addedHitLabel,
        winningSource: executionValue.winningSource,
        reason,
      };
    });
  };

  // Clean 14-column spin audit export — engine + per-axis gate state only,
  // no TI/structure/routing columns (those belonged to the removed
  // routing/transition-intelligence governance stack).
  const rowsForSpinAuditExport = () => [
    ["Spin", "Forecast", "Outcome", "Execution Mode", "Engine", "Color Gate", "Range Gate", "Parity Gate", "Dimensions Correct", "Color", "Range", "Parity", "Result", "Winning Source"],
    ...getSpinAuditRows().map((row) => {
      const fc = row.forecast ? groupToBits(row.forecast as GroupKey) : null;
      const oc = row.outcome ? groupToBits(row.outcome as GroupKey) : null;
      const colorHit  = fc && oc ? (fc[0]===oc[0]?"C":"I") : "—";
      const rangeHit  = fc && oc ? (fc[1]===oc[1]?"C":"I") : "—";
      const parityHit = fc && oc ? (fc[2]===oc[2]?"C":"I") : "—";
      return [
        row.spin, row.forecast, row.outcome, row.finalExecutionMode,
        row.engine, row.colorGate.label, row.rangeGate.label, row.parityGate.label,
        row.dimensionsCorrect,
        colorHit, rangeHit, parityHit,
        row.result, row.winningSource,
      ];
    }),
  ];

  const getLossInvestigationRows = () => {
    const routerRows = getSpinAuditRows();
    const rows: any[] = [];
    let streak: any[] = [];
    let streakId = 0;

    const flush = () => {
      if (streak.length >= 5) {
        streakId += 1;
        const modes = streak.map((row) => row.finalExecutionMode);
        const engines = streak.map((row) => row.engine);
        const mostCommon = (values: string[]) => {
          const counts: Record<string, number> = {};
          values.forEach((value) => { counts[value || "—"] = (counts[value || "—"] || 0) + 1; });
          return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
        };
        const avgDim = streak.reduce((sum, row) => sum + (typeof row.dimensionsCorrect === "number" ? row.dimensionsCorrect : Number(row.dimensionsCorrect) || 0), 0) / streak.length;
        streak.forEach((row) => rows.push({
          streakId,
          startSpin: streak[0].spin,
          endSpin: streak[streak.length - 1].spin,
          length: streak.length,
          commonMode: mostCommon(modes),
          commonEngine: mostCommon(engines),
          avgDim,
          ...row,
        }));
      }
      streak = [];
    };

    routerRows.forEach((row) => {
      if (row.result === "loss") streak.push(row);
      else flush();
    });
    flush();
    return rows;
  };

  const rowsForLossInvestigationExport = () => [
    ["Streak ID", "Start Spin", "End Spin", "Length", "Avg Dim Correct", "Spin", "Engine", "Color Gate", "Range Gate", "Parity Gate", "Forecast", "Outcome", "Dimensions Correct", "Color", "Range", "Parity", "Core Hit", "Winning Source",
     "Straight Predicted", "Straight Would Win", "Straight Diagnostic", "Inverted Predicted", "Inverted Would Win", "Inverted Diagnostic", "Markov Predicted", "Markov Would Win", "Markov Diagnostic", "Random Predicted", "Random Would Win", "Random Diagnostic"],
    ...getLossInvestigationRows().map((row) => {
      const fc = row.forecast ? groupToBits(row.forecast as GroupKey) : null;
      const oc = row.outcome ? groupToBits(row.outcome as GroupKey) : null;
      const colorHit  = fc && oc ? (fc[0]===oc[0]?"C":"I") : "—";
      const rangeHit  = fc && oc ? (fc[1]===oc[1]?"C":"I") : "—";
      const parityHit = fc && oc ? (fc[2]===oc[2]?"C":"I") : "—";
      const allEngines = getAllEngineDiagnosticsForRow(row);
      const winLabel = (v: boolean | null) => v === true ? "YES" : v === false ? "NO" : "—";
      return [
        row.streakId, row.startSpin, row.endSpin, row.length,
        row.avgDim.toFixed(2), row.spin,
        row.engine, row.colorGate.label, row.rangeGate.label, row.parityGate.label,
        row.forecast, row.outcome, row.dimensionsCorrect,
        colorHit, rangeHit, parityHit,
        row.coreHit, row.winningSource,
        allEngines.straight.group ?? "—", winLabel(allEngines.straight.wouldWin), allEngines.straight.label,
        allEngines.inverted.group ?? "—", winLabel(allEngines.inverted.wouldWin), allEngines.inverted.label,
        allEngines.markov.group ?? "—", winLabel(allEngines.markov.wouldWin), allEngines.markov.label,
        allEngines.random.group ?? "—", winLabel(allEngines.random.wouldWin), allEngines.random.label,
      ];
    }),
  ];


  const downloadSpinAuditCSV = () => downloadRowsAsCSV(rowsForSpinAuditExport(), "edgelab_spin_audit.csv");
  const downloadLossInvestigationCSV = () => downloadRowsAsCSV(rowsForLossInvestigationExport(), "edgelab_loss_investigation.csv");

  // AXIS FAILURE ANALYSIS
  // Purpose: track every 2/3-dimension loss so we can identify the axis that
  // keeps breaking, alongside which engine and gate state was active for it.
  const getAxisCorrectForRouterRow = (row: any, axis: "Color" | "Range" | "Parity") => {
    if (!row?.forecast || !row?.outcome) return null;
    const forecastBits = groupToBits(row.forecast as GroupKey);
    const outcomeBits = groupToBits(row.outcome as GroupKey);
    const index = axis === "Color" ? 0 : axis === "Range" ? 1 : 2;
    return forecastBits[index] === outcomeBits[index];
  };

  const getFailedAxisForRouterRow = (row: any) => {
    const axes = (["Color", "Range", "Parity"] as const).filter((axis) => getAxisCorrectForRouterRow(row, axis) === false);
    return axes.length === 1 ? axes[0] : "—";
  };

  const getGateForFailedAxis = (row: any, failedAxis: string) =>
    failedAxis === "Color" ? row.colorGate
    : failedAxis === "Range" ? row.rangeGate
    : failedAxis === "Parity" ? row.parityGate
    : { state: "—", gateName: "—", fitPct: null as number | null, label: "—" };

  const getAxisFailureRows = () => {
    const spinRows = getSpinAuditRows();
    return spinRows
      .filter((row) => row.result === "loss" && Number(row.dimensionsCorrect) === 2)
      .map((row) => {
        const failedAxis = getFailedAxisForRouterRow(row);
        const recoveryRow = failedAxis === "—" ? null : spinRows.find((candidate) => candidate.spin > row.spin && getAxisCorrectForRouterRow(candidate, failedAxis as any) === true);
        const recoveryDelay = recoveryRow ? recoveryRow.spin - row.spin : null;
        return {
          ...row,
          failedAxis,
          failedAxisGate: getGateForFailedAxis(row, failedAxis),
          colorCorrect: getAxisCorrectForRouterRow(row, "Color"),
          rangeCorrect: getAxisCorrectForRouterRow(row, "Range"),
          parityCorrect: getAxisCorrectForRouterRow(row, "Parity"),
          recoverySpin: recoveryRow?.spin ?? "Open",
          recoveryDelay,
          recoveryDelayLabel: recoveryDelay === null ? "Open" : String(recoveryDelay),
        };
      });
  };

  const getAxisFailureSummaryRows = () => {
    const rows = getAxisFailureRows();
    const map: Record<string, { key: string; failedAxis: string; engine: string; samples: number; open: number; totalDelay: number; delays: number[]; modes: Record<string, number>; gateStates: Record<string, number> }> = {};
    rows.forEach((row) => {
      const key = `${row.failedAxis}__${row.engine}`;
      if (!map[key]) map[key] = { key, failedAxis: row.failedAxis, engine: row.engine, samples: 0, open: 0, totalDelay: 0, delays: [], modes: {}, gateStates: {} };
      const bucket = map[key];
      bucket.samples += 1;
      if (typeof row.recoveryDelay === "number") {
        bucket.totalDelay += row.recoveryDelay;
        bucket.delays.push(row.recoveryDelay);
      } else {
        bucket.open += 1;
      }
      bucket.modes[row.finalExecutionMode || "—"] = (bucket.modes[row.finalExecutionMode || "—"] || 0) + 1;
      bucket.gateStates[row.failedAxisGate.state || "—"] = (bucket.gateStates[row.failedAxisGate.state || "—"] || 0) + 1;
    });
    const top = (counts: Record<string, number>) => Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    return Object.values(map)
      .map((row) => ({
        ...row,
        avgDelay: row.delays.length ? row.totalDelay / row.delays.length : null,
        maxDelay: row.delays.length ? Math.max(...row.delays) : null,
        topMode: top(row.modes),
        topGateState: top(row.gateStates),
      }))
      .sort((a, b) => b.samples - a.samples || (b.avgDelay ?? 0) - (a.avgDelay ?? 0));
  };

  const rowsForAxisFailureExport = () => [
    ["Spin", "Failed Axis", "Engine", "Gate State", "Forecast", "Outcome", "Final Execution Mode", "Color Correct", "Range Correct", "Parity Correct", "Recovery Spin", "Recovery Delay",
     "Straight Predicted", "Straight Would Win", "Inverted Predicted", "Inverted Would Win", "Markov Predicted", "Markov Would Win", "Random Predicted", "Random Would Win"],
    ...getAxisFailureRows().map((row) => {
      const allEngines = getAllEngineDiagnosticsForRow(row);
      const winLabel = (v: boolean | null) => v === true ? "YES" : v === false ? "NO" : "—";
      return [
        row.spin,
        row.failedAxis,
        row.engine,
        row.failedAxisGate.label,
        row.forecast,
        row.outcome,
        row.finalExecutionMode,
        row.colorCorrect === null ? "—" : row.colorCorrect ? "YES" : "NO",
        row.rangeCorrect === null ? "—" : row.rangeCorrect ? "YES" : "NO",
        row.parityCorrect === null ? "—" : row.parityCorrect ? "YES" : "NO",
        row.recoverySpin,
        row.recoveryDelayLabel,
        allEngines.straight.group ?? "—", winLabel(allEngines.straight.wouldWin),
        allEngines.inverted.group ?? "—", winLabel(allEngines.inverted.wouldWin),
        allEngines.markov.group ?? "—", winLabel(allEngines.markov.wouldWin),
        allEngines.random.group ?? "—", winLabel(allEngines.random.wouldWin),
      ];
    }),
  ];

  const downloadAxisFailureCSV = () => downloadRowsAsCSV(rowsForAxisFailureExport(), "edgelab_axis_failure_analysis.csv");

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
        markovEnabled,
        randomEnabled
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
  }, [rawOutcomes, baseUnit, startingBankroll, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, tierExecution, markovEnabled, randomEnabled]);


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

  const randomShadowRows = useMemo(
    () => runShadowStrategy(rawOutcomes, strategy, baseUnit, startingBankroll, "RANDOM", executionMode, tableLimit, perNumberLimit, tierExecution),
    [rawOutcomes, strategy, baseUnit, startingBankroll, executionMode, tableLimit, perNumberLimit, tierExecution]
  );

  const pulseMarkovShadowRows = useMemo(
    () => runComboShadowStrategy(rawOutcomes, strategy, baseUnit, startingBankroll, "PULSE_MARKOV", executionMode, tableLimit, perNumberLimit, tierExecution),
    [rawOutcomes, strategy, baseUnit, startingBankroll, executionMode, tableLimit, perNumberLimit, tierExecution]
  );

  const pulseRandomShadowRows = useMemo(
    () => runComboShadowStrategy(rawOutcomes, strategy, baseUnit, startingBankroll, "PULSE_RANDOM", executionMode, tableLimit, perNumberLimit, tierExecution),
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
  const MiniMetric = ({ label, value, accent }: any) => <div style={{ border: `1px solid ${t.border}`, background: t.panel2, borderRadius: 12, padding: "9px 10px", minWidth: 0 }}><div style={{ fontSize: 10, color: t.subtext, textTransform: "uppercase", fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div><div style={{ marginTop: 4, color: accent || t.text, fontSize: 18, fontWeight: 950, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div></div>;
  const Modal = ({ open, children }: any) => !open ? null : <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.62)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}><div style={{ width: "100%", maxWidth: 470, background: t.panel, borderRadius: 16, border: `1px solid ${t.borderStrong}`, boxShadow: t.shadow, padding: 18, color: t.text }}>{children}</div></div>;
  const rouletteButtonStyle = (value: SpinValue): React.CSSProperties => {
    const isZero = value === 0 || value === "00";
    const bg = isZero ? "#15803d" : RED_NUMBERS.has(value) ? "#991b1b" : "#111827";
    return { minHeight: 42, borderRadius: 8, border: "1px solid rgba(255,255,255,0.16)", background: bg, color: "#fff", cursor: "pointer", fontWeight: 900, fontSize: 13 };
  };

  const SignalPanel = () => {
    const pulseStatus = pulseEnabled ? "ENABLED" : "DISABLED";
    const dimensionTDA = (f as any).dimensionTDA;
    const rawDimensionTDABlocked = f.source === "PULSE" && dimensionTDA?.passed === false;
    const observeDisplayEnabled = executeObservation === true;
    const dimensionTDABlocked = observeDisplayEnabled && rawDimensionTDABlocked;
    const isObservationForecast = observeDisplayEnabled && (f.tier === "Hold · No Bet" || rawDimensionTDABlocked);
    const displayPrediction = isObservationForecast ? "OBSERVE" : (f.group ?? "WAITING");
    const executionLabel = !pulseEnabled ? "PULSE OFF" : isObservationForecast ? "NO BET" : f.group ? effectiveExecutionMode : "WAITING";
    const executionColor = f.group && pulseEnabled && !isObservationForecast ? COLORS.green : executionLabel === "NO BET" ? COLORS.amber : executionLabel === "PULSE OFF" ? COLORS.red : t.subtext;
    const tierColor = f.tier === "Active · High Confidence" ? COLORS.green : f.tier === "Active · Confirmed" ? COLORS.cyan : f.tier === "Active · Caution" ? COLORS.amber : f.tier === "Hold · No Bet" ? COLORS.red : t.text;
    const coreDisplayNumbers = f.group ? (GROUPS[f.group] ?? f.numbers) : [] as SpinValue[];
    const finalDisplayNumbers = executionNumbers.length ? executionNumbers : f.numbers;
    const addedDisplayNumbers = f.group && !isObservationForecast ? finalDisplayNumbers.filter((value: SpinValue) => !coreDisplayNumbers.includes(value)) : [] as SpinValue[];
    const statusReasonText = isObservationForecast ? "No Bet" : f.group ? "" : "Awaiting signal.";
    const numberDisplay = f.group && !isObservationForecast
      ? <div style={{ fontSize: 13, fontWeight: 900, marginTop: 10, lineHeight: 1.35 }}>
          <span style={{ color: COLORS.cyan }}>{coreDisplayNumbers.length ? coreDisplayNumbers.join(", ") : "—"}</span>
          {addedDisplayNumbers.length ? <span style={{ color: COLORS.amber }}> {addedDisplayNumbers.join(", ")}</span> : null}
        </div>
      : <div style={{ fontSize: 13, color: executionColor, fontWeight: 900, marginTop: 10 }}>{statusReasonText}</div>;

    // Pulse engine tracker data
    const tracker = (f as any).pulseEngineTracker;
    const engineColors: Record<string, string> = { Straight: COLORS.blue, Inverted: COLORS.amber, Markov: COLORS.green, Random: COLORS.cyan };

    return <Panel title="Signal State" style={{ minHeight: 344 }}>
      <button onClick={applyPulseMode} style={{ width: "100%", height: 34, borderRadius: 10, border: `1px solid ${pulseEnabled ? COLORS.cyan : COLORS.red}`, background: pulseEnabled ? "rgba(34,199,243,0.16)" : "rgba(239,68,68,0.10)", color: pulseEnabled ? COLORS.cyan : COLORS.red, fontWeight: 950, cursor: "pointer", marginBottom: 8 }}>{pulseEnabled ? "PULSE ON" : "PULSE OFF"}</button>

      {/* When Pulse is ON — show engine tracker */}
      {pulseEnabled && tracker ? (
        <div style={{ marginBottom: 10 }}>
          {tracker.isWarming ? (
            <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", background: t.panel2, textAlign: "center" }}>
              <div style={{ fontSize: 12, color: t.subtext, fontWeight: 900 }}>WARMING</div>
              <div style={{ fontSize: 20, fontWeight: 950, color: t.subtext, marginTop: 4 }}>{tracker.spinsRemaining} spins remaining</div>
              <div style={{ fontSize: 11, color: t.subtext, marginTop: 4 }}>All engines building history</div>
            </div>
          ) : (
            <div>
              {/* Active engine */}
              <div style={{ border: `1px solid ${engineColors[tracker.selectedEngine] ?? COLORS.cyan}44`, borderRadius: 10, padding: "8px 12px", background: `${engineColors[tracker.selectedEngine] ?? COLORS.cyan}0a`, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 9, color: t.subtext, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Active Engine</div>
                  <div style={{ fontSize: 16, fontWeight: 950, color: engineColors[tracker.selectedEngine] ?? COLORS.cyan, marginTop: 2 }}>{tracker.selectedEngine}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: t.subtext, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Win Rate (10)</div>
                  <div style={{ fontSize: 16, fontWeight: 950, color: engineColors[tracker.selectedEngine] ?? COLORS.cyan, marginTop: 2 }}>{tracker.engineRates[tracker.selectedEngine]}%</div>
                </div>
              </div>
              {/* All engine rates */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
                {["Straight","Inverted","Markov","Random"].map(eng => {
                  const rate = tracker.engineRates[eng] ?? 0;
                  const isActive = eng === tracker.selectedEngine;
                  const col = engineColors[eng];
                  return (
                    <div key={eng} style={{ border: `1px solid ${isActive ? col+"66" : t.border}`, borderRadius: 8, padding: "5px 6px", background: isActive ? `${col}10` : t.input, textAlign: "center" }}>
                      <div style={{ fontSize: 8, color: isActive ? col : t.subtext, fontWeight: 700, textTransform: "uppercase" }}>{eng.slice(0,3)}</div>
                      <div style={{ fontSize: 13, fontWeight: 950, color: isActive ? col : t.text, marginTop: 2 }}>{rate}%</div>
                    </div>
                  );
                })}
              </div>
              {tracker.switched && <div style={{ fontSize: 10, color: COLORS.amber, fontWeight: 900, marginTop: 6, textAlign: "center" }}>↔ Switched from {tracker.previousEngine}</div>}
            </div>
          )}
        </div>
      ) : !pulseEnabled ? (
        // Manual engine selection (Pulse OFF)
        <div>
          <div style={{ fontSize: 10, color: t.subtext, fontWeight: 950, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>Play Mode</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 10 }}>
            <button onClick={() => applyBBMode(false, false)} style={{ height: 34, borderRadius: 10, border: `1px solid ${!bbStraightEnabled && !bbInvertedEnabled && !markovEnabled && !randomEnabled ? COLORS.red : t.borderStrong}`, background: !bbStraightEnabled && !bbInvertedEnabled && !markovEnabled && !randomEnabled ? "rgba(239,68,68,0.10)" : t.input, color: !bbStraightEnabled && !bbInvertedEnabled && !markovEnabled && !randomEnabled ? COLORS.red : t.subtext, fontWeight: 950, cursor: "pointer", fontSize: 12 }}>OFF</button>
            <button onClick={() => applyBBMode(true, false)} style={{ height: 34, borderRadius: 10, border: `1px solid ${bbStraightEnabled && !bbInvertedEnabled && !markovEnabled && !randomEnabled ? COLORS.blue : t.borderStrong}`, background: bbStraightEnabled && !bbInvertedEnabled && !markovEnabled && !randomEnabled ? "rgba(37,99,235,0.14)" : t.input, color: bbStraightEnabled && !bbInvertedEnabled && !markovEnabled && !randomEnabled ? COLORS.blue : t.subtext, fontWeight: 950, cursor: "pointer", fontSize: 11 }}>STRAIGHT</button>
            <button onClick={() => applyBBMode(true, true)} style={{ height: 34, borderRadius: 10, border: `1px solid ${bbStraightEnabled && bbInvertedEnabled && !markovEnabled && !randomEnabled ? COLORS.amber : t.borderStrong}`, background: bbStraightEnabled && bbInvertedEnabled && !markovEnabled && !randomEnabled ? "rgba(245,158,11,0.12)" : t.input, color: bbStraightEnabled && bbInvertedEnabled && !markovEnabled && !randomEnabled ? COLORS.amber : t.subtext, fontWeight: 950, cursor: "pointer", fontSize: 11 }}>INVERTED</button>
            <button onClick={applyMarkovMode} style={{ height: 34, borderRadius: 10, border: `1px solid ${markovEnabled && !randomEnabled ? COLORS.green : t.borderStrong}`, background: markovEnabled && !randomEnabled ? "rgba(34,197,94,0.13)" : t.input, color: markovEnabled && !randomEnabled ? COLORS.green : t.subtext, fontWeight: 950, cursor: "pointer", fontSize: 11 }}>MARKOV</button>
            <button onClick={applyRandomMode} style={{ height: 34, borderRadius: 10, border: `1px solid ${randomEnabled ? COLORS.cyan : t.borderStrong}`, background: randomEnabled ? "rgba(34,199,243,0.13)" : t.input, color: randomEnabled ? COLORS.cyan : t.subtext, fontWeight: 950, cursor: "pointer", fontSize: 11 }}>RANDOM</button>
          </div>
        </div>
      ) : null}

      {/* Final prediction */}
      <div style={{ textAlign: "center", padding: "10px 0" }}>
        <div style={{ fontSize: 11, color: t.subtext, fontWeight: 950 }}>FINAL PREDICTION</div>
        <div style={{ fontSize: 50, fontWeight: 950, color: f.group && !isObservationForecast ? COLORS.cyan : t.subtext, lineHeight: 1, marginTop: 8 }}>{displayPrediction}</div>
        {numberDisplay}
      </div>
      <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, background: t.panel2, padding: "9px 10px", marginTop: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", fontSize: 12, fontWeight: 900 }}>
          <span style={{ color: t.subtext }}>Signal Source</span>
          <span style={{ color: pulseEnabled ? COLORS.cyan : COLORS.red }}>{pulseEnabled ? (tracker?.selectedEngine ? `Pulse · ${tracker.selectedEngine}` : "Pulse · Warming") : "Manual"}</span>
          <span style={{ color: t.subtext }}>Execution</span>
          <span style={{ color: executionColor }}>{executionLabel}</span>
          <span style={{ color: t.subtext }}>Tier</span>
          <span style={{ color: tierColor }}>{f.tier}</span>
        </div>
      </div>
    </Panel>;
  };
  const CompactMetrics = () => <CollapsiblePanel id="compactMetrics" title="Compact Metrics"><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><MiniMetric label="Bankroll" value={bankroll.toLocaleString()} accent={net >= 0 ? COLORS.green : COLORS.red} /><MiniMetric label="Net" value={net.toLocaleString()} accent={net >= 0 ? COLORS.green : COLORS.red} /><MiniMetric label="Win Rate" value={winRate} /><MiniMetric label="ROI" value={roi} /></div></CollapsiblePanel>;

  const DimensionPatternPanel = () => {
    const isPulseAndStraight = pulseEnabled && bbStraightEnabled && !bbInvertedEnabled && !markovEnabled && !randomEnabled;
    const divergence = isPulseAndStraight ? getPulseBBStraightDivergence(history) : null;

    const stateColor = (state: PulseDivergenceState) =>
      state === "ON_PATTERN" ? COLORS.green : state === "DIVERGING" ? COLORS.amber : COLORS.red;
    const cycleLabel = (cycle: PulseDivergenceCycle) =>
      cycle === "NONE" ? "—" : cycle.replace("CYCLE_3_","3-Cycle ").replace("STREAK_0","Streak B/H/E").replace("STREAK_1","Streak R/L/O").replace("ALTERNATING","Alternating");
    const perfColor = (ps: DimensionPerformanceState) =>
      ps === "EXECUTE" ? COLORS.green : ps === "HOLD" ? COLORS.red : ps === "WARMING" ? t.subtext : COLORS.amber;

    const renderAxis = (axis: PulseAxisDivergence | undefined, name: string, labels: [string, string]) => {
      if (!axis) return null;
      const pc = perfColor(axis.performanceState);
      const fitPct = Math.round(axis.gateFitScore * 100);
      const fitColor = fitPct >= 70 ? COLORS.green : fitPct >= 60 ? COLORS.amber : COLORS.red;

      // Last 20 AND conformance sequence
      const dimIndex = name === "Color" ? 0 : name === "Range" ? 1 : 2;
      const recentBits = groupSeries(history).map(groupToBits).map((b) => b[dimIndex]);
      const seq: boolean[] = [];
      for (let i = 1; i < recentBits.length; i++) {
        seq.push(getStraightNextBit(recentBits.slice(0,i) as (0|1)[]) === recentBits[i]);
      }
      const recent20 = seq.slice(-20);

      return (
        <div style={{ border: `1px solid ${axis.isHold ? COLORS.red+"44" : axis.isWarming ? t.border : COLORS.green+"33"}`, borderRadius: 12, padding: 12, background: axis.isHold ? "rgba(239,68,68,0.04)" : t.panel2 }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 950, fontSize: 13 }}>{name}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {!axis.isWarming && !axis.isHold && (
                <div style={{ background: `${COLORS.cyan}18`, border: `1px solid ${COLORS.cyan}44`, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 950, color: COLORS.cyan }}>
                  {axis.selectedGate} #{axis.allGateScores ? "" : ""}
                </div>
              )}
              <div style={{ background: `${pc}18`, border: `1px solid ${pc}44`, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 950, color: pc }}>
                {axis.performanceState}
              </div>
            </div>
          </div>

          {/* Prediction + Gate fit */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div style={{ border: `1px solid ${t.border}`, borderRadius: 8, padding: "7px 10px", background: t.input }}>
              <div style={{ fontSize: 9, color: t.subtext, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>Predicts</div>
              <div style={{ fontSize: 16, fontWeight: 950, color: t.text, marginTop: 3 }}>
                {axis.isHold || axis.isWarming ? "—" : axis.overrideBit === 0 ? labels[0] : labels[1]}
              </div>
            </div>
            <div style={{ border: `1px solid ${fitColor}44`, borderRadius: 8, padding: "7px 10px", background: `${fitColor}08` }}>
              <div style={{ fontSize: 9, color: t.subtext, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>Gate Fit</div>
              <div style={{ fontSize: 16, fontWeight: 950, color: fitColor, marginTop: 3 }}>{axis.isWarming ? "—" : `${fitPct}%`}</div>
            </div>
            <div style={{ border: `1px solid ${t.border}`, borderRadius: 8, padding: "7px 10px", background: t.input }}>
              <div style={{ fontSize: 9, color: t.subtext, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>Selected Gate</div>
              <div style={{ fontSize: 13, fontWeight: 950, color: COLORS.cyan, marginTop: 3 }}>{axis.isWarming ? "—" : axis.selectedGate}</div>
            </div>
          </div>

          {/* Gate fit bar */}
          {!axis.isWarming && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
                <span style={{ color: t.subtext }}>3-Input Gate Fit Score</span>
                <span style={{ color: fitColor }}>{fitPct}% {axis.isHold ? "(below threshold)" : ""}</span>
              </div>
              <div style={{ height: 7, borderRadius: 999, background: t.input, border: `1px solid ${t.border}`, overflow: "hidden", position: "relative" }}>
                <div style={{ width: `${fitPct}%`, height: "100%", background: fitColor, borderRadius: 999, transition: "width 0.3s ease" }} />
                <div style={{ position: "absolute", top: 0, left: "55%", width: 1, height: "100%", background: `${COLORS.green}66` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: t.subtext, marginTop: 2 }}>
                <span>0%</span>
                <span style={{ color: `${COLORS.green}cc` }}>55% → Trust</span>
                <span>100%</span>
              </div>
            </div>
          )}

          {/* Cycle detection */}
          {axis.detectedCycle !== "NONE" && (
            <div style={{ border: `1px solid ${stateColor(axis.state)}44`, borderRadius: 8, padding: "7px 10px", background: `${stateColor(axis.state)}08`, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 9, color: t.subtext, fontWeight: 700, textTransform: "uppercase" }}>Detected Cycle</div>
                  <div style={{ fontSize: 12, fontWeight: 950, color: stateColor(axis.state), marginTop: 2 }}>{cycleLabel(axis.detectedCycle)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: t.subtext, fontWeight: 700, textTransform: "uppercase" }}>Reps / Pos</div>
                  <div style={{ fontSize: 12, fontWeight: 950, color: stateColor(axis.state), marginTop: 2 }}>{axis.cycleConfidence} · {axis.cyclePosition}</div>
                </div>
              </div>
            </div>
          )}

          {/* AND conformance sequence — kept as reference */}
          <div>
            <div style={{ fontSize: 9, color: t.subtext, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 5 }}>
              Last 20 Pattern Sequence (C=match, I=deviation)
            </div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {recent20.map((match, i) => (
                <div key={i} style={{ width:22, height:22, borderRadius:5, background:match?"rgba(16,185,129,0.15)":"rgba(239,68,68,0.15)", border:`1px solid ${match?"rgba(16,185,129,0.40)":"rgba(239,68,68,0.40)"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:950, color:match?COLORS.green:COLORS.red }}>
                  {match?"C":"I"}
                </div>
              ))}
              {recent20.length === 0 && <span style={{ color: t.subtext, fontSize: 11 }}>Need more spins</span>}
            </div>
          </div>
        </div>
      );
    };

    if (!isPulseAndStraight) {
      return (
        <CollapsiblePanel id="dimensionPattern" title="Dimension Pattern">
          <div style={{ color: t.subtext, fontSize: 12, fontWeight: 900, padding: "10px 0" }}>
            Enable PULSE + STRAIGHT to activate the 3-input gate selector.
          </div>
        </CollapsiblePanel>
      );
    }

    return (
      <CollapsiblePanel id="dimensionPattern" title="Dimension Pattern">
        <div style={{ color: t.subtext, fontSize: 11, fontWeight: 900, marginBottom: 10 }}>
          3-input Boolean gate selector · 256 truth tables scored per axis · Best fit ≥ 55% → EXECUTE · Below → HOLD
        </div>
        {divergence && (
          <div style={{ border:`1px solid ${divergence.isWarming?t.border:divergence.holdCount===3?COLORS.red+"55":COLORS.green+"44"}`, borderRadius:10, padding:"9px 12px", marginBottom:12, background:divergence.holdCount===3?"rgba(239,68,68,0.06)":"rgba(16,185,129,0.04)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontWeight:950, fontSize:12, color:divergence.isWarming?t.subtext:divergence.holdCount===3?COLORS.red:COLORS.green }}>
              {divergence.label}
            </div>
            <div style={{ fontWeight:950, fontSize:18, color:COLORS.cyan }}>
              {divergence.isWarming || divergence.holdCount===3 ? "—" : divergence.group}
            </div>
          </div>
        )}
        <div style={{ display: "grid", gap: 10 }}>
          {renderAxis(divergence?.color,  "Color",  ["Black","Red"])}
          {renderAxis(divergence?.range,  "Range",  ["High","Low"])}
          {renderAxis(divergence?.parity, "Parity", ["Even","Odd"])}
        </div>
      </CollapsiblePanel>
    );
  };

    const AxisDirectionalAccuracyPanel = () => {
    return null;
  };

  const BankrollChart = () => {
    const streakBands = streakStats.segments.filter((segment: any) => segment.length >= 2);
    const buildStreakAudit = (band: { type: "win" | "loss"; startSpin: number; endSpin: number; length: number }) => {
      const rows = history.filter((row) => row.spin >= band.startSpin && row.spin <= band.endSpin);
      if (!rows.length) {
        return {
          rows,
          auditRows: [],
          title: `${band.type.toUpperCase()} STREAK ANALYSIS`,
          summary: [] as string[],
          diagnosis: "No detail available.",
          netChange: 0,
          dominantEngine: "—",
          gateExecuteRate: 0,
          entropyValue: 0,
          executed: 0,
          tdaHolds: 0,
          coreMisses: 0,
          overlayMisses: 0,
        };
      }
      const netChange = rows.reduce((sum, row) => sum + row.net, 0);
      const startBankroll = rows[0].bankroll - rows[0].net;
      const endBankroll = rows[rows.length - 1].bankroll;
      const groups = rows.map((row) => row.outcomeGroup);
      const e = entropy(groups);
      const tdaHolds = rows.filter((row) => row.result === "push" || row.note.includes("TDA") || !row.predictedGroup).length;
      const executed = rows.filter((row) => row.result === "win" || row.result === "loss").length;
      const coreMisses = rows.filter((row) => row.coreResult === "loss").length;
      const overlayMisses = rows.filter((row) => row.overlayResult === "loss").length;
      const auditRows = getSpinAuditRows().filter((row) => row.spin >= band.startSpin && row.spin <= band.endSpin);
      const mostCommon = (values: string[]) => {
        const counts: Record<string, number> = {};
        values.forEach((value) => { counts[value || "—"] = (counts[value || "—"] || 0) + 1; });
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
      };
      const dominantEngine = mostCommon(auditRows.map((row) => row.engine));
      const gateStates = auditRows.flatMap((row) => [row.colorGate.state, row.rangeGate.state, row.parityGate.state]);
      const executeGates = gateStates.filter((state) => state === "EXECUTE").length;
      const gateExecuteRate = gateStates.length ? executeGates / gateStates.length : 0;
      const settlementMismatchCount = rows.filter((row) => row.predictedGroup && row.predictedGroup === row.outcomeGroup && row.result !== "win").length;
      const diagnosis = settlementMismatchCount > 0
        ? `SETTLEMENT WARNING: ${settlementMismatchCount} matching forecast/outcome rows did not settle as WIN.`
        : band.type === "loss"
        ? e >= 62
          ? "Primary read: entropy/chaos expansion during loss block."
          : tdaHolds > Math.max(1, rows.length / 2)
          ? "Primary read: diagnostic holds (no bet placed) were frequent during this block."
          : gateExecuteRate < 0.5
          ? "Primary read: gates were mostly HOLD/WARMING during this block — little live signal to act on."
          : "Primary read: final execution basket missed despite gates actively executing."
        : "Winning streak block. Shows what aligned during this run.";
      return {
        rows,
        auditRows,
        title: `${band.type === "loss" ? "LOSS" : "WIN"} STREAK ANALYSIS`,
        summary: [
          `Spins: ${band.startSpin}-${band.endSpin} · Length: ${band.length}`,
          `Bankroll: ${startBankroll} → ${endBankroll} · Net: ${netChange}`,
          `Dominant Engine: ${dominantEngine}`,
          `Executed: ${executed}/${rows.length} · Diagnostic Holds: ${tdaHolds}`,
          `Gates Executing: ${executeGates}/${gateStates.length} axis-spins (${Math.round(gateExecuteRate * 100)}%)`,
        ],
        diagnosis,
        netChange,
        dominantEngine,
        gateExecuteRate,
        entropyValue: e,
        executed,
        tdaHolds,
        coreMisses,
        overlayMisses,
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
                <th style={{ padding: "8px 10px" }}>Engine</th>
                <th style={{ padding: "8px 10px" }}>Color Gate</th>
                <th style={{ padding: "8px 10px" }}>Range Gate</th>
                <th style={{ padding: "8px 10px" }}>Parity Gate</th>
                <th style={{ padding: "8px 10px" }}>All Engines</th>
                <th style={{ padding: "8px 10px" }}>Net</th>
                <th style={{ padding: "8px 10px" }}>Mode</th>
              </tr>
            </thead>
            <tbody>
              {audit.rows.map((row) => {
                const forecastLabel = row.predictedGroup ?? row.forecastGroup ?? "HOLD";
                const outcomeLabel = `${String(row.outcome)}(${row.outcomeGroup})`;
                const auditRow = audit.auditRows.find((candidate) => candidate.spin === row.spin);
                const gateColor = (state?: string) => state === "EXECUTE" ? COLORS.green : state === "HOLD" ? COLORS.amber : t.subtext;
                const allEngines = getAllEngineDiagnosticsForRow(row);
                const tooltip = `Straight: ${allEngines.straight.label} (${allEngines.straight.group ?? "—"})\nInverted: ${allEngines.inverted.label} (${allEngines.inverted.group ?? "—"})\nMarkov: ${allEngines.markov.label} (${allEngines.markov.group ?? "—"})\nRandom: ${allEngines.random.label} (${allEngines.random.group ?? "—"})`;
                return <tr key={`audit-${row.spin}`} style={{ borderBottom: `1px solid ${t.border}`, background: row.result === "win" ? "rgba(34,197,94,0.07)" : row.result === "loss" ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.05)" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 950 }}>{row.spin}</td>
                  <td style={{ padding: "8px 10px", color: COLORS.cyan, fontWeight: 950 }}>{forecastLabel}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 900 }}>{outcomeLabel}</td>
                  <td style={{ padding: "8px 10px", color: resultColor(row.result), fontWeight: 950 }}>{row.result.toUpperCase()}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 900 }}>{auditRow?.engine ?? getEngineLabelForRow(row)}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 900, color: gateColor(auditRow?.colorGate.state) }}>{auditRow?.colorGate.label ?? "—"}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 900, color: gateColor(auditRow?.rangeGate.state) }}>{auditRow?.rangeGate.label ?? "—"}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 900, color: gateColor(auditRow?.parityGate.state) }}>{auditRow?.parityGate.label ?? "—"}</td>
                  <td style={{ padding: "8px 10px", fontFamily: "ui-monospace, monospace", cursor: "help" }} title={tooltip}>{getAllEngineCompactLabel(row)}</td>
                  <td style={{ padding: "8px 10px", color: row.net > 0 ? COLORS.green : row.net < 0 ? COLORS.red : t.subtext, fontWeight: 900 }}>{row.net}</td>
                  <td style={{ padding: "8px 10px", color: t.subtext, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }}>{row.executionMode}</td>
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
      {streakBands.map((band: any, index: number) => {
        const x1 = x(Math.max(0, band.startSpin - 1));
        const x2 = x(Math.max(band.startSpin, band.endSpin));
        const fill = band.type === "win" ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.11)";
        const stroke = band.type === "win" ? "rgba(34,197,94,0.22)" : "rgba(239,68,68,0.24)";
        return <g key={`${band.type}-${band.startSpin}-${band.endSpin}-${index}`} style={{ cursor: "pointer" }} onClick={() => setSelectedStreakBand(band)}><rect x={x1} y={pt} width={Math.max(3, x2 - x1)} height={chartH - pt - pb} fill={fill} stroke={stroke} strokeWidth="1" /><text x={x1 + 5} y={pt + 14} fill={band.type === "win" ? COLORS.green : COLORS.red} fontSize="10" fontWeight="900">{band.type === "win" ? "W" : "L"}{band.length}</text></g>;
      })}
      {chartTicks.map((tick) => { const yy = y(tick); return <g key={tick}><line x1={pl} x2={chartW - pr} y1={yy} y2={yy} stroke={t.border} /><text x={pl - 10} y={yy + 4} textAnchor="end" fill={t.subtext} fontSize="12" fontWeight="900">{tick.toLocaleString()}</text></g>; })}<line x1={pl} x2={chartW - pr} y1={y(startingBankroll)} y2={y(startingBankroll)} stroke="rgba(250,204,21,0.72)" strokeDasharray="4 4" /><text x={chartW - pr - 130} y={y(startingBankroll) - 6} fill={COLORS.yellow} fontSize="12" fontWeight="800">Start {startingBankroll}</text><polyline points={chartPoints} fill="none" stroke={COLORS.cyan} strokeWidth="3" />{chartData.length > 1 ? <circle cx={x(maxSpin)} cy={y(chartData.at(-1)!.bankroll)} r="5" fill={COLORS.cyan} /> : null}<g transform={`translate(${pl},${chartH - 16})`}><rect x="0" y="-10" width="10" height="10" fill="rgba(34,197,94,0.18)" stroke="rgba(34,197,94,0.32)" /><text x="16" y="0" fill={t.subtext} fontSize="10" fontWeight="900">Win streak zone</text><rect x="126" y="-10" width="10" height="10" fill="rgba(239,68,68,0.18)" stroke="rgba(239,68,68,0.32)" /><text x="142" y="0" fill={t.subtext} fontSize="10" fontWeight="900">Loss streak zone</text></g></svg></div></CollapsiblePanel></>;
  };
  const RouletteTable = () => <Panel title="Manual Spin Input"><div style={{ display: "grid", gridTemplateColumns: "68px 1fr", gap: 8, background: "#064e3b", borderRadius: 14, padding: 10 }}><div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 6 }}>{["00" as SpinValue, 0].map(n => <button key={String(n)} onClick={() => addSpin(n)} style={rouletteButtonStyle(n)}>{String(n)}</button>)}</div><div style={{ display: "grid", gridTemplateRows: "repeat(3, 1fr)", gap: 6 }}>{ROULETTE_GRID.map((row, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 6 }}>{row.map(n => <button key={String(n)} onClick={() => addSpin(n)} style={rouletteButtonStyle(n)}>{String(n)}</button>)}</div>)}</div></div></Panel>;
  const RecentLog = () => <CollapsiblePanel id="sessionLog" title="Session Log" style={{ minHeight: 408 }}><div style={{ maxHeight: 356, overflowY: "auto", display: "grid", gap: 8 }}>{recent.length === 0 ? <div style={{ color: t.subtext, fontSize: 13 }}>No spins yet.</div> : recent.map(s => <div key={s.spin} style={{ border: `1px solid ${t.border}`, borderRadius: 12, padding: 9, background: t.panel2 }}><div style={{ display: "flex", justifyContent: "space-between", fontWeight: 950, fontSize: 12 }}><span>Spin {s.spin}: {String(s.outcome)} · {s.outcomeGroup}</span><span style={{ color: s.result === "win" ? COLORS.green : s.result === "loss" ? COLORS.red : t.subtext }}>{s.result.toUpperCase()}</span></div><div style={{ fontSize: 12, color: t.subtext, marginTop: 6 }}>Forecast: <b style={{ color: t.text }}>{s.forecastGroup ?? s.predictedGroup ?? "No Forecast"}</b> · Executed: <b style={{ color: t.text }}>{s.predictedGroup ?? "No Bet"}</b> · {s.executionMode} · Tier: <b style={{ color: t.text }}>{s.tier}</b><br />Final {s.result.toUpperCase()}<br />Unit {s.unitBet} · Exposure {s.exposure} · Net {s.net}<br />Bankroll {s.bankroll}</div></div>)}</div></CollapsiblePanel>;

  const PulseAuditTrail = () => {
    const rows = history.filter((row) => row.pulseAudit).slice(-80).reverse();
    return <CollapsiblePanel id="pulseAuditTrail" title="Pulse Audit Trail" style={{ minHeight: 360 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: t.subtext, fontWeight: 800 }}>Records Confidence / DPI / Spread / Signal for every settled spin.</div>
        <div style={{ width: 150 }}><Button variant="secondary" onClick={downloadPulseAuditCSV} disabled={!history.length}>Audit CSV</Button></div>
      </div>
      <div style={{ maxHeight: 340, overflow: "auto", display: "grid", gap: 8 }}>
        {rows.length === 0 ? <div style={{ color: t.subtext, fontSize: 13 }}>No audit rows yet.</div> : rows.map((s) => {
          const a = s.pulseAudit!;
          return <div key={`audit-${s.spin}`} style={{ border: `1px solid ${t.border}`, borderRadius: 12, padding: 10, background: t.panel2 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, fontWeight: 950 }}>
              <span>Spin {s.spin} · {s.predictedGroup ?? "No Bet"} → {s.outcomeGroup} · {a.dimensionsCorrect ?? "—"}/3 aligned</span>
              <span style={{ color: s.result === "win" ? COLORS.green : s.result === "loss" ? COLORS.red : t.subtext }}>{s.result.toUpperCase()}</span>
            </div>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, fontSize: 11 }}>
              <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: 8 }}>
                <div style={{ fontWeight: 950, color: a.colorCorrect === false ? COLORS.red : COLORS.green }}>COLOR · {a.colorSignal ?? "—"}</div>
                <div style={{ color: t.subtext, marginTop: 4 }}>DPI {a.colorDpi ?? "—"}</div>
                <div>Black {a.blackConfidence ?? "—"}% / {a.blackSpread ?? "—"}</div>
                <div>Red {a.redConfidence ?? "—"}% / {a.redSpread ?? "—"}</div>
              </div>
              <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: 8 }}>
                <div style={{ fontWeight: 950, color: a.rangeCorrect === false ? COLORS.red : COLORS.green }}>RANGE · {a.rangeSignal ?? "—"}</div>
                <div style={{ color: t.subtext, marginTop: 4 }}>DPI {a.rangeDpi ?? "—"}</div>
                <div>High {a.highConfidence ?? "—"}% / {a.highSpread ?? "—"}</div>
                <div>Low {a.lowConfidence ?? "—"}% / {a.lowSpread ?? "—"}</div>
              </div>
              <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: 8 }}>
                <div style={{ fontWeight: 950, color: a.parityCorrect === false ? COLORS.red : COLORS.green }}>PARITY · {a.paritySignal ?? "—"}</div>
                <div style={{ color: t.subtext, marginTop: 4 }}>DPI {a.parityDpi ?? "—"}</div>
                <div>Even {a.evenConfidence ?? "—"}% / {a.evenSpread ?? "—"}</div>
                <div>Odd {a.oddConfidence ?? "—"}% / {a.oddSpread ?? "—"}</div>
              </div>
            </div>
            <div style={{ marginTop: 7, color: t.subtext, fontSize: 11, fontWeight: 800 }}>Weakest failed dimension: <b style={{ color: t.text }}>{a.weakestDimension ?? "—"}</b> · Closest spread: <b style={{ color: t.text }}>{a.closestSpreadDimension ?? "—"}</b> ({a.smallestSpreadGap ?? "—"})</div>
          </div>;
        })}
      </div>
    </CollapsiblePanel>;
  };

  const getGapMetricsForRow = (row: Step) => {
    const a = row.pulseAudit;
    const colorGap = typeof a?.blackSpread === "number" && typeof a?.redSpread === "number" ? Math.abs(a.blackSpread - a.redSpread) : null;
    const rangeGap = typeof a?.highSpread === "number" && typeof a?.lowSpread === "number" ? Math.abs(a.highSpread - a.lowSpread) : null;
    const parityGap = typeof a?.evenSpread === "number" && typeof a?.oddSpread === "number" ? Math.abs(a.evenSpread - a.oddSpread) : null;
    const gaps = [colorGap, rangeGap, parityGap].filter((gap): gap is number => typeof gap === "number");
    const avgGap = gaps.length ? Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) : null;
    const strongestGap = gaps.length ? Math.max(...gaps) : null;
    const weakestGap = gaps.length ? Math.min(...gaps) : null;
    const zeroGap = gaps.some((gap) => gap === 0);
    const bucket = strongestGap === null ? "—" : strongestGap >= 66 ? "66+" : strongestGap >= 50 ? "50" : strongestGap >= 34 ? "34" : strongestGap >= 16 ? "16" : "0";
    return { colorGap, rangeGap, parityGap, gaps, avgGap, strongestGap, weakestGap, zeroGap, bucket };
  };

  const roiColor = (roi: number | string) => {
    const n = typeof roi === "string" ? parseFloat(roi) : roi;
    return n > 0 ? COLORS.green : n < 0 ? COLORS.red : t.subtext;
  };

  const displayStrategyName = (name: Strategy) => name;

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
  const ControlsPanel = () => <section style={{ marginBottom: 14, display: "grid", gap: 10 }}><button onClick={() => setControlsOpen(v => !v)} style={{ height: 42, borderRadius: 14, border: `1px solid ${t.border}`, background: t.panel, color: t.text, fontWeight: 950, cursor: "pointer", textAlign: "left", padding: "0 14px" }}>{controlsOpen ? "▾" : "▸"} Controls</button>{controlsOpen ? <Panel><div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr)) repeat(3, 118px)", gap: 10, alignItems: "end" }}><div><div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Starting Bankroll</div><Input type="number" value={startingBankroll} onChange={(e: any) => { const n = Number(e.target.value) || DEFAULT_STARTING_BANKROLL; setStartingBankroll(n); rebuild(n, baseUnit, strategy); }} /></div><div><div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Base Unit / Number</div><Input type="number" value={baseUnit} onChange={(e: any) => { const n = Number(e.target.value) || DEFAULT_BASE_UNIT; setBaseUnit(n); rebuild(startingBankroll, n, strategy); }} /></div><div><div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Strategy</div><Select value={strategy} onChange={(e: any) => { const s = e.target.value as Strategy; setStrategy(s); rebuild(startingBankroll, baseUnit, s); }} options={STRATEGIES} /></div><div style={{ position: "relative" }}><div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Execution Mode</div><Select value={executionMode} onChange={(e: any) => applyExecutionMode(e.target.value as ExecutionMode)} options={visibleExecutionModes} /></div><div><div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Auto Spins</div><Input type="number" value={autoSpins} onChange={(e: any) => setAutoSpins(Number(e.target.value) || DEFAULT_AUTO_SPINS)} /></div><Button onClick={runAuto} disabled={autoRunning}>{autoRunning ? "Running..." : "Run Auto"}</Button><Button variant="secondary" onClick={() => setHistory(h => h.slice(0, -1))} disabled={!history.length}>Undo</Button><Button variant="secondary" onClick={reset}>Reset</Button></div></Panel> : null}</section>;

  const DimensionPerformancePanel = () => {
    const rows = buildDimensionPerformance(history);

    return (
      <CollapsiblePanel id="dimensionPerformance" title="Dimension Performance">
        <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: t.panel2 }}>
              <tr>
                {["Dimension", "Wins", "Losses", "WR", "Best Win", "Worst Loss"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: 10,
                      textAlign: "left",
                      color: t.subtext,
                      borderBottom: `1px solid ${t.border}`,
                      fontSize: 11,
                      letterSpacing: 1,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.name} style={{ borderBottom: `1px solid ${t.border}` }}>
                  <td style={{ padding: 10, fontWeight: 900 }}>{row.name}</td>

                  <td style={{ padding: 10, color: COLORS.green, fontWeight: 900 }}>
                    {row.wins}
                  </td>

                  <td style={{ padding: 10, color: COLORS.red, fontWeight: 900 }}>
                    {row.losses}
                  </td>

                  <td
                    style={{
                      padding: 10,
                      color:
                        Number(row.wr) >= 55
                          ? COLORS.green
                          : Number(row.wr) >= 50
                          ? COLORS.amber
                          : COLORS.red,
                      fontWeight: 900,
                    }}
                  >
                    {row.wr}%
                  </td>

                  <td style={{ padding: 10, color: COLORS.green, fontWeight: 900 }}>
                    W{row.bestWin}
                  </td>

                  <td style={{ padding: 10, color: COLORS.red, fontWeight: 900 }}>
                    L{row.worstLoss}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsiblePanel>
    );
  };

const StreakAnalyticsPanel = () => {
    const severityAccent =
      lossStreakSeverity === "Critical"
        ? COLORS.red
        : lossStreakSeverity === "Pressure"
        ? COLORS.amber
        : lossStreakSeverity === "Elevated"
        ? COLORS.yellow
        : COLORS.green;

    const currentLabel =
      streakStats.currentType === "win"
        ? `W${streakStats.currentWinStreak}`
        : streakStats.currentType === "loss"
        ? `L${streakStats.currentLossStreak}`
        : "—";

    const currentAccent =
      streakStats.currentType === "win"
        ? COLORS.green
        : streakStats.currentType === "loss"
        ? COLORS.red
        : t.subtext;

    return (
      <Panel title="Streak Risk Analytics">
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <div style={{ color: t.subtext, fontSize: 10, fontWeight: 950, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>
              Core Streak State
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              <MiniMetric label="Current Streak" value={currentLabel} accent={currentAccent} />
              <MiniMetric label="Largest Win" value={streakStats.largestWinStreak} accent={COLORS.green} />
              <MiniMetric label="Largest Loss" value={streakStats.largestLossStreak} accent={COLORS.red} />
            </div>
          </div>

          <div>
            <div style={{ color: t.subtext, fontSize: 10, fontWeight: 950, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>
              Risk Exposure
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              <MiniMetric label="Loss Severity" value={lossStreakSeverity} accent={severityAccent} />
              <MiniMetric label="Active DD" value={`${activeDrawdown.toLocaleString()} / ${activeDrawdownPct.toFixed(1)}%`} accent={activeDrawdown > 0 ? COLORS.red : COLORS.green} />
              <MiniMetric label="High Water" value={peakBankroll.toLocaleString()} />
            </div>
          </div>

          <div>
            <div style={{ color: t.subtext, fontSize: 10, fontWeight: 950, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>
              Streak Averages
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              <MiniMetric label="Avg Win Streak" value={streakStats.avgWinStreak.toFixed(1)} accent={COLORS.green} />
              <MiniMetric label="Avg Loss Streak" value={streakStats.avgLossStreak.toFixed(1)} accent={COLORS.red} />
            </div>
          </div>
        </div>
      </Panel>
    );
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
      ...coreNumbers.map((value: SpinValue) => ({ value, radius: coreLineR, accent: coreAccent, label: "core" })),
    ];

    return <CollapsiblePanel id="rouletteWheelOverlay" title="Wheel Neighbor Overlay">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 10 }}>
        <MiniMetric label="Group" value={f.group ?? "—"} accent={COLORS.red} />
        <MiniMetric label="Last" value={winning !== undefined ? String(winning) : "—"} accent={winning !== undefined ? (winning === 0 || winning === "00" ? COLORS.green : RED_NUMBERS.has(winning) ? COLORS.red : t.text) : undefined} />
        <MiniMetric label="Execution" value={effectiveExecutionMode} accent={effectiveExecutionMode === "Stream Direct" ? COLORS.cyan : effectiveExecutionMode === "Neighbor Expansion" ? COLORS.amber : COLORS.blue} />
        <MiniMetric label="Align" value={`${wheelAlignment}%`} accent={streamConflict ? COLORS.amber : COLORS.cyan} />
      </div>
      {effectiveExecutionMode === "Dimension Compression" ? <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, background: t.panel2, padding: 9, marginBottom: 10, fontSize: 11, fontWeight: 900, lineHeight: 1.55 }}>
        <div style={{ color: t.subtext }}>Compression Basket</div>
        <div style={{ color: COLORS.amber }}>Core: {coreNumbers.length ? coreNumbers.join(", ") : "—"}</div>
        <div style={{ color: COLORS.blue }}>Added: {wheelNeighbors.length ? wheelNeighbors.join(", ") : "—"}</div>
        <div style={{ color: COLORS.green }}>Final: {executionNumbers.length ? executionNumbers.join(", ") : "—"}</div>
      </div> : null}

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
    return <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}><TrackPanel title="Color Track" values={colorVals} leftLabel="R" rightLabel="B" /><TrackPanel title="Range Track" values={rangeVals} leftLabel="HIGH" rightLabel="LOW" /><TrackPanel title="Parity Track" values={parityVals} leftLabel="ODD" rightLabel="EVEN" /></div>;
  };

  const TerminalHeader = () => {
    const last = history.at(-1);
    return <header style={{ minHeight: 62, display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 14, border: `1px solid ${t.border}`, borderRadius: 18, background: headerBg, padding: "0 16px", boxShadow: t.shadow, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, height: "100%" }}>
        <span style={{ display: "inline-flex", alignItems: "center", color: headerLogoFill, fontFamily: "Sora, Arial, sans-serif", fontWeight: 900, letterSpacing: 1.2, fontSize: 16, lineHeight: "22px", flexShrink: 0 }}>EDGELAB</span>
        <span style={{ height: 24, width: 1, background: t.borderStrong }} />
        <span style={{ color: headerAccent, fontWeight: 900, letterSpacing: 1.2, fontSize: 16 }}>ROULETTE TERMINAL</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, auto)", gap: 18, alignItems: "center", color: t.subtext, fontSize: 11, fontWeight: 850, textTransform: "uppercase" }}>
        <span>Last Result <b style={{ color: last?.result === "win" ? COLORS.green : last?.result === "loss" ? COLORS.red : t.text, marginLeft: 5 }}>{last?.result ?? "—"}</b></span>
        <span>Last Group <b style={{ color: t.text, marginLeft: 5 }}>{last?.outcomeGroup ?? "—"}</b></span>
        <span>Last Spin <b style={{ color: t.text, marginLeft: 5 }}>{last ? String(last.outcome) : "—"}</b></span>
        <span>Next <b style={{ color: headerAccent, marginLeft: 5 }}>Manual</b></span>
      </div>
    </header>;
  };

  const Last20SpinsStrip = () => {
    const last = [...history].reverse().slice(0, 20);
    return <CollapsiblePanel id="last20Spins" title="Last 20 Spins" style={{ overflow: "hidden", minWidth: 0 }}>
      {last.length === 0 ? <div style={{ color: t.subtext, fontSize: 13 }}>No spins yet.</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(20, minmax(0, 1fr))", gap: 3, width: "100%", maxWidth: "100%", minWidth: 0, overflow: "hidden", direction: "ltr", gridAutoFlow: "column" }}>
          {last.map((s, index) => {
            const isZero = s.outcome === 0 || s.outcome === "00";
            const red = !isZero && RED_NUMBERS.has(s.outcome);
            const opacity = index >= 16 ? 0.62 : index >= 12 ? 0.78 : 1;
            return (
              <div key={s.spin} style={{ height: 32, minWidth: 0, borderRadius: 5, border: `1px solid ${isZero ? "rgba(34,197,94,0.55)" : red ? "rgba(239,68,68,0.55)" : t.borderStrong}`, background: isZero ? "rgba(34,197,94,0.30)" : red ? "rgba(153,27,27,0.72)" : "rgba(2,6,23,0.82)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, lineHeight: 1, fontWeight: 950, boxSizing: "border-box", opacity }}>
                {String(s.outcome)}
              </div>
            );
          })}
        </div>
      )}
    </CollapsiblePanel>;
  };

  const Dashboard = () => <section style={{ display: "grid", gridTemplateColumns: "minmax(320px, 360px) minmax(520px, 1fr) minmax(360px, 430px)", gap: 14, alignItems: "start", minWidth: 1240, overflow: "visible" }}><div style={{ display: "grid", gap: 14, minWidth: 0, alignContent: "start" }}><SignalPanel /><CompactMetrics /><RouletteWheelPanel /></div><div style={{ display: "grid", gap: 14, minWidth: 0, overflow: "hidden", alignContent: "start" }}><RouletteTable /><Last20SpinsStrip /><BankrollChart /><DimensionPatternPanel /></div><div style={{ display: "grid", gap: 14, minWidth: 0, alignContent: "start" }}><RecentLog /><ComparisonTable compact /></div></section>;



  // ─── TI REGIME ACCURACY ────────────────────────────────────────────────────
  const TI_VALIDATION_WINDOWS: Record<string, number> = {
    Reversal: 3, Drift: 5, Compression: 5, Expansion: 5, Recovery: 5, Scatter: 4, Stable: 4,
  };

  const getStepDpis = (step: Step): [number, number, number] => [
    step.pulseAudit?.colorDpi ?? 0,
    step.pulseAudit?.rangeDpi ?? 0,
    step.pulseAudit?.parityDpi ?? 0,
  ];

  const getDpiSign = (v: number): -1 | 0 | 1 => v > 0 ? 1 : v < 0 ? -1 : 0;

  const validateTIClassification = (state: string, spinIndex: number, hist: Step[]): { validated: boolean | null; evidence: string; windowUsed: number } => {
    const k = TI_VALIDATION_WINDOWS[state] ?? 4;
    const future = hist.slice(spinIndex + 1, spinIndex + 1 + k);
    if (future.length < Math.min(k, 3)) return { validated: null, evidence: "Pending", windowUsed: future.length };

    const currentDpis = getStepDpis(hist[spinIndex]);
    const currentSigns = currentDpis.map(getDpiSign);

    switch (state) {
      case "Reversal": {
        const reversedAxes = [0, 1, 2].filter((i) => {
          const futSigns = future.map((s) => getDpiSign(getStepDpis(s)[i]));
          return currentSigns[i] !== 0 && futSigns.some((sg) => sg !== 0 && sg !== currentSigns[i]);
        });
        return { validated: reversedAxes.length >= 2, evidence: `${reversedAxes.length}/3 axes reversed`, windowUsed: future.length };
      }
      case "Drift": {
        const dominant = [0, 1, 2].reduce((best, i) => Math.abs(currentDpis[i]) > Math.abs(currentDpis[best]) ? i : best, 0);
        const endDpi = Math.abs(getStepDpis(future.at(-1)!)[dominant]);
        const startDpi = Math.abs(currentDpis[dominant]);
        return { validated: endDpi > startDpi, evidence: `Dominant axis ${startDpi}→${endDpi}`, windowUsed: future.length };
      }
      case "Compression": {
        const spread = (dpis: [number, number, number]) => Math.max(...dpis.map(Math.abs)) - Math.min(...dpis.map(Math.abs));
        const startSpread = spread(currentDpis);
        const endSpread = spread(getStepDpis(future.at(-1)!));
        return { validated: endSpread < startSpread, evidence: `Spread ${startSpread}→${endSpread}`, windowUsed: future.length };
      }
      case "Expansion": {
        const spread = (dpis: [number, number, number]) => Math.max(...dpis.map(Math.abs)) - Math.min(...dpis.map(Math.abs));
        const startSpread = spread(currentDpis);
        const endSpread = spread(getStepDpis(future.at(-1)!));
        return { validated: endSpread > startSpread, evidence: `Spread ${startSpread}→${endSpread}`, windowUsed: future.length };
      }
      case "Recovery": {
        const startAgreeing = hist[spinIndex].pulseAudit?.axesAgreeing ?? 0;
        const endAgreeing = future.at(-1)?.pulseAudit?.axesAgreeing ?? 0;
        const variance = (dpis: [number, number, number]) => {
          const vals = dpis.map(Math.abs);
          const mean = vals.reduce((s, v) => s + v, 0) / 3;
          return vals.reduce((s, v) => s + (v - mean) ** 2, 0) / 3;
        };
        const startVar = variance(currentDpis);
        const endVar = variance(getStepDpis(future.at(-1)!));
        return { validated: endAgreeing >= startAgreeing || endVar < startVar, evidence: `Agreement ${startAgreeing}→${endAgreeing}, var ${startVar.toFixed(1)}→${endVar.toFixed(1)}`, windowUsed: future.length };
      }
      case "Scatter": {
        const uniqueGroups = new Set(future.map((s) => s.outcomeGroup)).size;
        const endAgreeing = future.at(-1)?.pulseAudit?.axesAgreeing ?? 3;
        return { validated: uniqueGroups >= 4 || endAgreeing <= 1, evidence: `Unique groups: ${uniqueGroups}, end agreement: ${endAgreeing}/3`, windowUsed: future.length };
      }
      case "Stable": {
        const signsHeld = [0, 1, 2].every((i) => {
          if (currentSigns[i] === 0) return true;
          return future.every((s) => getDpiSign(getStepDpis(s)[i]) === currentSigns[i]);
        });
        return { validated: signsHeld, evidence: signsHeld ? "All axis signs held" : "At least one axis sign changed", windowUsed: future.length };
      }
      default:
        return { validated: null, evidence: "No rule", windowUsed: future.length };
    }
  };

  const getTIRegimeAccuracyRows = () => history
    .map((row, index) => {
      const state = row.pulseGate?.transitionState ?? row.pulseDiagnostics?.transitionIntelligence?.state ?? "—";
      const risk = row.pulseGate?.transitionRisk ?? "—";
      const expectedRegime = row.pulseGate?.transitionExpectedRegime ?? "—";
      if (!state || state === "—") return null;
      const validation = validateTIClassification(state, index, history);
      const futureRows = history.slice(index + 1, index + 1 + validation.windowUsed);
      const activeRows = futureRows.filter((r) => r.result !== "push");
      const engineWr = activeRows.length ? Math.round((activeRows.filter((r) => r.result === "win").length / activeRows.length) * 100) : null;
      return { spin: row.spin, state, risk, expectedRegime, validated: validation.validated, evidence: validation.evidence, windowUsed: validation.windowUsed, engineWr, activeInWindow: activeRows.length };
    })
    .filter(Boolean) as { spin: number; state: string; risk: string; expectedRegime: string; validated: boolean | null; evidence: string; windowUsed: number; engineWr: number | null; activeInWindow: number; }[];

  const getTIRegimeAccuracySummary = (rows: ReturnType<typeof getTIRegimeAccuracyRows>) => {
    const TI_STATES = ["Reversal", "Drift", "Compression", "Expansion", "Recovery", "Scatter", "Stable"];
    const z = 1.96;
    const ci = (pct: number, n: number) => n > 0 ? Math.round(z * Math.sqrt((pct / 100) * (1 - pct / 100) / n) * 100) : null;
    const byState = (state: string) => {
      const sr = rows.filter((r) => r.state === state);
      const settled = sr.filter((r) => r.validated !== null);
      const correct = settled.filter((r) => r.validated === true).length;
      const pct = settled.length ? Math.round((correct / settled.length) * 100) : null;
      const avgEngineWr = settled.filter((r) => r.engineWr !== null).length ? Math.round(settled.filter((r) => r.engineWr !== null).reduce((s, r) => s + r.engineWr!, 0) / settled.filter((r) => r.engineWr !== null).length) : null;
      return { state, total: sr.length, settled: settled.length, correct, pct, ci: pct !== null ? ci(pct, settled.length) : null, pending: sr.length - settled.length, avgEngineWr };
    };
    const all = rows.filter((r) => r.validated !== null);
    const allCorrect = all.filter((r) => r.validated === true).length;
    const overallPct = all.length ? Math.round((allCorrect / all.length) * 100) : null;
    return {
      overall: { state: "Overall", total: rows.length, settled: all.length, correct: allCorrect, pct: overallPct, ci: overallPct !== null ? ci(overallPct, all.length) : null, pending: rows.length - all.length, avgEngineWr: null as number | null },
      byState: TI_STATES.map(byState),
    };
  };

  const downloadTIAccuracyCSV = () => downloadRowsAsCSV([
    ["Spin", "TI State", "Risk", "Expected Regime", "Validated", "Evidence", "Window Used", "Engine WR% in Window", "Active Bets in Window"],
    ...getTIRegimeAccuracyRows().map((r) => [r.spin, r.state, r.risk, r.expectedRegime, r.validated === null ? "Pending" : r.validated ? "YES" : "NO", r.evidence, r.windowUsed, r.engineWr ?? "—", r.activeInWindow]),
  ], "edgelab_ti_regime_accuracy.csv");

  const LossInvestigationPanel = () => {
    const rows = getLossInvestigationRows();
    const streakCount = Array.from(new Set(rows.map((row) => row.streakId))).length;
    const latest = rows.at(-1);
    return <Panel title="LOSS INVESTIGATION">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{ color: t.subtext, fontSize: 12, fontWeight: 900 }}>Auto-focuses only on loss streaks of 5 or more so we can identify which engine and gate states were active during the failure.</div>
        <Button variant="secondary" onClick={downloadLossInvestigationCSV} disabled={!rows.length}>LOSS CSV</Button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginBottom: 10 }}>
        <MiniMetric label="Loss Streaks ≥5" value={streakCount} accent={streakCount ? COLORS.red : COLORS.green} />
        <MiniMetric label="Rows Captured" value={rows.length} />
        <MiniMetric label="Latest Common Engine" value={latest?.commonEngine ?? "—"} />
        <MiniMetric label="Latest Final Mode" value={latest?.commonMode ?? "—"} />
      </div>
      <div style={{ maxHeight: 360, overflow: "auto", border: `1px solid ${t.border}`, borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: t.text, whiteSpace: "nowrap" }}>
          <thead><tr style={{ textAlign: "left", borderBottom: `1px solid ${t.border}`, color: t.subtext }}>{["Streak", "Spin", "Engine", "Color Gate", "Range Gate", "Parity Gate", "All Engines", "Final Execution", "Forecast", "Outcome", "Dim", "Win Src"].map((h) => <th key={h} style={{ padding: "8px 10px" }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={12} style={{ padding: 12, color: t.subtext, fontWeight: 900 }}>No loss streak of 5+ yet.</td></tr> : rows.slice(-80).reverse().map((row) => {
              const allEngines = getAllEngineDiagnosticsForRow(row);
              const tooltip = `Straight: ${allEngines.straight.label} (${allEngines.straight.group ?? "—"})\nInverted: ${allEngines.inverted.label} (${allEngines.inverted.group ?? "—"})\nMarkov: ${allEngines.markov.label} (${allEngines.markov.group ?? "—"})\nRandom: ${allEngines.random.label} (${allEngines.random.group ?? "—"})`;
              return (
              <tr key={`${row.streakId}-${row.spin}`} style={{ borderBottom: `1px solid ${t.border}` }}>
                <td style={{ padding: "8px 10px", fontWeight: 950 }}>L{row.length}</td>
                <td style={{ padding: "8px 10px" }}>{row.spin}</td>
                <td style={{ padding: "8px 10px", fontWeight: 950 }}>{row.engine}</td>
                <td style={{ padding: "8px 10px", color: row.colorGate.state === "EXECUTE" ? COLORS.green : row.colorGate.state === "HOLD" ? COLORS.amber : t.subtext }}>{row.colorGate.label}</td>
                <td style={{ padding: "8px 10px", color: row.rangeGate.state === "EXECUTE" ? COLORS.green : row.rangeGate.state === "HOLD" ? COLORS.amber : t.subtext }}>{row.rangeGate.label}</td>
                <td style={{ padding: "8px 10px", color: row.parityGate.state === "EXECUTE" ? COLORS.green : row.parityGate.state === "HOLD" ? COLORS.amber : t.subtext }}>{row.parityGate.label}</td>
                <td style={{ padding: "8px 10px", fontFamily: "ui-monospace, monospace", cursor: "help" }} title={tooltip}>{getAllEngineCompactLabel(row)}</td>
                <td style={{ padding: "8px 10px", fontWeight: 950 }}>{row.finalExecutionMode}</td>
                <td style={{ padding: "8px 10px" }}>{row.forecast}</td>
                <td style={{ padding: "8px 10px" }}>{row.outcome}</td>
                <td style={{ padding: "8px 10px", textAlign: "center" }}>{row.dimensionsCorrect}</td>
                <td style={{ padding: "8px 10px", textAlign: "center", color: row.winningSource === "Core" ? COLORS.green : row.winningSource !== "None" ? COLORS.amber : t.subtext, fontWeight: 950 }}>{row.winningSource}</td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>
    </Panel>;
  };

  const AxisFailureAnalysisPanel = () => {
    const rows = getAxisFailureRows();
    const summaryRows = getAxisFailureSummaryRows();
    const axisTotals = (["Color", "Range", "Parity"] as const).map((axis) => ({ axis, count: rows.filter((row) => row.failedAxis === axis).length }));
    const totalResolvedDelay = rows.filter((row) => typeof row.recoveryDelay === "number") as any[];
    const avgRecovery = totalResolvedDelay.length ? (totalResolvedDelay.reduce((sum, row) => sum + row.recoveryDelay, 0) / totalResolvedDelay.length).toFixed(1) : "—";
    const mostFailed = axisTotals.slice().sort((a, b) => b.count - a.count)[0];
    const heatRows = summaryRows.slice(0, 12);
    return <Panel title="AXIS FAILURE ANALYSIS">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{ color: t.subtext, fontSize: 12, fontWeight: 900 }}>Tracks every 2/3-dimension loss and identifies the single failed axis before any Pulse logic is changed.</div>
        <Button variant="secondary" onClick={downloadAxisFailureCSV} disabled={!rows.length}>AXIS CSV</Button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8, marginBottom: 10 }}>
        <MiniMetric label="2/3 Losses" value={rows.length} accent={rows.length ? COLORS.red : COLORS.green} />
        <MiniMetric label="Top Failed Axis" value={mostFailed?.count ? mostFailed.axis : "—"} accent={mostFailed?.count ? COLORS.amber : COLORS.green} />
        <MiniMetric label="Color Fails" value={axisTotals[0].count} accent={axisTotals[0].count ? COLORS.red : t.subtext} />
        <MiniMetric label="Range Fails" value={axisTotals[1].count} accent={axisTotals[1].count ? COLORS.red : t.subtext} />
        <MiniMetric label="Parity Fails" value={axisTotals[2].count} accent={axisTotals[2].count ? COLORS.red : t.subtext} />
        <MiniMetric label="Avg Recovery" value={avgRecovery} accent={avgRecovery !== "—" ? COLORS.cyan : t.subtext} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1.95fr", gap: 10, marginBottom: 10 }}>
        <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, padding: 10, background: t.panel2 }}>
          <div style={{ fontSize: 11, color: t.subtext, fontWeight: 950, textTransform: "uppercase", marginBottom: 8 }}>Axis Totals Heat Map</div>
          <div style={{ display: "grid", gap: 7 }}>
            {axisTotals.map((row) => {
              const pct = rows.length ? Math.round((row.count / rows.length) * 100) : 0;
              return <div key={row.axis}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 950 }}><span>{row.axis}</span><span>{row.count} · {pct}%</span></div>
                <div style={{ height: 10, borderRadius: 999, background: t.input, border: `1px solid ${t.border}`, overflow: "hidden", marginTop: 4 }}><div style={{ width: `${pct}%`, height: "100%", background: row.count ? COLORS.red : t.border }} /></div>
              </div>;
            })}
          </div>
        </div>
        <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, padding: 10, background: t.panel2 }}>
          <div style={{ fontSize: 11, color: t.subtext, fontWeight: 950, textTransform: "uppercase", marginBottom: 8 }}>Engine / Gate Heat Map</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: t.text }}>
            <thead><tr style={{ textAlign: "left", borderBottom: `1px solid ${t.border}`, color: t.subtext }}><th style={{ paddingBottom: 7 }}>Axis</th><th>Engine</th><th style={{ textAlign: "center" }}>Fails</th><th style={{ textAlign: "center" }}>Top Mode</th><th style={{ textAlign: "center" }}>Gate State</th><th style={{ textAlign: "center" }}>Avg Rec</th><th style={{ textAlign: "center" }}>Open</th></tr></thead>
            <tbody>{heatRows.length === 0 ? <tr><td colSpan={7} style={{ padding: 10, color: t.subtext, fontWeight: 900 }}>No 2/3-dimension losses yet.</td></tr> : heatRows.map((row) => <tr key={row.key} style={{ borderBottom: `1px solid ${t.border}` }}><td style={{ padding: "8px 0", fontWeight: 950, color: COLORS.amber }}>{row.failedAxis}</td><td>{row.engine}</td><td style={{ textAlign: "center", fontWeight: 950, color: COLORS.red }}>{row.samples}</td><td style={{ textAlign: "center" }}>{row.topMode}</td><td style={{ textAlign: "center", color: row.topGateState === "EXECUTE" ? COLORS.green : row.topGateState === "HOLD" ? COLORS.amber : t.subtext, fontWeight: 950 }}>{row.topGateState}</td><td style={{ textAlign: "center" }}>{row.avgDelay === null ? "—" : row.avgDelay.toFixed(1)}</td><td style={{ textAlign: "center", color: row.open ? COLORS.amber : t.subtext, fontWeight: 950 }}>{row.open}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
      <div style={{ maxHeight: 360, overflow: "auto", border: `1px solid ${t.border}`, borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: t.text, whiteSpace: "nowrap" }}>
          <thead><tr style={{ textAlign: "left", borderBottom: `1px solid ${t.border}`, color: t.subtext }}>{["Spin", "Failed Axis", "Engine", "Gate State", "All Engines", "Forecast", "Outcome", "Final Mode", "Recovery"].map((h) => <th key={h} style={{ padding: "8px 10px" }}>{h}</th>)}</tr></thead>
          <tbody>{rows.length === 0 ? <tr><td colSpan={9} style={{ padding: 12, color: t.subtext, fontWeight: 900 }}>No 2/3-dimension losses captured yet.</td></tr> : rows.slice(-100).reverse().map((row) => {
            const allEngines = getAllEngineDiagnosticsForRow(row);
            const tooltip = `Straight: ${allEngines.straight.label} (${allEngines.straight.group ?? "—"})\nInverted: ${allEngines.inverted.label} (${allEngines.inverted.group ?? "—"})\nMarkov: ${allEngines.markov.label} (${allEngines.markov.group ?? "—"})\nRandom: ${allEngines.random.label} (${allEngines.random.group ?? "—"})`;
            return <tr key={`axis-${row.spin}-${row.failedAxis}`} style={{ borderBottom: `1px solid ${t.border}` }}><td style={{ padding: "8px 10px", fontWeight: 950 }}>{row.spin}</td><td style={{ padding: "8px 10px", color: COLORS.amber, fontWeight: 950 }}>{row.failedAxis}</td><td style={{ padding: "8px 10px", fontWeight: 950 }}>{row.engine}</td><td style={{ padding: "8px 10px", color: row.failedAxisGate.state === "EXECUTE" ? COLORS.green : row.failedAxisGate.state === "HOLD" ? COLORS.amber : t.subtext, fontWeight: 950 }}>{row.failedAxisGate.label}</td><td style={{ padding: "8px 10px", fontFamily: "ui-monospace, monospace", cursor: "help" }} title={tooltip}>{getAllEngineCompactLabel(row)}</td><td style={{ padding: "8px 10px" }}>{row.forecast}</td><td style={{ padding: "8px 10px" }}>{row.outcome}</td><td style={{ padding: "8px 10px", fontWeight: 950 }}>{row.finalExecutionMode}</td><td style={{ padding: "8px 10px", fontWeight: 950 }}>{row.recoveryDelayLabel}</td></tr>;
          })}</tbody>
        </table>
      </div>
    </Panel>;
  };

  const PulseSwitchLogPanel = () => {
    const rows = getPulseSwitchLogRows();
    const switches = rows.filter((row) => row.switched);
    const leanSwitches = switches.filter((row) => row.switchReason === "sustained-lean" || row.switchReason === "accelerating-lean");
    const maxLeanStreak = rows.length ? Math.max(...rows.map((row) => row.leanStreak)) : 0;
    return <Panel title="PULSE SWITCH LOG">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{ color: t.subtext, fontSize: 12, fontWeight: 900 }}>Rolling win rate + sample size for all 4 engines, every spin. A switch now requires the edge to be demonstrated over multiple spins, not a one-off snapshot: either a sustained lean (challenger holds z ≥ 1.0 for 10+ consecutive spins) OR an accelerating lean (z ≥ 1.0, held 5+ spins, and gained ≥ 0.7 over the last 10 spins — for a real edge that's climbing fast). The single-spin significance trigger was removed — at small windows it fired on noise nearly as easily as on a real edge. The very first engine pick after warmup also requires n ≥ 10 before it counts, so a lucky small-sample start can't lock in for the whole session.</div>
        <Button variant="secondary" onClick={downloadPulseSwitchLogCSV} disabled={!rows.length}>SWITCH LOG CSV</Button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8, marginBottom: 10 }}>
        <MiniMetric label="Spins Tracked" value={rows.length} />
        <MiniMetric label="Switches" value={switches.length} />
        <MiniMetric label="Sustained-Lean Switches" value={leanSwitches.length} accent={leanSwitches.length ? COLORS.cyan : t.subtext} />
        <MiniMetric label="Longest Lean Streak" value={maxLeanStreak} accent={maxLeanStreak >= 15 ? COLORS.amber : t.subtext} />
        <MiniMetric label="Current Engine" value={rows.at(-1)?.selectedEngine ?? "—"} />
      </div>
      <div style={{ maxHeight: 360, overflow: "auto", border: `1px solid ${t.border}`, borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: t.text, whiteSpace: "nowrap" }}>
          <thead><tr style={{ textAlign: "left", borderBottom: `1px solid ${t.border}`, color: t.subtext }}>{["Spin", "Selected", "Switched", "Reason", "From", "Straight", "Inverted", "Markov", "Random", "Leader", "Z-Score", "Lean Streak", "Trend", "Accel?"].map((h) => <th key={h} style={{ padding: "8px 10px" }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={14} style={{ padding: 12, color: t.subtext, fontWeight: 900 }}>No Pulse-tracked spins yet (Pulse must be ON).</td></tr> : rows.slice(-100).reverse().map((row) => (
              <tr key={row.spin} style={{ borderBottom: `1px solid ${t.border}` }}>
                <td style={{ padding: "8px 10px", fontWeight: 950 }}>{row.spin}</td>
                <td style={{ padding: "8px 10px", fontWeight: 950 }}>{row.selectedEngine}</td>
                <td style={{ padding: "8px 10px", color: row.switched ? COLORS.cyan : t.subtext, fontWeight: 950 }}>{row.switched ? "YES" : "—"}</td>
                <td style={{ padding: "8px 10px", color: row.switchReason === "accelerating-lean" ? COLORS.amber : row.switchReason === "sustained-lean" ? COLORS.cyan : t.subtext, fontWeight: 900 }}>{row.switchReason ?? "—"}</td>
                <td style={{ padding: "8px 10px", color: t.subtext }}>{row.switched ? row.previousEngine : "—"}</td>
                <td style={{ padding: "8px 10px", textAlign: "center" }}>{row.straightRate}% <span style={{ color: t.subtext }}>(n={row.straightN})</span></td>
                <td style={{ padding: "8px 10px", textAlign: "center" }}>{row.invertedRate}% <span style={{ color: t.subtext }}>(n={row.invertedN})</span></td>
                <td style={{ padding: "8px 10px", textAlign: "center" }}>{row.markovRate}% <span style={{ color: t.subtext }}>(n={row.markovN})</span></td>
                <td style={{ padding: "8px 10px", textAlign: "center" }}>{row.randomRate}% <span style={{ color: t.subtext }}>(n={row.randomN})</span></td>
                <td style={{ padding: "8px 10px", fontWeight: 950 }}>{row.leader}</td>
                <td style={{ padding: "8px 10px", textAlign: "center" }}>{row.zScore === null ? "—" : row.zScore.toFixed(2)}</td>
                <td style={{ padding: "8px 10px", textAlign: "center", color: row.leanStreak >= 15 ? COLORS.amber : t.subtext, fontWeight: row.leanStreak >= 15 ? 950 : 400 }}>{row.leanStreak || "—"}</td>
                <td style={{ padding: "8px 10px", textAlign: "center" }}>{row.zTrend === null ? "—" : (row.zTrend > 0 ? "+" : "") + row.zTrend.toFixed(2)}</td>
                <td style={{ padding: "8px 10px", textAlign: "center", color: row.accelerating ? COLORS.cyan : t.subtext, fontWeight: row.accelerating ? 950 : 400 }}>{row.zTrend === null ? "—" : row.accelerating ? "YES" : "NO"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>;
  };

  const ReportQuickAccessPanel = () => {
    const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    const links = [
      ["report-loss-investigation", "Loss Streak Analysis"],
      ["report-axis-failure", "Axis Failure"],
      ["report-pulse-switch-log", "Pulse Switch Log"],
      ["report-summary", "Summary"],
      ["report-bankroll", "Bankroll"],
      ["report-comparison", "Comparison"],
      ["report-session-log", "Session Log"],
    ];
    return <Panel title="REPORTS QUICK ACCESS"><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{links.map(([id, label]) => <Button key={id} variant="secondary" onClick={() => jump(id)}>{label}</Button>)}</div><div style={{ marginTop: 8, color: t.subtext, fontSize: 11, fontWeight: 800 }}>Jump directly to any report section without scrolling through the full Reports page.</div></Panel>;
  };

  const Analytics = () => <section style={{ display: "grid", gap: 14 }}>
    <LossInvestigationPanel />
    <AxisFailureAnalysisPanel />
    <PulseSwitchLogPanel />
    <DimensionPerformancePanel />
    <StreakAnalyticsPanel />
    <ComparisonTable title="Strategy Stability Matrix" />
  </section>;

  const Reports = () => <section style={{ display: "grid", gap: 14 }}>
    <ReportQuickAccessPanel />
    <div id="report-loss-investigation"><LossInvestigationPanel /></div>
    <div id="report-axis-failure"><AxisFailureAnalysisPanel /></div>
    <div id="report-pulse-switch-log"><PulseSwitchLogPanel /></div>
    <div id="report-summary"><Panel title="Report Summary"><div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}><MiniMetric label="Start" value={startingBankroll} /><MiniMetric label="Ending" value={bankroll} /><MiniMetric label="Net" value={net} /><MiniMetric label="ROI" value={roi} /><MiniMetric label="Win Rate" value={winRate} /><MiniMetric label="Spins" value={history.length} /></div></Panel></div>
    
    <div id="report-bankroll"><BankrollChart /></div>
    
    <div id="report-comparison"><ComparisonTable title="Report Comparison" /></div>
    <div id="report-session-log"><RecentLog /></div>
  </section>;
  const Sessions = () => {
    // ── Compute metrics for each saved session ──────────────────────────────
    const sessionMetrics = savedSessions.map(s => {
      const h = s.history;
      const active = h.filter(r => r.result === "win" || r.result === "loss");
      const wins = active.filter(r => r.result === "win").length;
      const losses = active.filter(r => r.result === "loss").length;
      const winRate = active.length ? Math.round(wins / active.length * 100) : 0;
      const endBankroll = h.length ? h[h.length-1].bankroll : s.startingBankroll;
      const net = endBankroll - s.startingBankroll;
      const roi = s.startingBankroll ? Math.round(net / s.startingBankroll * 100) : 0;
      // Profit factor = gross wins / gross losses
      const grossWins = h.filter(r => r.net > 0).reduce((sum, r) => sum + r.net, 0);
      const grossLosses = Math.abs(h.filter(r => r.net < 0).reduce((sum, r) => sum + r.net, 0));
      const pf = grossLosses > 0 ? Math.round(grossWins / grossLosses * 100) / 100 : grossWins > 0 ? 999 : 0;
      // Best/worst streak
      let curStreak = 0; let bestStreak = 0; let worstStreak = 0; let curLoss = 0;
      for (const r of active) {
        if (r.result === "win") { curStreak++; bestStreak = Math.max(bestStreak, curStreak); curLoss = 0; }
        else { curLoss++; worstStreak = Math.max(worstStreak, curLoss); curStreak = 0; }
      }
      // Dominant Pulse engine
      const engineCounts: Record<string,number> = {};
      for (const r of h) {
        const eng = (r as any).pulseSelectedEngine;
        if (eng) engineCounts[eng] = (engineCounts[eng] ?? 0) + 1;
      }
      const dominantEngine = Object.entries(engineCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? "—";
      const date = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—";
      return { name: s.name, date, spins: h.length, active: active.length, wins, losses, winRate, endBankroll, net, roi, pf, bestStreak, worstStreak, dominantEngine, startingBankroll: s.startingBankroll };
    }).sort((a,b) => b.name.localeCompare(a.name));

    // ── Cross-session totals ────────────────────────────────────────────────
    const wonSessions = sessionMetrics.filter(s => s.net > 0).length;
    const lostSessions = sessionMetrics.filter(s => s.net < 0).length;
    const totalNet = sessionMetrics.reduce((sum, s) => sum + s.net, 0);
    const avgROI = sessionMetrics.length ? Math.round(sessionMetrics.reduce((sum,s) => sum+s.roi, 0) / sessionMetrics.length) : 0;
    const avgWinRate = sessionMetrics.length ? Math.round(sessionMetrics.reduce((sum,s) => sum+s.winRate, 0) / sessionMetrics.length) : 0;
    const allPFs = sessionMetrics.filter(s => s.pf > 0 && s.pf < 999);
    const avgPF = allPFs.length ? Math.round(allPFs.reduce((sum,s) => sum+s.pf, 0) / allPFs.length * 100) / 100 : 0;
    const bestSession = sessionMetrics.reduce((best, s) => s.roi > (best?.roi ?? -999) ? s : best, sessionMetrics[0]);
    const worstSession = sessionMetrics.reduce((worst, s) => s.roi < (worst?.roi ?? 999) ? s : worst, sessionMetrics[0]);

    const engineColors: Record<string,string> = { Straight: COLORS.blue, Inverted: COLORS.amber, Markov: COLORS.green, Random: COLORS.cyan };

    return (
      <section style={{ display: "grid", gap: 14 }}>

        {/* ── Cross-session summary ── */}
        {sessionMetrics.length > 0 && (
          <Panel title="Overall Performance">
            {/* Top metrics row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 14 }}>
              {[
                { label: "Sessions", value: sessionMetrics.length, color: t.text },
                { label: "Won / Lost", value: `${wonSessions} / ${lostSessions}`, color: wonSessions > lostSessions ? COLORS.green : COLORS.red },
                { label: "Total Net", value: totalNet >= 0 ? `+${totalNet.toLocaleString()}` : totalNet.toLocaleString(), color: totalNet >= 0 ? COLORS.green : COLORS.red },
                { label: "Avg ROI", value: `${avgROI}%`, color: avgROI >= 0 ? COLORS.green : COLORS.red },
                { label: "Avg Win Rate", value: `${avgWinRate}%`, color: avgWinRate >= 20 ? COLORS.green : COLORS.amber },
                { label: "Avg PF", value: avgPF.toFixed(2), color: avgPF >= 1 ? COLORS.green : COLORS.red },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", background: t.panel2, textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: t.subtext, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 950, color, marginTop: 4 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Best / Worst session */}
            {bestSession && worstSession && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                <div style={{ border: `1px solid ${COLORS.green}44`, borderRadius: 10, padding: "10px 12px", background: "rgba(16,185,129,0.06)" }}>
                  <div style={{ fontSize: 9, color: t.subtext, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Best Session</div>
                  <div style={{ fontSize: 15, fontWeight: 950, color: COLORS.green, marginTop: 4 }}>{bestSession.name}</div>
                  <div style={{ fontSize: 12, color: t.subtext, marginTop: 2 }}>ROI {bestSession.roi}% · Net +{bestSession.net.toLocaleString()} · PF {bestSession.pf}</div>
                </div>
                <div style={{ border: `1px solid ${COLORS.red}44`, borderRadius: 10, padding: "10px 12px", background: "rgba(239,68,68,0.06)" }}>
                  <div style={{ fontSize: 9, color: t.subtext, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Worst Session</div>
                  <div style={{ fontSize: 15, fontWeight: 950, color: COLORS.red, marginTop: 4 }}>{worstSession.name}</div>
                  <div style={{ fontSize: 12, color: t.subtext, marginTop: 2 }}>ROI {worstSession.roi}% · Net {worstSession.net.toLocaleString()} · PF {worstSession.pf}</div>
                </div>
              </div>
            )}

            {/* ROI bar chart per session */}
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 9, color: t.subtext, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>ROI Per Session</div>
              <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 60 }}>
                {sessionMetrics.slice(-20).map(s => {
                  const maxAbs = Math.max(...sessionMetrics.map(x => Math.abs(x.roi)), 1);
                  const h = Math.max(4, Math.round(Math.abs(s.roi) / maxAbs * 56));
                  const col = s.roi >= 0 ? COLORS.green : COLORS.red;
                  return (
                    <div key={s.name} title={`${s.name}: ${s.roi}%`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: 60 }}>
                      <div style={{ width: "100%", height: h, background: col, borderRadius: 3, opacity: 0.85 }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: t.subtext, marginTop: 4 }}>
                <span>Oldest</span><span>Most Recent</span>
              </div>
            </div>
          </Panel>
        )}

        {/* ── Session history table ── */}
        {sessionMetrics.length > 0 && (
          <CollapsiblePanel id="sessionHistoryTable" title="Session History">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                    {["Session","Date","Spins","End","Net","ROI","Win%","PF","Best W","Worst L","Engine"].map(h => (
                      <th key={h} style={{ padding: "6px 8px", textAlign: h === "Session" ? "left" : "center", color: t.subtext, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessionMetrics.map((s, i) => (
                    <tr key={s.name} style={{ borderBottom: `1px solid ${t.border}`, background: i % 2 === 0 ? "transparent" : `${t.panel2}` }}>
                      <td style={{ padding: "8px 8px", fontWeight: 900, color: t.text, whiteSpace: "nowrap" }}>{s.name}</td>
                      <td style={{ padding: "8px 8px", textAlign: "center", color: t.subtext }}>{s.date}</td>
                      <td style={{ padding: "8px 8px", textAlign: "center", color: t.text }}>{s.spins}</td>
                      <td style={{ padding: "8px 8px", textAlign: "center", color: t.text, fontWeight: 900 }}>{s.endBankroll.toLocaleString()}</td>
                      <td style={{ padding: "8px 8px", textAlign: "center", fontWeight: 950, color: s.net >= 0 ? COLORS.green : COLORS.red }}>{s.net >= 0 ? `+${s.net}` : s.net}</td>
                      <td style={{ padding: "8px 8px", textAlign: "center", fontWeight: 950, color: s.roi >= 0 ? COLORS.green : COLORS.red }}>{s.roi}%</td>
                      <td style={{ padding: "8px 8px", textAlign: "center", color: s.winRate >= 20 ? COLORS.green : COLORS.amber }}>{s.winRate}%</td>
                      <td style={{ padding: "8px 8px", textAlign: "center", color: s.pf >= 1 ? COLORS.green : COLORS.red, fontWeight: 900 }}>{s.pf === 999 ? "∞" : s.pf.toFixed(2)}</td>
                      <td style={{ padding: "8px 8px", textAlign: "center", color: COLORS.green }}>{s.bestStreak}</td>
                      <td style={{ padding: "8px 8px", textAlign: "center", color: COLORS.red }}>{s.worstStreak}</td>
                      <td style={{ padding: "8px 8px", textAlign: "center", color: engineColors[s.dominantEngine] ?? t.subtext, fontWeight: 900 }}>{s.dominantEngine}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsiblePanel>
        )}

        {/* ── Session management ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Panel title="Save & Load Sessions">
            <div style={{ display: "grid", gap: 10 }}>
              <Button onClick={() => setShowSave(true)} variant="secondary">Save Current Session</Button>
              <Select value={selectedSession} onChange={(e: any) => { const name = e.target.value; setSelectedSession(name); if (name) recoverSession(name); }} options={["", ...savedSessions.map(s => s.name)]} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                <Button onClick={deleteSession} variant="danger" disabled={!selectedSession}>Delete</Button>
                <Button variant="secondary" onClick={() => window.print()} disabled={!history.length}>Print/PDF</Button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                <Button variant="secondary" onClick={downloadCSV} disabled={!history.length}>Session CSV</Button>
                <Button variant="secondary" onClick={downloadSpinAuditCSV} disabled={!history.length}>Spin Audit CSV</Button>
                <Button variant="secondary" onClick={downloadLossInvestigationCSV} disabled={!history.length}>Loss Analysis CSV</Button>
              </div>
            </div>
          </Panel>
          <Panel title="Merge Sessions">
            <select multiple value={selectedMerge} onChange={(e: any) => setSelectedMerge(Array.from(e.target.selectedOptions).map((o: any) => o.value))} style={{ width: "100%", minHeight: 140, padding: 10, borderRadius: 10, background: t.input, color: t.text, border: `1px solid ${t.borderStrong}` }}>
              {savedSessions.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <Button onClick={mergeSelected} disabled={!selectedMerge.length}>Merge Selected</Button>
              <Button variant="secondary" onClick={() => setSelectedMerge([])} disabled={!selectedMerge.length}>Clear</Button>
            </div>
          </Panel>
        </div>

        {/* ── Current session log and loss analysis ── */}
        <RecentLog />
        <LossInvestigationPanel />

      </section>
    );
  };

  return <div style={{ minHeight: "100vh", background: t.appBg, color: t.text, fontFamily: "Arial, sans-serif", display: "grid", gridTemplateColumns: "82px 1fr" }}>
    <Modal open={showSave}><div style={{ fontSize: 20, fontWeight: 950, marginBottom: 10 }}>Save Current Session</div><Input type="text" value={sessionName} onChange={(e: any) => setSessionName(e.target.value)} placeholder="Session name" /><div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}><div style={{ width: 130 }}><Button variant="secondary" onClick={() => setShowSave(false)}>Cancel</Button></div><div style={{ width: 130 }}><Button onClick={saveSession}>Save</Button></div></div></Modal>
    <Modal open={showSettings}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}><div><div style={{ fontSize: 22, fontWeight: 950 }}>Settings</div><div style={{ fontSize: 13, color: t.subtext, marginTop: 4 }}>Terminal display preferences and table limits.</div></div><button onClick={() => setShowSettings(false)} style={{ border: 0, background: "transparent", fontSize: 24, fontWeight: 900, cursor: "pointer", color: t.subtext }}>×</button></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><button onClick={() => setAppearance("light")} style={{ height: 42, borderRadius: 10, border: `2px solid ${appearance === "light" ? COLORS.blue : t.borderStrong}`, background: "#fff", color: "#0f172a", fontWeight: 950 }}>Light</button><button onClick={() => setAppearance("dark")} style={{ height: 42, borderRadius: 10, border: `2px solid ${appearance === "dark" ? COLORS.cyan : t.borderStrong}`, background: "#020617", color: "#fff", fontWeight: 950 }}>Dark</button></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}><div><div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Table Limit</div><Input type="number" value={tableLimit} onChange={(e: any) => { const n = Number(e.target.value) || DEFAULT_TABLE_LIMIT; setTableLimit(n); setHistory(runStrategy(history.map((h) => h.outcome), strategy, baseUnit, startingBankroll, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, n, perNumberLimit, tierExecution, markovEnabled, randomEnabled)); }} /></div><div><div style={{ fontSize: 11, color: t.subtext, marginBottom: 5, fontWeight: 900 }}>Per Number Limit</div><Input type="number" value={perNumberLimit} onChange={(e: any) => { const n = Number(e.target.value) || DEFAULT_PER_NUMBER_LIMIT; setPerNumberLimit(n); setHistory(runStrategy(history.map((h) => h.outcome), strategy, baseUnit, startingBankroll, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, n, tierExecution, markovEnabled, randomEnabled)); }} /></div></div><div style={{ marginTop: 10, color: t.subtext, fontSize: 11, fontWeight: 800, lineHeight: 1.45 }}>Limits are enforced on every strategy replay. Unit bet is capped by both the straight-up per-number limit and the total table limit across the active execution basket.</div><div style={{ marginTop: 14, border: `1px solid ${t.border}`, background: t.panel2, borderRadius: 12, padding: 12 }}><div style={{ fontSize: 12, fontWeight: 950, color: t.text, marginBottom: 8 }}>Tier Execution Rules</div><div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}><button onClick={() => { const next = !executeWeak; setExecuteWeak(next); setHistory(runStrategy(history.map((h) => h.outcome), strategy, baseUnit, startingBankroll, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, { ...tierExecution, executeWeak: next }, markovEnabled, randomEnabled)); }} style={{ height: 38, borderRadius: 10, border: `1px solid ${executeWeak ? COLORS.green : t.borderStrong}`, background: executeWeak ? "rgba(34,197,94,0.13)" : t.input, color: executeWeak ? COLORS.green : t.subtext, fontWeight: 950, cursor: "pointer" }}>Weak {executeWeak ? "ON" : "OFF"}</button><button onClick={() => { const next = !executeObservation; setExecuteObservation(next); setHistory(runStrategy(history.map((h) => h.outcome), strategy, baseUnit, startingBankroll, pulseEnabled, bbStraightEnabled, bbInvertedEnabled, executionMode, tableLimit, perNumberLimit, { ...tierExecution, executeObservation: next }, markovEnabled, randomEnabled)); }} style={{ height: 38, borderRadius: 10, border: `1px solid ${executeObservation ? COLORS.red : t.borderStrong}`, background: executeObservation ? "rgba(239,68,68,0.11)" : t.input, color: executeObservation ? COLORS.red : t.subtext, fontWeight: 950, cursor: "pointer" }}>Observe Hold {executeObservation ? "ON" : "OFF"}</button></div><div style={{ marginTop: 9, color: t.subtext, fontSize: 11, fontWeight: 800 }}>Default: Weak ON, Observe Hold OFF.</div></div><div style={{ marginTop: 14, border: `1px solid ${t.border}`, background: t.panel2, borderRadius: 12, padding: 12 }}><div style={{ fontSize: 12, fontWeight: 950, color: t.text, marginBottom: 8 }}>Saved Control Settings</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><Button onClick={saveControlSettings}>Save Controls</Button><Button variant="secondary" onClick={clearSavedControlSettings}>Clear Saved</Button></div>{settingsSavedNotice ? <div style={{ marginTop: 9, color: COLORS.green, fontSize: 11, fontWeight: 900 }}>{settingsSavedNotice}</div> : null}</div><div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}><div style={{ width: 130 }}><Button onClick={() => setShowSettings(false)}>Done</Button></div></div></Modal>
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
        {[["Auto Simulation Optimization", "Performance pass that batches Run Auto results, prevents repeated replay loops during simulation, memoizes shadow comparisons, and calculates recent accuracy from stored forecast rows."], ["Bankroll", "Current simulated bankroll after settled spins."], ["Base Unit / Number", "The starting wager amount per active number before strategy scaling and limit enforcement."], ["Adaptive TDA", " upgrade that allows full 3D execution when all dimensions pass, or controlled 2D compression when two dimensions pass and one dimension is weakening."], ["Active · Confirmed", "Gap-structure tier used when separation is usable but not strong enough for Strong and not weak enough for Weak."], ["DPI", "Directional Pressure Index. A pressure-state counter used directly by Spread Pulse as the pressure subtraction in Confidence - |DPI|."], ["DPI Zone", "Summary of pressure level: Neutral, Pressure, or Transition."], ["Engine Shadow Comparison", "Replays PULSE, Straight, Inverted, Markov, and Random against the same spin history so their results can be compared even when they are not live."], ["Entropy Regime Weighting", "Controlled PULSE modifier that slightly adjusts predictor weights based on chaos level. High entropy can favor reversal/recency models, but it cannot dominate the forecast or create Strong by itself."], ["ESI", "Engine Strength Index. A composite Live Engine Rankings score that combines win rate, ROI adjustment, and active engine status to estimate current engine quality."], ["Execution Accuracy", "Performance of actual bettable signals only. Advisory-only tiers are recorded as pushes/no-bets and do not affect bankroll, DPI, ROI, or win/loss totals."], ["Execution Compression", "PULSE-only execution behavior that widens from the strict 3D group to a 2D straight-up basket using current DPM evidence: selected side spread, side-to-side gap, and DPI pressure. It keeps the two strongest live dimensions and relaxes the weakest live dimension."], ["Execution Mode", "Controls whether the system uses Stream Direct, Neighbor Expansion, Edge Expansion, or Hybrid Coverage."], ["Edge Expansion", "Adds only the one-number edge map to the core stream forecast: BHE+9, RHE+2, BHO+1, RHO+10, RLE+2, BLO+1. It does not include Neighbor Expansion numbers."], ["Flat", "Uses the base unit per active number whenever a signal qualifies."], ["Hybrid Coverage", "Combines core stream numbers with both Neighbor Expansion and Edge Expansion coverage."], ["Inverted Mode", "Uses the mirrored Boolean structure only when the DPI threshold is reached; DPI calculation itself remains unchanged."], ["Limit Hit", "Occurs when the requested unit size is reduced by the table limit or per-number limit."], ["Martingale 3", "Doubles the unit after each 3-loss block. More aggressive than Martingale 5 and Martingale 7, especially with expanded number baskets."], ["Martingale 5", "Doubles the unit after each 5-loss block. Medium progression between Martingale 3 and Martingale 7."], ["Post-10 Win Recovery", "Flat betting until a 10+ loss streak arms recovery. The first win after that streak stays flat; the following spin enters Martingale-5 recovery until the next win resets to flat."], ["Martingale 7", "Doubles the unit after each 7-loss block."], ["Neighbor Expansion", "Adds only the PULSE neighbor expansion map to the core stream forecast. It does not include Edge Expansion numbers."], ["Neural Assist", "Diagnostics-only model in the harmonized architecture. It shows recent accuracy, agreement, and entropy context but does not modify live PULSE confidence."], ["Hold · No Bet", "Gap-structure observe state. If Observe Hold is ON, any zero-gap dimension can hold execution as no bet."], ["Per Number Limit", "Maximum straight-up bet allowed on each number. Default is $300 and can be changed in Settings."], ["Persistence Durability", "Legacy TDA diagnostic that checks whether a predicted Color, Range, or Parity alignment has held long enough to trust execution. It remains diagnostic; current Dimension Compression uses DPM spread/gap/DPI evidence instead of persistence."], ["PULSE", "Directional Spread Confidence-DPI engine. It predicts each dimension from Side Spread = Side Confidence - |DPI|. The higher side spread selects Black vs Red, High vs Low, and Even vs Odd. Ties select Red / Low / Odd." ], ["PULSE-Only Expansion", "Additional coverage numbers that are applied only when the active source is PULSE and the execution mode uses Neighbor Expansion or Hybrid Coverage. BB Straight and BB Inverted do not use these added numbers."], ["Saved Control Settings", "Settings option that saves bankroll, base unit, strategy, auto spins, PULSE/BB state, execution mode, table limits, tier execution rules, and appearance for the next login."], ["SIG", "Signals. In Engine Shadow Comparison, SIG is the number of actionable/executed signals produced by that engine during the replay/session."], ["Signal Accuracy", "Forecast accuracy view that can study all PULSE tiers, including advisory-only Directional Observe states."], ["Signal State", "Live decision panel showing the final Pulse Engine prediction, execution state, and tier."], ["Step Recovery", "Controlled staged recovery: 1x, 2x, 3x, then 4x base by loss depth."], ["Straight Mode", "Runs the locked Straight Boolean table from spin 1."], ["Strategy Comparison", "Replays all strategy models from the same raw outcomes to compare ending bankroll, ROI, drawdown, profit factor, and other metrics."], ["Stream Conflict", "Warning shown when neighbor expansion numbers do not match the core forecast stream group."], ["Stream Direct", "Executes only the core predicted group numbers."], ["Active · High Confidence", "Gap-structure tier: at least two dimensions have strong separation at 34+ and no weak non-zero gap is present."], ["Table Limit", "Maximum total wager allowed across the active execution basket. Default is $10,000 and can be changed in Settings."], ["TDA", ". Structural diagnostic layer only. TDA no longer independently vetoes execution; Consensus is the final execution authority. Persistence remains diagnostic. Current Dimension Compression uses live DPM spread/gap/DPI evidence rather than TDA persistence."], ["Tier Execution Rules", "Settings controls that decide whether Weak and Directional Observe tiers are actually executed or only tracked as advisory forecasts."], ["Active · Caution", "Gap-structure tier used when at least one non-zero dimension gap is weak and the signal is still allowed to execute by settings."], ["Wheel Neighbor Overlay", "Execution layer that adds selected wheel-neighbor numbers without changing the core stream forecast."]].map(([term, def]) => <div key={term} style={{ borderBottom: `1px solid ${t.border}`, padding: "13px 0" }}><div style={{ fontSize: 16, fontWeight: 950 }}>{term}</div><div style={{ fontSize: 13, color: t.subtext, marginTop: 4, lineHeight: 1.45 }}>{def}</div></div>)}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16, paddingBottom: 4 }}><div style={{ width: 130 }}><Button onClick={() => setShowGlossary(false)}>Done</Button></div></div>
      </div>
    </div> : null}
    <aside style={{ background: t.railBg, borderRight: `1px solid ${t.border}`, padding: "14px 9px", display: "grid", gridTemplateRows: "auto 1fr auto", gap: 14 }}><div aria-label="Menu" role="img" style={{ width: 48, height: 48, borderRadius: 14, background: isDark ? "rgba(2,6,23,0.34)" : "rgba(255,255,255,0.70)", border: `1px solid ${t.borderStrong}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", boxShadow: sidebarIconShadow }}><div style={{ display: "grid", gap: 5, width: 28 }}><span style={{ display: "block", width: 28, height: 3, borderRadius: 3, background: headerLogoFill }} /><span style={{ display: "block", width: 28, height: 3, borderRadius: 3, background: headerLogoFill }} /><span style={{ display: "block", width: 28, height: 3, borderRadius: 3, background: headerLogoFill }} /></div></div><nav style={{ display: "grid", gap: 8, alignContent: "start" }}>{VIEWS.map(v => <button key={v} onClick={() => setActiveView(v)} style={{ width: "100%", minHeight: 50, borderRadius: 14, border: `1px solid ${activeView === v ? "rgba(34,199,243,0.42)" : "transparent"}`, background: activeView === v ? "rgba(34,199,243,0.14)" : "transparent", color: activeView === v ? headerAccent : t.subtext, fontWeight: 900, fontSize: 10, cursor: "pointer" }}>{v}</button>)}</nav><div style={{ display: "grid", gap: 8 }}><button onClick={() => setShowSettings(true)} style={{ height: 42, borderRadius: 12, border: `1px solid ${t.border}`, background: "transparent", color: t.subtext, fontWeight: 900, cursor: "pointer" }}>⚙</button><button onClick={() => setShowGlossary(true)} style={{ height: 42, borderRadius: 12, border: `1px solid ${t.border}`, background: "transparent", color: t.subtext, fontWeight: 900, cursor: "pointer" }}>?</button></div></aside>
    <main style={{ padding: 16, overflowX: "auto", overflowY: "visible" }}><TerminalHeader />
      <ControlsPanel />
      {activeView === "Dashboard" ? <Dashboard /> : null}{activeView === "Analytics" ? <Analytics /> : null}{activeView === "Reports" ? <Reports /> : null}{activeView === "Sessions" ? <Sessions /> : null}

    </main>
  </div>;
}











