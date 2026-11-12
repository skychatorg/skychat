import SQL from 'sql-template-strings';
import { DatabaseHelper } from '../../skychat/DatabaseHelper.js';
import { Logging } from '../../skychat/Logging.js';
import { User } from '../../skychat/User.js';
import { UserController } from '../../skychat/UserController.js';

export type GameMoneyKind = 'bet' | 'win' | 'refund';

/**
 * How the party games move money: the same as UserController, and every move is kept for the daily summary
 */
export class GameMoney {
    public static async bet(user: User, amount: number, reason: string): Promise<void> {
        await UserController.buy(user, amount, reason);
        await GameMoney.log(user, 'bet', amount);
    }

    public static async win(user: User, amount: number, reason: string): Promise<void> {
        await UserController.giveMoney(user, amount, reason);
        await GameMoney.log(user, 'win', amount);
    }

    /**
     * A bet handed back: the summary takes it off what was bet, it is not a win
     */
    public static async refund(user: User, amount: number, reason: string): Promise<void> {
        await UserController.giveMoney(user, amount, reason);
        await GameMoney.log(user, 'refund', amount);
    }

    /**
     * Never fails: the money has moved by now, a lost line in the summary beats a game undoing a paid bet
     */
    private static async log(user: User, kind: GameMoneyKind, amount: number): Promise<void> {
        try {
            // The date comes from here, like for messages: the database may not be on the server's timezone
            await DatabaseHelper.db.query(
                SQL`INSERT INTO game_money (user_id, kind, amount, date) VALUES (${user.id}, ${kind}, ${amount}, ${new Date()})`,
            );
        } catch (error) {
            Logging.error('Game money', error);
        }
    }
}
