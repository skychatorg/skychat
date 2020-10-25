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

    public static readonly ITEMS: {[type: string]: ShopItems} = {
        'color.main': {
            items: [
                {id: 0, name: 'default', value: ColorPlugin.DEFAULT_MAIN, price: ShopPlugin.COLORS_TIER_0_COST},

                {id: 1, name: 'darkgray', value: '#656565', price: ShopPlugin.COLORS_TIER_1_COST},
                {id: 2, name: 'purewhite', value: '#ffffff', price: ShopPlugin.COLORS_TIER_1_COST},

                {id: 3, name: 'crimson', value: '#ec375a', price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 4, name: 'palevioletred', value: '#db7093', price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 5, name: 'lavenderblush', value: '#e6a2b9', price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 6, name: 'lightpurple', value: '#ea5fea', price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 7, name: 'lavender', value: '#9494e0', price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 8, name: 'steelblue', value: '#4b9fd5', price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 9, name: 'teal', value: '#008080', price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 10, name: 'lightcyan', value: '#82e2e2', price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 11, name: 'springgreen', value: '#00ff7f', price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 12, name: 'olive', value: '#808000', price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 13, name: 'lemonchiffon', value: '#fffacd', price: ShopPlugin.COLORS_TIER_2_COST},
                {id: 14, name: 'tan', value: '#f4a460', price: ShopPlugin.COLORS_TIER_2_COST},

                {id: 15, name: 'purple', value: '#ae1e68', price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 16, name: 'rebeccapurple', value: '#a348ff', price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 17, name: 'royalblue', value: '#4169e1', price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 18, name: 'oldblue', value: '#4c80bb', price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 19, name: 'darkcyan', value: '#046380', price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 20, name: 'turquoise', value: '#40e0d0', price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 21, name: 'green', value: '#388e3c', price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 22, name: 'limegreen', value: '#32cd32', price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 23, name: 'yellow', value: '#e4e400', price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 24, name: 'orange', value: '#e67e00', price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 25, name: 'orangered', value: '#ff4500', price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 26, name: 'bestred', value: '#ff2424', price: ShopPlugin.COLORS_TIER_3_COST},
            ],
            preview: (value, user) => `
                <div style="color:${value};border-left: 4px solid ${value};padding-left: 6px;">
                    <div style="border:1px solid white;width:14px;height:14px;border-radius:50%;background:transparent;display:inline-block;margin-right:4px;box-shadow:2px 2px 3px 2px ${user.data.plugins.color.secondary}">&nbsp;</div>
                    <b>${user.username}</b>
                </div>
            `
        },
        'color.secondary': {
            items: [
                {id: 0, name: 'default', value: ColorPlugin.DEFAULT_SECONDARY, price: ShopPlugin.COLORS_TIER_0_COST},

                {id: 1, name: 'white', value: '#ffffff', price: ShopPlugin.COLORS_TIER_1_COST},
                {id: 2, name: 'black', value: '#000000', price: ShopPlugin.COLORS_TIER_1_COST},

                {id: 3, name: 'purple', value: '#ae1e68', price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 4, name: 'rebeccapurple', value: '#a348ff', price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 5, name: 'royalblue', value: '#4169e1', price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 6, name: 'oldblue', value: '#4c80bb', price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 7, name: 'turquoise', value: '#40e0d0', price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 8, name: 'limegreen', value: '#32cd32', price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 9, name: 'yellow', value: '#e4e400', price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 10, name: 'orange', value: '#e67e00', price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 11, name: 'orangered', value: '#ff4500', price: ShopPlugin.COLORS_TIER_3_COST},
                {id: 12, name: 'bestred', value: '#ff2424', price: ShopPlugin.COLORS_TIER_3_COST},
            ],
            preview: (value, user) => `
                <div style="color:${user.data.plugins.color.main};border-left: 4px solid ${user.data.plugins.color.main};padding-left: 6px;">
                    <div style="border:1px solid white;width:14px;height:14px;border-radius:50%;background:transparent;display:inline-block;margin-right:4px;box-shadow:2px 2px 3px 2px ${user.data.plugins.color.secondary}">
                        &nbsp;
                    </div>
                    <b>${user.username}</b>
                </div>
            `
        },
        'pinnedicon': {
            items: [
                [ 0, '' ],
                [ 1, 'accessibility' ],
                [ 2, 'accessible' ],
                [ 3, 'accessible_forward' ],
                [ 4, 'not_accessible' ],
                [ 5, 'api' ],
                [ 6, 'biotech' ],
                [ 7, 'account_balance' ],
                [ 8, 'face' ],
                [ 9, 'whatshot' ],
                [ 10, 'psychology' ],
                [ 11, 'sentiment_very_satisfied' ],
                [ 12, 'sentiment_very_dissatisfied' ],
                [ 13, 'monetization_on' ],
                [ 14, 'sick' ],
                [ 15, 'masks' ],
                [ 16, 'military_tech' ],
                [ 17, 'self_improvement' ],
                [ 18, 'sports_volleyball' ],
                [ 19, 'sports_tennis' ],
                [ 20, 'sports_soccer' ],
                [ 21, 'sports_rugby' ],
                [ 22, 'sports_motorsports' ],
                [ 23, 'sports_mma' ],
                [ 24, 'sports_hockey' ],
                [ 25, 'sports_handball' ],
                [ 26, 'sports_football' ],
                [ 27, 'sports_bar' ],
                [ 28, 'pregnant_woman' ],
                [ 29, 'anchor' ],
                [ 30, 'pan_tool' ],
                [ 31, 'pets' ],
                [ 32, 'visibility' ],
                [ 33, 'album' ],
                [ 34, 'highlight' ],
                [ 35, 'monetization_on' ],
                [ 36, 'memory' ],
                [ 37, 'security' ],
                [ 38, 'sim_card' ],
                [ 39, 'airplanemode_inactive' ],
                [ 40, 'videogame_asset' ],
                [ 41, 'router' ],
                [ 42, 'bedtime' ],
                [ 43, 'trending_down' ],
                [ 44, 'trending_up' ],
                [ 45, 'blur_circular' ],
                [ 46, 'brightness_7' ],
                [ 47, 'camera' ],
                [ 48, 'laptop' ],
                [ 49, 'flash_on' ],
                [ 50, 'local_fire_department' ],
                [ 51, 'my_location' ],
                [ 52, 'navigation' ],
                [ 53, 'ac_unit' ],
                [ 54, 'grass' ],
                [ 55, 'spa' ],
                [ 56, 'smoking_rooms' ],
                [ 58, 'coronavirus' ],
                [ 59, 'science' ],
                [ 60, 'star' ],
                [ 61, 'gamepad' ],
                [ 62, 'bubble_chart' ]
            ].map((data: any[], index: number) => ({
                id: data[0],
                name: data[1],
                value: data[1],
                price: data[1] === '' ? 0 : 5000
            })),
            preview: (value, user) => `
                <div style="color:${user.data.plugins.color.main};border-left: 4px solid ${user.data.plugins.color.main};padding-left: 6px;">
                    <div style="border:1px solid white;width:14px;height:14px;border-radius:50%;background:transparent;display:inline-block;margin-right:4px;box-shadow:2px 2px 3px 2px ${user.data.plugins.color.secondary}">&nbsp;</div>
                    <i class="material-icons md-14" style="margin-right: 6px">${value}</i> <b>${user.username}</b>
                </div>
            `
        }
    };

    public static readonly TYPE_REGEXP: RegExp = /^(color\.main|color\.secondary|pinnedicon)$/;

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
                {name: 'type', pattern: ShopPlugin.TYPE_REGEXP}
            ]
        },
        shopbuy: {
            minCount: 2,
            maxCount: 2,
            params: [
                {name: 'type', pattern: ShopPlugin.TYPE_REGEXP},
                {name: 'item', pattern: /^([0-9]+)$/},
            ]
        },
        shopset: {
            minCount: 2,
            maxCount: 2,
            params: [
                {name: 'type', pattern: ShopPlugin.TYPE_REGEXP},
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
        const message = UserController.createNeutralMessage('');
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
        const message = UserController.createNeutralMessage('Available ' + param + ':');
        const formatter = MessageFormatter.getInstance();
        let html = '<table class="skychat-table">';
        html += `
            <tr>
                <td>name</td>
                <td>preview</td>
                <td>price</td>
                <td></td>
                <td></td>
            </tr>
        `;
        for (let item of itemDefinition.items) {
            const itemOwned = this.userOwnsItem(connection.session.user, param, item.id);
            html += `
                <tr>
                    <td>${item.name}</td>
                    <td>${itemDefinition.preview(item.value, connection.session.user)}</td>
                    <td>${'$ ' + (item.price / 100)}</td>
                    <td>${itemOwned ? '' : formatter.getButtonHtml('buy', '/shopbuy ' + param + ' ' + item.id, true, true)}</td>
                    <td>${formatter.getButtonHtml('set', '/shopset ' + param + ' ' + item.id, true, true)}</td>
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
            case 'color.main':
            case 'color.secondary':
                const data = await UserController.getPluginData(connection.session.user, 'color');
                data[type.split('.')[1]] = item.value;
                await UserController.savePluginData(connection.session.user, 'color', data);
                await (this.room.getPlugin('connectedlist') as ConnectedListPlugin).sync();
                break;
            
            case 'pinnedicon':
                await UserController.savePluginData(connection.session.user, 'pinnedicon', item.value);
                await (this.room.getPlugin('connectedlist') as ConnectedListPlugin).sync();
                break;
        }
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
