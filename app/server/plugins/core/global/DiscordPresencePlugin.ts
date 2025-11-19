import { Connection } from '../../../skychat/Connection.js';
import { Logging } from '../../../skychat/Logging.js';
import { RoomManager } from '../../../skychat/RoomManager.js';
import { Session } from '../../../skychat/Session.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';

export type DiscordPresence = {
    onlineCount: number;
    voiceCount: number;
    guildName: string;
} | null;

/**
 * Fetch and broadcast Discord server presence count
 */
export class DiscordPresencePlugin extends GlobalPlugin {
    static readonly SYNC_DELAY = 30 * 1000;

    static readonly commandName = 'discordpresence';

    callable = false;

    private lastPresence: DiscordPresence = null;

    constructor(manager: RoomManager) {
        super(manager);

        // Only start syncing if guild ID is configured
        if (process.env.DISCORD_GUILD_ID && manager) {
            this.syncPresence();
            setInterval(this.syncPresence.bind(this), DiscordPresencePlugin.SYNC_DELAY);
        }
    }

    async run(): Promise<void> {
        throw new Error('Not implemented');
    }

    async onNewConnection(connection: Connection): Promise<void> {
        if (this.lastPresence) {
            connection.send('discord-presence', this.lastPresence);
        }
    }

    private async syncPresence(): Promise<void> {
        const guildId = process.env.DISCORD_GUILD_ID;
        if (!guildId) {
            return;
        }

        try {
            Logging.info('Fetching Discord presence...');
            const response = await fetch(`https://discord.com/api/guilds/${guildId}/widget.json`);
            if (!response.ok) {
                if (response.status === 403) {
                    Logging.warn('Discord widget is disabled. Enable it in Server Settings > Widget > Enable Server Widget');
                }
                return;
            }

            const data = await response.json();

            // Count users in voice channels
            const voiceCount = data.members.filter((member: any) => Boolean(member.channel_id)).length;

            const newPresence: DiscordPresence = {
                onlineCount: data.presence_count ?? 0,
                voiceCount,
                guildName: data.name ?? 'Discord',
            };

            // Only broadcast if presence changed
            if (
                !this.lastPresence ||
                this.lastPresence.onlineCount !== newPresence.onlineCount ||
                this.lastPresence.voiceCount !== newPresence.voiceCount ||
                this.lastPresence.guildName !== newPresence.guildName
            ) {
                this.lastPresence = newPresence;
                this.broadcast();
            }
        } catch (error) {
            Logging.error('Failed to fetch Discord presence:', error);
        }
    }

    private broadcast(): void {
        for (const session of Object.values(Session.sessions)) {
            for (const connection of session.connections) {
                connection.send('discord-presence', this.lastPresence);
            }
        }
    }
}
