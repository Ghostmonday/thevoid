/**
 * @fated/verifier - Tests
 * Chapter 2: Core Philosophy (Telemetry as Truth)
 * Chapter 3: REP System
 */

import {
  determineVerificationLevel,
  calculateVerificationDecay,
  verifyContribution,
  calculateExecutionReliability,
  TELEMETRY_EVIDENCE,
} from '../src/index';
import { ContributionSchema, VerificationLevelSchema } from '@fated/types';

describe('Verification Engine', () => {
  const mockContribution = {
    id: 'contrib-123' as any,
    userId: 'user-123' as any,
    type: 'CODE_COMMIT' as const,
    axes: ['BACKEND'],
    verificationLevel: 'NONE' as const,
    metadata: {},
    createdAt: new Date(),
  };

  describe('determineVerificationLevel', () => {
    it('should return NONE when no telemetry', () => {
      const result = determineVerificationLevel(mockContribution, {});
      
      expect(result.level).toBe('NONE');
      expect(result.approved).toBe(false);
    });

    it('should return AUTOMATED when CI and tests pass', () => {
      const telemetry = {
        ciPassed: true,
        testsPassed: true,
      };
      
      const result = determineVerificationLevel(mockContribution, telemetry);
      
      expect(result.level).toBe('AUTOMATED');
      expect(result.approved).toBe(true);
      expect(result.evidence[TELEMETRY_EVIDENCE.CI_PASSED]).toBe(true);
    });

    it('should return PEER_REVIEW when approved by peers', () => {
      const telemetry = {
        ciPassed: true,
        testsPassed: true,
        approvedBy: ['user-1', 'user-2'],
      };
      
      const result = determineVerificationLevel(mockContribution, telemetry);
      
      expect(result.level).toBe('PEER_REVIEW');
      expect(result.approved).toBe(true);
    });

    it('should return STAKEHOLDER_APPROVAL with lead signoff', () => {
      const telemetry = {
        ciPassed: true,
        testsPassed: true,
        approvedBy: ['user-1'],
        projectLeadSignoff: true,
      };
      
      const result = determineVerificationLevel(mockContribution, telemetry);
      
      expect(result.level).toBe('STAKEHOLDER_APPROVAL');
    });
  });

  describe('calculateVerificationDecay', () => {
    it('should not decay levels without decay time', () => {
      const decision = {
        contributionId: 'contrib-123',
        level: 'AUTOMATED' as const,
        approved: true,
        evidence: {},
        verifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), // 10 days ago
        reason: 'Test',
      };
      
      const result = calculateVerificationDecay(decision);
      
      expect(result.shouldDecay).toBe(false);
    });

    it('should decay PEER_REVIEW after 72 hours', () => {
      const decision = {
        contributionId: 'contrib-123',
        level: 'PEER_REVIEW' as const,
        approved: true,
        evidence: {},
        verifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 80), // 80 hours ago
        reason: 'Test',
      };
      
      const result = calculateVerificationDecay(decision);
      
      expect(result.shouldDecay).toBe(true);
      expect(result.newLevel).toBe('AUTOMATED');
    });
  });

  describe('verifyContribution', () => {
    it('should add manual verifier when provided', () => {
      const telemetry = {
        ciPassed: true,
        testsPassed: true,
      };
      
      const result = verifyContribution(
        mockContribution, 
        telemetry, 
        'verifier-123' as any
      );
      
      expect(result.verifierId).toBe('verifier-123');
    });
  });
});

describe('Execution Reliability Calculation', () => {
  describe('calculateExecutionReliability', () => {
    it('should return 0 for empty history', () => {
      const result = calculateExecutionReliability([]);
      expect(result).toBe(0);
    });

    it('should calculate from approval rate', () => {
      const history = [
        { level: 'AUTOMATED' as const, approved: true },
        { level: 'AUTOMATED' as const, approved: true },
        { level: 'AUTOMATED' as const, approved: false }, // 66% approval
      ];
      
      // We need full decision objects
      const decisions = history.map((h, i) => ({
        contributionId: `c-${i}`,
        level: h.level,
        approved: h.approved,
        evidence: {},
        verifiedAt: new Date(),
        reason: 'test',
      }));
      
      const result = calculateExecutionReliability(decisions);
      
      // Approval rate 66% * 50 = 33
      // Plus AUTOMATED level bonus = 33 + 15 = 48
      expect(result).toBe(48);
    });

    it('should reward higher verification levels', () => {
      const decisions = [
        {
          contributionId: 'c-1',
          level: 'STAKEHOLDER_APPROVAL' as const,
          approved: true,
          evidence: {},
          verifiedAt: new Date(),
          reason: 'test',
        },
      ];
      
      const result = calculateExecutionReliability(decisions);
      
      // 100% approval * 50 = 50
      // Plus STAKEHOLDER level = 50 + 50 = 100
      expect(result).toBe(100);
    });
  });
});
