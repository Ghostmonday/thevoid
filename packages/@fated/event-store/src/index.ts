/**
 * @fated/event-store - Materialized State with Replay-on-Write Engine
 * Chapter 6: Technical Architecture
 * 
 * This is the "Truth Engine" - an event-sourced system where 
 * state is derived from an immutable event stream.
 */

import { z } from 'zod';
import {
  ContributionSchema,
  ExecutionBondSchema,
  UserSchema,
  SquadSchema,
  type Contribution,
  type ExecutionBond,
  type User,
  type Squad,
  type UserId,
} from '@fated/types';

// ============================================
// EVENT TYPES
// ============================================

export const EventTypeSchema = z.enum([
  'USER_CREATED',
  'USER_STATE_CHANGED',
  'VISIBILITY_CHANGED',
  'CONTRIBUTION_LOGGED',
  'CONTRIBUTION_VERIFIED',
  'REP_EARNED',
  'REP_DECAYED',
  'TRUST_CALCULATED',
  'SQUAD_CREATED',
  'SQUAD_MEMBER_JOINED',
  'SQUAD_MEMBER_LEFT',
  'BOND_CREATED',
  'BOND_COMPLETED',
  'BOND_FORFEITED',
]);
export type EventType = z.infer<typeof EventTypeSchema>;

// ============================================
// CORE EVENT STRUCTURE
// ============================================

export const BaseEventSchema = z.object({
  id: z.string().uuid(),
  type: EventTypeSchema,
  timestamp: z.date(),
  actorId: z.string().uuid(),  // User who triggered the event
  correlationId: z.string().uuid().optional(),  // For tracing related events
});
export type BaseEvent = z.infer<typeof BaseEventSchema>;

// ============================================
// EVENT PAYLOADS
// ============================================

export const UserCreatedPayloadSchema = z.object({
  userId: z.string().uuid(),
  primaryPseudonymId: z.string().uuid(),
  visibilityMode: z.enum(['ANON', 'OFF']),
});
export type UserCreatedPayload = z.infer<typeof UserCreatedPayloadSchema>;

export const ContributionLoggedPayloadSchema = z.object({
  contributionId: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.enum(['CODE_COMMIT', 'CODE_REVIEW', 'TASK_COMPLETION', 'DOCUMENTATION', 'MENTORSHIP']),
  axes: z.array(z.string()),
  verificationLevel: z.enum(['NONE', 'AUTOMATED', 'PEER_REVIEW', 'STAKEHOLDER_APPROVAL']),
  metadata: z.record(z.unknown()),
});
export type ContributionLoggedPayload = z.infer<typeof ContributionLoggedPayloadSchema>;

export const REPChangedPayloadSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().int(),
  axis: z.string(),
  reason: z.string(),
  contributionId: z.string().uuid().optional(),
});
export type REPChangedPayload = z.infer<typeof REPChangedPayloadSchema>;

export const TrustCalculatedPayloadSchema = z.object({
  userId: z.string().uuid(),
  overall: z.number().min(0).max(100),
  components: z.object({
    executionReliability: z.number().min(0).max(100),
    collaborationQuality: z.number().min(0).max(100),
    contributionQuality: z.number().min(0).max(100),
    judgmentQuality: z.number().min(0).max(100),
  }),
});
export type TrustCalculatedPayload = z.infer<typeof TrustCalculatedPayloadSchema>;

export const BondEventPayloadSchema = z.object({
  bondId: z.string().uuid(),
  userId: z.string().uuid(),
  squadId: z.string().uuid(),
  amount: z.number().int(),
  trigger: z.enum(['P0_OUTAGE', 'MISSED_DEADLINE', 'PROJECT_ABANDON']),
});
export type BondEventPayload = z.infer<typeof BondEventPayloadSchema>;

// ============================================
// COMPLETE EVENT SCHEMA
// ============================================

