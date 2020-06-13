import {Connection} from "../../../Connection";
import {User} from "../../../User";
import {Session} from "../../../Session";
import {Plugin} from "../../Plugin";
import {Message} from "../../../Message";
import {UserController} from "../../../UserController";
import * as striptags from "striptags";
import {MessageFormatter} from "../../../MessageFormatter";


export class BanPlugin extends Plugin {

    public static readonly BAN_COMMAND: string = 'ban';
    public static readonly UNBAN_COMMAND: string = 'unban';
    public static readonly BANLIST_COMMAND: string = 'banlist';

    readonly name = BanPlugin.BAN_COMMAND;

    readonly aliases = [BanPlugin.UNBAN_COMMAND, BanPlugin.BANLIST_COMMAND];

    readonly rules = {
        [BanPlugin.BAN_COMMAND]: {
            minCount: 2,
            maxCount: 2,
            params: [{name: "username", pattern: User.USERNAME_REGEXP}, {name: "duration (s)", pattern: /^\d+$/}]
        },
        [BanPlugin.UNBAN_COMMAND]: {
            minCount: 1,
            maxCount: 1,
            params: [{name: "username", pattern: User.USERNAME_REGEXP}]
        },
        [BanPlugin.BANLIST_COMMAND]: {minCount: 0, maxCount: 0,},
    };

    readonly minRight = 40;

    /**
     * List of banned ips
     */
    protected storage: {banned: {[matchString: string]: {source: string, until: number}}} = {
        banned: {}
    };

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

    isBanned(connection: Connection): boolean {
        const username = connection.session.identifier;
        const ip = connection.ip;
        const banEntries = Object.keys(this.storage.banned)
            .filter(s => s === `ip:${ip}` || s === `username:${username}`)
            .map(matchString => this.storage.banned[matchString])
            .filter(banEntry => new Date().getTime() < banEntry.until);
        return banEntries.length > 0;
    }

    async handleBan(param: string, connection: Connection) {
        const identifier = Session.autocompleteIdentifier(param.split(' ')[0]);
        const duration = parseInt(param.split(' ')[1]);
        const session = Session.getSessionByIdentifier(identifier);
        if (! session) {
            throw new Error('User ' + identifier + ' does not exist');
        }
        const banEntry = {source: session.identifier, until: new Date(Date.now() + duration * 1000).getTime()};
        this.storage.banned['username:' + session.identifier] = banEntry;
        for (const connection of session.connections) {
            this.storage.banned['ip:' + connection.ip] = banEntry;
        }
        this.syncStorage();
        for (const connection of session.connections) {
            connection.close(4403, "You have been banned");
        }
        connection.send('message', new Message('User has been banned', null, UserController.getNeutralUser(), null).sanitized());
    }

    async handleUnban(param: string, connection: Connection) {
        const identifier = Session.autocompleteIdentifier(param.split(' ')[0]);
        const session = Session.getSessionByIdentifier(identifier);
        if (! session) {
            throw new Error('User ' + identifier + ' does not exist');
        }
        for (const matchString of Object.keys(this.storage.banned)) {
            const banEntry = this.storage.banned[matchString];
            if (banEntry.source === session.identifier) {
                delete this.storage.banned[matchString];
            }
        }
        this.syncStorage();
        connection.send('message', new Message('User has been unbanned', null, UserController.getNeutralUser(), null).sanitized());
    }

    async handleBanList(param: string, connection: Connection) {
        const formatter = MessageFormatter.getInstance();
        let content = `<p>Banned:</p>`;
        content += `<table class="skychat-table">`;
        content += `
            <tr>
                <th>source</th>
                <th>match string</th>
                <th>unban date</th>
                <th></th>
            </tr>
        `;
        for (const matchString of Object.keys(this.storage.banned)) {
            const banEntry = this.storage.banned[matchString];
            content += `
                <tr>
                    <td>${banEntry.source}</td>
                    <td>${matchString}</td>
                    <td>${new Date(banEntry.until).toISOString()}</td>
                    <td>${formatter.getButtonHtml('unban', '/' + BanPlugin.UNBAN_COMMAND + ' ' + banEntry.source, true, true)}</td>
                </tr>`;
        }
        content += `</table>`;
        const message = new Message('', null, UserController.getNeutralUser());
        message.edit(striptags(content), content);
        connection.send('message', message.sanitized());
    }

    private checkBan(connection: Connection): void {
        if (this.isBanned(connection)) {
            connection.close(4403, 'You are banned from this server');
        }
    }

    public async onConnectionAuthenticated(connection: Connection): Promise<void> {
        this.checkBan(connection);
    }

    public async onConnectionJoinedRoom(connection: Connection): Promise<void> {
        this.checkBan(connection);
    }

    public async onNewMessageHook(message: string, connection: Connection): Promise<string> {
        this.checkBan(connection);
        return message;
    }
}
