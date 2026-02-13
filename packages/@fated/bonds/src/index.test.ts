/**
 * @fated/bonds - Tests
 * Chapter 3.5: Two-Tier Reputation System
 */

import {
  createBond,
  slashBond,
  completeBond,
  releaseBond,
  calculateSlashPenalty,
  calculateREPPenalty,
  evaluateTrigger,
  BondTrigger,
  BondStatus,
} from '../src/index';

describe('Execution Bonds', () => {
  describe('createBond', () => {
    it('should create a valid bond', () => {
      const bond = createBond('user-1', 'squad-1', 500, BondTrigger.MISSED_DEADLINE);
      
      expect(bond.userId).toBe('user-1');
      expect(bond.squadId).toBe('squad-1');
      expect(bond.amount).toBe(500);
      expect(bond.trigger).toBe(BondTrigger.MISSED_DEADLINE);
      expect(bond.status).toBe(BondStatus.ACTIVE);
      expect(bond.id).toBeDefined();
    });

    it('should reject bond below minimum', () => {
      expect(() => createBond('user-1', 'squad-1', 50, BondTrigger.MISSED_DEADLINE))
        .toThrow('Minimum bond amount is 100 REP');
    });
  });

  describe('slashBond', () => {
    it('should slash an active bond', () => {
      const bond = createBond('user-1', 'squad-1', 500, BondTrigger.P0_OUTAGE);
      const event = slashBond(bond, 'Production outage caused by breaking change');
      
      expect(event.bondId).toBe(bond.id);
      expect(event.amount).toBe(500);
      expect(event.trigger).toBe(BondTrigger.P0_OUTAGE);
      expect(event.slashedAt).toBeDefined();
    });

    it('should reject slashing non-active bond', () => {
      const bond = createBond('user-1', 'squad-1', 500, BondTrigger.P0_OUTAGE);
      const completed = completeBond(bond);
      
      expect(() => slashBond(completed as any, 'test')).toThrow('Can only slash active bonds');
    });
  });

  describe('completeBond', () => {
    it('should complete a bond successfully', () => {
      const bond = createBond('user-1', 'squad-1', 500, BondTrigger.MISSED_DEADLINE);
      const event = completeBond(bond);
      
      expect(event.bondId).toBe(bond.id);
      expect(event.completedAt).toBeDefined();
    });
  });

  describe('releaseBond', () => {
    it('should release a bond voluntarily', () => {
      const bond = createBond('user-1', 'squad-1', 500, BondTrigger.MISSED_DEADLINE);
      const released = releaseBond(bond);
      
      expect(released.status).toBe(BondStatus.RELEASED);
      expect(released.completedAt).toBeDefined();
    });
  });
});

describe('Bond Calculations', () => {
  describe('calculateSlashPenalty', () => {
    it('should apply 50% penalty for small bonds', () => {
      expect(calculateSlashPenalty(100)).toBe(0.5);
      expect(calculateSlashPenalty(500)).toBe(0.5);
    });

    it('should apply 75% penalty for medium bonds', () => {
      expect(calculateSlashPenalty(501)).toBe(0.75);
      expect(calculateSlashPenalty(1000)).toBe(0.75);
    });

    it('should apply 90% penalty for large bonds', () => {
      expect(calculateSlashPenalty(1001)).toBe(0.9);
    });
  });

  describe('calculateREPPenalty', () => {
    it('should calculate higher penalty for P0_OUTAGE', () => {
      const penalty = calculateREPPenalty(500, BondTrigger.P0_OUTAGE);
      // 500 * 0.5 * 1.2 = 300
      expect(penalty).toBe(300);
    });

    it('should calculate lower penalty for MISSED_DEADLINE', () => {
      const penalty = calculateREPPenalty(500, BondTrigger.MISSED_DEADLINE);
      // 500 * 0.5 * 0.8 = 200
      expect(penalty).toBe(200);
    });
  });

  describe('evaluateTrigger', () => {
    it('should detect P0_OUTAGE', () => {
      const result = evaluateTrigger(BondTrigger.P0_OUTAGE, { outageOccurred: true });
      expect(result).toBe(true);
    });

    it('should detect MISSED_DEADLINE', () => {
      const result = evaluateTrigger(BondTrigger.MISSED_DEADLINE, { deadlineMissed: true });
      expect(result).toBe(true);
    });

    it('should detect PROJECT_ABANDON', () => {
      const result = evaluateTrigger(BondTrigger.PROJECT_ABANDON, { abandonedProject: true });
      expect(result).toBe(true);
    });

    it('should return false when trigger not met', () => {
      const result = evaluateTrigger(BondTrigger.P0_OUTAGE, { outageOccurred: false });
      expect(result).toBe(false);
    });
  });
});