export const EventSchema = z.object({
  ...BaseEventSchema.shape,
  payload: z.discriminatedUnion('type', [
    z.object({ type: z.literal('USER_CREATED'), payload: UserCreatedPayloadSchema }),
    z.object({ type: z.literal('CONTRIBUTION_LOGGED'), payload: ContributionLoggedPayloadSchema }),
    z.object({ type: z.literal('REP_EARNED'), payload: REPChangedPayloadSchema }),
    z.object({ type: z.literal('REP_DECAYED'), payload: REPChangedPayloadSchema }),
    z.object({ type: z.literal('TRUST_CALCULATED'), payload: TrustCalculatedPayloadSchema }),
    z.object({ type: z.literal('BOND_CREATED'), payload: BondEventPayloadSchema }),
    z.object({ type: z.literal('BOND_FORFEITED'), payload: BondEventPayloadSchema }),
  ]),
});
export type Event = z.infer<typeof EventSchema>;

// ============================================
// MATERIALIZED STATE (DERIVED FROM EVENTS)
// ============================================

/**
 * Materialized User State
 * Derived by replaying all USER_CREATED and USER_STATE_CHANGED events
 */
export interface MaterializedUserState {
  userId: UserId;
  currentState: 'VISITOR' | 'PASSIVE' | 'ACTIVE' | 'PROJECT' | 'TRUSTED';
  visibilityMode: 'ANON' | 'OFF';
  lastActivityAt: Date;
  totalContributions: number;
  totalREP: number;
  trustScore: number;
}

/**
 * Materialized Project State
 * Derived from contribution and bond events
 */
export interface MaterializedProjectState {
  squadId: UserId;
  activeBonds: number;
  totalREPStaked: number;
  completedContributions: number;
  trustScore: number;
}

// ============================================
// EVENT STORE INTERFACE
// ============================================

export interface EventStore {
  /**
   * Append a new event to the stream
   * This is the "Write" in "Replay-on-Write"
   */
  append(event: Event): Promise<void>;
  
  /**
   * Get all events for a specific aggregate (user, squad, etc.)
   */
  getEventsForAggregate(aggregateId: string): Promise<Event[]>;
  
  /**
   * Replay events to derive current state
   * This is the "Replay" in "Replay-on-Write"
   */
  replay<T>(aggregateId: string, reducer: EventReducer<T>): Promise<T>;
  
  /**
   * Get events by type
   */
  getEventsByType(type: EventType, since?: Date): Promise<Event[]>;
  
  /**
   * Get events in time range
   */
  getEventsInRange(start: Date, end: Date): Promise<Event[]>;
}

export type EventReducer<T> = (state: T, event: Event) => T;

// ============================================
// DEFAULT REDUCERS
// ============================================

export const defaultUserReducer = (
  state: MaterializedUserState | null,
  event: Event
): MaterializedUserState => {
  if (!state) {
    if (event.type === 'USER_CREATED') {
      const payload = event.payload;
      if (payload.type !== 'USER_CREATED') return state as any;
      return {
        userId: payload.payload.userId,
        currentState: 'PASSIVE',
        visibilityMode: payload.payload.visibilityMode,
        lastActivityAt: event.timestamp,
        totalContributions: 0,
        totalREP: 0,
        trustScore: 0,
      };
    }
    return state as any;
  }

  switch (event.type) {
    case 'USER_STATE_CHANGED':
      // Handle state changes
      break;
    case 'CONTRIBUTION_LOGGED':
      return {
        ...state,
        totalContributions: state.totalContributions + 1,
        lastActivityAt: event.timestamp,
      };
    case 'REP_EARNED':
      return {
        ...state,
        totalREP: state.totalREP + (event.payload as any).payload.amount,
      };
    case 'TRUST_CALCULATED':
      const trustPayload = event.payload;
      if (trustPayload.type !== 'TRUST_CALCULATED') return state;
      return {
        ...state,
        trustScore: trustPayload.payload.overall,
      };
  }

  return state;
};

// ============================================
// EXPORTS
// ============================================

export const EventStoreLib = {
  EventType: EventTypeSchema,
  Event: EventSchema,
  BaseEvent: BaseEventSchema,
  
  // Payload schemas
  UserCreatedPayload: UserCreatedPayloadSchema,
  ContributionLoggedPayload: ContributionLoggedPayloadSchema,
  REPChangedPayload: REPChangedPayloadSchema,
  TrustCalculatedPayload: TrustCalculatedPayloadSchema,
  BondEventPayload: BondEventPayloadSchema,
  
  // Reducers
  defaultUserReducer,
};
