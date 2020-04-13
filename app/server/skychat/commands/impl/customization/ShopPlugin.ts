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
    preview: string
};

export type ShopItem = {
    id: number,
    name: string,
    value: string,
    price: number
}


export class ShopPlugin extends Plugin {

    public static readonly ITEMS: {[type: string]: ShopItems} = {
        colors: {
            items: [
                {id: 0, name: 'gray', value: ColorPlugin.DEFAULT_COLOR, price: 0},
                {id: 2, name: 'darkgray', value: '#888888', price: 1000},
                {id: 3, name: 'white', value: '#ffffff', price: 5000},
                {id: 6, name: 'pink', value: '#eda6c0', price: 20000},
                {id: 7, name: 'lime', value: '#64dd17', price: 30000},
                {id: 9, name: 'lightblue', value: '#99ccff', price: 30000},
                {id: 5, name: 'darkcyan', value: '#046380', price: 40000},
                {id: 12, name: 'orange', value: '#e67e00', price: 50000},
                {id: 10, name: 'blue', value: '#0287bd', price: 50000},
                {id: 11, name: 'purple', value: '#ae1e68', price: 50000},
                {id: 14, name: 'green', value: '#388e3c', price: 50000},
                {id: 13, name: 'yellow', value: '#ffd700', price: 60000},
                {id: 4, name: 'violet', value: '#bf00ff', price: 70000},
                {id: 8, name: 'red', value: '#ba000d', price: 99999},
            ],
            preview: '<b style="color:{VALUE}">{USERNAME}</b>'
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
                <td>id</td>
                <td>name</td>
                <td>preview</td>
                <td>value</td>
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
                    <td>${item.id}</td>
                    <td>${item.name}</td>
                    <td>${itemDefinition.preview.replace('{VALUE}', item.value).replace('{USERNAME}', connection.session.user.username)}</td>
                    <td>${item.value}</td>
                    <td>$ ${item.price / 100}</td>
                    <td>${formatter.getButtonHtml(actionTitle, actionPayload, true)}</td>
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
