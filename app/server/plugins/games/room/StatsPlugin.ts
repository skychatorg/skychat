import { RoomPlugin } from '../../RoomPlugin.js';
import { UserController } from '../../../skychat/UserController.js';
import { User } from '../../../skychat/User.js';
import { Session } from '../../../skychat/Session.js';
import { Config } from '../../../skychat/Config.js';

export class StatsPlugin extends RoomPlugin {
    static readonly AVERAGE_BOOK_READ_TIME: number = 60 * 5;

    static readonly AVERAGE_MOVIE_WATCH_TIME: number = 60 * 2;

    static readonly AVERAGE_MARATHON_RUN_TIME: number = 60 * 4;

    static readonly commandName = 'stats';

    readonly minRight = Config.PREFERENCES.minRightForConnectedList;

    readonly rules = {
        stats: {
            minCount: 1,
            maxCount: 2,
            coolDown: 1000,
            params: [{ name: 'username', pattern: User.USERNAME_REGEXP }],
        },
    };

    /**
     * Displays a funny message about the number of minutes a user has spent on the tchat
     * @param alias
     * @param username
     * @param connection
     */
    async run(alias: string, username: string): Promise<void> {
        const session = Session.getSessionByIdentifier(username);
        if (!session) {
            // If user doesn't exist
            throw new Error('Username not found');
        }

        const xp = session.user.xp;
        const minCount = xp;
        const hourCount = Math.floor(xp / 60);
        const dayCount = Math.floor(xp / 1440);
        const weekCount = Math.floor(xp / 10080);
        const bookCount = Math.floor(xp / StatsPlugin.AVERAGE_BOOK_READ_TIME);
        const movieCount = Math.floor(xp / StatsPlugin.AVERAGE_MOVIE_WATCH_TIME);
        const marathonCount = Math.floor(xp / StatsPlugin.AVERAGE_MARATHON_RUN_TIME);

        const messageContent = `${session.user.username} spent ${minCount} ${
            minCount > 1 ? 'minutes' : 'minute'
        } here, that's ${hourCount} ${hourCount > 1 ? 'hours' : 'hour'}, ${dayCount} ${dayCount > 1 ? 'days' : 'day'} or ${weekCount} ${
            weekCount > 1 ? 'weeks' : 'week'
        }! During this time, he could have:
            - read ${bookCount} ${bookCount > 1 ? 'books' : 'book'} 📖
            - watched ${movieCount} ${movieCount > 1 ? 'movies' : 'movie'} 🎥
            - run ${marathonCount} ${marathonCount > 1 ? 'marathons' : 'marathon'} 🏃        
        `;

        await this.room.sendMessage({
            content: `${messageContent}`,
            user: UserController.getNeutralUser(),
        });
    }
}
