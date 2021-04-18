import {Connection} from "../../../Connection";
import {Plugin} from "../../Plugin";
import {Poll, PollOptions} from "./Poll";
import {Command} from "../../Command";
import {Room} from "../../../Room";
import { Config } from "../../../Config";



export class PollPlugin extends Plugin {

    public static readonly POLL_CREATION_COOL_DOWN: number = 60 * 1000;

    public static readonly POLL_TIMEOUT: number = 30 * 1000;

    readonly name = 'poll';

    readonly aliases = ['vote'];

    readonly minRight = Config.PREFERENCES.minRightForPolls;

    private polls: {[id: number]: Poll} = [];

    readonly rules = {
        poll: {
            minCount: 1,
            coolDown: PollPlugin.POLL_CREATION_COOL_DOWN,
            params: [{name: 'content', pattern: /./}]
        },
        vote: {
            minCount: 2,
            maxCount: 2,
            maxCallsPer10Seconds: 4,
            params: [{name: 'poll id', pattern: Command.POSITIVE_INTEGER_REGEXP}, {name: 'answer', pattern: /^([yn])$/}]
        }
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        if (alias === 'poll') {
            await this.handlePoll(param, connection);
            return;
        }

        if (alias === 'vote') {
            this.handleVote(param, connection);
        }
    }

    /**
     * Create a new poll
     * @param param
     * @param connection
     */
    private async handlePoll(param: string, connection: Connection) {
        await this.poll(`${connection.session.user.username} asks:`, param, {
            defaultValue: undefined,
            timeout: PollPlugin.POLL_TIMEOUT
        });
    }

    /**
     * Handle when an user answers to a specific poll
     * @param param
     * @param connection
     */
    private handleVote(param: string, connection: Connection) {
        // Get poll information
        const [rawPollId, rawVote] = param.split(' ');
        const pollId = parseInt(rawPollId);
        const vote = rawVote[0] === 'y';
        const poll = this.polls[pollId];
        if (! poll) {
            throw new Error('Poll does not exist');
        }
        // Vote
        poll.registerVote(connection.session.identifier, vote);
        this.sync(this.room);
    }

    /**
     * Create a new poll and notify clients in the room
     * @param title
     * @param content
     * @param options
     */
    public async poll(title: string, content: string, options: PollOptions): Promise<Poll> {
        const poll: Poll = new Poll(title, content, options);
        this.polls[poll.id] = poll;
        this.sync(this.room);
        await poll.complete();
        delete this.polls[poll.id];
        this.sync(this.room);
        this.room.send('poll-result', poll.sanitized());
        return poll;
    }

    /**
     * Sync clients
     */
    public sync(broadcaster: Connection | Room) {
        if (broadcaster instanceof Room) {
            for (const connection of broadcaster.connections) {
                this.sync(connection);
            }
            return;
        }
        const polls = Object.values(this.polls);

        // If currently no poll
        if (polls.length === 0) {
            // Abort
            broadcaster.send('poll', []);
            return;
        }

        const sanitizedPollList = polls.map(poll => poll.sanitized());
        broadcaster.send('poll', sanitizedPollList);
    }

    /**
     * When client join the room, sync the polls
     * @param connection
     */
    async onConnectionJoinedRoom(connection: Connection): Promise<void> {
        this.sync(connection);
    }
}
