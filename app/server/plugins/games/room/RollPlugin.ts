import { Connection } from '../../../skychat/Connection.js';
import { RoomPlugin } from '../../RoomPlugin.js';
import { Message } from '../../../skychat/Message.js';
import { UserController } from '../../../skychat/UserController.js';
import { Session } from '../../../skychat/Session.js';
import striptags from 'striptags';
import { MessageFormatter } from '../../../skychat/MessageFormatter.js';
import { Room } from '../../../skychat/Room.js';
import { RandomGenerator } from '../../../skychat/RandomGenerator.js';
import { Timing } from '../../../skychat/Timing.js';

type GameObject = {
    state: 'pending' | 'running';
    ballPosition: number;
    rollMessage: Message | null;
    participants: Session[];
    bets: { [identifier: string]: number };
    finalPosition: number | null;
};

/**
 * Utility function to wait a certain delay in ms
 * @param delay
 */
const waitTimeout = (delay: number) => {
    return new Promise((resolve) => {
        setTimeout(resolve, delay);
    });
};

export class RollPlugin extends RoomPlugin {
    public static readonly ENTRY_COST: number = 100;

    public static readonly BASE_JACKPOT: number = 1000;

    public static readonly JACKPOT_INCREASE_AMOUNT: number = 100;

    public static readonly GLOBAL_COOL_DOWN: number = 4 * 60 * 1000;

    public static readonly TICK_MS: number[] = Array.from({ length: 3000 / 150 })
        .map((_, i) => (1 + i) * 150)
        .concat([3048, 3180, 3307, 3440, 3576, 3723, 3881, 4040, 4209, 4398, 4603, 4834, 5084, 5372, 5744, 6413, 7621]);

    static readonly commandName = 'roll';

    readonly minRight = 0;

    readonly rules = {
        roll: {
            minCount: 1,
            maxCount: 1,
            coolDown: 500,
            params: [{ name: 'action', pattern: /^(start|([0-9]+))$/ }],
        },
    };

    private currentGame: GameObject | null = null;

    private lastGameFinishedDate: Date = new Date(0);

    protected storage = {
        lastGameResults: Array.from({ length: 10 }).map(() => 0),
        currentJackpot: RollPlugin.BASE_JACKPOT,
        totalGameCount: 0,
    };

    constructor(room: Room) {
        super(room);

        if (this.room) {
            this.loadStorage();
        }
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        if (param === 'start') {
            await this.handleStart();
            return;
        }

        await this.handleBet(param, connection);
    }

