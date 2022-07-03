import { Connection } from "../../../skychat/Connection";
import { GlobalPlugin } from "../../GlobalPlugin";
import { User } from "../../../skychat/User";
import { ConnectedListPlugin } from "./ConnectedListPlugin";
import { Room } from "../../../skychat/Room";
import { Session } from "../../../skychat/Session";


/**
 * One element that can be customized
 */
export type CustomizationElementValue = {
    id: number;
    name: string;
    value: any;
};

export type CustomizationElements = {[key: string]: CustomizationElementValue[]};

export class CustomizationPlugin extends GlobalPlugin {

    /**
     * Key used to store the color
     */
    static KEY_COLOR = 'color';

    /**
     * All possible customization keys/values
     */
    static readonly ITEMS: CustomizationElements = {

        [CustomizationPlugin.KEY_COLOR]: [

            // Grays
            { id: 0, name: 'Dark Dark Dark Dark Gray', value: '#656565' },
            { id: 1, name: 'Dark Dark Dark Gray', value: '#757575' },
            { id: 2, name: 'Dark Dark Gray', value: '#858585' },
            { id: 3, name: 'Dark Gray', value: '#959595' },
            { id: 4, name: 'Boring Gray', value: '#aaaaaa' },
            { id: 5, name: 'Gray', value: '#bbbbbb' },
            { id: 6, name: 'lightgray', value: '#cccccc' },
            { id: 7, name: 'Light Gray', value: '#dddddd' },
            { id: 8, name: 'Light Light Gray', value: '#eeeeee' },
            { id: 9, name: 'Light Light Light Gray', value: '#f6f6f6' },

            // https://coolors.co/ff4769-f7457c-f34486-ee428f-e640a2-dd3db4-d53bc7-cc38da-c837e4-c436ed
            { id: 10, name: 'Fiery Rose', value: '#FF4769' },
            { id: 11, name: 'Light French Rose', value: '#F7457C' },
            { id: 12, name: 'French Rose', value: '#F34486' },
            { id: 13, name: 'French Fuchsia', value: '#EE428F' },
            { id: 14, name: 'Light Frostbite', value: '#E640A2' },
            { id: 15, name: 'Frostbite', value: '#DD3DB4' },
            { id: 16, name: 'Light Light Steel Pink', value: '#D53BC7' },
            { id: 17, name: 'Steel Pink', value: '#CC38DA' },
            { id: 18, name: 'Steel Pink', value: '#C837E4' },
            { id: 19, name: 'Phlox', value: '#C436ED' },

            // https://coolors.co/bb33ff-bc47ff-b65cff-a35cff-7e47ff-5447ff-4778ff-4788ff-5c9aff-70b5ff
            { id: 20, name: 'Electric Purple', value: '#BB33FF' },
            { id: 21, name: 'Phlox Purple', value: '#BC47FF' },
            { id: 22, name: 'Medium Orchid', value: '#B65CFF' },
            { id: 23, name: 'Medium Purple', value: '#A35CFF' },
            { id: 24, name: 'Majorelle Purple', value: '#7E47FF' },
            { id: 25, name: 'Majorelle Blue', value: '#5447FF' },
            { id: 26, name: 'Blue Crayola', value: '#4778FF' },
            { id: 27, name: 'United Nations Blue', value: '#4788FF' },
            { id: 28, name: 'Cornflower Blue', value: '#5C9AFF' },
            { id: 29, name: 'French Sky Blue', value: '#70B5FF' },
        ],
    };

    static readonly commandName = 'custom';

    readonly minRight = 0;

    readonly rules = {
        custom: {
            minCount: 2,
            maxCount: 2,
            params: [
                {
                    name: 'action',
                    pattern: /^use$/,
                    info: 'Action'
                },
                {
                    name: 'choice',
                    pattern: /^(color):(\d+)$/,
                    info: 'Chosen color'
                }
            ]
        }
    };

    /**
     * Default values
     */
    static readonly defaultDataStorageValue = {
        [CustomizationPlugin.KEY_COLOR]: '#aaaaaa',
    };

    public async run(alias: string, param: string, connection: Connection, session: Session, user: User, room: Room | null): Promise<void> {
        const [action, choice] = param.split(' ');
        const [type, rawId] = choice.split(':');
        const id = parseInt(rawId);

        // Check that type exists
        if (! CustomizationPlugin.ITEMS[type]) {
            throw new Error('Unable to customize this property');
        }

        // Check that item exists
        const item = CustomizationPlugin.ITEMS[type].find(item => item.id === id);
        if (! item) {
            throw new Error(`Item ${id} does not exist`);
        }

        // Set item
        const data = this.getUserData(connection.session.user);
        data[type] = item.value;
        this.saveUserData(connection.session.user, data);
        (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
    }

    /**
     * Send the list of all items to the new connection
     * @abstract
     * @param connection
     */
    async onNewConnection(connection: Connection): Promise<void> {
        connection.send('custom', CustomizationPlugin.ITEMS);
    }
}
