import { Connection } from '../../../skychat/Connection';
import { RoomPlugin } from '../../RoomPlugin';
import { UserController } from '../../../skychat/UserController';
import { RandomGenerator } from '../../../skychat/RandomGenerator';


export class RandomGeneratorPlugin extends RoomPlugin {

    static readonly commandName = 'rand';

    readonly minRight = 0;

    readonly rules = {
        rand: {
            minCount: 2,
            maxCount: 2,
            coolDown: 100,
            params: [{ name: 'min', pattern: /^([0-9]+)$/ }, { name: 'max', pattern: /^([0-9]+)$/ }]
        },
    };

    /**
     * Return a random number
     * @param alias
     * @param param
     * @param connection
     */
    async run(alias: string, param: string, connection: Connection): Promise<void> {
        const min = parseInt(param.split(' ')[0]);
        const max = parseInt(param.split(' ')[1]);
        if (min >= max) {
            throw new Error('Invalid min/max values given');
        }
        const rand = Math.floor(RandomGenerator.random(8) * (1 + max - min) + min);
        await this.room.sendMessage({
            content: `rand(user=${connection.session.identifier}, min=${min}, max=${max}) = ${rand}`,
            user: UserController.getNeutralUser()
        });
    }
}
