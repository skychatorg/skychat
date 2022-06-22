import {Connection} from "../../../skychat/Connection";
import {RoomPlugin} from "../../RoomPlugin";
import {UserController} from "../../../skychat/UserController";
import {Message} from "../../../skychat/Message";
import {Session} from "../../../skychat/Session";
import {RandomGenerator} from "../../../skychat/RandomGenerator";


type GameObject = {
    state: 'pending' | 'running',
    startedDate: Date,
    secretNumber: number,
    participants: Session[],
    participantListMessage: Message | null,
    guesses: {[identifier: string]: number},
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


export class GuessTheNumberPlugin extends RoomPlugin {

    public static readonly ENTRY_COST: number = 100;

    static readonly commandName = 'guess';

    readonly minRight = 20;

    readonly rules = {
        guess: {
            minCount: 1,
            maxCount: 1,
            coolDown: 1000,
            params: [{name: 'action', pattern: /^(start|join|([0-9]+))$/}]
        }
    };

    private currentGame: GameObject | null = null;

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        if (param === 'start') {
            await this.handleStart(param, connection);
            return;
        }

        if (param === 'join') {
            await this.handleJoin(param, connection);
            return;
        }

        await this.handleGuess(param, connection);
    }

    /**
     * Start a new game
     */
    private async handleStart(param: string, connection: Connection): Promise<void> {
        if (this.currentGame) {
            throw new Error('A round is already in progress');
        }

        // Start the game
        this.currentGame = {
            state: 'pending',
            startedDate: new Date(),
            secretNumber: Math.floor(RandomGenerator.random(8) * 1000),
            participants: [],
            participantListMessage: null,
            guesses: {}
        };

        // Wait for participants
        await this.room.sendMessage({
            content: `:d) New round (guess the number) :d) [[Participate (entry cost: ${GuessTheNumberPlugin.ENTRY_COST / 100}$)//${this.commandName} join]]`,
            user: UserController.getNeutralUser()
        });
        this.currentGame.participantListMessage = await this.room.sendMessage({
            content: `Participants:`,
            user: UserController.getNeutralUser()
        });
        await waitTimeout(30 * 1000);

        // If not enough participants
        if (this.currentGame.participants.length <= 1) {
            await this.room.sendMessage({
                content: `Not enough participants. Aborting.`,
                user: UserController.getNeutralUser()
            });
            // Refund users
            for (const session of this.currentGame.participants) {
                await UserController.giveMoney(session.user, GuessTheNumberPlugin.ENTRY_COST);
            }
            this.currentGame = null;
            return;
        }

        // Start actual round
        this.currentGame.state = 'running';
        await this.room.sendMessage({
            content: `:alerte: Round started :alerte:\nGuess the number between 0 and 1000 by sending ./guess {nb}\nExample:\n/guess 423`,
            user: UserController.getNeutralUser(),
            quoted: this.currentGame.participantListMessage
        });

        // Wait for people to guess the number
        await waitTimeout(15 * 1000);
        await this.room.sendMessage({
            content: `10 more seconds to guess`,
            user: UserController.getNeutralUser()
        });
        await waitTimeout(10 * 1000);

        // Revelate guesses
        let content = `Guesses:\n`;
        for (const identifier of Object.keys(this.currentGame.guesses)) {
            content += `- ${identifier}: ${this.currentGame.guesses[identifier]}\n`;
        }
        content += `Number was ${this.currentGame.secretNumber} :zoomix:`;
        await this.room.sendMessage({content, user: UserController.getNeutralUser()});

        // Find winner
        let currentWinners: string[] = [];
        let currentWinnerDistance: number = Infinity;
        for (const identifier of Object.keys(this.currentGame.guesses)) {
            const guess = this.currentGame.guesses[identifier];
            const distance = Math.abs(this.currentGame.secretNumber - guess);
            if (distance === currentWinnerDistance) {
                currentWinners.push(identifier);
            } else if (distance < currentWinnerDistance) {
                currentWinners = [identifier];
                currentWinnerDistance = distance;
            }
        }

        if (currentWinners.length === 0) {
            // If no winner
            await this.room.sendMessage({content: `No winner this time :)`, user: UserController.getNeutralUser()});

        } else {
            const jackpot = Math.floor(this.currentGame.participants.length * GuessTheNumberPlugin.ENTRY_COST / currentWinners.length);
            // If winner
            for (const identifier of currentWinners) {
                const session = this.currentGame.participants.find(session => session.identifier === identifier);
                if (! session) {
                    continue;
                }
                await UserController.giveMoney(session.user, jackpot);
            }
            await this.room.sendMessage({
                content: `${currentWinners.join(', ')} won this round :) ${currentWinners.length > 1 ? 'They' : 'He'} earned \$${jackpot / 100}`,
                user: UserController.getNeutralUser()
            });
        }

        await this.room.sendMessage({content: `Round ended`, user: UserController.getNeutralUser()});
        this.currentGame = null;
    }

    /**
     * Join this round
     * @param param
     * @param connection
     */
    private async handleJoin(param: string, connection: Connection): Promise<void> {
        if (! this.currentGame) {
            throw new Error('Round is already finished');
        }
        if (this.currentGame.state !== 'pending' || ! this.currentGame.participantListMessage) {
            throw new Error('Round has already started');
        }
        if (this.currentGame.participants.indexOf(connection.session) >= 0) {
            throw new Error('You are already in this round');
        }
        await UserController.buy(connection.session.user, GuessTheNumberPlugin.ENTRY_COST);
        this.currentGame.participants.push(connection.session);
        this.currentGame.participantListMessage.append('- ' + connection.session.user.username);
        this.room.send('message-edit', this.currentGame.participantListMessage.sanitized());
    }

    /**
     * Guess a number
     * @param param
     * @param connection
     */
    private async handleGuess(param: string, connection: Connection): Promise<void> {
        if (! this.currentGame) {
            throw new Error('Round is already finished');
        }
        if (this.currentGame.state !== 'running') {
            throw new Error('Round has already started');
        }
        if (this.currentGame.participants.indexOf(connection.session) === -1) {
            throw new Error('You did not join this round');
        }
        const guess = parseInt(param);
        if (guess < 0 || guess > 1000) {
            throw new Error('Number should be between 0 and 1000');
        }
        this.currentGame.guesses[connection.session.identifier] = guess;
        connection.send('message', UserController.createNeutralMessage({content: 'Guess: ' + guess, room: this.room.id, id: 0}).sanitized());
    }
}
