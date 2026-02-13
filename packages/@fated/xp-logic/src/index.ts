/**
 * @fated/xp-logic - Trust Gradient & REP Calculation Engine
 * Chapter 2: Core Philosophy (Telemetry as Truth)
 * Chapter 3: Trust Gradients & REP System
 */

import { z } from 'zod';
import {
  TrustComponentSchema,
  TrustScoreSchema,
  REPRecordSchema,
  UserREPProfileSchema,
  REPAmountSchema,
  type TrustComponent,
  type TrustScore,
  type REPRecord,
  type UserREPProfile,
  type UserId,
} from '@fated/types';

// ============================================
// TRUST GRADIENT CALCULATIONS
// ============================================

/**
 * Trust Gradient Weights - Chapter 2
 * These weights determine how different factors
 * contribute to the overall trust score
 */
export const TRUST_WEIGHTS = {
  executionReliability: 0.35,   // 35% - Most important
  collaborationQuality: 0.25,  // 25%
  contributionQuality: 0.25,    // 25%
  judgmentQuality: 0.15,        // 15% - Least weight
} as const;

/**
 * Calculate overall trust score from components
 * Uses weighted average formula
 */
export function calculateTrustScore(
  userId: UserId,
  components: TrustComponent
): TrustScore {
  const overall = Math.round(
    components.executionReliability * TRUST_WEIGHTS.executionReliability +
    components.collaborationQuality * TRUST_WEIGHTS.collaborationQuality +
    components.contributionQuality * TRUST_WEIGHTS.contributionQuality +
    components.judgmentQuality * TRUST_WEIGHTS.judgmentQuality
  );

  return {
    userId,
    overall: Math.min(100, Math.max(0, overall)),
    components,
    calculatedAt: new Date(),
  };
}

/**
 * Decay Rate Constants - Chapter 3
 * Passive REP decays at 3% monthly to allow for sabbaticals
 */
export const DECAY_CONFIG = {
  PASSIVE_REP_MONTHLY_RATE: 0.03,    // 3% monthly
  ACTIVE_BOND_DECAY_RATE: 0.00,      // Bonds don't decay, they slash
  GRACE_PERIOD_DAYS: 30,             // No decay in first 30 days
  MIN_TRUST_THRESHOLD: 10,           // Below this, user needs re-verification
} as const;

/**
 * Calculate REP decay for passive reputation
 * Chapter 3.5: Two-Tier System - Passive REP
 */
export function calculateREPDecay(
  record: REPRecord,
  daysSinceLastUpdate: number
): number {
  if (daysSinceLastUpdate < DECAY_CONFIG.GRACE_PERIOD_DAYS) {
    return record.amount; // No decay during grace period
  }

  const monthsElapsed = daysSinceLastUpdate / 30;
  const decayMultiplier = Math.pow(
    1 - DECAY_CONFIG.PASSIVE_REP_MONTHLY_RATE,
    monthsElapsed
  );

  return Math.round(record.amount * decayMultiplier);
}

/**
 * Calculate Trust Decay over time
 * Trust scores decay faster than REP (10% monthly)
 */
export const TRUST_DECAY_CONFIG = {
  MONTHLY_RATE: 0.10,    // 10% monthly
  FLOOR: 0,              // Trust can hit zero
} as const;

export function calculateTrustDecay(
  currentTrust: number,
  daysSinceLastUpdate: number
): number {
  const monthsElapsed = daysSinceLastUpdate / 30;
  const decayMultiplier = Math.pow(
    1 - TRUST_DECAY_CONFIG.MONTHLY_RATE,
    monthsElapsed
  );
  
  return Math.max(TRUST_DECAY_CONFIG.FLOOR, 
    Math.round(currentTrust * decayMultiplier)
  );
}

// ============================================
// REP EARNING ALGORITHMS
// ============================================

/**
 * REP Multipliers by Verification Level
 * Higher verification = more REP earned
 */
export const REP_MULTIPLIERS = {
  NONE: 0.5,                // Self-reported, half value
  AUTOMATED: 1.0,          // CI/CD verified
  PEER_REVIEW: 1.5,        // Code review approved
  STAKEHOLDER_APPROVAL: 2.0, // Project lead verified
} as const;

/**
 * Base REP values by contribution type
 */
export const REP_BASE_VALUES = {
  CODE_COMMIT: 10,
  CODE_REVIEW: 5,
  TASK_COMPLETION: 8,
  DOCUMENTATION: 3,
  MENTORSHIP: 15,
} as const;

/**
 * Calculate REP earned from a contribution
 */
export function calculateREPEarned(
  contributionType: keyof typeof REP_BASE_VALUES,
  verificationLevel: keyof typeof REP_MULTIPLIERS,
  axisMultiplier: number = 1.0
): number {
  const base = REP_BASE_VALUES[contributionType];
  const multiplier = REP_MULTIPLIERS[verificationLevel];
  
  return Math.round(base * multiplier * axisMultiplier);
}

/**
 * Process REP profile with decay
 * Updates all records and applies decay
 */
export function processREPProfile(
  profile: UserREPProfile
): UserREPProfile {
  const now = new Date();
  const daysSinceUpdate = Math.floor(
    (now.getTime() - profile.lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
  );

  const updatedRecords = profile.records.map(record => ({
    ...record,
    amount: calculateREPDecay(record, daysSinceUpdate),
  }));

  const totalREP = updatedRecords.reduce(
    (sum, record) => sum + record.amount, 
    0
  );

  return {
    ...profile,
    records: updatedRecords,
    totalREP,
    lastUpdated: now,
  };
}

// ============================================
// TRUST GRADIENTS - NETWORK EFFECTS
// ============================================

/**
 * Trust Gradient: How trust propagates through networks
 * Chapter 2: Trust Gradients
 * 
 * When you work with high-trust users, your trust grows faster
 * When you work with low-trust users, your trust grows slower
 */
export const TRUST_GRADIENT_CONFIG = {
  HIGH_TRUST_PARTNER_BOOST: 1.5,    // Work with trusted users = 50% boost
  LOW_TRUST_PARTNER_PENALTY: 0.5,   // Work with new users = 50% penalty
  HIGH_TRUST_THRESHOLD: 75,         // Above this = high trust
  LOW_TRUST_THRESHOLD: 25,          // Below this = low trust
} as const;

/**
 * Apply trust gradient to REP calculation
 */
export function applyTrustGradient(
  baseREP: number,
  partnerTrustScore: number
): number {
  if (partnerTrustScore >= TRUST_GRADIENT_CONFIG.HIGH_TRUST_THRESHOLD) {
    return Math.round(baseREP * TRUST_GRADIENT_CONFIG.HIGH_TRUST_PARTNER_BOOST);
  }
  
  if (partnerTrustScore <= TRUST_GRADIENT_CONFIG.LOW_TRUST_THRESHOLD) {
    return Math.round(baseREP * TRUST_GRADIENT_CONFIG.LOW_TRUST_PARTNER_PENALTY);
  }
  
  return baseREP; // Normal trust range, no adjustment
}

// ============================================
// EXPORTS
// ============================================

export const XPLogic = {
  // Trust calculations
  calculateTrustScore,
  calculateTrustDecay,
  calculateTrustScoreSchema: TrustScoreSchema,
  
  // REP calculations
  calculateREPDecay,
  calculateREPEarned,
  processREPProfile,
  applyTrustGradient,
  
  // Config exports
  TRUST_WEIGHTS,
  DECAY_CONFIG,
  REP_MULTIPLIERS,
  REP_BASE_VALUES,
  TRUST_GRADIENT_CONFIG,
};
