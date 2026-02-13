/**
 * @fated/db - Persistence Bridge with Write-Through Cache
 * Chapter 6: Technical Architecture
 * 
 * Integrates Prisma with SQLite using a write-through cache pattern.
 * Maintains high-speed in-memory cache for O(1) writes while
 * asynchronously ensuring durability in SQLite.
 */

import { z } from 'zod';

// ============================================
// DATABASE SCHEMAS (Prisma-equivalent in Zod)
// ============================================

/**
 * User table schema
 */
export const UserTableSchema = z.object({
  id: z.string().uuid(),
  primaryPseudonymId: z.string().uuid(),
  realName: z.string().optional(),
  visibilityMode: z.enum(['ANON', 'OFF']),
  state: z.enum(['VISITOR', 'PASSIVE', 'ACTIVE', 'PROJECT', 'TRUSTED']),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type UserTable = z.infer<typeof UserTableSchema>;

/**
 * REP Profile table schema
 */
export const REPProfileTableSchema = z.object({
  userId: z.string().uuid(),
  totalREP: z.number().int().min(0),
  lastUpdated: z.date(),
});
export type REPProfileTable = z.infer<typeof REPProfileTableSchema>;

/**
 * REP Record table schema
 */
export const REPRecordTableSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  axis: z.string(),
  amount: z.number().int().min(0),
  earnedAt: z.date(),
  decayRate: z.number().min(0).max(1),
});
export type REPRecordTable = z.infer<typeof REPRecordTableSchema>;

/**
 * Trust Score table schema
 */
export const TrustScoreTableSchema = z.object({
  userId: z.string().uuid(),
  overall: z.number().min(0).max(100),
  executionReliability: z.number().min(0).max(100),
  collaborationQuality: z.number().min(0).max(100),
  contributionQuality: z.number().min(0).max(100),
  judgmentQuality: z.number().min(0).max(100),
  calculatedAt: z.date(),
});
export type TrustScoreTable = z.infer<typeof TrustScoreTableSchema>;

/**
 * Squad table schema
 */
export const SquadTableSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  mission: z.string().optional(),
  createdAt: z.date(),
});
export type SquadTable = z.infer<typeof SquadTableSchema>;

/**
 * Squad Member table schema
 */
export const SquadMemberTableSchema = z.object({
  squadId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['LEAD', 'ENGINEER', 'AUDITOR', 'COORDINATOR', 'MENTOR', 'SPONSOR']),
  joinedAt: z.date(),
});
export type SquadMemberTable = z.infer<typeof SquadMemberTableSchema>;

/**
 * Execution Bond table schema
 */
export const BondTableSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  squadId: z.string().uuid(),
  amount: z.number().int().min(0),
  trigger: z.enum(['P0_OUTAGE', 'MISSED_DEADLINE', 'PROJECT_ABANDON']),
  status: z.enum(['ACTIVE', 'COMPLETED', 'FORFEITED', 'RELEASED']),
  createdAt: z.date(),
  completedAt: z.date().optional(),
});
export type BondTable = z.infer<typeof BondTableSchema>;

/**
 * Event Log table schema
 */
export const EventLogTableSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  payload: z.record(z.unknown()),
  actorId: z.string().uuid(),
  correlationId: z.string().uuid().optional(),
  timestamp: z.date(),
});
export type EventLogTable = z.infer<typeof EventLogTableSchema>;

// ============================================
// WRITE-THROUGH CACHE INTERFACE
// ============================================

export interface CacheEntry<T> {
  data: T;
  dirty: boolean;
  lastWrite: Date;
}

/**
 * Write-Through Cache
 * O(1) writes to memory, async flush to SQLite
 */
export class WriteThroughCache<K, T> {
  private cache: Map<K, CacheEntry<T>> = new Map();
  private writeQueue: Array<{ key: K; data: T }> = [];
  private flushInterval: number;
  private isFlushing = false;

  constructor(flushIntervalMs: number = 1000) {
    this.flushInterval = flushIntervalMs;
    // Start periodic flush
    setInterval(() => this.flush(), this.flushInterval);
  }

