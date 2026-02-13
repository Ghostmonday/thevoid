/**
 * @fated/verifier - Contribution Verification Logic
 * Chapter 2: Core Philosophy (Telemetry as Truth)
 * Chapter 3: REP System
 * 
 * The verifier validates contributions and determines
 * verification levels based on telemetry.
 */

import { z } from 'zod';
import {
  VerificationLevelSchema,
  ContributionSchema,
  type Contribution,
  type UserId,
} from '@fated/types';

// ============================================
// VERIFICATION RULES
// ============================================

/**
 * Verification Level Rules
 * Chapter 3: Determines how much REP a contribution earns
 */
export const VERIFICATION_RULES = {
  NONE: {
    requires: [],
    autoApprove: false,
    decayHours: null,
  },
  AUTOMATED: {
    requires: ['CI_PASSED', 'LINT_PASSED', 'TESTS_PASSED'],
    autoApprove: true,
    decayHours: null,
  },
  PEER_REVIEW: {
    requires: ['APPROVED_BY', 'CI_PASSED'],
    autoApprove: false,
    decayHours: 72, // 3 days to review
  },
  STAKEHOLDER_APPROVAL: {
    requires: ['PROJECT_LEAD_SIGNOFF', 'PEER_REVIEW', 'CI_PASSED'],
    autoApprove: false,
    decayHours: 168, // 1 week for stakeholder
  },
} as const;

// ============================================
// TELEMETRY VERIFICATION
// ============================================

/**
 * Telemetry Evidence Types
 * Chapter 2: Telemetry as Truth
 */
export const TELEMETRY_EVIDENCE = {
  CI_PASSED: 'continuous_integration',
  LINT_PASSED: 'code_quality',
  TESTS_PASSED: 'test_coverage',
  DEPLOY_SUCCESS: 'deployment',
  UPTIME_METRIC: 'availability',
  RESPONSE_TIME: 'performance',
} as const;

// ============================================
// VERIFICATION DECISION
// ============================================

export const VerificationDecisionSchema = z.object({
  contributionId: z.string().uuid(),
  level: VerificationLevelSchema,
  approved: z.boolean(),
  evidence: z.record(z.boolean()),  // What checks passed
  verifierId: z.string().uuid().optional(),
  verifiedAt: z.date(),
  reason: z.string().optional(),
});
export type VerificationDecision = z.infer<typeof VerificationDecisionSchema>;

// ============================================
// VERIFICATION ENGINE
// ============================================

export interface TelemetryData {
  ciPassed?: boolean;
  lintPassed?: boolean;
  testsPassed?: boolean;
  deploySuccess?: boolean;
  uptimeMetric?: number;      // Percentage
  responseTime?: number;      // Milliseconds
  approvedBy?: string[];      // User IDs who approved
  projectLeadSignoff?: boolean;
}

/**
 * Determine verification level based on telemetry
 * This is the core "Telemetry as Truth" logic
 */
export function determineVerificationLevel(
  contribution: Contribution,
  telemetry: TelemetryData
): VerificationDecision {
  const evidence: Record<string, boolean> = {};
  
  // Check automated checks first
  evidence[TELEMETRY_EVIDENCE.CI_PASSED] = telemetry.ciPassed ?? false;
  evidence[TELEMETRY_EVIDENCE.LINT_PASSED] = telemetry.lintPassed ?? false;
  evidence[TELEMETRY_EVIDENCE.TESTS_PASSED] = telemetry.testsPassed ?? false;
  evidence[TELEMETRY_EVIDENCE.DEPLOY_SUCCESS] = telemetry.deploySuccess ?? false;

  // Determine level based on evidence
  let level: z.infer<typeof VerificationLevelSchema> = 'NONE';
  let approved = false;
  let reason = 'No verification evidence available';

  // Check AUTOMATED level
  if (telemetry.ciPassed && telemetry.testsPassed) {
    level = 'AUTOMATED';
    approved = true;
    reason = 'Automated CI/CD verification passed';
  }

  // Check PEER_REVIEW level
  if (approved && telemetry.approvedBy && telemetry.approvedBy.length > 0) {
    level = 'PEER_REVIEW';
    reason = `Approved by ${telemetry.approvedBy.length} peer(s)`;
  }

  // Check STAKEHOLDER_APPROVAL level
  if (level === 'PEER_REVIEW' && telemetry.projectLeadSignoff) {
    level = 'STAKEHOLDER_APPROVAL';
    reason = 'Stakeholder sign-off received';
  }

  return {
    contributionId: contribution.id,
    level,
    approved,
    evidence,
    verifiedAt: new Date(),
    reason,
  };
}

/**
 * Calculate verification decay
 * If verification isn't confirmed within time limit, it expires
 */
export function calculateVerificationDecay(
  decision: VerificationDecision
): { shouldDecay: boolean; newLevel: z.infer<typeof VerificationLevelSchema> } {
  const rule = VERIFICATION_RULES[decision.level];
  
  if (!rule.decayHours) {
    return { shouldDecay: false, newLevel: decision.level };
  }

  const hoursSinceVerification = 
    (Date.now() - decision.verifiedAt.getTime()) / (1000 * 60 * 60);

  if (hoursSinceVerification > rule.decayHours) {
    // Decay to next lower level
    const levels: Array<z.infer<typeof VerificationLevelSchema>> = 
      ['STAKEHOLDER_APPROVAL', 'PEER_REVIEW', 'AUTOMATED', 'NONE'];
    const currentIndex = levels.indexOf(decision.level);
    
    if (currentIndex < levels.length - 1) {
      return { 
        shouldDecay: true, 
        newLevel: levels[currentIndex + 1] 
      };
    }
  }

  return { shouldDecay: false, newLevel: decision.level };
}

/**
 * Verify a contribution end-to-end
 */
export function verifyContribution(
  contribution: Contribution,
  telemetry: TelemetryData,
  manualVerifierId?: UserId
): VerificationDecision {
  const decision = determineVerificationLevel(contribution, telemetry);
  
  // Add manual verifier if provided
  if (manualVerifierId) {
    decision.verifierId = manualVerifierId;
  }

  return decision;
}

// ============================================
// TRUST CALCULATION FROM VERIFICATION
// ============================================

/**
 * Calculate execution reliability from verification history
 */
export function calculateExecutionReliability(
  verificationHistory: VerificationDecision[]
): number {
  if (verificationHistory.length === 0) {
    return 0;
  }

  const approved = verificationHistory.filter(v => v.approved).length;
  const approvalRate = approved / verificationHistory.length;

  // Base score from approval rate
  let reliability = approvalRate * 50; // Max 50 points from approval rate

  // Bonus for higher verification levels
  const levelScores: Record<string, number> = {
    NONE: 0,
    AUTOMATED: 15,
    PEER_REVIEW: 30,
    STAKEHOLDER_APPROVAL: 50,
  };

  const avgLevelScore = verificationHistory.reduce(
    (sum, v) => sum + levelScores[v.level], 
    0
  ) / verificationHistory.length;

  reliability += avgLevelScore;

  return Math.min(100, Math.round(reliability));
}

// ============================================
// EXPORTS
// ============================================

export const VerifierLib = {
  VERIFICATION_RULES,
  TELEMETRY_EVIDENCE,
  VerificationDecision: VerificationDecisionSchema,
  
  // Core functions
  determineVerificationLevel,
  calculateVerificationDecay,
  verifyContribution,
  calculateExecutionReliability,
};
