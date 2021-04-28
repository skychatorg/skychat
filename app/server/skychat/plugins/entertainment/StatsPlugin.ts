import {Connection} from "../../Connection";
import {Plugin} from "../../Plugin";
import {UserController} from "../../UserController";
import {User} from "../../User";
import {Session} from "../../Session";
import {Config} from "../../Config";

export class StatsPlugin extends Plugin {

    static readonly AVERAGE_BOOK_READ_TIME: number = 60 * 5; 

    static readonly AVERAGE_MOVIE_WATCH_TIME: number = 60 * 2; 

    static readonly AVERAGE_MARATHON_RUN_TIME: number = 60 * 4;

    readonly name = 'stats';

    readonly minRight = Config.PREFERENCES.minRightForConnectedList;

    readonly rules = {
        stats: {
            minCount: 1,
            maxCount: 2,
            coolDown: 1000,
            params: [{name: 'username', pattern: User.USERNAME_REGEXP}]
        },
    };

    /**
     * Displays a funny message about the number of minutes a user has spent on the Skychat
     * @param alias
     * @param param
     * @param connection
     */
    async run(alias: string, param: string, connection: Connection): Promise<void> {
        
        const username = Session.autocompleteIdentifier(param);
        const session = Session.getSessionByIdentifier(username);
        if (! session) {
            // If user doesn't exist
            throw new Error('Username not found');
        }

        const xp = session.user.xp;

        let messageContent = `-> ${session.user.username} spent ${xp} minutes on the SkyChat 🕒

            That's ${Math.floor(xp/60)} hours, ${Math.floor(xp/1440)} days, and ${Math.floor(xp/10080)} weeks!

            During this time, he could have:
            
            - read ${Math.floor(xp/StatsPlugin.AVERAGE_BOOK_READ_TIME)} book 📖
            - watch ${Math.floor(xp/StatsPlugin.AVERAGE_MOVIE_WATCH_TIME)} movies 🎥
            - run ${Math.floor(xp/StatsPlugin.AVERAGE_MARATHON_RUN_TIME)} marathons 🏃
        
        But instead he chose to come here, which is much better than all those things!
        `

        await this.room.sendMessage({
            content: `${messageContent}`,
            user: UserController.getNeutralUser()
        });

    }
}