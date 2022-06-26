import {Connection} from "../../../skychat/Connection";
import {GlobalPlugin} from "../../GlobalPlugin";
import {User} from "../../../skychat/User";
import {ConnectedListPlugin} from "./ConnectedListPlugin";
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

export class CustomizationPlugin extends GlobalPlugin {

    /**
     * Key used to store the color
     */
    static KEY_COLOR = 'color';

    /**
     * All possible customization keys/values
     */
    static readonly ITEMS: {[key: string]: CustomizationElementValue[]} = {

        [CustomizationPlugin.KEY_COLOR]: [
            { id: 0, name: 'default', value: '#aaaaaa' },

            { id: 1, name: 'darkgray', value: '#656565' },
            { id: 2, name: 'purewhite', value: '#ffffff' },

            { id: 3, name: 'crimson', value: '#ec375a' },
            { id: 4, name: 'palevioletred', value: '#db7093' },
            { id: 5, name: 'lavenderblush', value: '#e6a2b9' },
            { id: 6, name: 'lightpurple', value: '#ea5fea' },
            { id: 7, name: 'lavender', value: '#9494e0' },
            { id: 8, name: 'steelblue', value: '#4b9fd5' },
            { id: 9, name: 'teal', value: '#008080' },
            { id: 10, name: 'lightcyan', value: '#82e2e2' },
            { id: 11, name: 'springgreen', value: '#00ff7f' },
            { id: 12, name: 'olive', value: '#808000' },
            { id: 13, name: 'lemonchiffon', value: '#fffacd' },
            { id: 14, name: 'tan', value: '#f4a460' },

            { id: 15, name: 'purple', value: '#ae1e68' },
            { id: 16, name: 'rebeccapurple', value: '#a348ff' },
            { id: 17, name: 'royalblue', value: '#4169e1' },
            { id: 18, name: 'oldblue', value: '#4c80bb' },
            { id: 19, name: 'darkcyan', value: '#046380' },
            { id: 20, name: 'turquoise', value: '#40e0d0' },
            { id: 21, name: 'green', value: '#388e3c' },
            { id: 22, name: 'limegreen', value: '#32cd32' },
            { id: 23, name: 'yellow', value: '#e4e400' },
            { id: 24, name: 'orange', value: '#e67e00' },

            // Disabled because too flashy
            // {id: 25, name: 'orangered', value: '#ff4500', price: ShopPlugin.COLORS_TIER_3_COST},
            // {id: 26, name: 'bestred', value: '#ff2424', price: ShopPlugin.COLORS_TIER_3_COST},
        ],
    };

    static readonly commandName = 'custom';

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
}
