import { Config } from '../../../skychat/Config.js';
import { Connection } from '../../../skychat/Connection.js';
import { Logging } from '../../../skychat/Logging.js';
import { Message } from '../../../skychat/Message.js';
import { Session } from '../../../skychat/Session.js';
import { RoomPlugin } from '../../RoomPlugin.js';
import { BlacklistPlugin } from '../global/BlacklistPlugin.js';
import { WebPushPlugin } from '../global/WebPushPlugin.js';

type ParsedMentions = {
    here: boolean;
    users: string[];
};

export class MentionPlugin extends RoomPlugin {
    static readonly commandName = 'mention';

    static readonly MENTION_REGEX = /@[a-zA-Z0-9-_]+/g;

    static readonly MENTION_HERE = 'here';

    public callable = false;

    async run(): Promise<void> {}

    private parseMentions(message: Message): ParsedMentions {
        const parsedMentions: ParsedMentions = {
            here: false,
            users: [],
        };

        // No quote detected
        const mentions = message.content.match(MentionPlugin.MENTION_REGEX);
        if (mentions === null) {
            return parsedMentions;
        }

        for (const mention of mentions) {
            const identifier = mention.substring(1).toLowerCase();

            if (identifier === MentionPlugin.MENTION_HERE) {
                parsedMentions.here = true;
                continue;
            }

            const session = Session.getSessionByIdentifier(identifier);
            if (session) {
                parsedMentions.users.push(session.user.username);
            }
        }

        return parsedMentions;
    }

    // Intercept quotes in messages
    public async onBeforeMessageBroadcastHook(message: Message, connection?: Connection) {
        // It is currently not possible to mention an user if there's not connection the mention originates from
        if (!connection) {
            return message;
        }

        if (connection.session.user.right < Config.PREFERENCES.minRightForUserMention) {
            return message;
        }

        const mentions = this.parseMentions(message);

        // No mentions detected
        if (!mentions.here && mentions.users.length === 0) {
            return message;
        }

        // If `here`
        if (mentions.here) {
            this.handleHereMention(connection, message);
        }

        // If `@user`
        if (mentions.users.length > 0) {
            this.handleUserMentions(connection, message, mentions.users);
        }

        return message;
    }

    private canReceiveMention(receiver: Connection, sender: Connection): boolean {
        // Blacklisted?
        if (BlacklistPlugin.hasBlacklisted(receiver.session.user, sender.session.identifier)) {
            return false;
        }

        // Receiver can join the room?
        if (!sender.room?.accepts(receiver.session)) {
            return false;
        }

        return true;
    }

    private handleHereMention(sender: Connection, message: Message) {
        for (const receiver of Session.connections) {
            if (this.canReceiveMention(receiver, sender)) {
                this.sendMention(receiver, sender, message);
            }
        }
    }

    private handleUserMentions(sender: Connection, message: Message, users: string[]) {
        const sessions = users.map((user) => Session.getSessionByIdentifier(user)).filter((session) => session !== undefined);

        for (const session of sessions) {
            for (const receiver of session.connections) {
                if (this.canReceiveMention(receiver, sender)) {
                    this.sendMention(receiver, sender, message);
                }
            }
        }
    }

    private sendMention(receiver: Connection, sender: Connection, message: Message) {
        Logging.info(`MentionPlugin: ${sender.session.identifier} mentioned ${receiver.session.identifier} in room ${this.room.id}`);
        receiver.send('mention', {
            roomId: this.room.id,
            identifier: sender.session.identifier,
            messageId: message.id,
        });

        // Send Web Push notification
        const webPushPlugin = this.room.manager.getPlugin('push') as WebPushPlugin | undefined;
        if (webPushPlugin) {
            const truncatedContent = message.content.length > 100 ? message.content.substring(0, 100) + '...' : message.content;
            webPushPlugin.send(receiver.session.user, {
                title: `@${sender.session.identifier} mentioned you`,
                body: truncatedContent,
                tag: `mention-${message.id}`,
            });
        }
    }
}
