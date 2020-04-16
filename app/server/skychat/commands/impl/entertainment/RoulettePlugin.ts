import {Connection} from "../../../Connection";
import {Plugin} from "../../Plugin";
import {Message} from "../../../Message";
import {UserController} from "../../../UserController";
import {Session} from "../../../Session";
import * as striptags from "striptags";
import {MessageFormatter} from "../../../MessageFormatter";


type GameObject = {
    state: 'pending' | 'running';
    ballPosition: number;
    rouletteMessage: Message | null;
    participants: Session[],
    bets: {[identifier: string]: number};
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


export class RoulettePlugin extends Plugin {

    public static readonly ENTRY_COST: number = 100;

    public static readonly REWARD_AMOUNT: number = 1004;

    readonly name = 'roulette';

    readonly minRight = 0;

    readonly rules = {
        roulette: {
            minCount: 1,
            maxCount: 1,
            coolDown: 500,
            params: [{name: 'action', pattern: /^(start|([0-9]+))$/}]
        }
    };

    private currentGame: GameObject | null = null;

    private lastGameFinishedDate: Date = new Date(0);

    private lastGameResults: number[] = Array.from({length: 10}).map(() => 0);

    private totalGameCount: number = 0;

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        if (param === 'start') {
            await this.handleStart(param, connection);
            return;
        }

        await this.handleBet(param, connection);
    }

    /**
     * Start a new game
     */
    private async handleStart(param: string, connection: Connection): Promise<void> {

        // If a game is already in progress
        if (this.currentGame) {
            throw new Error('A round is already in progress');
        }

        // If last game finished less than 4 minute before
        if (this.lastGameFinishedDate.getTime() + 4 * 60 * 1000 > new Date().getTime()) {
            throw new Error('A game was launched in the last 4 minutes. Wait a bit.');
        }

        // Initialize game object
        this.currentGame = {
            state: 'pending',
            ballPosition: 0,
            rouletteMessage: null,
            bets: {},
            participants: [],
            finalPosition: null
        };

        // Build and send the intro message
        let introMessageContent = ``;
        introMessageContent += `
        -> New round (roulette). To bet on a specific slot, click on one of the button below:<br>
        <table class="skychat-table">
            <tr>
                ${Array.from({length:10}).map((_: any, i: number) => `<td>[[slot ${i}//${this.name} ${i}]]</td>`).join(' ')}
            </tr>
        </table>`;
        const formatter = MessageFormatter.getInstance();
        introMessageContent = formatter.replaceButtons(introMessageContent);
        const introMessage = await this.room.sendMessage(striptags(introMessageContent), introMessageContent, UserController.getNeutralUser(), null);

        // Wait for participants
        this.currentGame.rouletteMessage = await this.room.sendMessage(`...`, null, UserController.getNeutralUser(), null);
        this.updateGameMessage();
        await waitTimeout(30 * 1000);

        // If not enough participants
        if (this.currentGame.participants.length === 0) {
            await this.room.sendMessage(`Not enough participants. Aborting.`, null, UserController.getNeutralUser(), null);
            this.currentGame = null;
            return;
        }

        // Start actual round
        introMessage.edit('deleted', `<i>deleted</i>`);
        this.room.send('message-edit', introMessage.sanitized());
        this.currentGame.state = 'running';

        // Initialize board
        this.updateGameMessage();

        // The timeout will increase randomly until reaching maxTimeout
        let currentTimeout: number = 50;
        const maxTimeout: number = 2000;
        while (currentTimeout < maxTimeout) {

            // Move ball to next slot
            this.currentGame.ballPosition = (++this.currentGame.ballPosition) % 10;

            // Redraw game
            this.updateGameMessage();

            // Increase timeout
            currentTimeout += currentTimeout * (.20 * Math.random());

            // Wait a bit
            await waitTimeout(currentTimeout);
        }

        // Get winner list
        this.currentGame.rouletteMessage.append(`\nRound ended. Ball position: ${this.currentGame.ballPosition}`);
        let content = `Results:\n`;
        for (const identifier of Object.keys(this.currentGame.bets)) {
            const session = this.currentGame.participants.find(session => session.identifier === identifier);
            if (! session) {
                // Not supposed to happen
                continue;
            }
            const bet = this.currentGame.bets[identifier];
            const won = bet === this.currentGame.ballPosition;
            if (won) {
                await UserController.giveMoney(session.user, RoulettePlugin.REWARD_AMOUNT);
                content += `- ${identifier} won $${RoulettePlugin.REWARD_AMOUNT / 100}\n`;
            } else {
                content += `- ${identifier} lost\n`;
            }
        }
        this.currentGame.rouletteMessage.append(content);
        this.room.send('message-edit', this.currentGame.rouletteMessage.sanitized());
        this.lastGameResults[this.currentGame.ballPosition] ++;
        this.lastGameFinishedDate = new Date();
        this.totalGameCount ++;
        this.currentGame = null;
    }

    /**
     *
     */
    private updateGameMessage(): void {
        if (! this.currentGame || ! this.currentGame.rouletteMessage) {
            return;
        }
        // Display participants
        let content = `Participants:<br>`;
        for (const session of this.currentGame.participants) {
            content += `- ${session.user.username} (${this.currentGame.bets[session.identifier]})<br>`;
        }
        const ballPosition = this.currentGame.ballPosition;
        const bets = Object.values(this.currentGame.bets);
        content += `
        <br>
        <table class="skychat-table">
            <tr>
                ${Array.from({length:10}).map((_: any, i: number) => `<td>${i === ballPosition ? '&nbsp;&nbsp;&nbsp;↓' : ''}</td>`).join(' ')}
            </tr>
            <tr>
                ${Array.from({length:10}).map((_: any, i: number) => `<td>slot ${i}</td>`).join(' ')}
            </tr>
            <tr>
                ${Array.from({length:10}).map((_: any, i: number) => `<td>${bets.filter(bet => bet === i).length === 0 ? '' : ('&nbsp;&nbsp;&nbsp;' + bets.filter(bet => bet === i).length)}</td>`).join(' ')}
            </tr>
            <tr>
                ${Array.from({length:10}).map((_: any, i: number) => `<td>${Math.floor(100 * (this.lastGameResults[i] / (this.totalGameCount || 1)))}%</td>`).join(' ')}
            </tr>
        </table>`;
        // Update message
        this.currentGame.rouletteMessage.edit(striptags(content), content);
        this.room.send('message-edit', this.currentGame.rouletteMessage.sanitized());
    }

    /**
     * Guess a number
     * @param param
     * @param connection
     */
    private async handleBet(param: string, connection: Connection): Promise<void> {
        if (! this.currentGame) {
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
        await UserController.buy(connection.session.user, RoulettePlugin.ENTRY_COST);
        this.currentGame.participants.push(connection.session);
        this.currentGame.bets[connection.session.identifier] = bet;
        this.updateGameMessage();
    }
}
