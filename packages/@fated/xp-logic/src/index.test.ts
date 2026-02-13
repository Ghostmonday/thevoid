/**
 * @fated/xp-logic - Tests
 * Chapter 2: Core Philosophy (Telemetry as Truth)
 * Chapter 3: Trust Gradients & REP System
 */

import { 
  calculateTrustScore, 
  calculateREPDecay, 
  calculateREPEarned,
  applyTrustGradient,
  calculateTrustDecay,
  REP_BASE_VALUES,
  REP_MULTIPLIERS,
  TRUST_GRADIENT_CONFIG,
} from '../src/index';

describe('Trust Gradient Calculations', () => {
  describe('calculateTrustScore', () => {
    it('should calculate weighted trust score correctly', () => {
      const components = {
        executionReliability: 80,
        collaborationQuality: 70,
        contributionQuality: 90,
        judgmentQuality: 60,
      };
      
      const result = calculateTrustScore('user-123' as any, components);
      
      // 80 * 0.35 + 70 * 0.25 + 90 * 0.25 + 60 * 0.15 = 76
      expect(result.overall).toBe(76);
      expect(result.userId).toBe('user-123');
    });

    it('should clamp score between 0 and 100', () => {
      const components = {
        executionReliability: 150, // Over 100
        collaborationQuality: -10, // Under 0
        contributionQuality: 50,
        judgmentQuality: 50,
      };
      
      const result = calculateTrustScore('user-123' as any, components);
      expect(result.overall).toBe(100); // Clamped to max
    });
  });

  describe('calculateTrustDecay', () => {
    it('should decay trust by 10% per month', () => {
      const trust = 100;
      const daysElapsed = 30; // 1 month
      
      const result = calculateTrustDecay(trust, daysElapsed);
      expect(result).toBe(90); // 100 * 0.9
    });

    it('should not decay below floor', () => {
      const trust = 5;
      const daysElapsed = 365; // 1 year
      
      const result = calculateTrustDecay(trust, daysElapsed);
      expect(result).toBe(0); // Floor is 0
    });
  });
});

describe('REP Calculations', () => {
  describe('calculateREPEarned', () => {
    it('should calculate base REP with verification multiplier', () => {
      const rep = calculateREPEarned('CODE_COMMIT', 'PEER_REVIEW', 1.0);
      // 10 * 1.5 = 15
      expect(rep).toBe(15);
    });

    it('should apply axis multiplier', () => {
      const rep = calculateREPEarned('CODE_COMMIT', 'AUTOMATED', 2.0);
      // 10 * 1.0 * 2.0 = 20
      expect(rep).toBe(20);
    });

    it('should handle NONE verification with penalty', () => {
      const rep = calculateREPEarned('CODE_COMMIT', 'NONE', 1.0);
      // 10 * 0.5 = 5
      expect(rep).toBe(5);
    });
  });

  describe('calculateREPDecay', () => {
    it('should not decay during grace period', () => {
      const record = {
        axis: 'BACKEND' as any,
        amount: 100,
        earnedAt: new Date(),
        decayRate: 0.03,
      };
      
      const result = calculateREPDecay(record, 15); // Under 30 days
      expect(result).toBe(100);
    });

    it('should decay after grace period', () => {
      const record = {
        axis: 'BACKEND' as any,
        amount: 100,
        earnedAt: new Date(),
        decayRate: 0.03,
      };
      
      const result = calculateREPDecay(record, 60); // 2 months
      // 100 * (0.97)^2 = 94.09 -> 94
      expect(result).toBe(94);
    });
  });
});

describe('Trust Gradient - Network Effects', () => {
  describe('applyTrustGradient', () => {
    it('should boost REP when working with high-trust partner', () => {
      const baseREP = 10;
      const partnerTrust = 80; // Above 75 threshold
      
      const result = applyTrustGradient(baseREP, partnerTrust);
      expect(result).toBe(15); // 10 * 1.5
    });

    it('should penalize REP when working with low-trust partner', () => {
      const baseREP = 10;
      const partnerTrust = 20; // Below 25 threshold
      
      const result = applyTrustGradient(baseREP, partnerTrust);
      expect(result).toBe(5); // 10 * 0.5
    });

    it('should not adjust in normal trust range', () => {
      const baseREP = 10;
      const partnerTrust = 50; // Between 25 and 75
      
      const result = applyTrustGradient(baseREP, partnerTrust);
      expect(result).toBe(10); // No change
    });
  });
});

describe('Configuration Exports', () => {
  it('should have correct REP base values', () => {
    expect(REP_BASE_VALUES.CODE_COMMIT).toBe(10);
    expect(REP_BASE_VALUES.MENTORSHIP).toBe(15);
  });

  it('should have correct verification multipliers', () => {
    expect(REP_MULTIPLIERS.PEER_REVIEW).toBe(1.5);
    expect(REP_MULTIPLIERS.STAKEHOLDER_APPROVAL).toBe(2.0);
  });

  it('should have correct trust gradient config', () => {
    expect(TRUST_GRADIENT_CONFIG.HIGH_TRUST_THRESHOLD).toBe(75);
    expect(TRUST_GRADIENT_CONFIG.LOW_TRUST_THRESHOLD).toBe(25);
  });
});
