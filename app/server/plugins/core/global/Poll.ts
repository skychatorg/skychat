import { Room } from '../../../skychat/Room';
import { Session } from '../../../skychat/Session';


export type PollState =  'pending' | 'started' | 'finished';

export type PollOptions = {

    /**
     * Poll audience. Can be a room object, a list of sessions or addressed to everyone
     */
    audience: Room | Session[] | '*';

    /**
     * Default value
     */
    defaultValue: boolean | undefined;

    /**
     * Timeout in milliseconds
     */
    timeout: number;

    /**
     * Minimum required number of votes
     */
    minVotes?: number;
}

export type SanitizedPoll = {
    id: number,
    state: PollState
    title: string,
    content: string,
    result: undefined | boolean,
    yesCount: number,
    noCount: number,
    opVote: undefined | boolean,
}

export class Poll {

    private static CURRENT_POLL_ID = 0;

    public readonly id: number;

    public state: PollState = 'pending';

    public readonly title: string;

    public readonly content: string;

    public readonly options: PollOptions;

    public opVote?: boolean;

    public votes: {[identifier: string]: boolean} = {};

    constructor(title: string, content: string, options: PollOptions) {
        this.id = ++ Poll.CURRENT_POLL_ID;
        this.title = title;
        this.content = content;
        this.options = options;
        this.sync();
    }

    /**
     * Register a vote
     * @param identifier
     * @param vote
     */
    public registerVote(identifier: string, vote: boolean) {
        // If the user is anyone else, register his vote only if an OP did not vote before
        if (typeof this.opVote === 'boolean') {
            return false;
        }
        this.votes[identifier] = vote;
        this.sync();
    }

    /**
     * Force the result of this poll
     * @param vote 
     */
    public forceResult(vote: boolean) {
        this.opVote = vote;
        this.votes = {};
        this.sync();
    }

    /**
     * Get the result of the poll. Boolean if a response is chosen, undefined if not enough voters
     */
    public getResult(): boolean | undefined {
        // If an OP voted
        if (typeof this.opVote === 'boolean') {
            // Return its vote
            return this.opVote;
        }
        const votes = Object.values(this.votes);
        if (votes.length === 0) {
            return undefined;
        }
        // If not enough votes, return the default specified value
        const enoughVotes = typeof this.options.minVotes === 'undefined' || votes.length >= this.options.minVotes;
        if (! enoughVotes) {
            return this.options.defaultValue;
        }
        const yes = votes.filter(vote => vote).length;
        const no = votes.filter(vote => ! vote).length;
        if (yes === no) {
            return this.options.defaultValue;
        }
        return yes > no;
    }

    /**
     * Await for this poll to complete
     */
    public async complete(): Promise<boolean | undefined> {

        if (this.state !== 'pending') {
            throw new Error('Poll already started');
        }

        this.state = 'started';

        return new Promise(resolve => {

            // Wait for the poll to end
            setTimeout(() => {

                this.state = 'finished';
                this.sync();
                resolve(this.getResult());
            }, this.options.timeout);
        });
    }

    public sanitized(): SanitizedPoll {
        const votes = Object.values(this.votes);
        const yesCount = votes.filter(vote => vote).length;
        const noCount = votes.filter(vote => ! vote).length;
        return {
            id: this.id,
            state: this.state,
            title: this.title,
            content: this.content,
            result: this.getResult(),
            yesCount: yesCount,
            noCount: noCount,
            opVote: this.opVote
        };
    }

    public sync(): void {

        // If polling all
        if (this.options.audience === '*') {
            for (const session of Object.values(Session.sessions)) {
                session.send('poll', this.sanitized());
            }
            return;
        }

        // If polling a room
        if (this.options.audience instanceof Room) {
            this.options.audience.send('poll', this.sanitized());
            return;
        }

        // If polling sessions
        if (this.options.audience instanceof Array) {
            this.options.audience.map(session => session.send('poll', this.sanitized()));
            return;
        }

        throw new Error('Unknown audience type');
    }
}
