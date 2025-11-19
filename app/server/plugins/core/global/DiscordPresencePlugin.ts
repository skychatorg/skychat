import express from 'express';
import sha256 from 'sha256';
import { Config } from '../../../skychat/Config.js';
import { Connection } from '../../../skychat/Connection.js';
import { Logging } from '../../../skychat/Logging.js';
import { RoomManager } from '../../../skychat/RoomManager.js';
import { Session } from '../../../skychat/Session.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin, PluginRoute } from '../../GlobalPlugin.js';
import { ConnectedListPlugin } from './ConnectedListPlugin.js';

export type DiscordPresence = {
    onlineCount: number;
    voiceCount: number;
    guildName: string;
    onlineUserIds: number[];
} | null;

export type DiscordLinkData = {
    discordId: string;
    discordUsername: string;
    verifiedAt: number;
} | null;

/**
 * Fetch and broadcast Discord server presence count, and allow users to link their Discord account via OAuth
 */
export class DiscordPresencePlugin extends GlobalPlugin {
    static readonly SYNC_DELAY = 30 * 1000;

    static readonly commandName = 'discord';

    static readonly commandAliases = [];

    static readonly defaultDataStorageValue: DiscordLinkData = null;

    readonly minRight = 0;

    readonly rules = {
        discord: {
            minCount: 0,
            maxCount: 1,
            coolDown: 1000,
            params: [
                {
                    name: 'action',
                    pattern: /^(link|unlink)$/,
                    info: 'Action: link or unlink',
                },
            ],
        },
    };

    private lastPresence: DiscordPresence = null;
    private onlineDiscordUsernames: Set<string> = new Set();

    constructor(manager: RoomManager) {
        super(manager);

        // Only start syncing if guild ID is configured
        if (process.env.DISCORD_GUILD_ID && manager) {
            this.syncPresence();
            setInterval(this.syncPresence.bind(this), DiscordPresencePlugin.SYNC_DELAY);
        }
    }

    /**
     * Generate a signed state token for Discord OAuth
     */
    private static generateOAuthState(userId: number): string {
        const timestamp = Date.now();
        const signature = sha256(userId + ':' + timestamp + ':' + process.env.USERS_TOKEN_SALT);
        return Buffer.from(JSON.stringify({ userId, timestamp, signature })).toString('base64url');
    }

    /**
     * Verify and decode a Discord OAuth state token
     */
    private static verifyOAuthState(state: string): { userId: number; timestamp: number } {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
        const expectedSignature = sha256(decoded.userId + ':' + decoded.timestamp + ':' + process.env.USERS_TOKEN_SALT);
        if (decoded.signature !== expectedSignature) {
            throw new Error('Invalid state signature');
        }
        // State valid for 10 minutes
        if (Date.now() - decoded.timestamp > 10 * 60 * 1000) {
            throw new Error('State expired');
        }
        return { userId: decoded.userId, timestamp: decoded.timestamp };
    }

    /**
     * Get Discord OAuth URL for a user
     */
    private getOAuthUrl(userId: number): string {
        const clientId = process.env.DISCORD_OAUTH_CLIENT_ID;
        if (!clientId) {
            throw new Error('Discord OAuth is not configured');
        }
        const redirectUri = encodeURIComponent(Config.LOCATION + '/api/plugin/discord/callback');
        const state = DiscordPresencePlugin.generateOAuthState(userId);
        const scope = encodeURIComponent('identify');
        return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;
    }

    /**
     * Get HTTP routes for this plugin
     */
    public getRoutes(): PluginRoute[] {
        return [
            {
                method: 'get',
                path: '/callback',
                handler: this.handleOAuthCallback.bind(this),
            },
        ];
    }

