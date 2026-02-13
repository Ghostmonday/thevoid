/**
 * @fated/contributions - Contribution Tracking
 * Chapter 3: REP System
 * 
 * Tracks and processes user contributions.
 */

import { z } from 'zod';

// ============================================
// CONTRIBUTION TYPES
// ============================================

export const ContributionType = {
  CODE_COMMIT: 'CODE_COMMIT',
  CODE_REVIEW: 'CODE_REVIEW',
  TASK_COMPLETION: 'TASK_COMPLETION',
  DOCUMENTATION: 'DOCUMENTATION',
  MENTORSHIP: 'MENTORSHIP',
} as const;

export type ContributionTypeType = typeof ContributionType[keyof typeof ContributionType];

// ============================================
// CONTRIBUTION SCHEMA
// ============================================

export const ContributionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.enum(['CODE_COMMIT', 'CODE_REVIEW', 'TASK_COMPLETION', 'DOCUMENTATION', 'MENTORSHIP']),
  axes: z.array(z.string()),
  description: z.string().optional(),
  metadata: z.record(z.unknown()),
  createdAt: z.date(),
});

export type Contribution = z.infer<typeof ContributionSchema>;

// ============================================
// CONTRIBUTION OPERATIONS
// ============================================

/**
 * Create a new contribution record
 */
export function createContribution(
  userId: string,
  type: ContributionTypeType,
  axes: string[],
  metadata: Record<string, unknown> = {},
  description?: string
): Contribution {
  return {
    id: crypto.randomUUID(),
    userId,
    type,
    axes,
    description,
    metadata,
    createdAt: new Date(),
  };
}

/**
 * Calculate REP earned from contribution
 */
export function calculateContributionREP(
  type: ContributionTypeType,
  verificationLevel: 'NONE' | 'AUTOMATED' | 'PEER_REVIEW' | 'STAKEHOLDER_APPROVAL',
  axisMultiplier: number = 1.0
): number {
  const baseValues: Record<ContributionTypeType, number> = {
    [ContributionType.CODE_COMMIT]: 10,
    [ContributionType.CODE_REVIEW]: 5,
    [ContributionType.TASK_COMPLETION]: 8,
    [ContributionType.DOCUMENTATION]: 3,
    [ContributionType.MENTORSHIP]: 15,
  };

  const multipliers = {
    NONE: 0.5,
    AUTOMATED: 1.0,
    PEER_REVIEW: 1.5,
    STAKEHOLDER_APPROVAL: 2.0,
  };

  const base = baseValues[type];
  const multiplier = multipliers[verificationLevel];

  return Math.round(base * multiplier * axisMultiplier);
}

/**
 * Process contribution - main entry point
 */
export function processContribution(
  userId: string,
  type: ContributionTypeType,
  axes: string[],
  verificationLevel: 'NONE' | 'AUTOMATED' | 'PEER_REVIEW' | 'STAKEHOLDER_APPROVAL',
  metadata: Record<string, unknown> = {}
): {
  contribution: Contribution;
  repEarned: number;
} {
  const contribution = createContribution(userId, type, axes, metadata);
  
  // Calculate REP based on primary axis
  const primaryAxis = axes[0] || 'GENERAL';
  const axisMultiplier = getAxisMultiplier(primaryAxis);
  
  const repEarned = calculateContributionREP(type, verificationLevel, axisMultiplier);

  return {
    contribution,
    repEarned,
  };
}

/**
 * Get multiplier based on skill axis
 */
function getAxisMultiplier(axis: string): number {
  // High-demand skills get bonus
  const highDemand = ['SECURITY', 'DEVOPS', 'DATA_ENGINEERING'];
  const mediumDemand = ['BACKEND', 'FRONTEND'];
  
  if (highDemand.includes(axis)) return 1.5;
  if (mediumDemand.includes(axis)) return 1.2;
  return 1.0;
}

/**
 * Aggregate contributions by type
 */
export function aggregateByType(contributions: Contribution[]): Record<ContributionTypeType, number> {
  const aggregates: Record<string, number> = {};
  
  for (const type of Object.values(ContributionType)) {
    aggregates[type] = contributions.filter(c => c.type === type).length;
  }
  
  return aggregates as Record<ContributionTypeType, number>;
}

/**
 * Aggregate contributions by axis
 */
export function aggregateByAxis(contributions: Contribution[]): Record<string, number> {
  const aggregates: Record<string, number> = {};
  
  for (const contrib of contributions) {
    for (const axis of contrib.axes) {
      aggregates[axis] = (aggregates[axis] || 0) + 1;
    }
  }
  
  return aggregates;
}

// ============================================
// EXPORTS
// ============================================

export const ContributionsLib = {
  ContributionType,
  Contribution: ContributionSchema,
  
  // Operations
  createContribution,
  calculateContributionREP,
  processContribution,
  aggregateByType,
  aggregateByAxis,
};
