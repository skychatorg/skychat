import { Connection } from '../../../skychat/Connection.js';
import { Message } from '../../../skychat/Message.js';
import { Session } from '../../../skychat/Session.js';
import { RoomPlugin } from '../../RoomPlugin.js';
import { BlacklistPlugin } from '../global/BlacklistPlugin.js';

export class MentionPlugin extends RoomPlugin {
    static readonly commandName = 'mention';

    public callable = false;

    async run(): Promise<void> {}

    // Intercept quotes in messages
    public async onBeforeMessageBroadcastHook(message: Message, connection: Connection) {
        const mentions = message.content.match(/@[a-zA-Z0-9-_]+/g);

        // Note quote detected
        if (mentions === null) {
            return message;
        }

        // Get users from mentions
        const allSessions = mentions
            .map((mention) => mention.substring(1).toLowerCase())
            .filter((identifier) => identifier !== connection.session.identifier)
            .map((identifier) => Session.getSessionByIdentifier(identifier))
            .filter((session) => session !== undefined) as Session[];

        // Remove duplicates
        const sessions = Array.from(new Set(allSessions));

        // No valid session
        if (sessions.length === 0) {
            return message;
        }

        // Send mention to each session
        for (const session of sessions) {
            // Skip blacklisted users
            if (BlacklistPlugin.hasBlacklisted(session.user, connection.session.user.username)) {
                continue;
            }
            // Skip if in a room where the mentioned user is not allowed
            if (!connection.room || !connection.room.accepts(session)) {
                continue;
            }
            session.send('mention', {
                roomId: this.room.id,
                identifier: connection.session.identifier,
                messageId: message.id,
            });
        }

        // For each quote
        return message;
    }
}
