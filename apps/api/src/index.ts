import Fastify, { FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { calculateState, XpVector } from '@fated/xp-logic';
import { formParty } from '@fated/matchmaker';
import { AppEvent, ContributionSubmittedSchema, VerificationSubmittedSchema } from '@fated/events';

const fastify = Fastify({ logger: true });

// In-Memory Event Store
const EVENTS: AppEvent[] = [];

// POST /contribute
fastify.post<{ Body: AppEvent }>('/contribute', async (request: FastifyRequest<{ Body: AppEvent }>, reply) => {
    const result = ContributionSubmittedSchema.safeParse(request.body);

    if (!result.success) {
        return reply.status(400).send({ error: 'Invalid contribution payload', details: result.error.flatten() });
    }

    const event: AppEvent = {
        id: result.data.id,
        streamId: result.data.streamId,
        timestamp: result.data.timestamp,
        type: 'CONTRIBUTION_SUBMITTED',
        payload: {
            userId: result.data.payload.userId,
            url: result.data.payload.url,
            complexityScore: result.data.payload.complexityScore,
        },
    };

    EVENTS.push(event);

    return {
        success: true,
        eventId: event.id,
        message: 'Contribution recorded'
    };
});

// POST /verify
fastify.post<{ Body: AppEvent }>('/verify', async (request: FastifyRequest<{ Body: AppEvent }>, reply) => {
    const result = VerificationSubmittedSchema.safeParse(request.body);

    if (!result.success) {
        return reply.status(400).send({ error: 'Invalid verification payload', details: result.error.flatten() });
    }

    const event: AppEvent = {
        id: result.data.id,
        streamId: result.data.streamId,
        timestamp: result.data.timestamp,
        type: 'VERIFICATION_SUBMITTED',
        payload: {
            verifierId: result.data.payload.verifierId,
            targetContributionId: result.data.payload.targetContributionId,
            verdict: result.data.payload.verdict,
            qualityScore: result.data.payload.qualityScore,
        },
    };

    EVENTS.push(event);

    return {
        success: true,
        eventId: event.id,
        message: 'Verification recorded'
    };
});

// GET /leaderboard
fastify.get('/leaderboard', async () => {
    const state = calculateState(EVENTS);

    const leaderboard = Object.entries(state)
        .map(([userId, xp]: [string, XpVector]) => ({
            userId,
            totalXP: xp.total,
            pendingXP: xp.pending,
            contributions: xp.contributions,
            lastActivity: xp.lastActivity
        }))
        .sort((a, b) => b.totalXP - a.totalXP);

    return { leaderboard };
});

// GET /team
fastify.get('/team', async () => {
    const state = calculateState(EVENTS);
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