    /**
     * Start a new game
     */
    private async handleStart(): Promise<void> {
        // If a game is already in progress
        if (this.currentGame) {
            throw new Error('A round is already in progress');
        }

        // If last game finished less than 4 minute before
        if (this.lastGameFinishedDate.getTime() + RollPlugin.GLOBAL_COOL_DOWN > new Date().getTime()) {
            const waitDuration = this.lastGameFinishedDate.getTime() + RollPlugin.GLOBAL_COOL_DOWN - new Date().getTime();
            throw new Error(`Wait ${Timing.getDurationText(waitDuration, false, true)} seconds before launching a new round.`);
        }

        // Initialize game object
        this.currentGame = {
            state: 'pending',
            ballPosition: -1,
            rollMessage: null,
            bets: {},
            participants: [],
            finalPosition: null,
        };

        // Build and send the intro message
        let introMessageContent = '';
        introMessageContent += `
        -> New round (roll). To bet on a specific slot, click on one of the button below:<br>
        <table class="skychat-table">
            <tr>
                ${Array.from({ length: 10 })
                    .map((_: any, i: number) => `<td>[[slot ${i}//${this.commandName} ${i}]]</td>`)
                    .join(' ')}
            </tr>
        </table>`;
        const formatter = MessageFormatter.getInstance();
        introMessageContent = formatter.replaceButtons(introMessageContent, false, true);
        const introMessage = await this.room.sendMessage({
            content: striptags(introMessageContent),
            formatted: introMessageContent,
            user: UserController.getNeutralUser(),
        });

        // Wait for participants
        this.currentGame.rollMessage = await this.room.sendMessage({
            content: '...',
            user: UserController.getNeutralUser(),
        });
        this.updateGameMessage();
        await waitTimeout(30 * 1000);

        // If not enough participants
        if (this.currentGame.participants.length === 0) {
            await this.room.sendMessage({
                content: 'Not enough participants. Aborting.',
                user: UserController.getNeutralUser(),
            });
            this.currentGame = null;
            return;
        }

        // Start actual round
        introMessage.edit('deleted', '<s>deleted</s>');
        this.room.send('message-edit', introMessage.sanitized());
        this.currentGame.state = 'running';
        this.currentGame.ballPosition = Math.floor(RandomGenerator.random(8) * 10);

        // Initialize board
        this.updateGameMessage();
        this.room.send('roll', { state: true });
        await waitTimeout(100);

        // The timeout will increase randomly until reaching maxTimeout
        for (const tickMs of RollPlugin.TICK_MS) {
            setTimeout(() => {
                // Move ball to next slot
                this.currentGame!.ballPosition = ++this.currentGame!.ballPosition % 10;

                // Redraw game
                this.updateGameMessage();
            }, tickMs);
        }

        // Wait for latest tick to complete
        await waitTimeout(RollPlugin.TICK_MS[RollPlugin.TICK_MS.length - 1]);

        // Get winner list
        this.currentGame.rollMessage.append(`\nRound ended. Ball position: ${this.currentGame.ballPosition}`);
        let content = 'Results:\n';
        let winnerCount = 0;
        for (const identifier of Object.keys(this.currentGame.bets)) {
            const session = this.currentGame.participants.find((session) => session.identifier === identifier);
            if (!session) {
                // Not supposed to happen
                continue;
            }
            const bet = this.currentGame.bets[identifier];
            const won = bet === this.currentGame.ballPosition;
            if (won) {
                await UserController.giveMoney(session.user, this.storage.currentJackpot);
                content += `- ${identifier} won $${this.storage.currentJackpot / 100}\n`;
                winnerCount++;
            } else {
                content += `- ${identifier} lost\n`;
            }
        }
        // If no winner and enough participants, increase jackpot
        if (winnerCount === 0 && this.currentGame.participants.length > 1) {
            this.storage.currentJackpot += RollPlugin.JACKPOT_INCREASE_AMOUNT;
        }
        // If winners, reset jackpot
        if (winnerCount > 0) {
            this.storage.currentJackpot = RollPlugin.BASE_JACKPOT;
        }
        this.currentGame.rollMessage.append(content);
        this.room.send('message-edit', this.currentGame.rollMessage.sanitized());
        this.room.send('roll', { state: false });
        this.storage.lastGameResults[this.currentGame.ballPosition]++;
        this.lastGameFinishedDate = new Date();
        this.storage.totalGameCount++;
        this.currentGame = null;
        this.syncStorage();
    }

    /**
     *
     */
    private updateGameMessage(): void {
        if (!this.currentGame || !this.currentGame.rollMessage) {
            return;
        }
        // Display information about current round
        let content = `Current jackpot: $${this.storage.currentJackpot / 100}<br>`;
        content += 'Participants:<br>';
        for (const session of this.currentGame.participants) {
            content += `- ${session.user.username} (${this.currentGame.bets[session.identifier]})<br>`;
        }
        const ballPosition = this.currentGame.ballPosition;
        const bets = Object.values(this.currentGame.bets);
        content += `
        <br>
        <table class="skychat-table">
            <tr>
                ${Array.from({ length: 10 })
                    .map((_: any, i: number) => `<td>${i === ballPosition ? '&nbsp;&nbsp;&nbsp;↓' : ''}</td>`)
                    .join(' ')}
            </tr>
            <tr>
                ${Array.from({ length: 10 })
                    .map((_: any, i: number) => `<td>slot ${i}</td>`)
                    .join(' ')}
            </tr>
            <tr>
                ${Array.from({ length: 10 })
                    .map(
                        (_: any, i: number) =>
                            `<td>${
                                bets.filter((bet) => bet === i).length === 0
                                    ? ''
                                    : '&nbsp;&nbsp;&nbsp;' + bets.filter((bet) => bet === i).length
                            }</td>`,
                    )
                    .join(' ')}
            </tr>
            <tr>
                ${Array.from({ length: 10 })
                    .map(
                        (_: any, i: number) =>
                            `<td>${Math.floor(100 * (this.storage.lastGameResults[i] / (this.storage.totalGameCount || 1)))}%</td>`,
                    )
                    .join(' ')}
            </tr>
        </table>`;
        // Update message
        this.currentGame.rollMessage.edit(striptags(content), content);
        this.room.send('message-edit', this.currentGame.rollMessage.sanitized());
    }

    /**
     * Guess a number
     * @param param
     * @param connection
     */
    private async handleBet(param: string, connection: Connection): Promise<void> {
        if (!this.currentGame) {
            throw new Error('Round is already finished');
        }
        if (this.currentGame.state !== 'pending') {
            throw new Error('Round has already started');
        }
        if (this.currentGame.participants.indexOf(connection.session) >= 0) {
            throw new Error('You have already chosen');
        }
        const bet = parseInt(param);
        if (bet < 0 || bet > 10) {
            throw new Error('Number should be between 0 and 1000');
        }
        await UserController.buy(connection.session.user, RollPlugin.ENTRY_COST);
        this.currentGame.participants.push(connection.session);
        this.currentGame.bets[connection.session.identifier] = bet;
        this.updateGameMessage();
    }
}
