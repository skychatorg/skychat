import pQueue from 'p-queue';
import { Connection } from '../../../skychat/Connection.js';
import { Logging } from '../../../skychat/Logging.js';
import { MessageController } from '../../../skychat/MessageController.js';
import { Session } from '../../../skychat/Session.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';
import { Plugin } from '../../Plugin.js';

type ReactionPluginData = {
    [reaction: string]: string[];
};

export class ReactionPlugin extends GlobalPlugin {
    static readonly DEFAULT_DATA: ReactionPluginData = {};

    static readonly REACTIONS: string[] = ['💯', '😂', '🤡', '🥸', '👋', '🥒'];

    static readonly QUEUE = new pQueue({ concurrency: 1 });

    static readonly commandName = 'reaction';

    static readonly commandAliases = [];

    readonly minRight = 0;

    readonly rules = {
        reaction: {
            minCount: 2,
            maxCount: 2,
            coolDown: 100,
            params: [
                { name: 'message id', pattern: Plugin.POSITIVE_INTEGER_REGEXP },
                { name: 'reaction', pattern: /.?/ },
            ],
        },
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        if (alias === ReactionPlugin.commandName) {
            return this.handleReaction(param, connection);
        }
    }

    async handleReaction(param: string, connection: Connection): Promise<void> {
        const [messageIdRaw, reaction] = param.split(' ');
        const messageId = parseInt(messageIdRaw);

        if (!messageId) {
            throw new Error('Invalid message id');
        }

        if (!ReactionPlugin.REACTIONS.includes(reaction)) {
            throw new Error('Invalid reaction');
        }

        ReactionPlugin.QUEUE.add(async () => {
            try {
                const message = await MessageController.getMessageById(messageId, true);
                const reactions = (message.storage.reactions ?? { ...ReactionPlugin.DEFAULT_DATA }) as ReactionPluginData;

                if (reactions[reaction]?.includes(connection.session.identifier)) {
                    reactions[reaction] = reactions[reaction] ?? [];
                    reactions[reaction] = reactions[reaction].filter((identifier) => identifier !== connection.session.identifier);
                    if (!reactions[reaction].length) {
                        delete reactions[reaction];
                    }
                } else {
                    reactions[reaction] = reactions[reaction] ?? [];
                    reactions[reaction].push(connection.session.identifier);
                }

                message.storage.reactions = reactions;
                await message.update();
                for (const session of Object.values(Session.sessions)) {
                    for (const connection of session.connections) {
                        connection.send('message-edit', message.sanitized());
                    }
                }

                // Try to update the message in the room memory if it exists
                if (typeof message.room === 'number') {
                    const room = this.manager.getRoomById(message.room);
                    const roomMessageRef = room?.getMessageById(message.id);
                    if (roomMessageRef) {
                        roomMessageRef.storage = message.storage;
                    }
                }
            } catch (error) {
                Logging.error('Error while handling reaction', error);

                try {
                    const message = error instanceof Error ? error.message : 'An error occurred';
                    connection.send('error', { message });
                } catch (error) {
                    Logging.error('Error while sending error message', error);
                }
            }
        });
    }

    async onNewConnection(connection: Connection): Promise<void> {
        connection.send(ReactionPlugin.commandName, ReactionPlugin.REACTIONS);
    }
}
