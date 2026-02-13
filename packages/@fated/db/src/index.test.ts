/**
 * @fated/db - Tests
 * Schema validation tests
 */

import {
  UserTableSchema,
  REPProfileTableSchema,
  TrustScoreTableSchema,
  BondTableSchema,
} from './index';

describe('Database Schemas', () => {
  describe('UserTableSchema', () => {
    it('should validate valid user', () => {
      const user = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        primaryPseudonymId: '550e8400-e29b-41d4-a716-446655440001',
        visibilityMode: 'ANON',
        state: 'VISITOR',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(UserTableSchema.safeParse(user).success).toBe(true);
    });

    it('should reject invalid state', () => {
      const user = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        primaryPseudonymId: '550e8400-e29b-41d4-a716-446655440001',
        visibilityMode: 'ANON',
        state: 'INVALID',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(UserTableSchema.safeParse(user).success).toBe(false);
    });
  });

  describe('REPProfileTableSchema', () => {
    it('should validate valid profile', () => {
      const profile = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        totalREP: 1000,
        lastUpdated: new Date(),
      };
      expect(REPProfileTableSchema.safeParse(profile).success).toBe(true);
    });

    it('should reject negative REP', () => {
      const profile = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        totalREP: -100,
        lastUpdated: new Date(),
      };
      expect(REPProfileTableSchema.safeParse(profile).success).toBe(false);
    });
  });

  describe('TrustScoreTableSchema', () => {
    it('should validate valid trust score', () => {
      const trust = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        score: 85,
        lastUpdated: new Date(),
      };
      expect(TrustScoreTableSchema.safeParse(trust).success).toBe(true);
    });
  });

  describe('BondTableSchema', () => {
    it('should validate valid bond', () => {
      const bond = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        amount: 500,
        status: 'ACTIVE',
        slashedAmount: 0,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      };
      expect(BondTableSchema.safeParse(bond).success).toBe(true);
    });

    it('should reject slashed amount > amount', () => {
      const bond = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        amount: 500,
        status: 'ACTIVE',
        slashedAmount: 600,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      };
      expect(BondTableSchema.safeParse(bond).success).toBe(false);
    });
  });
});
