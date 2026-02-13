import Fastify, { FastifyRequest, FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { formParty } from '@fated/matchmaker';
import { AppEvent } from '@fated/events';
import { InMemoryEventStore } from '@fated/event-store';

const fastify = Fastify({ logger: true });

// Global error handler for production resilience
fastify.setErrorHandler((error: any, request: FastifyRequest, reply: any) => {
    // Log full error internally for debugging
    console.error('Error:', error);

    // Handle Prisma unique constraint violations (P2002)
    if (error.code === 'P2002') {
        return reply.status(409).send({ error: 'Resource conflict' });
    }

    // Handle SQLite errors
    if (error.message?.includes('SQLITE') || error.code === 'P3000') {
        return reply.status(500).send({ error: 'Internal storage error' });
    }

    // Handle validation errors from Zod
    if (error.name === 'ZodError') {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
    }

    // Default: return sanitized error
    return reply.status(error.statusCode || 500).send({
        error: error.message || 'Operation failed'
    });
});

// In-Memory Event Store with Materialized State
// Pass hydrate=true to load state from SQLite on startup
const store = new InMemoryEventStore(true);

// POST /contribute
fastify.post('/contribute', async (request: FastifyRequest<{ Body: AppEvent }>, reply) => {
    const result = store.append(request.body);

    if (!result.ok) {
        const error = result as { ok: false; error: unknown };
        return reply.status(400).send({ error: 'Invalid contribution payload', details: error.error });
    }

    return {
        success: true,
        eventId: result.eventId,
        message: 'Contribution recorded'
    };
});

// POST /verify
fastify.post('/verify', async (request: FastifyRequest<{ Body: AppEvent }>, reply) => {
    const result = store.append(request.body);

    if (!result.ok) {
        const error = result as { ok: false; error: unknown };
        return reply.status(400).send({ error: 'Invalid verification payload', details: error.error });
    }

    return {
        success: true,
        eventId: result.eventId,
        message: 'Verification recorded'
    };
});

// GET /leaderboard
fastify.get('/leaderboard', async (request: FastifyRequest<{ Querystring: { offset?: string; limit?: string } }>) => {
    const offset = Number(request.query.offset) || 0;
    const limit = Number(request.query.limit) || 50;

    const leaderboard = store.getLeaderboard({ offset, limit });
    const total = store.getUserCount();

    return {
        leaderboard: leaderboard.map(entry => ({
            userId: entry.userId,
            totalXP: entry.total,
            pendingXP: entry.pending,
            contributions: entry.contributions,
            lastActivity: entry.lastActivity
        })),
        total
    };
});

// GET /team
fastify.get('/team', async () => {
    const state = store.getState();
    const party = formParty(state);

    return {
        team: party.members.map((m) => ({
            userId: m.userId,
            role: m.role,
            score: m.score
        })),
        totalPower: party.totalPower
    };
});

// Start server
const start = async () => {
    try {
        await fastify.listen({ port: 3000, host: '0.0.0.0' });
        console.log('🚀 FatedFortress API running at http://localhost:3000');
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

start();
