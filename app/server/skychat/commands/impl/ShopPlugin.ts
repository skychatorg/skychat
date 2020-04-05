import {Connection} from "../../Connection";
import {Plugin} from "../Plugin";
import {ColorPlugin} from "./ColorPlugin";
import {Message} from "../../Message";
import {User} from "../../User";
import {ConnectedListPlugin} from "./ConnectedListPlugin";


export class ShopPlugin extends Plugin {

    public static readonly ITEMS: {[type: string]: {id: number, name: string, preview: string, value: string, price: number}[]} = {
        colors: [
            {id: 0, name: 'default', preview: '', value: ColorPlugin.DEFAULT_COLOR, price: 0},
            {id: 1, name: 'white', preview: '', value: 'white', price: 0},
            {id: 2, name: 'cyan', preview: '', value: 'cyan', price: 0},
        ]
    };

    readonly defaultDataStorageValue: {[type: string]: number[]} = {colors: []};

    readonly name = 'shop';

    readonly aliases = ['shoplist', 'shopbuy', 'shopset'];

    readonly minRight = 0;

    readonly rules = {
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
        return;
    }

    /**
     * List items
     * @param param
     * @param connection
     */
    private async handleShopList(param: string, connection: Connection): Promise<void> {
        const items = ShopPlugin.ITEMS[param];
        if (! items) {
            throw new Error('Unknown item');
        }
        connection.send('message', new Message('Available ' + param + ':', User.BOT_USER));
        for (let item of items) {
            let content: string = item.id + ': ' + item.name;
            if (item.preview) {
                content += ' -> ' + item.preview;
            }
            content += ' (' + item.value + '): $ ' + item.price;
            connection.send('message', new Message(content, User.BOT_USER));
        }
        connection.send('message', new Message('Use /shopbuy  ' + param + ' {id} to buy an item' , User.BOT_USER));
    }

    /**
     * Buy an item
     * @param param
     * @param connection
     */
    private async handleShopBuy(param: string, connection: Connection): Promise<void> {

        const type = param.split(' ')[0];
        const id = parseInt(param.split(' ')[1]);
        const items = ShopPlugin.ITEMS[type];
        if (! items) {
            throw new Error('Unknown item type');
        }
        const item = items.find((i: any) => i.id === id);
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
        const items = ShopPlugin.ITEMS[type];
        if (! items) {
            throw new Error('Unknown item type');
        }
        const item = items.find((i: any) => i.id === id);
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
    }
}
