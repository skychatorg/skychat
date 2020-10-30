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
    value: string,
    count: number,
    lastRegistered: number,
}

type StorageObject = {
    [stringifiedNode: string]: Array<Node>
}

export class TrackerPlugin extends Plugin {

    public static readonly SOURCE_TYPES: NodeType[] = ['username', 'ip'];

    public static readonly COUNT_INCREMENT_COOLDOWN_MS: number = 24 * 60 * 60 * 1000;

    public static nodeToKey(type: NodeType, value: string): string {
        return `${type}:${value}`;
    }

    readonly name = 'track';

    readonly aliases = ['autotrack'];

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
        autotrack: {
            minCount: 1,
            maxCount: 1,
            params: [
                {name: 'value', pattern: /./},
            ]
        },
    };

    protected storage: StorageObject = {};

    constructor(room: Room) {
        super(room);
        this.loadStorage();
    }

    public getAllRelatedNodes(type: NodeType, value: string): Node[] {
        return this.storage[TrackerPlugin.nodeToKey(type, value)] || [];
    }

    public getAllRelatedNodesRecursive(type: NodeType, value: string, predicate?: (node: Node, path: Node[]) => boolean): {node: Node, path: Node[]}[] {

        /**
         * Recursive lookup function
         * @param type 
         * @param value 
         * @param visited Hashmap of visited node keys
         * @param path 
         */
        const lookup = (type: NodeType, value: string, visited?: {[nodeKey: string]: boolean}, path?: Node[]) => {

            // Aggregated nodes
            let allNodes: {node: Node, path: Node[]}[] = [];
            
            // On first call, path is empty
            visited = visited || {[TrackerPlugin.nodeToKey(type, value)]: true};
            path = path || [];

            // Find all its children
            const relatedNodes = this.getAllRelatedNodes(type, value);
            for (const relatedNode of relatedNodes) {

                // The node key
                const nodeKey = TrackerPlugin.nodeToKey(relatedNode.type, relatedNode.value);
                
                // If node already visited
                if (typeof visited[nodeKey] !== 'undefined') {
                    continue;
                }

                // Mark this node as visited
                visited[nodeKey] = true;

                if (predicate && ! predicate(relatedNode, path)) {
                    continue;
                }

                // Add the current node to the path for the recursive lookup
                const newPath = path.slice(0).concat([relatedNode]);

                // Register this node
                allNodes.push({node: relatedNode, path: newPath});

                // Recursive lookup on the child
                allNodes = allNodes.concat(...lookup(relatedNode.type, relatedNode.value, visited, newPath));
            }

            return allNodes;
        }

        return lookup(type, value);
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        if (alias === 'track') {
            await this.handleTrack(param, connection);
            return;
        }

        if (alias === 'autotrack') {
            await this.handleAutoTrack(param, connection);
            return;
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
        const nodes = this.getAllRelatedNodes(type, value);
        const sortedNodes = nodes.sort((a, b) => a.count - b.count);

        const formatter = MessageFormatter.getInstance();
        let html = '<table class="skychat-table">';
        html += `
            <tr>
                <td>source type</td>
                <td>source value</td>
                <td>target type</td>
                <td>target value</td>
                <td>count (%)</td>
            </tr>
        `;
        const sumOfCounts = sortedNodes.reduce((total: number, node: Node) => total + node.count, 0);
        for (let node of sortedNodes) {
            html += `
                <tr>
                    <td>${type}</td>
                    <td>${value}</td>
                    <td>${node.type}</td>
                    <td>${formatter.getButtonHtml(node.value, '/track ' + node.type + ' ' + node.value, true, true)}</td>
                    <td>${node.count} (${(100 * node.count / sumOfCounts).toFixed(2)}%)</td>
                </tr>
            `;
        }
        html += '</table>';

        connection.send('message', new Message({
            content: striptags(html),
            formatted: html,
            user: UserController.getNeutralUser()
        }).sanitized());
    }

    /**
     * Handle a track request
     * @param param
     * @param connection
     */
    async handleAutoTrack(param: string, connection: Connection): Promise<void> {
        const value = param.trim();
        const entries = this.getAllRelatedNodesRecursive('username', value);

        const formatter = MessageFormatter.getInstance();
        let html = '<table class="skychat-table">';
        html += `
            <tr>
                <td>source</td>
                <td>target</td>
                <td>depth</td>
                <td>path</td>
            </tr>
        `;
        for (const entry of entries) {
            let pathStr = entry.path.slice(0, entry.path.length - 1).map(node => `${node.value}`).join(' → ');
            html += `
                <tr>
                    <td>${value}</td>
                    <td>${entry.node.value}</td>
                    <td>${entry.path.length}</td>
                    <td>${pathStr}</td>
                </tr>
            `;
        }
        html += '</table>';

        connection.send('message', new Message({
            content: striptags(html),
            formatted: html,
            user: UserController.getNeutralUser()
        }).sanitized());
    }

    public registerAssociation(type1: NodeType, value1: string, type2: NodeType, value2: string): void {

        // Build keys
        const key1 = TrackerPlugin.nodeToKey(type1, value1);
        const key2 = TrackerPlugin.nodeToKey(type2, value2);

        // If there is no entry for node1 yet, create the array
        if (! this.storage[key1]) {
            this.storage[key1] = [];
        }

        // Add the entry node1 -> node2 if it does not exist yet
        // Then add 1 to the association counter if the cooldown as passed
        let match1 = this.storage[key1].find(node => TrackerPlugin.nodeToKey(node.type, node.value) === key2);
        if (! match1) {
            match1 = {
                type: type2,
                value: value2,
                count: 1,
                lastRegistered: new Date().getTime(),
            };
            this.storage[key1].push(match1);
        }
        if (new Date().getTime() > match1.lastRegistered + TrackerPlugin.COUNT_INCREMENT_COOLDOWN_MS) {
            match1.count ++;
            match1.lastRegistered = new Date().getTime();
        }

        // If there is no entry for node2 yet, create the array
        if (! this.storage[key2]) {
            this.storage[key2] = [];
        }

        // Add the entry node2 -> node1 if it does not exist yet
        // Then add 1 to the association counter if the cooldown as passed
        let match2 = this.storage[key2].find(node => TrackerPlugin.nodeToKey(node.type, node.value) === key1);
        if (! match2) {
            match2 = {
                type: type1,
                value: value1,
                count: 1,
                lastRegistered: new Date().getTime(),
            };
            this.storage[key2].push(match2);
        }
        if (new Date().getTime() > match2.lastRegistered + TrackerPlugin.COUNT_INCREMENT_COOLDOWN_MS) {
            match2.count ++;
            match2.lastRegistered = new Date().getTime();
        }
    }

    public async onConnectionJoinedRoom(connection: Connection): Promise<void> {
        this.registerAssociation(
            'username',
            connection.session.user.id === 0 ? '*guest' : connection.session.identifier,
            'ip',
            connection.ip
        );
        this.syncStorage();
    }

    public async onConnectionAuthenticated(connection: Connection): Promise<void> {
        this.registerAssociation(
            'username',
            connection.session.user.id === 0 ? '*guest' : connection.session.identifier,
            'ip',
            connection.ip
        );
        this.syncStorage();
    }
}
