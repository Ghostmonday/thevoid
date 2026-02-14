import { faker } from '@faker-js/faker';
import { ContributionSubmitted, VerificationSubmitted } from '@fated/events';
import { UserId, toUserId, Specialty } from '@fated/types';

export class Agent {
    public readonly id: UserId;
    public readonly name: string;
    public readonly role: 'BUILDER' | 'REVIEWER';
    public readonly specialty: Specialty;

    constructor(specialty?: Specialty) {
        this.id = toUserId(faker.string.uuid());
        this.name = faker.internet.userName();
        this.role = Math.random() > 0.5 ? 'BUILDER' : 'REVIEWER';
        this.specialty = specialty || (['BACKEND', 'FRONTEND', 'DEVOPS', 'SECURITY', 'RESEARCH'][Math.floor(Math.random() * 5)] as Specialty);
    }

    public act(now: Date): ContributionSubmitted | null {
        if (this.role !== 'BUILDER') return null;
        if (Math.random() > 0.3) return null;

        return {
            id: faker.string.uuid(),
            streamId: this.id,
            timestamp: now,
            type: 'CONTRIBUTION_SUBMITTED',
            payload: {
                userId: this.id,
                url: `https://github.com/expnet/${faker.hacker.noun()}`,
                complexityScore: Math.floor(Math.random() * 10) + 1,
                specialty: this.specialty,
            },
        };
    }

    public verify(targetId: string, now: Date): VerificationSubmitted | null {
        const chance = this.role === 'REVIEWER' ? 0.8 : 0.1;
        if (Math.random() > chance) return null;

        return {
            id: faker.string.uuid(),
            streamId: this.id,
            timestamp: now,
            type: 'VERIFICATION_SUBMITTED',
            payload: {
                verifierId: this.id,
                targetContributionId: targetId,
                verdict: 'APPROVE',
                qualityScore: 5,
                specialty: this.specialty,
            },
        };
    }
}
