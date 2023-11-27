import { Connection } from '../../../skychat/Connection';
import { Session } from '../../../skychat/Session';
import { BlacklistPlugin } from '../global/BlacklistPlugin';
import { RoomPlugin } from '../../RoomPlugin';
import { Message } from '../../../skychat/Message';

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

        // No valid user
        if (allSessions.length === 0) {
            return message;
        }

        // Remove duplicates
        const sessions = Array.from(new Set(allSessions));

        // Send mention to each session
        for (const session of sessions) {
            if (BlacklistPlugin.hasBlacklisted(session.user, connection.session.user.username)) {
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
