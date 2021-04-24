import {Connection} from "../../Connection";
import {Plugin} from "../../Plugin";
import { UserController } from "../../UserController";
import { Room } from "../../Room";
import { Message } from "../../Message";
import { Session } from "../../Session";
import { MessageFormatter } from "../../MessageFormatter";
import * as striptags from "striptags";
import { RandomGenerator } from "../../RandomGenerator";
import { Timing } from "../../Timing";


type GameObject = {
    state: 'pending' | 'started';
    gameMessage: Message | null;
    participants: Session[],
    cards: {[carId: number]: {state: 'pending' | 'chosen' | 'shown', content: number}};
    bets: {[identifier: string]: number};
};


export class DailyRoll extends Plugin {

    /**
     * Scheduled time in hours. E.g. 2.5 means 2h30
     */
    public static readonly SCHEDULED_TIME: number = 1.66;

    public static readonly ENTRY_COST: number = 100;

    public static readonly JACKPOT_AMOUNT: number = 50 * 100;

    public static readonly BOARD_WIDTH: number = 6;

    public static readonly BOARD_HEIGHT: number = 5;

    public static readonly CARDS_COUNT: number = DailyRoll.BOARD_WIDTH * DailyRoll.BOARD_HEIGHT;

    readonly name = 'dailyroll';

    readonly minRight = 10;

    readonly rules = {
        dailyroll: {
            minCount: 1,
            maxCount: 1,
            coolDown: 1000,
            params: [{name: 'bet', pattern: /^([0-9]+)$/}]
        }
    };

    private currentGame: GameObject | null = null;

    constructor(room: Room) {
        super(room);

        if (this.room && this.room.id === 0) { // @TODO implement plugins / room
            this.armTimer();
        }
    }

    getCardCoordinates(cardId: number): {x: number, y: number} {
        return {
            x: cardId % DailyRoll.BOARD_WIDTH,
            y: Math.floor(cardId / DailyRoll.BOARD_WIDTH),
        }
    }

    getCardId(x: number, y: number): number {
        return y * DailyRoll.BOARD_WIDTH + x;
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        await this.handleBet(param, connection);
    }
    
    private armTimer(): void {
        const now = new Date().getHours() + new Date().getMinutes() / 60;
        let duration = DailyRoll.SCHEDULED_TIME - now;
        if (duration < 0) {
            duration += 24;
        }
        setTimeout(this.start.bind(this), duration * 60 * 60 * 1000);
    }

    async start(): Promise<void> {

        // Wait for at least 1 user to be there
        while(true) {
            const connectionCount = this.room.connections
                .filter(connection => ! connection.session.deadSince)
                .length;
            if (connectionCount > 0) {
                break;
            }
            await Timing.sleep(15 * 1000);
        }

        // Teasing
        await this.room.sendMessage({
            content: 'A daily roll will be launched in 1 minute.',
            user: UserController.getNeutralUser(),
        });

        await Timing.sleep(60 * 1000);

        // Initialize game object
        this.currentGame = {
            state: 'pending',
            gameMessage: null,
            participants: [],
            bets: {},
            cards: {},
        };

        // Decide card content
        for (let cardId = 0; cardId < DailyRoll.CARDS_COUNT; ++ cardId) {
            this.currentGame.cards[cardId] = {
                state: "pending",
                content: Math.floor(RandomGenerator.random(8) * 6) * 100,
            };
        }

        // Decide jackpot card
        const jackpotCardId = Math.floor(RandomGenerator.random(8) * DailyRoll.CARDS_COUNT);
        this.currentGame.cards[jackpotCardId].content = DailyRoll.JACKPOT_AMOUNT;

        // Send base message
        this.currentGame.gameMessage = await this.room.sendMessage({content: '...', user: UserController.getNeutralUser()});
        this.updateGameMessage();

        // Wait for 30 seconds
        while (true) {
            await Timing.sleep(30 * 1000);
            if (this.currentGame.participants.length > 0) {
                break;
            }
        }
        const lastMessage = await this.room.sendMessage({content: 'Hurry up, only 5 more seconds to chose your daily card', user: UserController.getNeutralUser()});
        await Timing.sleep(5 * 1000);

        // End chosing state
        this.currentGame.state = 'started';

        // Re-create game message
        this.currentGame.gameMessage.edit('deleted', '<i>deleted</i>');
        this.room.send('message-edit', this.currentGame.gameMessage.sanitized());
        this.currentGame.gameMessage = await this.room.sendMessage({content: '...', user: UserController.getNeutralUser()});
        this.updateGameMessage();

        // Reveal cards which were not chosen
        lastMessage.edit('Too late! Now revealing cards..');
        this.room.send('message-edit', lastMessage.sanitized());
        await Timing.sleep(2 * 1000);
        for (let y = 0; y < DailyRoll.BOARD_HEIGHT; ++ y) {
            for (let x = 0; x < DailyRoll.BOARD_WIDTH; ++ x) {
                const id = this.getCardId(x, y);
                const card = this.currentGame.cards[id];
                // Only reveal card if not chosen
                if (card.state === 'chosen') {
                    continue;
                }
                card.state = 'shown';
                this.updateGameMessage();
                await Timing.sleep(500);
            }
        }

        // Reveal chosen cards
        for (const session of this.currentGame.participants) {
            const chosenCardId = this.currentGame.bets[session.identifier];
            const card = this.currentGame.cards[chosenCardId];
            card.state = 'shown';
            if (card.content > 0) {
                await UserController.giveMoney(session.user, card.content);
            }
            this.updateGameMessage();
            await Timing.sleep(500);
        }

        // Edit last message & exit
        lastMessage.edit('Sleeping for approximately one day..');
        this.room.send('message-edit', lastMessage.sanitized());

        // Re-arm timer for next daily roll
        this.armTimer();
    }

