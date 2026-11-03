import { Connection } from '../../../skychat/Connection.js';
import { Session } from '../../../skychat/Session.js';
import { BlackjackTable, CasinoOptions, logFailure } from '../casino/BlackjackTable.js';
import type { PlayerChannel } from '../PlayerChannel.js';
import { LuckyPop } from './LuckyPop.js';

export const PARTY_GAMES = { blackjack: 'Blackjack', luckypop: 'Lucky Pop' } as const;

export type PartyGameId = keyof typeof PARTY_GAMES;

/**
 * - lobby: no game, the first pick starts one
 * - playing: a game runs its round, it says when the round is over
 * - vote: everyone here picks the next game, before a timer
 */
export type PartyPhase = 'lobby' | 'playing' | 'vote';

export type SanitizedParty = {
    channelId: number;
    phase: PartyPhase;
    game: PartyGameId | null;
    /** The game whose round just ended, during a vote */
    lastGame: PartyGameId | null;
    /** Wall-clock ms at which the vote closes */
    deadline: number | null;
    /** Usernames that voted, by game */
    votes: { [game: string]: string[] };
};

/**
 * The cycle of a party channel: lobby → a game's round → vote for the next game → that game, or back to the lobby.
 * Every step ends on a timer, so nobody can hold the channel on a game.
 */
export class Party {
    /** Instance values, so tests can shorten them */
    public timings = { voteMs: 10_000, stormEveryMs: 6000 };

    public game: BlackjackTable | LuckyPop | null = null;

    /** For tests: shorten a new game's timers or fix its luck before it starts */
    public onGameCreated?: (game: BlackjackTable | LuckyPop) => void;

    private gameId: PartyGameId | null = null;

    private phase: PartyPhase = 'lobby';

    private lastGame: PartyGameId | null = null;

    private deadline: number | null = null;

    private timer: ReturnType<typeof setTimeout> | null = null;

    private readonly votes = new Map<Session, PartyGameId>();

    /** Wizz storms outlive a round, so they belong to the party */
    private readonly storms = new Map<Session, ReturnType<typeof setInterval>>();

    constructor(
        public readonly channel: PlayerChannel,
        public readonly options: CasinoOptions,
    ) {}

    public get table(): BlackjackTable | null {
        return this.game instanceof BlackjackTable ? this.game : null;
    }

    public get luckyPop(): LuckyPop | null {
        return this.game instanceof LuckyPop ? this.game : null;
    }

    public pick(session: Session, game: string): void {
        if (session.user.isGuest()) {
            throw new Error('Log in to start a game');
        }
        if (this.phase !== 'lobby') {
            throw new Error('A game is already on');
        }
        this.start(Party.gameId(game));
    }

    public vote(session: Session, game: string): void {
        if (session.user.isGuest()) {
            throw new Error('Log in to vote');
        }
        if (this.phase !== 'vote') {
            throw new Error('There is no vote right now');
        }
        this.votes.set(session, Party.gameId(game));
        this.broadcast();
    }

    public async onSessionLeft(session: Session): Promise<void> {
        this.votes.delete(session);
        if (this.phase === 'vote') {
            this.broadcast();
        }
        await this.game?.onSessionLeft(session);
    }

    /**
     * Wizz someone every few seconds, a set number of times. Ticks while they are offline are skipped, not queued
     */
    public wizzStorm(session: Session, count: number): void {
        if (this.storms.has(session)) {
            return;
        }
        let left = count;
        const interval = setInterval(() => {
            session.send('wizz', { from: session.user.sanitized() });
            if (--left <= 0) {
                clearInterval(interval);
                this.storms.delete(session);
            }
        }, this.timings.stormEveryMs);
        this.storms.set(session, interval);
    }

    public syncConnections(connections: Connection[]): void {
        connections.forEach((connection) => connection.send('party', this.sanitized()));
        this.game?.syncConnections(connections);
    }

    /**
     * Called when the channel is deleted
     */
    public async destroy(): Promise<void> {
        this.clearTimer();
        this.storms.forEach((interval) => clearInterval(interval));
        this.storms.clear();
        await this.game?.destroy();
        this.game = null;
    }

    public sanitized(): SanitizedParty {
        const votes: SanitizedParty['votes'] = {};
        this.votes.forEach((game, session) => (votes[game] ??= []).push(session.user.username));
        return {
            channelId: this.channel.id,
            phase: this.phase,
            game: this.gameId,
            lastGame: this.lastGame,
            deadline: this.deadline,
            votes,
        };
    }

    private static gameId(game: string): PartyGameId {
        if (!(game in PARTY_GAMES)) {
            throw new Error('Unknown game');
        }
        return game as PartyGameId;
    }

    private start(game: PartyGameId): void {
        this.clearTimer();
        this.phase = 'playing';
        this.gameId = game;
        const onRoundEnd = () => this.endRound();
        this.game = game === 'blackjack' ? new BlackjackTable(this.channel, this.options, onRoundEnd) : new LuckyPop(this, onRoundEnd);
        this.onGameCreated?.(this.game);
        this.game.start();
        this.broadcast();
        this.game.syncConnections(this.connections());
    }

    private endRound(): void {
        const game = this.game;
        if (!game) {
            return;
        }
        this.lastGame = this.gameId;
        this.game = null;
        this.gameId = null;
        logFailure(game.destroy());
        // Clears the game from everyone's screen
        this.channel.sessions.forEach((session) => session.send(game instanceof BlackjackTable ? 'casino-table' : 'lucky-pop', null));
        // Nobody left to vote: straight back to the lobby, no timer running in an empty channel
        if (!this.channel.sessions.length) {
            this.lobby();
            return;
        }
        this.phase = 'vote';
        this.votes.clear();
        this.deadline = Date.now() + this.timings.voteMs;
        this.timer = setTimeout(() => this.closeVote(), this.timings.voteMs);
        this.broadcast();
    }

    /**
     * Most votes wins. A tie goes to a game that was not just played, so a channel does not get stuck on one game
     */
    private closeVote(): void {
        const counts = new Map<PartyGameId, number>();
        this.votes.forEach((game) => counts.set(game, (counts.get(game) ?? 0) + 1));
        const best = Math.max(0, ...counts.values());
        if (!best) {
            this.lobby();
            return;
        }
        const tied = [...counts.keys()].filter((game) => counts.get(game) === best);
        this.start(tied.find((game) => game !== this.lastGame) ?? tied[0]);
    }

    private lobby(): void {
        this.clearTimer();
        this.phase = 'lobby';
        this.votes.clear();
        this.broadcast();
    }

    private connections(): Connection[] {
        return this.channel.sessions.flatMap((session) => session.connections);
    }

    private broadcast(): void {
        const payload = this.sanitized();
        this.channel.sessions.forEach((session) => session.send('party', payload));
        // The channel list shows which game is on
        this.channel.manager.sync();
    }

    private clearTimer(): void {
        this.deadline = null;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
}
