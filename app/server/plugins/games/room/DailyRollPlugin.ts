import { Connection } from '../../../skychat/Connection';
import { RoomPlugin } from '../../RoomPlugin';
import { UserController } from '../../../skychat/UserController';
import { Room } from '../../../skychat/Room';
import { Message } from '../../../skychat/Message';
import { Session } from '../../../skychat/Session';
import { MessageFormatter } from '../../../skychat/MessageFormatter';
import striptags from 'striptags';
import { RandomGenerator } from '../../../skychat/RandomGenerator';
import { Timing } from '../../../skychat/Timing';

type GameObject = {
    // Current game state
    state: 'pending' | 'started';

    // Global game message
    gameMessage: Message | null;

    // All sessions that have already chosed a card
    participants: Session[];

    // Card ids goes from 0 to CARDS_COUNT - 1
    cards: { [cardId: number]: { state: 'pending' | 'chosen' | 'shown'; content: number } };

    // Bets from users
    bets: { [identifier: string]: number };
};

export class DailyRollPlugin extends RoomPlugin {
    /**
     * Scheduled time in hours. E.g. 2.5 means 2h30
     */
    public static readonly SCHEDULED_TIME: number = 21.5;

    public static readonly JACKPOT_AMOUNT: number = 50 * 100;

    public static readonly BOARD_WIDTH: number = 6;

    public static readonly BOARD_HEIGHT: number = 5;

    public static readonly CARDS_COUNT: number = DailyRollPlugin.BOARD_WIDTH * DailyRollPlugin.BOARD_HEIGHT;

    static readonly commandName = 'dailyroll';

    readonly minRight = 0;

    readonly rules = {
        dailyroll: {
            minCount: 1,
            maxCount: 1,
            coolDown: 1000,
            params: [{ name: 'bet', pattern: /^([0-9]+)$/ }],
        },
    };

    private currentGame: GameObject | null = null;

    constructor(room: Room) {
        super(room);

        // @TODO implement plugins / room
        if (this.room.id === 0) {
            this.armTimer();
        }
    }

    getCardCoordinates(cardId: number): { x: number; y: number } {
        return {
            x: cardId % DailyRollPlugin.BOARD_WIDTH,
            y: Math.floor(cardId / DailyRollPlugin.BOARD_WIDTH),
        };
    }

    getCardId(x: number, y: number): number {
        return y * DailyRollPlugin.BOARD_WIDTH + x;
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        await this.handleBet(param, connection);
    }

    private armTimer(): void {
        const now = new Date().getHours() + new Date().getMinutes() / 60;
        let duration = DailyRollPlugin.SCHEDULED_TIME - now;
        if (duration < 0) {
            duration += 24;
        }
        setTimeout(this.start.bind(this), duration * 60 * 60 * 1000);
    }

