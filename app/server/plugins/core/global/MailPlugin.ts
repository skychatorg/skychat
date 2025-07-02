import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { IMailgunClient } from 'mailgun.js/Interfaces/index.js';
import { MailgunClientOptions, MailgunMessageData } from 'mailgun.js/definitions';
import { Config } from '../../../skychat/Config.js';
import { Connection } from '../../../skychat/Connection.js';
import { Logging } from '../../../skychat/Logging.js';
import { RoomManager } from '../../../skychat/RoomManager.js';
import { User } from '../../../skychat/User.js';
import { UserController } from '../../../skychat/UserController.js';
import { GlobalPlugin } from '../../GlobalPlugin.js';

export class MailPlugin extends GlobalPlugin {
    static readonly commandName = 'mail';

    readonly opOnly = true;

    readonly rules = {
        mail: {
            minCount: 2,
            coolDown: 1000,
            params: [
                { name: 'username', pattern: User.USERNAME_REGEXP },
                { name: 'message', pattern: /./ },
            ],
        },
    };

    private readonly mailgunDomain = process.env.MAILGUN_DOMAIN ?? '';

    private readonly mailgunClient?: IMailgunClient;

    constructor(manager: RoomManager) {
        super(manager);

        if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
            this.mailgunClient = new Mailgun(formData).client({
                username: 'api',
                key: process.env.MAILGUN_API_KEY,
                url: 'https://api.eu.mailgun.net',
            } as MailgunClientOptions);
        }
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        // Parse parameters
        const username = param.split(' ')[0];
        const text = param.split(' ').slice(1).join(' ');

        // Send email
        try {
            const result = await this.sendMailToUsername(username, {
                subject: 'New mail from ' + Config.LOCATION,
                text,
            });

            // Send back notification
            connection.send(
                'message',
                UserController.createNeutralMessage({ content: `${result.id} sent`, room: connection.roomId, id: 0 }).sanitized(),
            );
        } catch (error) {
            Logging.error('MailPlugin', `Error sending email to ${username}:`, error);
        }
    }

    /**
     * Send an email to an email address
     */
    public async sendMail(data: MailgunMessageData) {
        if (!this.mailgunClient) {
            throw new Error('Email transport not registered');
        }

        return this.mailgunClient.messages.create(this.mailgunDomain, {
            from: process.env.MAILGUN_FROM ?? 'SkyChat <mailgun@' + this.mailgunDomain + '>',
            ...data,
        });
    }

    /**
     * Send an email to a specific user
     */
    public async sendMailToUser(user: User, data: MailgunMessageData) {
        if (!user.email) {
            throw new Error('This user does not accept emails');
        }
        return this.sendMail({ to: [user.email], ...data });
    }

    /**
     * Send an email to a user using its username
     */
    public async sendMailToUsername(username: string, data: MailgunMessageData) {
        const user = await UserController.getUserByUsername(username);
        if (!user) {
            throw new Error(`User ${username} not found`);
        }
        return this.sendMailToUser(user, data);
    }
}
