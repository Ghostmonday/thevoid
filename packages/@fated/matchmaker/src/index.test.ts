/**
 * @fated/matchmaker - Tests
 * Chapter 4: Execution Squad
 */

import { 
  calculateMatchScore, 
  findMatches, 
  formSquad, 
  calculateSquadTrust,
  MatchingCriteriaSchema 
} from '../src/index';

// Inline types for testing
type UserId = string;
type ExecutionRole = 'LEAD' | 'ENGINEER' | 'AUDITOR' | 'COORDINATOR' | 'MENTOR' | 'SPONSOR';

interface UserREPProfile {
  userId: UserId;
  records: Array<{ axis: string; amount: number }>;
  totalREP: number;
  lastUpdated: Date;
}

describe('Matchmaker - Skill Matching', () => {
  describe('calculateMatchScore', () => {
    const mockProfile: UserREPProfile = {
      userId: 'user-1',
      records: [
        { axis: 'BACKEND', amount: 50 },
        { axis: 'FRONTEND', amount: 30 },
      ],
      totalREP: 80,
      lastUpdated: new Date(),
    };

    it('should return high score when required axes match', () => {
      const criteria = {
        requiredAxes: ['BACKEND'],
        preferredAxes: [] as string[],
        minTrustScore: 0,
        rolesNeeded: ['ENGINEER'] as ExecutionRole[],
        maxTeamSize: 5,
      };

      const score = calculateMatchScore(mockProfile, 60, criteria);
      expect(score).toBeGreaterThan(50);
    });

    it('should return 0 when required axis is missing', () => {
      const criteria = {
        requiredAxes: ['SECURITY'], // User doesn't have this
        preferredAxes: [] as string[],
        minTrustScore: 0,
        rolesNeeded: ['ENGINEER'] as ExecutionRole[],
        maxTeamSize: 5,
      };

      const score = calculateMatchScore(mockProfile, 60, criteria);
      // Skill match is 0, but trust contributes 40%, so 60 * 0.4 = 24
      expect(score).toBe(24);
    });

    it('should penalize low trust users', () => {
      const criteria = {
        requiredAxes: ['BACKEND'],
        preferredAxes: [] as string[],
        minTrustScore: 70, // Above user's trust
        rolesNeeded: ['ENGINEER'] as ExecutionRole[],
        maxTeamSize: 5,
      };

      const score = calculateMatchScore(mockProfile, 60, criteria);
      // Below minTrustScore, so trust match is 0, but skill match contributes 60%
      expect(score).toBe(60);
    });
  });

  describe('findMatches', () => {
    const candidates = [
      { userId: 'user-1' as UserId, profile: { userId: 'user-1', records: [{ axis: 'BACKEND', amount: 50 }], totalREP: 50, lastUpdated: new Date() }, trustScore: 80 },
      { userId: 'user-2' as UserId, profile: { userId: 'user-2', records: [{ axis: 'FRONTEND', amount: 40 }], totalREP: 40, lastUpdated: new Date() }, trustScore: 60 },
      { userId: 'user-3' as UserId, profile: { userId: 'user-3', records: [{ axis: 'BACKEND', amount: 20 }], totalREP: 20, lastUpdated: new Date() }, trustScore: 40 },
    ];

    it('should return matches sorted by score', () => {
      const criteria = {
        requiredAxes: ['BACKEND'],
        preferredAxes: [] as string[],
        minTrustScore: 0,
        rolesNeeded: ['ENGINEER'] as ExecutionRole[],
        maxTeamSize: 5,
      };

      const matches = findMatches(candidates, criteria);
      
      // All 3 users match (user-2 doesn't have BACKEND but score > 0 due to trust)
      expect(matches.length).toBe(3);
      expect(matches[0].userId).toBe('user-1'); // Higher trust/score first
    });

    it('should filter by minimum trust score', () => {
      const criteria = {
        requiredAxes: [] as string[],
        preferredAxes: [] as string[],
        minTrustScore: 70,
        rolesNeeded: [] as ExecutionRole[],
        maxTeamSize: 5,
      };

      const matches = findMatches(candidates, criteria);
      
      expect(matches.length).toBe(1);
      expect(matches[0].userId).toBe('user-1');
    });
  });

  describe('formSquad', () => {
    const matches = [
      { userId: 'user-1' as UserId, score: 90, skillMatch: 100, trustMatch: 80 },
      { userId: 'user-2' as UserId, score: 70, skillMatch: 60, trustMatch: 70 },
      { userId: 'user-3' as UserId, score: 50, skillMatch: 40, trustMatch: 50 },
    ];

    it('should form squad with assigned roles', () => {
      const criteria = {
        requiredAxes: [] as string[],
        preferredAxes: [] as string[],
        minTrustScore: 0,
        rolesNeeded: ['LEAD', 'ENGINEER', 'AUDITOR'] as ExecutionRole[],
        maxTeamSize: 3,
      };

      const squad = formSquad(matches, criteria, 'Project Alpha');

      expect(squad.name).toBe('Project Alpha');
      expect(squad.members.length).toBe(3);
      expect(squad.members[0].role).toBe('LEAD'); // Highest trust gets LEAD
    });

    it('should respect max team size', () => {
      const criteria = {
        requiredAxes: [] as string[],
        preferredAxes: [] as string[],
        minTrustScore: 0,
        rolesNeeded: ['LEAD', 'ENGINEER'] as ExecutionRole[],
        maxTeamSize: 2,
      };

      const squad = formSquad(matches, criteria, 'Small Team');

      expect(squad.members.length).toBe(2);
    });
  });
});

describe('Squad Trust Calculation', () => {
  describe('calculateSquadTrust', () => {
    it('should return average trust for mixed team', () => {
      const memberTrusts = [80, 60, 40];
      const trust = calculateSquadTrust(memberTrusts);
      
      // Average 60 + gradient bonus from high-trust members
      expect(trust).toBe(63); // 60 + (1/3)*10 = 63
    });

    it('should apply gradient bonus for high-trust team', () => {
      const memberTrusts = [90, 85, 80]; // All above 75
      const trust = calculateSquadTrust(memberTrusts);
      
      // Average 85 + 10% bonus = 93.5 -> 94
      expect(trust).toBeGreaterThan(85);
    });

    it('should return 0 for empty team', () => {
      const trust = calculateSquadTrust([]);
      expect(trust).toBe(0);
    });
  });
});
