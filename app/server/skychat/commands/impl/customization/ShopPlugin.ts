import {Connection} from "../../../Connection";
import {Plugin} from "../../Plugin";
import {ColorPlugin} from "./ColorPlugin";
import {Message} from "../../../Message";
import {User} from "../../../User";
import {ConnectedListPlugin} from "../core/ConnectedListPlugin";
import * as striptags from "striptags";
import {UserController} from "../../../UserController";
import {MessageFormatter} from "../../../MessageFormatter";


export type ShopItems = {
    items: ShopItem[];
    preview: (value: any, user: User) => string
};

export type ShopItem = {
    id: number,
    name: string,
    value: any,
    price: number
}


export class ShopPlugin extends Plugin {

    public static readonly COLORS_TIER_0_COST: number = 0;
    public static readonly COLORS_TIER_1_COST: number = 500;
    public static readonly COLORS_TIER_2_COST: number = 1500;
    public static readonly COLORS_TIER_3_COST: number = 3000;
    public static readonly COLORS_TIER_4_COST: number = 5000;

    public static readonly ITEMS: {[type: string]: ShopItems} = {
        colors: {
            items: [
                {id: 0, name: 'default', value: {main: ColorPlugin.DEFAULT_MAIN, secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_0_COST},
 
                {id: 1, name: 'darkgray', value: {main: '#656565', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_1_COST},
                {id: 2, name: 'purewhite', value: {main: '#ffffff', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_1_COST},
 
                {id: 3, name: 'crimson', value: {main: '#ec375a', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 4, name: 'palevioletred', value: {main: '#db7093', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 5, name: 'lavenderblush', value: {main: '#e6a2b9', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 6, name: 'lightpurple', value: {main: '#ea5fea', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 7, name: 'lavender', value: {main: '#9494e0', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 8, name: 'steelblue', value: {main: '#4b9fd5', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 9, name: 'teal', value: {main: '#008080', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 10, name: 'lightcyan', value: {main: '#82e2e2', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 11, name: 'springgreen', value: {main: '#00ff7f', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 12, name: 'olive', value: {main: '#808000', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 13, name: 'lemonchiffon', value: {main: '#fffacd', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 14, name: 'tan', value: {main: '#f4a460', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_2_COST},
 
                {id: 15, name: 'purple', value: {main: '#ae1e68', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 16, name: 'rebeccapurple', value: {main: '#a348ff', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 17, name: 'royalblue', value: {main: '#4169e1', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 18, name: 'oldblue', value: {main: '#4c80bb', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 19, name: 'darkcyan', value: {main: '#046380', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 20, name: 'turquoise', value: {main: '#40e0d0', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 21, name: 'green', value: {main: '#388e3c', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 22, name: 'limegreen', value: {main: '#32cd32', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 23, name: 'yellow', value: {main: '#e4e400', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 24, name: 'orange', value: {main: '#e67e00', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 25, name: 'orangered', value: {main: '#ff4500', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 26, name: 'bestred', value: {main: '#ff2424', secondary: ColorPlugin.DEFAULT_SECONDARY}, price: ShopPlugin.COLORS_TIER_3_COST},
               
                {id: 1000, name: 'admin', value: {main: '#ff2424', secondary: '#ff2424'}, price: ShopPlugin.COLORS_TIER_4_COST},
            ],
            preview: (value, user) => `
                <div style="color:${value.main};border-left: 4px solid ${value.main};padding-left: 6px;">
                    <div style="width:14px;height:14px;border-radius:50%;background:transparent;display:inline-block;margin-right:4px;box-shadow:1px 1px 3px 1px ${value.secondary}">&nbsp;</div>
                    <b>${user.username}</div>
                </div>
            `
        }
    };

    readonly defaultDataStorageValue: {[type: string]: number[]} = {colors: []};

    readonly name = 'shop';

    readonly aliases = ['shoplist', 'shopbuy', 'shopset'];

    readonly minRight = 0;

    readonly rules = {
        shop: {
            minCount: 0,
            maxCount: 0,
            params: []
        },
        shoplist: {
            minCount: 1,
            maxCount: 1,
            params: [
                {name: 'type', pattern: /^(colors)$/}
            ]
        },
        shopbuy: {
            minCount: 2,
            maxCount: 2,
            params: [
                {name: 'type', pattern: /^(colors)$/},
                {name: 'item', pattern: /^([0-9]+)$/},
            ]
        },
        shopset: {
            minCount: 2,
            maxCount: 2,
            params: [
                {name: 'type', pattern: /^(colors)$/},
                {name: 'item', pattern: /^([0-9]+)$/},
            ]
        },
    };

    /**
     * Main function for handling commands
     * @param alias
     * @param param
     * @param connection
     */
    async run(alias: string, param: string, connection: Connection): Promise<void> {

        if (alias === 'shop') {
            await this.handleShop(param, connection);
            return;
        }

        if (alias === 'shoplist') {
            await this.handleShopList(param, connection);
            return;
        }

        if (alias === 'shopbuy') {
            await this.handleShopBuy(param, connection);
            return;
        }

        if (alias === 'shopset') {
            await this.handleShopSet(param, connection);
            return;
        }
    }

    /**
     * General shop options
     * @param param
     * @param connection
     */
    private async handleShop(param: string, connection: Connection): Promise<void> {
        const message = new Message('', null, UserController.getNeutralUser());
        for (const type in ShopPlugin.ITEMS) {
            message.append(`[[list all available ${type}//shoplist ${type}]]`);
        }
        connection.send('message', message.sanitized());
    }

    /**
     * List items
     * @param param
     * @param connection
     */
    private async handleShopList(param: string, connection: Connection): Promise<void> {
        if (! param) {
            for (const type in ShopPlugin.ITEMS) {
                await this.handleShopList(type, connection);
            }
            return;
        }
        const itemDefinition = ShopPlugin.ITEMS[param];
        if (! itemDefinition) {
            throw new Error('Unknown item type');
        }
        const message = new Message('Available ' + param + ':', null, UserController.getNeutralUser());
        const formatter = MessageFormatter.getInstance();
        let html = '<table class="skychat-table">';
        html += `
            <tr>
                <td>name</td>
                <td>preview</td>
                <td>price</td>
                <td></td>
            </tr>
        `;
        for (let item of itemDefinition.items) {
            const itemOwned = this.userOwnsItem(connection.session.user, param, item.id);
            const actionTitle = itemOwned ? 'set' : 'buy';
            const actionPayload = (itemOwned ? '/shopset' : '/shopbuy') + ' ' + param + ' ' + item.id;
            html += `
                <tr>
                    <td>${item.name}</td>
                    <td>${itemDefinition.preview(item.value, connection.session.user)}</td>
                    <td>$ ${item.price / 100}</td>
                    <td>${formatter.getButtonHtml(actionTitle, actionPayload, true, true)}</td>
                </tr>
            `;
        }
        html += '</table>';
        message.append(striptags(html), html);
        connection.send('message', message.sanitized());
    }

    /**
     * Buy an item
     * @param param
     * @param connection
     */
    private async handleShopBuy(param: string, connection: Connection): Promise<void> {

        const type = param.split(' ')[0];
        const id = parseInt(param.split(' ')[1]);

        // Check item existence
        const item = this.getItem(type, id);
        if (! item) {
            throw new Error('Item not found');
        }

        // Check ownership
        if (this.userOwnsItem(connection.session.user, type, id)) {
            throw new Error('You don\'t own this item');
        }

        // Buy item
        await UserController.buy(connection.session.user, item.price);
        await this.userAddOwnedItem(connection.session.user, type, id);
        await this.handleShopList(type, connection);
    }

    /**
     * Buy an item
     * @param param
     * @param connection
     */
    private async handleShopSet(param: string, connection: Connection): Promise<void> {

        const type = param.split(' ')[0];
        const id = parseInt(param.split(' ')[1]);

        // Check item existence
        const item = this.getItem(type, id);
        if (! item) {
            throw new Error('Item not found');
        }

        // Check ownership
        if (! this.userOwnsItem(connection.session.user, type, id)) {
            throw new Error('You don\'t own this item');
        }

        // Set item
        switch (type) {
            case 'colors':
                await UserController.savePluginData(connection.session.user, 'color', item.value);
                await (this.room.getPlugin('connectedlist') as ConnectedListPlugin).sync();
                break;
        }
        await this.handleShopList(type, connection);
    }

    /**
     * @param type
     * @param itemId
     */
    public getItem(type: string, itemId: number): undefined | ShopItem {
        const itemDefinitions = ShopPlugin.ITEMS[type];
        if (! itemDefinitions) {
            return;
        }
        return itemDefinitions.items.find((item: ShopItem) => item.id === itemId);
    }

    /**
     * Tells whether an user owns a specific item
     * @param user
     * @param type
     * @param itemId
     */
    public userOwnsItem(user: User, type: string, itemId: number): boolean {
        const storage = user.storage || {shop: {owned: {}}};
        storage.shop = storage.shop || {};
        storage.shop.ownedItems = storage.shop.ownedItems || {};
        storage.shop.ownedItems[type] = storage.shop.ownedItems[type] || [];
        const index = storage.shop.ownedItems[type].findIndex((ownedItemId: number) => ownedItemId === itemId);
        return index !== -1;
    }

    /**
     * Tells whether an user owns a specific item
     * @param user
     * @param type
     * @param itemId
     */
    public async userAddOwnedItem(user: User, type: string, itemId: number): Promise<void> {
        const storage = user.storage || {shop: {owned: {}}};
        storage.shop = storage.shop || {};
        storage.shop.ownedItems = storage.shop.ownedItems || {};
        storage.shop.ownedItems[type] = storage.shop.ownedItems[type] || [];
        storage.shop.ownedItems[type].push(itemId);
        user.storage = storage;
        await UserController.sync(user);
    }
}
