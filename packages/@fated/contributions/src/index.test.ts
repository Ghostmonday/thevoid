/**
 * @fated/contributions - Tests
 * Chapter 3: REP System
 */

import {
  createContribution,
  calculateContributionREP,
  processContribution,
  aggregateByType,
  aggregateByAxis,
  ContributionType,
} from '../src/index';

describe('Contribution Tracking', () => {
  describe('createContribution', () => {
    it('should create a valid contribution', () => {
      const contrib = createContribution('user-1', ContributionType.CODE_COMMIT, ['BACKEND']);
      
      expect(contrib.userId).toBe('user-1');
      expect(contrib.type).toBe(ContributionType.CODE_COMMIT);
      expect(contrib.axes).toContain('BACKEND');
      expect(contrib.id).toBeDefined();
      expect(contrib.createdAt).toBeDefined();
    });
  });

  describe('calculateContributionREP', () => {
    it('should calculate REP for CODE_COMMIT', () => {
      const rep = calculateContributionREP(ContributionType.CODE_COMMIT, 'AUTOMATED');
      expect(rep).toBe(10); // Base 10 * 1.0
    });

    it('should apply verification multiplier', () => {
      const rep = calculateContributionREP(ContributionType.CODE_COMMIT, 'PEER_REVIEW');
      expect(rep).toBe(15); // Base 10 * 1.5
    });

    it('should apply axis multiplier', () => {
      const rep = calculateContributionREP(ContributionType.CODE_COMMIT, 'AUTOMATED', 1.5);
      expect(rep).toBe(15); // Base 10 * 1.0 * 1.5
    });

    it('should penalize NONE verification', () => {
      const rep = calculateContributionREP(ContributionType.CODE_COMMIT, 'NONE');
      expect(rep).toBe(5); // Base 10 * 0.5
    });

    it('should give highest REP for MENTORSHIP', () => {
      const rep = calculateContributionREP(ContributionType.MENTORSHIP, 'STAKEHOLDER_APPROVAL', 1.5);
      // Base 15 * 2.0 * 1.5 = 45
      expect(rep).toBe(45);
    });
  });

  describe('processContribution', () => {
    it('should process contribution and calculate REP', () => {
      const result = processContribution(
        'user-1',
        ContributionType.CODE_COMMIT,
        ['BACKEND'],
        'PEER_REVIEW'
      );
      
      expect(result.contribution.userId).toBe('user-1');
      expect(result.repEarned).toBe(18); // 10 * 1.5 * 1.2 (BACKEND axis)
    });
  });

  describe('aggregateByType', () => {
    it('should aggregate contributions by type', () => {
      const contributions = [
        { id: '1', userId: 'u1', type: ContributionType.CODE_COMMIT, axes: [], metadata: {}, createdAt: new Date() },
        { id: '2', userId: 'u1', type: ContributionType.CODE_COMMIT, axes: [], metadata: {}, createdAt: new Date() },
        { id: '3', userId: 'u1', type: ContributionType.CODE_REVIEW, axes: [], metadata: {}, createdAt: new Date() },
      ] as any;
      
      const result = aggregateByType(contributions);
      
      expect(result[ContributionType.CODE_COMMIT]).toBe(2);
      expect(result[ContributionType.CODE_REVIEW]).toBe(1);
    });
  });

  describe('aggregateByAxis', () => {
    it('should aggregate contributions by axis', () => {
      const contributions = [
        { id: '1', userId: 'u1', type: ContributionType.CODE_COMMIT, axes: ['BACKEND', 'DEVOPS'], metadata: {}, createdAt: new Date() },
        { id: '2', userId: 'u1', type: ContributionType.CODE_COMMIT, axes: ['BACKEND'], metadata: {}, createdAt: new Date() },
        { id: '3', userId: 'u1', type: ContributionType.CODE_COMMIT, axes: ['FRONTEND'], metadata: {}, createdAt: new Date() },
      ] as any;
      
      const result = aggregateByAxis(contributions);
      
      expect(result['BACKEND']).toBe(2);
      expect(result['DEVOPS']).toBe(1);
      expect(result['FRONTEND']).toBe(1);
    });
  });
});
