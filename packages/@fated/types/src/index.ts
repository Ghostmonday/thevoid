/**
 * @fated/types - Zod schemas and type definitions for FatedFortress
 * Chapter 6: Technical Architecture
 * Chapter 3: REP System
 */

import { z } from 'zod';

// ============================================
// USER & IDENTITY
// ============================================

export const UserIdSchema = z.string().uuid();
export type UserId = z.infer<typeof UserIdSchema>;

export const PseudonymSchema = z.object({
  id: UserIdSchema,
  name: z.string().min(1).max(50),
  createdAt: z.date(),
});
export type Pseudonym = z.infer<typeof PseudonymSchema>;

export const VisibilityModeSchema = z.enum(['ANON', 'OFF']);
export type VisibilityMode = z.infer<typeof VisibilityModeSchema>;

export const UserStateSchema = z.enum([
  'VISITOR',      // Initial browsing state
  'PASSIVE',      // Created account, no contributions
  'ACTIVE',       // Primary contributing state
  'PROJECT',       // Scoped to specific projects
  'TRUSTED',      // Earned through sustained contribution
]);
export type UserState = z.infer<typeof UserStateSchema>;

export const UserSchema = z.object({
  id: UserIdSchema,
  primaryPseudonymId: UserIdSchema,
  realName: z.string().optional(), // Only visible in OFF mode
  visibilityMode: VisibilityModeSchema,
  state: UserStateSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type User = z.infer<typeof UserSchema>;

// ============================================
// REP (REPUTATION) SYSTEM
// ============================================

export const REP_AXIS_TECHNICAL = [
  'BACKEND',
  'FRONTEND',
  'DEVOPS',
  'DATA_ENGINEERING',
  'SECURITY',
  'MOBILE',
] as const;

export const REP_AXIS_PROCESS = [
  'PROJECT_MANAGEMENT',
  'QUALITY_ASSURANCE',
  'DOCUMENTATION',
] as const;

export const REP_AXIS_COLLABORATION = [
  'TECHNICAL_LEADERSHIP',
  'CROSS_FUNCTIONAL',
  'COMMUNITY_BUILDING',
] as const

export const REP_AXIS_ENABLEMENT = [
  'PATRONAGE',
  'MENTORSHIP',
  'EVANGELISM',
] as const;

export type REPTechnicalAxis = typeof REP_AXIS_TECHNICAL[number];
export type REPProcessAxis = typeof REP_AXIS_PROCESS[number];
export type REPCollaborationAxis = typeof REP_AXIS_COLLABORATION[number];
export type REPEnablementAxis = typeof REP_AXIS_ENABLEMENT[number];

export type REPAxis = REPTechnicalAxis | REPProcessAxis | REPCollaborationAxis | REPEnablementAxis;

export const REPAxisSchema = z.enum([
  ...REP_AXIS_TECHNICAL,
  ...REP_AXIS_PROCESS,
  ...REP_AXIS_COLLABORATION,
  ...REP_AXIS_ENABLEMENT,
]);

export const REPAmountSchema = z.number().int().min(0);

export const REPRecordSchema = z.object({
  axis: REPAxisSchema,
  amount: REPAmountSchema,
  earnedAt: z.date(),
  decayRate: z.number().min(0).max(1).default(0.03), // 3% monthly
});
export type REPRecord = z.infer<typeof REPRecordSchema>;

export const UserREPProfileSchema = z.object({
  userId: UserIdSchema,
  records: z.array(REPRecordSchema),
  totalREP: REPAmountSchema,
  lastUpdated: z.date(),
});
export type UserREPProfile = z.infer<typeof UserREPProfileSchema>;

// ============================================
// TRUST GRADIENT
// ============================================

export const TrustComponentSchema = z.object({
  executionReliability: z.number().min(0).max(100),
  collaborationQuality: z.number().min(0).max(100),
  contributionQuality: z.number().min(0).max(100),
  judgmentQuality: z.number().min(0).max(100),
});
export type TrustComponent = z.infer<typeof TrustComponentSchema>;

export const TrustScoreSchema = z.object({
  userId: UserIdSchema,
  overall: z.number().min(0).max(100),
  components: TrustComponentSchema,
  calculatedAt: z.date(),
});
export type TrustScore = z.infer<typeof TrustScoreSchema>;

// ============================================
// EXECUTION SQUAD (TEAM ROLES)
// ============================================

export const ExecutionRoleSchema = z.enum([
  'LEAD',         // Architect/Strategist
  'ENGINEER',     // Builder/Implementer
  'AUDITOR',      // Guardian/Quality
  'COORDINATOR',  // Navigator/PM
  'MENTOR',
  'SPONSOR',
]);
export type ExecutionRole = z.infer<typeof ExecutionRoleSchema>;

export const SquadMemberSchema = z.object({
  userId: UserIdSchema,
  role: ExecutionRoleSchema,
  joinedAt: z.date(),
});
export type SquadMember = z.infer<typeof SquadMemberSchema>;

export const SquadSchema = z.object({
  id: UserIdSchema, // Reusing UUID type
  name: z.string().min(1).max(100),
  members: z.array(SquadMemberSchema),
  mission: z.string().optional(),
  createdAt: z.date(),
});
export type Squad = z.infer<typeof SquadSchema>;

// ============================================
// CONTRIBUTIONS & VERIFICATION
// ============================================

export const ContributionTypeSchema = z.enum([
  'CODE_COMMIT',
  'CODE_REVIEW',
  'TASK_COMPLETION',
  'DOCUMENTATION',
  'MENTORSHIP',
]);
export type ContributionType = z.infer<typeof ContributionTypeSchema>;

export const VerificationLevelSchema = z.enum([
  'NONE',
  'AUTOMATED',
  'PEER_REVIEW',
  'STAKEHOLDER_APPROVAL',
]);
export type VerificationLevel = z.infer<typeof VerificationLevelSchema>;

export const ContributionSchema = z.object({
  id: UserIdSchema,
  userId: UserIdSchema,
  type: ContributionTypeSchema,
  axes: z.array(REPAxisSchema),
  verificationLevel: VerificationLevelSchema,
  verifiedBy: UserIdSchema.optional(),
  metadata: z.record(z.unknown()),
  createdAt: z.date(),
});
export type Contribution = z.infer<typeof ContributionSchema>;

// ============================================
// TWO-TIER REPUTATION: ACTIVE BONDS
// ============================================

export const BondStatusSchema = z.enum([
  'ACTIVE',
  'COMPLETED',
  'FORFEITED',   // Slashing triggered
  'RELEASED',
]);
export type BondStatus = z.infer<typeof BondStatusSchema>;

export const BondTriggerSchema = z.enum([
  'P0_OUTAGE',           // Breaking change caused production outage
  'MISSED_DEADLINE',     // Failed to deliver on time
  'PROJECT_ABANDON',     // Left committed project
]);
export type BondTrigger = z.infer<typeof BondTriggerSchema>;

export const ExecutionBondSchema = z.object({
  id: UserIdSchema,
  userId: UserIdSchema,
  squadId: UserIdSchema,
  amount: REPAmountSchema,        // REP at stake
  trigger: BondTriggerSchema,
  status: BondStatusSchema,
  createdAt: z.date(),
  completedAt: z.date().optional(),
});
export type ExecutionBond = z.infer<typeof ExecutionBondSchema>;

// ============================================
// EXPORT ALL SCHEMAS
// ============================================

export const AllSchemas = {
  UserId: UserIdSchema,
  User: UserSchema,
  Pseudonym: PseudonymSchema,
  VisibilityMode: VisibilityModeSchema,
  UserState: UserStateSchema,
  REPAxis: REPAxisSchema,
  REPRecord: REPRecordSchema,
  UserREPProfile: UserREPProfileSchema,
  TrustComponent: TrustComponentSchema,
  TrustScore: TrustScoreSchema,
  ExecutionRole: ExecutionRoleSchema,
  SquadMember: SquadMemberSchema,
  Squad: SquadSchema,
  ContributionType: ContributionTypeSchema,
  VerificationLevel: VerificationLevelSchema,
  Contribution: ContributionSchema,
  BondTrigger: BondTriggerSchema,
  ExecutionBond: ExecutionBondSchema,
};
