import { Connection } from '../../../skychat/Connection';
import { Plugin } from '../../Plugin';
import { Poll, PollOptions } from './Poll';
import { Config } from '../../../skychat/Config';
import { GlobalPlugin } from '../../GlobalPlugin';



export class PollPlugin extends GlobalPlugin {

    public static readonly POLL_CREATION_COOL_DOWN: number = 60 * 1000;

    public static readonly POLL_TIMEOUT: number = 30 * 1000;

    static readonly commandName = 'poll';

    static readonly commandAliases = ['vote'];

    readonly minRight = Config.PREFERENCES.minRightForPolls;

    private polls: { [id: number]: Poll } = [];

    readonly rules = {
        poll: {
            minCount: 1,
            coolDown: PollPlugin.POLL_CREATION_COOL_DOWN,
            params: [{ name: 'content', pattern: /./ }]
        },
        vote: {
            minCount: 2,
            maxCount: 2,
            maxCallsPer10Seconds: 4,
            params: [{ name: 'poll id', pattern: Plugin.POSITIVE_INTEGER_REGEXP }, { name: 'answer', pattern: /^([yn])$/ }]
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
        await this.poll(
            `${connection.session.user.username} asks:`,
            param,
            {
                audience: connection.room ? connection.room : '*',
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
        if (connection.session.isOP()) {
            poll.forceResult(vote);
        } else {
            poll.registerVote(connection.session.identifier, vote);
        }
    }

    /**
     * Create a new poll and notify clients in the room
     * @param title
     * @param content
     * @param options
     */
    public async poll(title: string, content: string, options: PollOptions): Promise<Poll> {

        // Create new poll
        const poll: Poll = new Poll(title, content, options);
        this.polls[poll.id] = poll;

        // Send poll to
        await poll.complete();

        // Clear poll
        delete this.polls[poll.id];

        // Return poll result
        return poll;
    }
}
