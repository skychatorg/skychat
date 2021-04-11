import {Connection} from "../../../Connection";
import {User} from "../../../User";
import {Session} from "../../../Session";
import {Plugin} from "../../Plugin";
import {UserController} from "../../../UserController";
import * as striptags from "striptags";
import {MessageFormatter} from "../../../MessageFormatter";
import { Room } from "../../../Room";
import { Timing } from "../../../Timing";
import { Message } from "../../../Message";


enum BAN_TYPES {
    ACCESS = 0,
    SHADOW = 1,
};


export class BanPlugin extends Plugin {

    public static readonly BAN_COMMAND: string = 'ban';
    public static readonly UNBAN_COMMAND: string = 'unban';
    public static readonly BANLIST_COMMAND: string = 'banlist';

    public static readonly BAN_MIN_RIGHT = 40;

    readonly name = BanPlugin.BAN_COMMAND;

    readonly minRight = BanPlugin.BAN_MIN_RIGHT;

    readonly aliases = [BanPlugin.UNBAN_COMMAND, BanPlugin.BANLIST_COMMAND];

    readonly rules = {
        [BanPlugin.BAN_COMMAND]: {
            minCount: 1,
            maxCount: 3,
            params: [
                {name: "username", pattern: User.USERNAME_REGEXP},
                {name: "type", pattern: new RegExp('^(' + Object.keys(BAN_TYPES).filter(t => isNaN(parseInt(t))).join('|') + ')$')},
                {name: "duration (s)", pattern: /^\d+$/},
            ]
        },
        [BanPlugin.UNBAN_COMMAND]: {
            minCount: 1,
            maxCount: 1,
            params: [{name: "username", pattern: User.USERNAME_REGEXP}]
        },
        [BanPlugin.BANLIST_COMMAND]: {
            minCount: 0,
            maxCount: 0,
        },
    };

    /**
     * List of banned ips
     */
    protected storage: {banned: {[matchString: string]: {source: string, type: BAN_TYPES, until: number | null}}} = {
        banned: {}
    };

    constructor(room: Room) {
        super(room);

        if (this.room) {
            this.loadStorage();
        }
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        switch (alias) {

            case BanPlugin.BAN_COMMAND:
                await this.handleBan(param, connection);
                break;

            case BanPlugin.UNBAN_COMMAND:
                await this.handleUnban(param, connection);
                break;

            case BanPlugin.BANLIST_COMMAND:
                await this.handleBanList(param, connection);
                break;
        }
    }

    isBanned(connection: Connection, type?: BAN_TYPES): boolean {
        return Object.keys(this.storage.banned)
            .filter(s => s === `ip:${connection.ip}` || s === `username:${connection.session.identifier}`) // get entries for this connection
            .map(matchString => this.storage.banned[matchString]) // transform back keys into values
            .filter(banEntry => typeof type === 'undefined' ? true : banEntry.type === type) // filter entries that are of the given type
            .filter(banEntry => banEntry.until === null || new Date().getTime() < banEntry.until) // filter entries that are still valid
            .length > 0; // is there at least one of them?
    }

    async handleBan(param: string, connection: Connection) {
        const identifier = Session.autocompleteIdentifier(param.split(' ')[0]);
        const typeRaw = param.split(' ')[1] || 'ACCESS';
        const duration = param.split(' ')[2] ? parseInt(param.split(' ')[2]) : null;
        if (typeof (BAN_TYPES as any)[typeRaw] === 'undefined') {
            throw new Error('Invalid ban type');
        }
        const type: BAN_TYPES = (BAN_TYPES as any)[typeRaw];
        const session = Session.getSessionByIdentifier(identifier); // can be null
        const banEntry = {
            source: identifier,
            type: type,
            until: duration ? (Date.now() + duration * 1000) : null
        };
        this.storage.banned['username:' + identifier] = banEntry;
        if (session) {
            for (const connection of session.connections) {
                this.storage.banned['ip:' + connection.ip] = banEntry;
                // Close connection if access ban
                if (this.isBanned(connection, BAN_TYPES.ACCESS)) {
                    connection.close(Connection.CLOSE_KICKED, "You have been disconnected");
                }
            }
        }
        this.syncStorage();
        await this.handleBanList('', connection);
    }

    async handleUnban(param: string, connection: Connection) {
        const identifier = Session.autocompleteIdentifier(param.split(' ')[0]);
        for (const matchString of Object.keys(this.storage.banned)) {
            const banEntry = this.storage.banned[matchString];
            if (banEntry.source === identifier) {
                delete this.storage.banned[matchString];
            }
        }
        this.syncStorage();
        await this.handleBanList('', connection);
    }

    async handleBanList(param: string, connection: Connection) {
        const formatter = MessageFormatter.getInstance();
        let content = `<p>Banned:</p>`;
        content += `<table class="skychat-table">`;
        content += `
            <tr>
                <th>source</th>
                <th>match string</th>
                <th>ban type</th>
                <th>unban date</th>
                <th></th>
            </tr>
        `;
        for (const matchString of Object.keys(this.storage.banned)) {
            const banEntry = this.storage.banned[matchString];
            const unbanDuration = banEntry.until === null ? 'never' : Timing.getDurationText(banEntry.until - new Date().getTime());
            content += `
                <tr>
                    <td>${banEntry.source}</td>
                    <td>${matchString}</td>
                    <td>${BAN_TYPES[banEntry.type]}</td>
                    <td>${unbanDuration}</td>
                    <td>${formatter.getButtonHtml('unban', '/' + BanPlugin.UNBAN_COMMAND + ' ' + banEntry.source, true, true)}</td>
                </tr>`;
        }
        content += `</table>`;
        const message = UserController.createNeutralMessage({content: '', id: 0});
        message.edit(striptags(content), content);
        connection.send('message', message.sanitized());
    }

    public async onNewMessageHook(message: string, connection: Connection): Promise<string> {
        // If access ban, just close connection
        if (this.isBanned(connection, BAN_TYPES.ACCESS)) {
            connection.close(Connection.CLOSE_KICKED, 'You have been disconnected');
            throw new Error();
        }
        // If shadow banned
        if (this.isBanned(connection, BAN_TYPES.SHADOW)) {

            // Do not send cursor to others
            if (message.startsWith('/c ')) {
                return `/void`;
            }

            // Only send new messages to himself
            if (message.startsWith('/message ')) {
                connection.send('message', new Message({id: ++Message.ID, content: message.substr('/message'.length), user: connection.session.user}).sanitized());
                connection.session.lastMessageDate = new Date();
                return `/void`;
            }
        }
        return message;
    }

    public async onConnectionAuthenticated(connection: Connection): Promise<void> {
        // If access ban, just close connection
        if (this.isBanned(connection, BAN_TYPES.ACCESS)) {
            connection.close(Connection.CLOSE_KICKED, 'You have been disconnected');
            throw new Error();
        }
    }

    public async onConnectionJoinedRoom(connection: Connection): Promise<void> {
        // If access ban, just close connection
        if (this.isBanned(connection, BAN_TYPES.ACCESS)) {
            connection.close(Connection.CLOSE_KICKED, 'You have been disconnected');
            throw new Error();
        }
    }
}
