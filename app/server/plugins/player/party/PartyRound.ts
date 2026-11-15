import { Connection } from '../../../skychat/Connection.js';
import { logFailure } from '../../../skychat/Logging.js';
import { Session } from '../../../skychat/Session.js';
import { UserController } from '../../../skychat/UserController.js';
import type { Party } from './Party.js';

/**
 * What the party games share: one pending step, a round that ends once, its state sent to the channel, and refunds
 */
export abstract class PartyRound {
    protected over = false;

    private step: ReturnType<typeof setTimeout> | undefined;

    constructor(
        protected readonly party: Party,
        private readonly onRoundEnd: () => void,
        /** Names the game in refunds and logs */
        private readonly label: string,
    ) {}

    public abstract syncConnections(connections: Connection[]): void;

    /** Runs `fn` in `ms`, in place of the pending step */
    protected schedule(ms: number, fn: () => void): void {
        this.cancelStep();
        this.step = setTimeout(fn, ms);
    }

    protected cancelStep(): void {
        clearTimeout(this.step);
    }

    /** Ends the round once, then hands back to the party */
    protected end(): void {
        if (this.over) {
            return;
        }
        this.over = true;
        this.cancelStep();
        logFailure(Promise.resolve().then(this.onRoundEnd), this.label);
    }

    protected broadcast(): void {
        if (!this.over) {
            this.syncConnections(this.party.connections());
        }
    }

    /** Hands money back: a refund cancels its bet in the daily summary */
    protected async refund(entries: { session: Session; amount: number }[]): Promise<void> {
        await Promise.all(
            entries.map(({ session, amount }) => UserController.giveMoney(session.user, amount, `${this.label} refund`, 'refund')),
        );
    }
}
