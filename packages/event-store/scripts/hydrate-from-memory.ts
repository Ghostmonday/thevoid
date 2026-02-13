/**
 * Hydration Script: Migrate in-memory event store state to SQLite
 *
 * Usage: pnpm --filter @fated/event-store hydrate
 *
 * This script:
 * 1. Reads current in-memory events and state from the InMemoryEventStore
 * 2. Bulk inserts all events into the SQLite Event table
 * 3. Upserts all actor states into the SQLite ActorState table
 */

import { prisma } from '@fated/db';
import { InMemoryEventStore, XpVector } from '../src/index';

async function main() {
    console.log('Starting hydration from memory to SQLite...');

    // Create a fresh in-memory store (this will be empty if running after server restart)
    // In practice, you'd export/import the memory state or connect to running instance
    const store = new InMemoryEventStore(false);

    console.log('Current in-memory event count:', store.count);
    console.log('Current in-memory user count:', store.getUserCount());

    // If store has data, hydrate it
    if (store.count > 0) {
        const events = store.getAll();
        const state = store.getState();

        console.log(`Hydrating ${events.length} events and ${Object.keys(state).length} actors...`);

        // Bulk insert events
        if (events.length > 0) {
            await prisma.event.createMany({
                data: events.map(event => ({
                    id: event.id,
                    streamId: event.streamId,
                    timestamp: new Date(event.timestamp),
                    type: event.type,
                    payload: JSON.stringify(event),
                    metadata: event.metadata ? JSON.stringify(event.metadata) : null,
                    createdAt: new Date()
                }))
            });
            console.log(`Inserted ${events.length} events`);
        }

        // Upsert actor states
        const actorEntries = Object.entries(state) as [string, XpVector][];
        for (const [actorId, xpVector] of actorEntries) {
            await prisma.actorState.upsert({
                where: { actorId },
                update: {
                    currentXp: xpVector.total,
                    pendingXp: xpVector.pending,
                    contributions: xpVector.contributions,
                    lastActivity: xpVector.lastActivity,
                    lastUpdated: new Date()
                },
                create: {
                    actorId,
                    currentXp: xpVector.total,
                    pendingXp: xpVector.pending,
                    contributions: xpVector.contributions,
                    lastActivity: xpVector.lastActivity,
                    lastUpdated: new Date(),
                    decayRate: 0.0,
                    roleHistory: '[]'
                }
            });
        }
        console.log(`Upserted ${actorEntries.length} actors`);

        console.log('Hydration complete!');
    } else {
        console.log('No in-memory data to hydrate. SQLite will serve as the source of truth.');
        console.log('Use the API to add events - they will be persisted to SQLite automatically.');
    }

    await prisma.$disconnect();
}

main().catch(async (error) => {
    console.error('Hydration failed:', error);
    await prisma.$disconnect();
    process.exit(1);
});
