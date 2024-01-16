import { Connection } from '../../../skychat/Connection';
import { MessageFormatter } from '../../../skychat/MessageFormatter';
import { UserController } from '../../../skychat/UserController';
import { RoomPlugin } from '../../RoomPlugin';

type Poll = {
    question: string;
    answers: string[];
    votes: Map<string, number>;
    messageId?: number;
};

export class UserPollPlugin extends RoomPlugin {
    static readonly commandName = 'userpoll';

    static readonly commandAliases = ['userpollvote'];

    readonly minRight = 0;

    readonly rules = {
        userpoll: {
            minCount: 2,
            coolDown: 30000,
        },
        userpollvote: {
            minCount: 2,
            maxCount: 2,
            coolDown: 500,
            params: [
                { name: 'pollId', pattern: /^[0-9]+$/ },
                { name: 'answer', pattern: /^[0-9]+$/ },
            ],
        },
    };

    private currentPollId = 0;

    private readonly polls: { [pollId: string]: Poll } = {};

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        if (alias === 'userpoll') {
            await this.handlePoll(param);
            return;
        }
        if (alias === 'userpollvote') {
            await this.handleVote(param, connection);
            return;
        }
        throw new Error('Invalid command');
    }

    private getVoteCount(poll: Poll, answerIndex: number) {
        let count = 0;
        for (const vote of poll.votes.values()) {
            if (vote === answerIndex) {
                count++;
            }
        }
        return count;
    }

    private formatPollMessage(id: number, poll: Poll): string {
        const formatter = MessageFormatter.getInstance();
        const parts = [];
        parts.push(`🔥 Poll 🔥 ${poll.question}`);
        for (let i = 0; i < poll.answers.length; i++) {
            const button = formatter.createButton(poll.answers[i], `/userpollvote ${id} ${i}`);
            const voteCount = this.getVoteCount(poll, i);
            if (voteCount > 0) {
                parts.push(`${i + 1}. ${button} - ${voteCount} ${voteCount === 1 ? 'vote' : 'votes'}`);
            } else {
                parts.push(`${i + 1}. ${button}`);
            }
        }
        return parts.join('\n');
    }

    private async handlePoll(param: string): Promise<void> {
        const [question, ...answers] = param.split('\n');
        if (!question || answers.filter((a) => a.trim().length > 0).length < 2) {
            throw new Error('Invalid poll');
        }
        const pollId = ++this.currentPollId;
        const poll: Poll = {
            question,
            answers,
            votes: new Map(),
        };
        this.polls[pollId] = poll;

        const formatter = MessageFormatter.getInstance();
        const messageContent = this.formatPollMessage(pollId, poll);
        const message = await this.room.sendMessage({
            content: messageContent,
            formatted: formatter.format(messageContent, false, true),
            user: UserController.getNeutralUser(),
        });
        poll.messageId = message.id;
    }

    private async handleVote(param: string, connection: Connection): Promise<void> {
        const [pollId, answer] = param.split(' ');
        const poll = this.polls[pollId];
        if (!poll || isNaN(parseInt(pollId, 10)) || !poll.messageId) {
            throw new Error('Invalid poll');
        }
        const userId = connection.session.user.id.toString();

        // If user has already voted, ignore
        if (poll.votes.has(userId)) {
            throw new Error('You have already voted');
        }

        // Does the answer exist?
        const answerIndex = parseInt(answer, 10);
        if (typeof poll.answers[answerIndex] === 'undefined') {
            throw new Error('Invalid answer');
        }

        // Add vote
        poll.votes.set(userId, answerIndex);

        // Update message
        const formatter = MessageFormatter.getInstance();
        const messageContent = this.formatPollMessage(parseInt(pollId, 10), poll);
        const message = await this.room.getMessageById(poll.messageId);
        if (message) {
            message?.edit(messageContent, formatter.format(messageContent, false, true));
            this.room.send('message-edit', message?.sanitized());
        }
    }
}