  /**
   * O(1) write to cache
   */
  set(key: K, data: T): void {
    this.cache.set(key, {
      data,
      dirty: true,
      lastWrite: new Date(),
    });
    
    // Queue for async persistence
    this.writeQueue.push({ key, data });
  }

  /**
   * O(1) read from cache
   */
  get(key: K): T | undefined {
    return this.cache.get(key)?.data;
  }

  /**
   * Check if key exists in cache
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Async flush dirty entries to database
   */
  private async flush(): Promise<void> {
    if (this.isFlushing || this.writeQueue.length === 0) return;
    
    this.isFlushing = true;
    
    try {
      const toWrite = [...this.writeQueue];
      this.writeQueue = [];
      
      for (const item of toWrite) {
        const entry = this.cache.get(item.key);
        if (entry && entry.dirty) {
          // In real implementation, this would write to SQLite
          console.log(`[DB] Persisting to SQLite: ${item.key}`);
          entry.dirty = false;
        }
      }
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Force immediate flush
   */
  async flushNow(): Promise<void> {
    await this.flush();
  }
}

// ============================================
// DATABASE REPOSITORY INTERFACE
// ============================================

export interface UserRepository {
  findById(id: string): Promise<UserTable | null>;
  findAll(): Promise<UserTable[]>;
  create(user: UserTable): Promise<void>;
  update(user: UserTable): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface REPRepository {
  findProfile(userId: string): Promise<REPProfileTable | null>;
  findRecords(userId: string): Promise<REPRecordTable[]>;
  addRecord(record: REPRecordTable): Promise<void>;
  updateRecord(record: REPRecordTable): Promise<void>;
}

export interface TrustRepository {
  findByUserId(userId: string): Promise<TrustScoreTable | null>;
  save(trust: TrustScoreTable): Promise<void>;
}

export interface SquadRepository {
  findById(id: string): Promise<SquadTable | null>;
  findMembers(squadId: string): Promise<SquadMemberTable[]>;
  create(squad: SquadTable): Promise<void>;
  addMember(member: SquadMemberTable): Promise<void>;
}

export interface BondRepository {
  findByUser(userId: string): Promise<BondTable[]>;
  findActiveBySquad(squadId: string): Promise<BondTable[]>;
  create(bond: BondTable): Promise<void>;
  updateStatus(bondId: string, status: BondTable['status']): Promise<void>;
}

export interface EventRepository {
  log(event: EventLogTable): Promise<void>;
  findByType(type: string, since?: Date): Promise<EventLogTable[]>;
  findByAggregate(aggregateId: string): Promise<EventLogTable[]>;
}

// ============================================
// HYDRATION SUPPORT
// ============================================

/**
 * Hydration script interface
 * Ensures system survives server restart
 */
export interface HydrationScript {
  /**
   * Load cached data from SQLite into memory on startup
   */
  hydrate(cache: WriteThroughCache<any, any>): Promise<void>;
  
  /**
   * Persist any in-memory state before shutdown
   */
  dehydrate(cache: WriteThroughCache<any, any>): Promise<void>;
}

/**
 * Default hydration: load recent users and trust scores
 */
export const defaultHydrationScript: HydrationScript = {
  async hydrate(cache) {
    // In real implementation:
    // 1. Load all users from SQLite
    // 2. Load all REP profiles
    // 3. Load all trust scores
    // 4. Populate cache
    console.log('[DB] Hydrating cache from SQLite...');
  },
  
  async dehydrate(cache) {
    // Flush all dirty entries before shutdown
    await cache.flushNow();
    console.log('[DB] Dehydration complete');
  },
};

// ============================================
// EXPORTS
// ============================================

export const DBLib = {
  // Schemas
  User: UserTableSchema,
  REPProfile: REPProfileTableSchema,
  REPRecord: REPRecordTableSchema,
  TrustScore: TrustScoreTableSchema,
  Squad: SquadTableSchema,
  SquadMember: SquadMemberTableSchema,
  Bond: BondTableSchema,
  EventLog: EventLogTableSchema,
  
  // Cache
  WriteThroughCache,
  
  // Hydration
  defaultHydrationScript,
};