    /**
     * Handle Discord OAuth2 callback
     */
    private async handleOAuthCallback(req: express.Request, res: express.Response): Promise<void> {
        try {
            const code = req.query.code as string;
            const state = req.query.state as string;

            if (!code || !state) {
                throw new Error('Missing code or state');
            }

            // Verify state and get user ID
            const { userId } = DiscordPresencePlugin.verifyOAuthState(state);

            // Exchange code for access token
            const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: process.env.DISCORD_OAUTH_CLIENT_ID!,
                    client_secret: process.env.DISCORD_OAUTH_CLIENT_SECRET!,
                    code,
                    grant_type: 'authorization_code',
                    redirect_uri: Config.LOCATION + '/api/plugin/discord/callback',
                }),
            });

            if (!tokenResponse.ok) {
                const error = await tokenResponse.text();
                throw new Error(`Failed to exchange code: ${error}`);
            }

            const tokenData = await tokenResponse.json();

            // Get user info from Discord
            const userResponse = await fetch('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });

            if (!userResponse.ok) {
                throw new Error('Failed to get Discord user info');
            }

            const discordUser = await userResponse.json();

            // Get SkyChat user from in-memory session and save Discord info
            const session = Session.getSessionByUserId(userId);
            if (!session) {
                throw new Error('Session not found. Please make sure you are logged in.');
            }
            const user = session.user;
            // Use global_name (display name) for widget matching, fall back to username
            const displayName = discordUser.global_name || discordUser.username;
            Logging.info(`Linking Discord account for user ${user.username} (${user.id})`);
            await UserController.savePluginData(user, 'discord', {
                discordId: discordUser.id,
                discordUsername: displayName,
                verifiedAt: Date.now(),
            });

            Logging.info(`User ${user.username} linked Discord account: ${displayName} (${discordUser.id})`);

            // Sync connected list and presence
            (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
            this.broadcast();

            // Send success page
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Discord Linked</title>
                    <style>
                        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: #fff; }
                        .container { text-align: center; }
                        h1 { color: #5865F2; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Discord Account Linked!</h1>
                        <p>Your Discord account <strong>${displayName}</strong> has been linked.</p>
                        <p>You can close this window.</p>
                    </div>
                </body>
                </html>
            `);
        } catch (error) {
            Logging.error('Discord OAuth error:', error);
            res.status(400).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Discord Link Failed</title>
                    <style>
                        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: #fff; }
                        .container { text-align: center; }
                        h1 { color: #ff6b6b; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Link Failed</h1>
                        <p>${(error as Error).message}</p>
                    </div>
                </body>
                </html>
            `);
        }
    }

    async run(_alias: string, param: string, connection: Connection): Promise<void> {
        const action = param.trim();

        if (!action) {
            // Show current linked Discord account
            const linkData = UserController.getUserPluginData<DiscordLinkData>(connection.session.user, this.commandName);
            if (linkData && linkData.discordUsername) {
                const isOnline = this.onlineDiscordUsernames.has(linkData.discordUsername.toLowerCase());
                connection.send(
                    'info',
                    `Your Discord account is linked to: ${linkData.discordUsername} (${isOnline ? 'online' : 'offline'})`,
                );
            } else {
                connection.send('info', 'Your Discord account is not linked. Use /discord link to get a link URL.');
            }
            return;
        }

        if (action === 'unlink') {
            await UserController.savePluginData(connection.session.user, this.commandName, null);
            connection.send('info', 'Discord account unlinked');
            (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
            this.broadcast();
            return;
        }

        if (action === 'link') {
            try {
                const oauthUrl = this.getOAuthUrl(connection.session.user.id);
                connection.send('discord-link', oauthUrl);
            } catch (error) {
                throw new Error('Discord OAuth is not configured. Please contact an administrator.');
            }
            return;
        }

        throw new Error('Invalid action. Use /discord, /discord link, or /discord unlink');
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

            // Update online Discord usernames (widget anonymizes IDs, so we match by username)
            this.onlineDiscordUsernames = new Set(data.members.map((member: any) => (member.username as string).toLowerCase()));

            // Find SkyChat users who are online on Discord
            const onlineUserIds: number[] = [];
            for (const session of Object.values(Session.sessions)) {
                const linkData = UserController.getUserPluginData<DiscordLinkData>(session.user, this.commandName);
                if (linkData && linkData.discordUsername && this.onlineDiscordUsernames.has(linkData.discordUsername.toLowerCase())) {
                    onlineUserIds.push(session.user.id);
                }
            }

            const newPresence: DiscordPresence = {
                onlineCount: data.presence_count ?? 0,
                voiceCount,
                guildName: data.name ?? 'Discord',
                onlineUserIds,
            };

            // Only broadcast if presence changed
            if (
                !this.lastPresence ||
                this.lastPresence.onlineCount !== newPresence.onlineCount ||
                this.lastPresence.voiceCount !== newPresence.voiceCount ||
                this.lastPresence.guildName !== newPresence.guildName ||
                JSON.stringify(this.lastPresence.onlineUserIds) !== JSON.stringify(newPresence.onlineUserIds)
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
