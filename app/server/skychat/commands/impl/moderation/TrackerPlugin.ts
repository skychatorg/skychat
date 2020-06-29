import {Plugin} from "../../Plugin";
import {Connection} from "../../../Connection";
import {Room} from "../../../Room";
import {Message} from "../../../Message";
import {UserController} from "../../../UserController";
import * as striptags from "striptags";
import {MessageFormatter} from "../../../MessageFormatter";


type NodeType = 'username' | 'ip';
type Node = {
    type: NodeType,
    value: string
}

type StorageObject = {
    [stringifiedNode: string]: Array<Node>
}

export class TrackerPlugin extends Plugin {

    public static readonly SOURCE_TYPES: NodeType[] = ['username', 'ip'];

    public static stringifyNode(node: Node): string {
        return `${node.type}:${node.value}`;
    }

    readonly name = 'track';

    readonly minRight = 40;

    readonly rules = {
        track: {
            minCount: 2,
            maxCount: 2,
            params: [
                {name: 'type', pattern: new RegExp('^' + TrackerPlugin.SOURCE_TYPES.join('|') + '$')},
                {name: 'value', pattern: /./},
            ]
        },
    };

    protected storage: StorageObject = {};

    constructor(room: Room) {
        super(room);
        this.loadStorage();
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        if (alias === 'track') {
            await this.handleTrack(param, connection);
        }
    }

    /**
     * Handle a track request
     * @param param
     * @param connection
     */
    async handleTrack(param: string, connection: Connection): Promise<void> {
        const type = param.split(' ')[0] as NodeType;
        const value = param.slice(type.length + 1);
        const nodes = this.storage[TrackerPlugin.stringifyNode({type, value})] || [];

        const formatter = MessageFormatter.getInstance();
        let html = '<table class="skychat-table">';
        html += `
            <tr>
                <td>source type</td>
                <td>source value</td>
                <td>target type</td>
                <td>target value</td>
                <td></td>
            </tr>
        `;
        for (let node of nodes) {
            html += `
                <tr>
                    <td>${type}</td>
                    <td>${value}</td>
                    <td>${node.type}</td>
                    <td>${node.value}</td>
                    <td>${formatter.getButtonHtml('search', '/track ' + node.type + ' ' + node.value, true, true)}</td>
                </tr>
            `;
        }
        html += '</table>';

        connection.send('message', new Message(striptags(html), html, UserController.getNeutralUser(), null).sanitized());
    }

    public registerAssociation(node1: Node, node2: Node): void {

        // If there is no entry for node1 yet, create the array
        if (! this.storage[TrackerPlugin.stringifyNode(node1)]) {
            this.storage[TrackerPlugin.stringifyNode(node1)] = [];
        }

        // Add the entry node1 -> node2 if it does not exist yet
        const stringifiedNode1 = TrackerPlugin.stringifyNode(node1);
        const match1 = this.storage[stringifiedNode1].find(node => TrackerPlugin.stringifyNode(node) === TrackerPlugin.stringifyNode(node2));
        if (! match1) {
            this.storage[stringifiedNode1].push(node2);
        }

        // If there is no entry for node2 yet, create the array
        if (! this.storage[TrackerPlugin.stringifyNode(node2)]) {
            this.storage[TrackerPlugin.stringifyNode(node2)] = [];
        }

        // Add the entry node2 -> node1 if it does not exist yet
        const stringifiedNode2 = TrackerPlugin.stringifyNode(node2);
        const match2 = this.storage[stringifiedNode2].find(node => TrackerPlugin.stringifyNode(node) === TrackerPlugin.stringifyNode(node1));
        if (! match2) {
            this.storage[stringifiedNode2].push(node1);
        }
    }

    public async onConnectionJoinedRoom(connection: Connection): Promise<void> {
        const node1: Node = {type: 'username', value: connection.session.user.id === 0 ? '*guest' : connection.session.identifier};
        const node2: Node = {type: 'ip', value: connection.ip};
        this.registerAssociation(node1, node2);
        this.syncStorage();
    }

    public async onConnectionAuthenticated(connection: Connection): Promise<void> {
        const node1: Node = {type: 'username', value: connection.session.user.id === 0 ? '*guest' : connection.session.identifier};
        const node2: Node = {type: 'ip', value: connection.ip};
        this.registerAssociation(node1, node2);
        this.syncStorage();
    }
}
