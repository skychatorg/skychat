import {Connection} from "../../Connection";
import {Plugin} from "../../Plugin";
import {UserController} from "../../UserController";
import * as striptags from "striptags";
import {MessageFormatter} from "../../MessageFormatter";
import {RandomGenerator} from "../../RandomGenerator";
import { Session } from "../../Session";
import { Message } from "../../Message";
import { Timing } from "../../Timing";


type GameObject = {
    state: 'pending' | 'starting' | 'started';
    cars: string[];
    titleMessage: string;
    gameMessage: Message | null;
    participants: Session[],
    bets: {[identifier: string]: number};
    positions: {[carId: number]: number};
    winnerId: number | null;
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


export class RacingPlugin extends Plugin {

    static readonly CARS: string[] = [
        '🚚',
        '🚗',
        '🚴',
        '🚁',
        '🛸',
        '🐒',
        '🐄',
        '🐘',
        '🦏',
        '🐇',
        '🦕',
        '🐢',
        '⛷️',
        '🤸‍♂️'
    ];

    static readonly AVERAGE_RACE_DURATION: number = 10 * 1000;

    static readonly ENTRY_COST: number = 1 * 100;

    public static readonly GLOBAL_COOL_DOWN: number = 4 * 60 * 1000;

    readonly name = 'racing';

    readonly minRight = 20;

    readonly rules = {
        racing: {
            minCount: 1,
            maxCount: 1,
            coolDown: 500,
            params: [{name: 'action', pattern: /^(start|([0-9]+))$/}]
        }
    };

    private currentGame: GameObject | null = null;

    private lastGameFinishedDate: Date = new Date(0);

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
        if (this.lastGameFinishedDate.getTime() + RacingPlugin.GLOBAL_COOL_DOWN > new Date().getTime()) {
            const waitDuration = this.lastGameFinishedDate.getTime() + RacingPlugin.GLOBAL_COOL_DOWN - new Date().getTime();
            throw new Error(`Wait ${Timing.getDurationText(waitDuration, false, true)} seconds before launching a new round.`);
        }

        // Choose a subset of cars and initialize car positions
        const chosenCars = RacingPlugin.CARS.slice(0).sort(() => Math.random() - .5).slice(0, 4);
        const carPositions: {[carId: number]: number} = {};
        for (let i = 0; i < chosenCars.length; ++ i) { carPositions[i] = 0; }

        // Initialize game object
        this.currentGame = {
            state: 'pending',
            titleMessage: 'Choose your car',
            cars: chosenCars,
            gameMessage: null,
            participants: [],
            bets: {},
            positions: carPositions,
            winnerId: null,
        };

        // Wait for participants
        this.currentGame.gameMessage = await this.room.sendMessage({content: `...`, user: UserController.getNeutralUser()});
        this.updateGameMessage();

        // Let users the time to participate
        for (let i = 0; i < 15 + 1; ++ i) {
            this.currentGame.titleMessage = `Choose your car (${15 - i}s left) - Entry cost: $${RacingPlugin.ENTRY_COST / 100}`;
            this.updateGameMessage();
            await waitTimeout(1000);
        }

        // If not enough participants
        if (this.currentGame.participants.length === 0) {
            this.currentGame.gameMessage.edit('Not enough participants. Aborting.');
            this.room.send('message-edit', this.currentGame.gameMessage.sanitized());
            this.currentGame = null;
            return;
        }

        // Display list of participants and prepare cars
        this.currentGame.state = 'starting';
        for (let i = 0; i < 3 + 1; ++ i) {
            this.currentGame.titleMessage = `Starting in ${3 - i}s`;
            this.updateGameMessage();
            await waitTimeout(1000);
        }
        
        // Run actual race car
        this.currentGame.titleMessage = '🚩 Goooo 🚩';
        this.currentGame.state = 'started';
        this.updateGameMessage();
        await waitTimeout(1000);
        const tickDuration = 1000 / 4;
        const percentPerTick = tickDuration / RacingPlugin.AVERAGE_RACE_DURATION * this.currentGame.cars.length;
        while (true) {
            // Decide which car will move this tick
            const chosenCarId = Math.floor(RandomGenerator.random(8) * this.currentGame.cars.length);
            // Move the car
            this.currentGame.positions[chosenCarId] += percentPerTick;
            this.updateGameMessage();
            // If car has arrived
            if (this.currentGame.positions[chosenCarId] >= 1) {
                this.currentGame.positions[chosenCarId] = 1;
                this.currentGame.winnerId = chosenCarId;
                break;
            }
            await waitTimeout(500);
        }

        // Get winner list
        const winners = this.currentGame.participants
            .filter(session => this.currentGame && this.currentGame.bets[session.identifier] === this.currentGame.winnerId);
        let content = ``;
        if (winners.length > 0) {
            content += `Winners:<br>`;
            const amount = RacingPlugin.ENTRY_COST * this.currentGame.cars.length;
            for (const winner of winners) {
                content += `- ${winner.identifier} (+ $${amount / 100})<br>`;
                UserController.giveMoney(winner.user, amount);
            }
        } else {
            content += `Nobody won :)`;
        }
        this.currentGame.gameMessage.append(striptags(content), content);
        this.room.send('message-edit', this.currentGame.gameMessage.sanitized());

        // End game
        this.currentGame = null;
        this.lastGameFinishedDate = new Date();
    }

    /**
     *
     */
    private updateGameMessage(): void {
        if (! this.currentGame || ! this.currentGame.gameMessage) {
            return;
        }
        const roadWidth = 50;
        // Display game board
        let content = this.currentGame.titleMessage + '<br>';
        content += '- '.repeat(roadWidth / 2 + 3) + '🚩<br>';
        for (let carId = 0; carId < this.currentGame.cars.length; ++ carId) {
            const carEmoji = `<div style="display:inline-block;-webkit-transform:rotateY(180deg);-moz-transform:rotateY(180deg);-o-transform:rotateY(180deg);-ms-transform:rotateY(180deg);">${this.currentGame.cars[carId]}</div>`;
            const dashCount = Math.floor(this.currentGame.positions[carId] * roadWidth / 2);
            // add button so that users can bet on this car
            content += `[[→//${this.name} ${carId}]] `;
            content += '· '.repeat(dashCount) + carEmoji;
            // find participants that bet on this car
            const identifiers = Object.entries(this.currentGame.bets)
            .filter(entry => entry[1] === carId)
            .map(entry => entry[0]);
            if (identifiers.length > 0) {
                content += ` (${identifiers.join(', ')})`;
            }
            content += '<br>';
        }
        content += '- '.repeat(roadWidth / 2 + 3) + '🚩<br>';
        // Send the message edit
        const formatter = MessageFormatter.getInstance();
        this.currentGame.gameMessage.edit(striptags(content), formatter.replaceButtons(content, false, true));
        this.room.send('message-edit', this.currentGame.gameMessage.sanitized());
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
        const bet = parseInt(param);
        if (bet < 0 || bet > this.currentGame.cars.length - 1) {
            throw new Error('Invalid bet');
        }
        if (this.currentGame.participants.indexOf(connection.session) === -1) {
            // If first vote, pay the price
            await UserController.buy(connection.session.user, RacingPlugin.ENTRY_COST);
            this.currentGame.participants.push(connection.session);
        }
        this.currentGame.bets[connection.session.identifier] = bet;
        this.updateGameMessage();
    }
}
