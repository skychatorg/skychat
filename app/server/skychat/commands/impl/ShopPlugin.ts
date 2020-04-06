import {Connection} from "../../Connection";
import {Plugin} from "../Plugin";
import {ColorPlugin} from "./ColorPlugin";
import {Message} from "../../Message";
import {User} from "../../User";
import {ConnectedListPlugin} from "./ConnectedListPlugin";
import * as striptags from "striptags";


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
                {id: 0, name: '#aaaaaa', value: ColorPlugin.DEFAULT_COLOR, price: 0},
                {id: 1, name: 'white', value: '#ffffff', price: 0},
                {id: 2, name: '#bf00ff', value: '#bf00ff', price: 0},
                {id: 3, name: '#046380', value: '#046380', price: 0},
                {id: 4, name: '#eda6c0', value: '#eda6c0', price: 0},
            ],
            preview: '<span style="color:{VALUE}">{USERNAME}</span>'
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
        const message = new Message('Available items:', User.BOT_USER);
        for (const type in ShopPlugin.ITEMS) {
            message.append('/shoplist ' + type + ' :d) list all available ' + type);
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
            throw new Error('Unknown item');
        }
        const message = new Message('Available ' + param + ':', User.BOT_USER);
        let html = '<table>';
        html += `
            <tr>
                <td>id</td>
                <td>name</td>
                <td>preview</td>
                <td>value</td>
                <td>price</td>
            </tr>
        `;
        for (let item of itemDefinition.items) {
            html += `
                <tr>
                    <td>${item.id}</td>
                    <td>${item.name}</td>
                    <td>${itemDefinition.preview.replace('{VALUE}', item.value).replace('{USERNAME}', connection.session.user.username)}</td>
                    <td>${item.value}</td>
                    <td>$ ${item.price / 100}</td>
                </tr>
            `;
        }
        html += '</table>';
        message.append(striptags(html), html);
        message.append('Buy a command:');
        message.append('/shopbuy ' + param + ' {id} :d) Buy item {id}');
        message.append('/shopset ' + param + ' {id} :d) Select item {id} (Must be bought beforehand)');
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
        const itemDefinition = ShopPlugin.ITEMS[type];
        if (! itemDefinition) {
            throw new Error('Unknown item type');
        }
        const item = itemDefinition.items.find((i: any) => i.id === id);
        if (! item) {
            throw new Error('Item not found');
        }
        let data: any = User.getPluginData(connection.session.user, this.name);
        if (! data) {
            data = {};
        }
        if (! data[type]) {
            data[type] = [];
        }
        const ownedItems = data[type];
        if (typeof ownedItems.find((id: number) => id === item.id) !== 'undefined') {
            throw new Error('You already own this item');
        }
        await User.buy(connection.session.user, item.price);
        data[type].push(item.id);
        await User.savePluginData(connection.session.user, this.name, data);
    }

    /**
     * Buy an item
     * @param param
     * @param connection
     */
    private async handleShopSet(param: string, connection: Connection): Promise<void> {

        const type = param.split(' ')[0];
        const id = parseInt(param.split(' ')[1]);
        const itemDefinition = ShopPlugin.ITEMS[type];
        if (! itemDefinition) {
            throw new Error('Unknown item type');
        }
        const item = itemDefinition.items.find((i: any) => i.id === id);
        if (! item) {
            throw new Error('Item not found');
        }
        const data = User.getPluginData(connection.session.user, this.name);
        if (! data[type]) {
            data[type] = [];
        }
        const ownedItems = data[type];
        if (typeof ownedItems.find((id: number) => id === item.id) === 'undefined') {
            throw new Error('You don\'t own this item');
        }

        switch (type) {
            case 'colors':
                await User.savePluginData(connection.session.user, 'color', item.value);
                await (this.room.getPlugin('connectedlist') as ConnectedListPlugin).sync();
                break;
        }
        connection.send('message', new Message(':ok:', User.BOT_USER).sanitized());
    }
}
