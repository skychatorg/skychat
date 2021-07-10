import {Connection} from "../../skychat/Connection";
import {GlobalPlugin} from "../../skychat/GlobalPlugin";
import { UserController } from "../../skychat/UserController";
import {exec} from 'child_process';


export class BackupPlugin extends GlobalPlugin {

    static readonly commandName = 'backup';

    readonly opOnly = true;

    readonly rules = {
        backup: {
            coolDown: 10 * 1000,
        },
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        const filePath = await this.makeBackup();
        const content = `Backup created: ${filePath}`;
        const message = UserController.createNeutralMessage({content, id: 0,});
        connection.send('message', message.sanitized());
    }

    public makeBackup(): Promise<string> {
        return new Promise((resolve, reject) => {
            exec('bash scripts/backup.sh', (error, stdout, stderr) => {
                // If backup fails
                if (error || stderr) {
                    return reject(error || new Error(stderr));
                }
                // If backup has been created
                resolve(stdout);
            });
        });
    }
}
