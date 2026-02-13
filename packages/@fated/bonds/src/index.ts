/**
 * @fated/bonds - Execution Bond Management
 * Chapter 3.5: Two-Tier Reputation System
 * 
 * Handles active-staked reputation with slashing triggers.
 */

import { z } from 'zod';

// ============================================
// BOND TYPES
// ============================================

export const BondStatus = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  FORFEITED: 'FORFEITED',
  RELEASED: 'RELEASED',
} as const;

export type BondStatusType = typeof BondStatus[keyof typeof BondStatus];

export const BondTrigger = {
  P0_OUTAGE: 'P0_OUTAGE',         // Breaking change caused production outage
  MISSED_DEADLINE: 'MISSED_DEADLINE', // Failed to deliver on time
  PROJECT_ABANDON: 'PROJECT_ABANDON', // Left committed project
} as const;

export type BondTriggerType = typeof BondTrigger[keyof typeof BondTrigger];

// ============================================
// BOND SCHEMA
// ============================================

export const ExecutionBondSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  squadId: z.string().uuid(),
  amount: z.number().int().min(100), // Minimum 100 REP to stake
  trigger: z.enum(['P0_OUTAGE', 'MISSED_DEADLINE', 'PROJECT_ABANDON']),
  status: z.enum(['ACTIVE', 'COMPLETED', 'FORFEITED', 'RELEASED']),
  createdAt: z.date(),
  completedAt: z.date().optional(),
  slashedAt: z.date().optional(),
  slashReason: z.string().optional(),
});

export type ExecutionBond = z.infer<typeof ExecutionBondSchema>;

// ============================================
// BOND MANAGEMENT
// ============================================

export interface BondSlashedEvent {
  bondId: string;
  userId: string;
  squadId: string;
  amount: number;
  trigger: BondTriggerType;
  slashedAt: Date;
  reason: string;
}

export interface BondCompletedEvent {
  bondId: string;
  userId: string;
  squadId: string;
  amount: number;
  completedAt: Date;
}

/**
 * Create a new execution bond
 */
export function createBond(
  userId: string,
  squadId: string,
  amount: number,
  trigger: BondTriggerType
): ExecutionBond {
  if (amount < 100) {
    throw new Error('Minimum bond amount is 100 REP');
  }

  return {
    id: crypto.randomUUID(),
    userId,
    squadId,
    amount,
    trigger,
    status: BondStatus.ACTIVE,
    createdAt: new Date(),
  };
}

/**
 * Slash a bond (called when trigger condition is met)
 */
export function slashBond(
  bond: ExecutionBond,
  reason: string
): BondSlashedEvent {
  if (bond.status !== BondStatus.ACTIVE) {
    throw new Error('Can only slash active bonds');
  }

  const slashedBond: ExecutionBond = {
    ...bond,
    status: BondStatus.FORFEITED,
    slashedAt: new Date(),
    slashReason: reason,
  };

  return {
    bondId: slashedBond.id,
    userId: slashedBond.userId,
    squadId: slashedBond.squadId,
    amount: slashedBond.amount,
    trigger: slashedBond.trigger,
    slashedAt: slashedBond.slashedAt!,
    reason,
  };
}

/**
 * Complete a bond successfully
 */
export function completeBond(bond: ExecutionBond): BondCompletedEvent {
  if (bond.status !== BondStatus.ACTIVE) {
    throw new Error('Can only complete active bonds');
  }

  const completedBond: ExecutionBond = {
    ...bond,
    status: BondStatus.COMPLETED,
    completedAt: new Date(),
  };

  return {
    bondId: completedBond.id,
    userId: completedBond.userId,
    squadId: completedBond.squadId,
    amount: completedBond.amount,
    completedAt: completedBond.completedAt!,
  };
}

/**
 * Release a bond (voluntary exit before trigger)
 */
export function releaseBond(bond: ExecutionBond): ExecutionBond {
  if (bond.status !== BondStatus.ACTIVE) {
    throw new Error('Can only release active bonds');
  }

  return {
    ...bond,
    status: BondStatus.RELEASED,
    completedAt: new Date(),
  };
}

// ============================================
// BOND CALCULATIONS
// ============================================

/**
 * Calculate slash penalty based on bond amount
 * Higher bonds have steeper penalties
 */
export function calculateSlashPenalty(bondAmount: number): number {
  if (bondAmount <= 500) {
    return 0.5; // 50% penalty for small bonds
  }
  if (bondAmount <= 1000) {
    return 0.75; // 75% penalty for medium bonds
  }
  return 0.9; // 90% penalty for large bonds
}

/**
 * Calculate REP penalty after slash
 */
export function calculateREPPenalty(
  originalAmount: number,
  trigger: BondTriggerType
): number {
  const penaltyRate = calculateSlashPenalty(originalAmount);
  
  // P0_OUTAGE is the harshest
  if (trigger === BondTrigger.P0_OUTAGE) {
    return Math.round(originalAmount * penaltyRate * 1.2); // +20% severity
  }
  
  if (trigger === BondTrigger.PROJECT_ABANDON) {
    return Math.round(originalAmount * penaltyRate); // Standard
  }
  
  // MISSED_DEADLINE is least severe
  return Math.round(originalAmount * penaltyRate * 0.8); // -20% leniency
}

/**
 * Check if a trigger condition is met
 */
export function evaluateTrigger(
  trigger: BondTriggerType,
  evidence: {
    outageOccurred?: boolean;
    deadlineMissed?: boolean;
    abandonedProject?: boolean;
  }
): boolean {
  switch (trigger) {
    case BondTrigger.P0_OUTAGE:
      return evidence.outageOccurred ?? false;
    case BondTrigger.MISSED_DEADLINE:
      return evidence.deadlineMissed ?? false;
    case BondTrigger.PROJECT_ABANDON:
      return evidence.abandonedProject ?? false;
    default:
      return false;
  }
}

// ============================================
// EXPORTS
// ============================================

export const BondsLib = {
  BondStatus,
  BondTrigger,
  ExecutionBond: ExecutionBondSchema,
  
  // Operations
  createBond,
  slashBond,
  completeBond,
  releaseBond,
  
  // Calculations
  calculateSlashPenalty,
  calculateREPPenalty,
  evaluateTrigger,
};
