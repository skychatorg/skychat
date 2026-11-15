import { COLORS, Duration, DURATIONS, SHOP, ShopItem, ShopSlot, TITLE_MAX_LENGTH } from '../../../../api/shop.js';
import { Connection } from '../../../skychat/Connection.js';
import { Logging, logFailure } from '../../../skychat/Logging.js';
import { RoomManager } from '../../../skychat/RoomManager.js';
import { Session } from '../../../skychat/Session.js';
import { User } from '../../../skychat/User.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';
import { ConnectedListPlugin } from './ConnectedListPlugin.js';

/**
 * One element that can be customized
 */
export type CustomizationElementValue = {
    id: number;
    name: string;
    value: any;
};

export type CustomizationElements = { [key: string]: CustomizationElementValue[] };

/** What the user wears, and until when each rental runs, in ms */
type CustomizationData = { [slot in ShopSlot]?: string } & { [slot in ShopSlot as `${slot}Until`]?: number };

const SLOTS = Object.keys(SHOP) as ShopSlot[];

/** Any printable text, no line breaks */
const TITLE_PATTERN = new RegExp(`^[^\\p{C}]{1,${TITLE_MAX_LENGTH}}$`, 'u');

export class CustomizationPlugin extends GlobalPlugin {
    /**
     * Everyone's color when they don't rent one
     */
    static readonly DEFAULT_COLOR = '#aaaaaa';

    /**
     * All possible customization keys/values
     */
    static readonly ITEMS: CustomizationElements = { color: COLORS };

    static readonly commandName = 'custom';

    readonly minRight = 0;

    readonly rules = {
        custom: {
            minCount: 2,
            params: [
                {
                    name: 'action',
                    pattern: /^(use|buy)$/,
                    info: 'Action',
                },
                {
                    name: 'item',
                    pattern: new RegExp(`^(${SLOTS.join('|')})(:\\w+)?$`),
                    info: 'Item, and the option picked',
                },
            ],
        },
    };

    static readonly defaultDataStorageValue: CustomizationData = {
        color: CustomizationPlugin.DEFAULT_COLOR,
    };

    /**
     * Whether the user rents this item right now
     */
    static isRenting(user: User, slot: ShopSlot): boolean {
        const data = UserController.getUserPluginData<CustomizationData>(user, CustomizationPlugin.commandName);
        return (data[`${slot}Until`] ?? 0) > Date.now();
    }

    /**
     * Refuses a wizz, sandale or confuse on a shielded user, before the sender pays for it
     */
    static checkUnshielded(identifier: string): void {
        const user = Session.getSessionByIdentifier(identifier)?.user;
        if (user && CustomizationPlugin.isRenting(user, 'shield')) {
            throw new Error(`${user.username} has a shield up`);
        }
    }

    constructor(manager: RoomManager) {
        super(manager);

        setInterval(() => logFailure(this.expire(), 'Shop expiry'), 60 * 1000);
    }

    /**
     * `buy <item>[:<option>] <duration> [title]` rents an item, adding to the time left. `use <item>[:<option>] [title]` switches for free while it runs
     */
    public async run(alias: string, param: string, connection: Connection): Promise<void> {
        const [action, choice, ...rest] = param.split(' ');
        const [slot, option] = choice.split(':') as [ShopSlot, string | undefined];
        const user = connection.session.user;
        const data = this.getUserData<CustomizationData>(user);

        if (action === 'buy') {
            const duration = rest.shift() as Duration;
            const prices: Partial<Record<string, number>> = SHOP[slot].prices;
            // Own keys only: `constructor` would find Object's
            const price = Object.prototype.hasOwnProperty.call(prices, duration) ? prices[duration] : undefined;
            if (!price) {
                throw new Error(`Choose how long to rent it for: ${Object.keys(SHOP[slot].prices).join(' or ')}`);
            }
            const value = this.valueOf(slot, option, rest.join(' '));
            await UserController.buy(user, price, `${SHOP[slot].name} for a ${duration}`);
            data[`${slot}Until`] = Math.max(Date.now(), data[`${slot}Until`] ?? 0) + DURATIONS[duration] * 24 * 60 * 60 * 1000;
            data[slot] = value;
        } else {
            if (!CustomizationPlugin.isRenting(user, slot)) {
                throw new Error(`Rent the ${SHOP[slot].name.toLowerCase()} in the shop first`);
            }
            data[slot] = this.valueOf(slot, option, rest.join(' '));
        }

        await this.saveUserData(user, data);
        this.sync(connection.session);
    }

    /**
     * What is stored for the picked option, checked before anything is paid
     */
    private valueOf(slot: ShopSlot, option: string | undefined, text: string): string | undefined {
        if (slot === 'shield') {
            return undefined;
        }
        if (slot === 'title') {
            const title = text.trim();
            if (!TITLE_PATTERN.test(title)) {
                throw new Error(`Write a title of up to ${TITLE_MAX_LENGTH} characters`);
            }
            return title;
        }
        const value = slot === 'color' ? COLORS.find((color) => String(color.id) === option)?.value : option;
        if (!value || !(SHOP[slot] as ShopItem).options?.some((o) => o.id === option)) {
            throw new Error(`Pick one of the ${SHOP[slot].name.toLowerCase()}s`);
        }
        return value;
    }

    /**
     * Takes off what is no longer rented, item by item. Also takes back colors picked when they were free
     */
    private async expire(): Promise<void> {
        for (const session of Object.values(Session.sessions)) {
            if (session.user.right < 0) {
                continue;
            }
            const data = this.getUserData<CustomizationData>(session.user);
            const expired = SLOTS.filter(
                (slot) =>
                    !CustomizationPlugin.isRenting(session.user, slot) &&
                    (data[slot] !== CustomizationPlugin.defaultDataStorageValue[slot] || data[`${slot}Until`] !== undefined),
            );
            if (expired.length === 0) {
                continue;
            }
            for (const slot of expired) {
                delete data[slot];
                delete data[`${slot}Until`];
            }
            data.color ??= CustomizationPlugin.DEFAULT_COLOR;
            // One user failing to save must not stop the others
            try {
                await this.saveUserData(session.user, data);
                this.sync(session);
            } catch (error) {
                Logging.error('Shop expiry', error);
            }
        }
    }

    private sync(session: Session): void {
        (this.manager.getPlugin('connectedlist') as ConnectedListPlugin).sync();
        session.syncUserData();
    }

    /**
     * Send the list of all items to the new connection
     */
    async onNewConnection(connection: Connection): Promise<void> {
        connection.send('custom', CustomizationPlugin.ITEMS);
    }
}
