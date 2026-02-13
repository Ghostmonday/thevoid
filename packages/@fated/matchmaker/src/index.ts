/**
 * @fated/matchmaker - Execution Squad Matching Engine
 * Chapter 4: Execution Squad
 * 
 * Matches users into teams based on trust scores,
 * skill axes, and availability.
 */

import { z } from 'zod';

// ============================================
// TYPES (Inlined to avoid cross-package deps)
// ============================================

type UserId = string;

type ExecutionRole = 'LEAD' | 'ENGINEER' | 'AUDITOR' | 'COORDINATOR' | 'MENTOR' | 'SPONSOR';

interface REPRecord {
  axis: string;
  amount: number;
  earnedAt?: Date;
  decayRate?: number;
}

interface UserREPProfile {
  userId: UserId;
  records: REPRecord[];
  totalREP: number;
  lastUpdated: Date;
}

interface SquadMember {
  userId: UserId;
  role: ExecutionRole;
  joinedAt: Date;
}

interface Squad {
  id: UserId;
  name: string;
  members: SquadMember[];
  mission?: string;
  createdAt: Date;
}

// ============================================
// MATCHING CRITERIA
// ============================================

export const MatchingCriteriaSchema = z.object({
  requiredAxes: z.array(z.string()),
  preferredAxes: z.array(z.string()),
  minTrustScore: z.number().min(0).max(100).default(0),
  rolesNeeded: z.array(z.enum(['LEAD', 'ENGINEER', 'AUDITOR', 'COORDINATOR', 'MENTOR', 'SPONSOR'])),
  maxTeamSize: z.number().int().min(2).max(10).default(5),
});
export type MatchingCriteria = z.infer<typeof MatchingCriteriaSchema>;

// ============================================
// MATCHING ALGORITHM
// ============================================

/**
 * Calculate skill match score between user and criteria
 */
function calculateSkillMatch(
  userProfile: UserREPProfile,
  criteria: MatchingCriteria
): number {
  let score = 0;
  let maxScore = 0;

  // Required axes must be present
  for (const axis of criteria.requiredAxes) {
    maxScore += 30;
    const userAxis = userProfile.records.find((r) => r.axis === axis);
    if (userAxis && userAxis.amount > 0) {
      score += 30;
    }
  }

  // Preferred axes are bonus
  for (const axis of criteria.preferredAxes) {
    maxScore += 15;
    const userAxis = userProfile.records.find((r) => r.axis === axis);
    if (userAxis && userAxis.amount > 0) {
      score += 15;
    }
  }

  return maxScore > 0 ? (score / maxScore) * 100 : 0;
}

/**
 * Calculate trust match score
 */
function calculateTrustMatch(
  trustScore: number,
  criteria: MatchingCriteria
): number {
  if (trustScore < criteria.minTrustScore) {
    return 0;
  }
  
  // Score scales with trust above minimum
  return Math.min(100, trustScore);
}

/**
 * Calculate overall match score
 */
export function calculateMatchScore(
  userProfile: UserREPProfile,
  trustScore: number,
  criteria: MatchingCriteria
): number {
  const skillScore = calculateSkillMatch(userProfile, criteria);
  const trustMatchScore = calculateTrustMatch(trustScore, criteria);
  
  // Weighted: 60% skill, 40% trust
  const overallScore = (skillScore * 0.6) + (trustMatchScore * 0.4);
  
  return Math.round(overallScore);
}

/**
 * Find best matches for criteria
 */
export function findMatches(
  candidates: Array<{
    userId: UserId;
    profile: UserREPProfile;
    trustScore: number;
  }>,
  criteria: MatchingCriteria
): Array<{
  userId: UserId;
  score: number;
  skillMatch: number;
  trustMatch: number;
}> {
  const matches = candidates
    .map((candidate) => ({
      userId: candidate.userId,
      score: calculateMatchScore(candidate.profile, candidate.trustScore, criteria),
      skillMatch: calculateSkillMatch(candidate.profile, criteria),
      trustMatch: calculateTrustMatch(candidate.trustScore, criteria),
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);

  return matches;
}

/**
 * Form an Execution Squad from matched candidates
 */
export function formSquad(
  matches: Array<{
    userId: UserId;
    score: number;
    skillMatch: number;
    trustMatch: number;
  }>,
  criteria: MatchingCriteria,
  squadName: string
): Squad {
  // Sort by score and take top candidates
  const selectedMembers = matches.slice(0, criteria.maxTeamSize);
  
  // Assign roles based on best skills
  const roleAssignment = assignRoles(selectedMembers, [...criteria.rolesNeeded]);
  
  const squad: Squad = {
    id: crypto.randomUUID() as UserId,
    name: squadName,
    members: roleAssignment.map((assignment, index) => ({
      userId: assignment.userId,
      role: assignment.role,
      joinedAt: new Date(),
    })),
    createdAt: new Date(),
  };

  return squad;
}

/**
 * Assign roles based on candidate scores
 */
function assignRoles(
  candidates: Array<{ userId: UserId; score: number; skillMatch: number; trustMatch: number }>,
  rolesNeeded: ExecutionRole[]
): Array<{ userId: UserId; role: ExecutionRole }> {
  const assignments: Array<{ userId: UserId; role: ExecutionRole }> = [];
  const availableRoles = [...rolesNeeded];
  
  // Sort candidates by trust score (highest first)
  const sortedCandidates = [...candidates].sort((a, b) => b.trustMatch - a.trustMatch);
  
  for (const candidate of sortedCandidates) {
    if (availableRoles.length === 0) break;
    
    // Assign highest-trust user to LEAD if needed
    if (availableRoles.includes('LEAD') && assignments.length === 0) {
      assignments.push({ userId: candidate.userId, role: 'LEAD' });
      availableRoles.splice(availableRoles.indexOf('LEAD'), 1);
      continue;
    }
    
    // Assign next best role
    const role = availableRoles.shift();
    if (role) {
      assignments.push({ userId: candidate.userId, role });
    }
  }

  return assignments;
}

// ============================================
// TRUST GRADIENT INTEGRATION
// ============================================

/**
 * Calculate squad trust score based on member trust
 * Uses Chapter 2 Trust Gradient: high-trust members boost squad
 */
export function calculateSquadTrust(
  memberTrustScores: number[]
): number {
  if (memberTrustScores.length === 0) return 0;

  const avgTrust = memberTrustScores.reduce((a, b) => a + b, 0) / memberTrustScores.length;
  
  // Apply gradient bonus for high-trust squads
  const highTrustMembers = memberTrustScores.filter((t) => t >= 75).length;
  const gradientBonus = (highTrustMembers / memberTrustScores.length) * 10;
  
  return Math.min(100, Math.round(avgTrust + gradientBonus));
}

// ============================================
// EXPORTS
// ============================================

export const MatchmakerLib = {
  MatchingCriteria: MatchingCriteriaSchema,
  
  // Core matching
  calculateMatchScore,
  calculateSkillMatch,
  calculateTrustMatch,
  findMatches,
  formSquad,
  
  // Trust calculation
  calculateSquadTrust,
};
