/**
 * FatedFortress API - Express Server
 * Chapter 5: User States
 * Chapter 6: Technical Architecture
 */

import express from 'express';
import { z } from 'zod';

// ============================================
// USER STATE MACHINE
// ============================================

export const UserState = {
  VISITOR: 'VISITOR',
  PASSIVE: 'PASSIVE',
  ACTIVE: 'ACTIVE',
  PROJECT: 'PROJECT',
  TRUSTED: 'TRUSTED',
} as const;

export type UserStateType = typeof UserState[keyof typeof UserState];

// State transition rules
const STATE_TRANSITIONS: Record<UserStateType, UserStateType[]> = {
  [UserState.VISITOR]: [UserState.PASSIVE],
  [UserState.PASSIVE]: [UserState.ACTIVE, UserState.VISITOR],
  [UserState.ACTIVE]: [UserState.PROJECT, UserState.PASSIVE, UserState.TRUSTED],
  [UserState.PROJECT]: [UserState.ACTIVE, UserState.TRUSTED],
  [UserState.TRUSTED]: [UserState.ACTIVE, UserState.PROJECT], // Trusted is sticky
};

export function canTransition(from: UserStateType, to: UserStateType): boolean {
  return STATE_TRANSITIONS[from]?.includes(to) ?? false;

// ============================================
// AUTHENTICATION
// ============================================

export const AuthProvider = {
  GITHUB: 'github',
  EMAIL: 'email',
} as const;

export type AuthProviderType = typeof AuthProvider[keyof typeof AuthProvider];

// ============================================
// VISIBILITY MODES
// ============================================

export const VisibilityMode = {
  ANON: 'ANON',     // Fully anonymous
  OFF: 'OFF',      // Pseudonym only
} as const;

export type VisibilityModeType = typeof VisibilityMode[keyof typeof VisibilityMode];

// ============================================
// REQUEST SCHEMAS
// ============================================

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  pseudonym: z.string().min(1).max(50),
  realName: z.string().optional(), // Only required if visibilityMode is OFF
  visibilityMode: z.enum(['ANON', 'OFF']),
  authProvider: z.enum(['github', 'email']),
  authToken: z.string(), // OAuth token or magic link
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const UpdateStateRequestSchema = z.object({
  targetState: z.enum(['VISITOR', 'PASSIVE', 'ACTIVE', 'PROJECT', 'TRUSTED']),
  reason: z.string().optional(),
});

export type UpdateStateRequest = z.infer<typeof UpdateStateRequestSchema>;

// ============================================
// USER CONTROLLER
// ============================================

export class UserController {
  /**
   * Register a new user
   */
  async register(request: RegisterRequest) {
    // Create user with initial state VISITOR -> PASSIVE
    const user = {
      id: crypto.randomUUID(),
      email: request.email,
      pseudonym: request.pseudonym,
      realName: request.realName,
      visibilityMode: request.visibilityMode,
      authProvider: request.authProvider,
      state: UserState.PASSIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return user;
  }

  /**
   * Transition user state
   */
  async transitionState(
    userId: string,
    currentState: UserStateType,
    targetState: UserStateType,
    reason?: string
  ) {
    if (!canTransition(currentState, targetState)) {
      throw new Error(
        `Invalid state transition from ${currentState} to ${targetState}`
      );
    }

    return {
      userId,
      previousState: currentState,
      newState: targetState,
      reason,
      transitionedAt: new Date(),
    };
  }

  /**
   * Get user's visibility based on their mode and requester's relationship
   */
  getVisibility(
    userVisibilityMode: VisibilityModeType,
    requesterState: UserStateType
  ): 'FULL' | 'PSEUDONYM' | 'ANONYMOUS' {
    if (userVisibilityMode === VisibilityMode.ANON) {
      return 'ANONYMOUS';
    }

    if (userVisibilityMode === VisibilityMode.OFF) {
      // If requester is also ACTIVE or higher, show pseudonym
      if (requesterState === UserState.ACTIVE ||
          requesterState === UserState.PROJECT ||
          requesterState === UserState.TRUSTED) {
        return 'PSEUDONYM';
      }
      return 'ANONYMOUS';
    }

    return 'ANONYMOUS';
  }
}

// ============================================
// EXPRESS ROUTER
// ============================================

export function createUserRouter() {
  const router = express.Router();
  const controller = new UserController();

  // Register new user
  router.post('/register', async (req, res) => {
    try {
      const body = RegisterRequestSchema.parse(req.body);
      const user = await controller.register(body);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // Update user state
  router.patch('/:userId/state', async (req, res) => {
    try {
      const { userId } = req.params;
      const body = UpdateStateRequestSchema.parse(req.body);
      const currentState = req.body.currentState as UserStateType;
      
      const result = await controller.transitionState(
        userId,
        currentState,
        body.targetState,
        body.reason
      );
      
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(400).json({ error: (error as Error).message });
      }
    }
  });

  return router;
}

// ============================================
// EXPORTS
// ============================================

export const API = {
  UserState,
  AuthProvider,
  VisibilityMode,
  UserController,
  createUserRouter,
};
