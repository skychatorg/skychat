import { Connection } from '../../../skychat/Connection.js';
import { MessageFormatter } from '../../../skychat/MessageFormatter.js';
import { Room } from '../../../skychat/Room.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';

type Poll = {
    question: string;
    answers: string[];
    votes: Map<string, number>;
    messageId?: number;
};

export class UserPollPlugin extends GlobalPlugin {
    static readonly commandName = 'userpoll';

    static readonly commandAliases = ['userpollvote', 'userpolldetail'];

    readonly minRight = 0;

    readonly rules = {
        userpoll: {
            minCount: 1,
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
        userpolldetail: {
            minCount: 1,
            maxCount: 1,
            coolDown: 500,
            params: [{ name: 'pollId', pattern: /^\d+$/ }],
        },
    };

    private currentPollId = 0;

    private readonly polls: { [pollId: string]: Poll } = {};

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        // All commands require to be in a room
        const room = connection.room;
        if (!room) {
            throw new Error('Not in a room');
        }

        if (alias === 'userpoll') {
            await this.handlePoll(param, room);
            return;
        }
        if (alias === 'userpollvote') {
            await this.handleVote(param, room, connection);
            return;
        }
        if (alias === 'userpolldetail') {
            await this.handleDetail(param, connection);
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
        parts.push('');
        parts.push(formatter.createButton('See votes', `/userpolldetail ${id}`));
        return parts.join('\n');
    }

    private formatPollVotes(poll: Poll): string {
        const parts = [];
        parts.push(`🔥 Poll 🔥 ${poll.question} - Votes`);
        for (let i = 0; i < poll.answers.length; i++) {
            const votants = Array.from(poll.votes.entries())
                .filter(([, voteIndex]: [unknown, number]) => voteIndex === i)
                .map(([identifier]) => identifier);
            if (votants.length > 0) {
                parts.push(`${i + 1}. ${poll.answers[i]} - ${votants.join(', ')}`);
            } else {
                parts.push(`${i + 1}. ${poll.answers[i]}`);
            }
        }
        return parts.join('\n');
    }

    private async handlePoll(param: string, room: Room): Promise<void> {
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
        const message = await room.sendMessage({
            content: messageContent,
            formatted: formatter.format(messageContent, false, true),
            user: UserController.getNeutralUser(),
        });
        poll.messageId = message.id;
    }

    private async handleVote(param: string, room: Room, connection: Connection): Promise<void> {
        const [pollId, answer] = param.split(' ');
        const poll = this.polls[pollId];
        if (!poll || isNaN(parseInt(pollId, 10)) || !poll.messageId) {
            throw new Error('Invalid poll');
        }
        const sessionIdentifier = connection.session.identifier;

        // If user has already voted, ignore
        if (poll.votes.has(sessionIdentifier)) {
            throw new Error('You have already voted');
        }

        // Does the answer exist?
        const answerIndex = parseInt(answer, 10);
        if (typeof poll.answers[answerIndex] === 'undefined') {
            throw new Error('Invalid answer');
        }

        // Add vote
        poll.votes.set(sessionIdentifier, answerIndex);

        // Update message
        const formatter = MessageFormatter.getInstance();
        const messageContent = this.formatPollMessage(parseInt(pollId, 10), poll);
        const message = await room.getMessageById(poll.messageId);
        if (message) {
            message?.edit(messageContent, formatter.format(messageContent, false, true));
            room.send('message-edit', message?.sanitized());
        }
    }

    private async handleDetail(param: string, connection: Connection): Promise<void> {
        const pollId = parseInt(param, 10);
        const poll = this.polls[pollId];
        if (!poll || isNaN(pollId)) {
            throw new Error('Invalid poll');
        }
        const content = this.formatPollVotes(poll);
        const message = UserController.createNeutralMessage({ content, id: 0 });
        connection.send('message', message.sanitized());
    }
}