    /**
     *
     */
    private updateGameMessage(): void {
        if (! this.currentGame || ! this.currentGame.gameMessage) {
            return;
        }
        // Display game board
        let content = '';

        // Show participants (and results if game is finished)
        for (const session of this.currentGame.participants) {
            const chosenCardId = this.currentGame.bets[session.identifier];
            const card = this.currentGame.cards[chosenCardId];
            content += `- ${session.identifier} chose a card.`;
            if (card.state === 'shown') {
                content += ` he earns $${card.content / 100}`;
            }
            content += '<br>';
        }

        // Display board context
        content += '<table style="text-align: center">';
        content += '<tr>' + '<th style="width: 30px"></th>'.repeat(DailyRoll.BOARD_WIDTH) + '</tr>';
        for (let y = 0; y < DailyRoll.BOARD_HEIGHT; ++ y) {
            content += '<tr>';
            for (let x = 0; x < DailyRoll.BOARD_WIDTH; ++ x) {
                const id = this.getCardId(x, y);
                const card = this.currentGame.cards[id];
                content += '<td>';

                // Display this specific card
                if (card.state === 'pending') {
                    content += `[[❔//${this.name} ${id}]]`;
                } else if (card.state === 'chosen') {
                    content += `[[❓//${this.name} ${id}]]`;
                } else if (card.content === DailyRoll.JACKPOT_AMOUNT) {
                    content += `[[💰//${this.name} ${id}]]`;
                } else if (card.content > 0) {
                    content += `[[💵//${this.name} ${id}]]`;
                } else {
                    content += `[[💩//${this.name} ${id}]]`;
                }

                content += '</td>';
            }
            content += '</tr>';
        }
        content += '</table>';
        // Send the message edit
        const formatter = MessageFormatter.getInstance();
        this.currentGame.gameMessage.edit(striptags(content), formatter.replaceButtons(content, false, true));
        this.room.send('message-edit', this.currentGame.gameMessage.sanitized());
    }

    private async handleBet(param: string, connection: Connection): Promise<void> {
        const cardId = parseInt(param);
        if (! this.currentGame) {
            throw new Error('Round is already finished');
        }
        if (this.currentGame.state !== 'pending') {
            throw new Error('Round has already started');
        }
        const bet = parseInt(param);
        if (bet < 0 || bet > DailyRoll.CARDS_COUNT - 1) {
            throw new Error('Invalid bet');
        }
        if (this.currentGame.cards[cardId].state !== 'pending') {
            throw new Error('Card already chosen');
        }
        if (this.currentGame.participants.indexOf(connection.session) !== -1) {
            throw new Error('You have alrady chosen');
        }
        await UserController.buy(connection.session.user, DailyRoll.ENTRY_COST);
        this.currentGame.participants.push(connection.session);
        this.currentGame.bets[connection.session.identifier] = bet;
        this.currentGame.cards[cardId].state = 'chosen';
        this.updateGameMessage();
    }
}