    async start(): Promise<void> {
        // Wait for at least 1 user to be there
        while (this.room.connections.filter((connection) => connection.session.isAlive()).length === 0) {
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
        for (let cardId = 0; cardId < DailyRollPlugin.CARDS_COUNT; ++cardId) {
            this.currentGame.cards[cardId] = {
                state: 'pending',
                content: Math.floor(RandomGenerator.random(8) * 6) * 100,
            };
        }

        // Decide jackpot card
        const jackpotCardId = Math.floor(RandomGenerator.random(8) * DailyRollPlugin.CARDS_COUNT);
        this.currentGame.cards[jackpotCardId].content = DailyRollPlugin.JACKPOT_AMOUNT;

        // Send base message
        this.currentGame.gameMessage = await this.room.sendMessage({ content: '...', user: UserController.getNeutralUser() });
        this.updateGameMessage();

        // Wait for 30 seconds
        while (this.currentGame.participants.length === 0) {
            await Timing.sleep(30 * 1000);
        }
        const lastMessage = await this.room.sendMessage({ content: 'Hurry up, only 5 more seconds to chose your daily card', user: UserController.getNeutralUser() });
        await Timing.sleep(5 * 1000);

        // End chosing state
        this.currentGame.state = 'started';

        // Automatically choose a card for remaining users
        // Find the sessions in this room that did not vote
        const sessions: Session[] = Array.from(new Set(this.room.connections.map((connection) => connection.session)))
            .filter((session) => session.user.right >= 0)
            .filter((session) => typeof this.currentGame!.bets[session.identifier] === 'undefined');
        // Automatically vote for these sessions
        for (const session of sessions) {
            // If all cards chosen
            if (Object.values(this.currentGame.bets).length >= DailyRollPlugin.CARDS_COUNT) {
                break;
            }
            // Choose a random free card
            let randomCardId = Math.floor(RandomGenerator.random(8) * DailyRollPlugin.CARDS_COUNT);
            while (this.currentGame.cards[randomCardId]!.state !== 'pending') {
                // Find next card, cycling to 0 if exceeding last card
                if (++randomCardId > DailyRollPlugin.CARDS_COUNT - 1) {
                    randomCardId = 0;
                }
            }
            this.currentGame.participants.push(session);
            this.currentGame.bets[session.identifier] = randomCardId;
            this.currentGame.cards[randomCardId].state = 'chosen';
        }

        // Re-create game message
        this.currentGame.gameMessage.edit('deleted', '<s>deleted</s>');
        this.room.send('message-edit', this.currentGame.gameMessage.sanitized());
        this.currentGame.gameMessage = await this.room.sendMessage({ content: '...', user: UserController.getNeutralUser() });
        this.updateGameMessage();

        // Reveal cards which were not chosen
        lastMessage.edit('Too late! Now revealing cards..');
        this.room.send('message-edit', lastMessage.sanitized());
        await Timing.sleep(2 * 1000);
        for (let y = 0; y < DailyRollPlugin.BOARD_HEIGHT; ++y) {
            for (let x = 0; x < DailyRollPlugin.BOARD_WIDTH; ++x) {
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
        if (!this.currentGame || !this.currentGame.gameMessage) {
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
        content += '<tr>' + '<th style="width: 30px"></th>'.repeat(DailyRollPlugin.BOARD_WIDTH) + '</tr>';
        for (let y = 0; y < DailyRollPlugin.BOARD_HEIGHT; ++y) {
            content += '<tr>';
            for (let x = 0; x < DailyRollPlugin.BOARD_WIDTH; ++x) {
                const id = this.getCardId(x, y);
                const card = this.currentGame.cards[id];
                content += '<td>';

                // Display this specific card
                if (card.state === 'pending') {
                    content += `[[❔//${this.commandName} ${id}]]`;
                } else if (card.state === 'chosen') {
                    content += `[[❓//${this.commandName} ${id}]]`;
                } else if (card.content === DailyRollPlugin.JACKPOT_AMOUNT) {
                    content += `[[💰//${this.commandName} ${id}]]`;
                } else if (card.content > 0) {
                    content += `[[💵//${this.commandName} ${id}]]`;
                } else {
                    content += `[[💩//${this.commandName} ${id}]]`;
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
        if (!this.currentGame) {
            throw new Error('Round is already finished');
        }
        if (this.currentGame.state !== 'pending') {
            throw new Error('Round has already started');
        }
        if (cardId < 0 || cardId > DailyRollPlugin.CARDS_COUNT - 1) {
            throw new Error('Invalid bet');
        }
        if (this.currentGame.cards[cardId].state !== 'pending') {
            throw new Error('Card already chosen');
        }
        if (this.currentGame.participants.indexOf(connection.session) !== -1) {
            throw new Error('You have alrady chosen');
        }
        this.currentGame.participants.push(connection.session);
        this.currentGame.bets[connection.session.identifier] = cardId;
        this.currentGame.cards[cardId].state = 'chosen';
        this.updateGameMessage();
    }
}
