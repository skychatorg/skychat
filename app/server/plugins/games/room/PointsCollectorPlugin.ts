import { Connection } from '../../../skychat/Connection';
import { RoomPlugin } from '../../RoomPlugin';
import { UserController } from '../../../skychat/UserController';
import * as striptags from 'striptags';
import { MessageFormatter } from '../../../skychat/MessageFormatter';
import { RandomGenerator } from '../../../skychat/RandomGenerator';
import { Session } from '../../../skychat/Session';
import { Message } from '../../../skychat/Message';
import { Timing } from '../../../skychat/Timing';
import { CursorPlugin } from '../global/CursorPlugin';


type GameObject = {
    gameMessage: Message | null;
    participants: Session[];
    ball: {
        pos: { x: number, y: number, },
        vel: { x: number, y: number, },
    };
    point: { x: number, y: number, };
    collectedPoints: number;
};


export class PointsCollectorPlugin extends RoomPlugin {

    static readonly GAME_DURATION: number = 30 * 1000;

    static readonly ENTRY_COST: number = 1 * 100;

    static readonly TICK_DURATION: number = 100;

    static readonly BOARD_MARGIN: number = 0.1;

    static readonly POINT_COLLISION_RADIUS: number = 0.05;

    static readonly commandName = 'pointscollector';

    readonly minRight = 0;

    readonly rules = {
        pointscollector: {
            minCount: 0,
            maxCount: 0,
            coolDown: PointsCollectorPlugin.GAME_DURATION + 4 * 60 * 1000,
            params: []
        }
    };

    private currentGame: GameObject | null = null;

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        await this.handleStart(param, connection);
    }

    /**
     * Start a new game
     */
    private async handleStart(param: string, connection: Connection): Promise<void> {

        // If a game is already in progress
        if (this.currentGame) {
            throw new Error('A round is already in progress');
        }

        // Get a reference to the cursor plugin
        const cursorPlugin = this.room.manager.getPlugin('cursor') as CursorPlugin;

        // Initialize game object
        this.currentGame = {
            gameMessage: null,
            participants: [],
            ball: {
                pos: { x: .5, y: .5 },
                vel: { x: .0, y: .0 },
            },
            point: { x: 0, y: 0 },
            collectedPoints: 0,
        };
        this.movePoint();

        // Start message
        this.currentGame.gameMessage = await this.room.sendMessage({ content: '...', user: UserController.getNeutralUser() });
        this.updateGameMessage();

        // Start game
        const gameStartDate = new Date();
        let lastTick = new Date();
        while (new Date().getTime() - gameStartDate.getTime() < PointsCollectorPlugin.GAME_DURATION) {
            const newTick = new Date();
            const delta = (newTick.getTime() - lastTick.getTime()) / 1000;
            lastTick = newTick;
            this.tick(delta, cursorPlugin);
            this.updatePositions(cursorPlugin);
            await Timing.sleep(PointsCollectorPlugin.TICK_DURATION);
        }

        // Finalize game
        this.currentGame.ball.pos.x = 1;
        this.currentGame.ball.pos.y = 1;
        this.currentGame.point.x = 1;
        this.currentGame.point.y = 1;
        this.updatePositions(cursorPlugin);

        // Send recap message
        this.currentGame.gameMessage.edit(`Finished! You collected ${this.currentGame.collectedPoints} points`);
        this.room.send('message-edit', this.currentGame.gameMessage.sanitized());

        // End game
        this.currentGame = null;
    }

    private movePoint(): void {
        if (! this.currentGame) {
            return;
        }
        this.currentGame.point.x = PointsCollectorPlugin.POINT_COLLISION_RADIUS + RandomGenerator.random(8) * (1 - PointsCollectorPlugin.POINT_COLLISION_RADIUS * 2);
        this.currentGame.point.y = PointsCollectorPlugin.POINT_COLLISION_RADIUS + RandomGenerator.random(8) * (1 - PointsCollectorPlugin.POINT_COLLISION_RADIUS * 2);
    }

    private async tick(delta: number, cursorPlugin: CursorPlugin): Promise<void> {

        if (! this.currentGame) {
            return;
        }

        const ball = this.currentGame.ball;
        const point = this.currentGame.point;

        // If ball touches point
        const pointDistance = Math.sqrt(Math.pow(ball.pos.x - point.x, 2) + Math.pow(ball.pos.y - point.y, 2));
        if (pointDistance < PointsCollectorPlugin.POINT_COLLISION_RADIUS) {
            this.movePoint();
            this.currentGame.collectedPoints ++;
            this.updateGameMessage();
        }

        // Loop ball through walls
        const margin = PointsCollectorPlugin.BOARD_MARGIN;
        if (ball.pos.x < margin) {
            ball.pos.x = margin;
            ball.vel.x = Math.abs(ball.vel.x) * .2;
        }
        if (ball.pos.x > 1 - margin) {
            ball.pos.x = 1 - margin;
            ball.vel.x = - Math.abs(ball.vel.x) * .2;
        }
        if (ball.pos.y < margin) {
            ball.pos.y = margin;
            ball.vel.y = Math.abs(ball.vel.y) * .2;
        }
        if (ball.pos.y > 1 - margin) {
            ball.pos.y = 1 - margin;
            ball.vel.y = - Math.abs(ball.vel.y) * .2;
        }

        // Build acceleration force vector from cursors
        const accForce = { x: 0, y: 0 };
        for (const identifier in cursorPlugin.cursors) {
            // Ignore bots
            if (identifier.startsWith('$')) {
                continue;
            }
            const cursorPosition = cursorPlugin.cursors[identifier];
            const distanceX = ball.pos.x - cursorPosition.x;
            const distanceY = ball.pos.y - cursorPosition.y;
            const distance = Math.sqrt(Math.pow(distanceX, 2) + Math.pow(distanceY, 2));
            if (distance > .1) {
                continue;
            }
            const angle = Math.atan2(distanceY, distanceX);
            accForce.x += .05 * Math.cos(angle) / distance;
            accForce.y += .05 * Math.sin(angle) / distance;
        }

        // Add friction
        accForce.x += - .5 * ball.vel.x;
        accForce.y += - .5 * ball.vel.y;

        // Update velocity
        ball.vel.x += accForce.x * delta;
        ball.vel.y += accForce.y * delta;

        // Update position
        ball.pos.x += ball.vel.x * delta;
        ball.pos.y += ball.vel.y * delta;
    }

    private updatePositions(cursorPlugin: CursorPlugin): void {

        if (! this.currentGame) {
            return;
        }

        // Send ball
        cursorPlugin.sendCursorPosition(
            UserController.getNeutralUser(`$${this.commandName}_ball`),
            this.currentGame.ball.pos.x,
            this.currentGame.ball.pos.y,
        );

        // Send point
        cursorPlugin.sendCursorPosition(
            UserController.getNeutralUser(`$${this.commandName}_point`),
            this.currentGame.point.x,
            this.currentGame.point.y,
        );
    }

    /**
     *
     */
    private updateGameMessage(): void {
        if (! this.currentGame || ! this.currentGame.gameMessage) {
            return;
        }
        let content = '';
        content += `Guide the ball to the point using your cursor! Collected points: ${this.currentGame.collectedPoints}`;
        // Send the message edit
        const formatter = MessageFormatter.getInstance();
        this.currentGame.gameMessage.edit(striptags(content), formatter.replaceButtons(content, false, true));
        this.room.send('message-edit', this.currentGame.gameMessage.sanitized());
    }
}
