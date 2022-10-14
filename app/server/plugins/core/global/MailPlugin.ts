import { Connection } from "../../../skychat/Connection";
import { Config } from "../../../skychat/Config";
import * as nodemailer from "nodemailer";
import * as Mail from "nodemailer/lib/mailer";
import { SentMessageInfo } from "nodemailer";
import { UserController } from "../../../skychat/UserController";
import { User } from "../../../skychat/User";
import { GlobalPlugin } from "../../GlobalPlugin";
import { RoomManager } from "../../../skychat/RoomManager";


export class MailPlugin extends GlobalPlugin {

    static readonly commandName = 'mail';

    readonly opOnly = true;

    readonly rules = {
        mail: {
            minCount: 2,
            maxCount: 2,
            coolDown: 1000,
            params: [{name: 'username', pattern: User.USERNAME_REGEXP}, {name: 'message', pattern: /./}]
        }
    };

    private readonly transporter?: Mail;

    constructor(manager: RoomManager) {
        super(manager);

        if (Config.EMAIL_TRANSPORT) {
            this.transporter = nodemailer.createTransport(Config.EMAIL_TRANSPORT);
        }
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        // Parse parameters
        const username = param.split(' ')[0];
        const message = param.split(' ').slice(1).join(' ');

        // Send email
        const result = await this.sendMailToUsername(username, 'New mail from ' + Config.LOCATION, message);

        // Send back notification
        connection.send('message', UserController.createNeutralMessage({content: result.response, room: connection.roomId, id: 0}).sanitized());
    }

    /**
     * Send an email to an email address
     * @param to
     * @param subject
     * @param content
     */
    public async sendMail(to: string, subject: string, content: string): Promise<SentMessageInfo> {

        if (! this.transporter) {
            throw new Error('Email transport not registered');
        }

        return this.transporter.sendMail({
            to: to,
            subject: subject,
            text: content
        });
    }

    /**
     * Send an email to a specific user
     * @param user
     * @param subject
     * @param content
     */
    public async sendMailToUser(user: User, subject: string, content: string): Promise<SentMessageInfo> {
        if (! user.email) {
            throw new Error(`This user does not accepts emails`);
        }
        return this.sendMail(user.email, subject, content);
    }

    /**
     * Send an email to a user using its username
     * @param username
     * @param subject
     * @param content
     */
    public async sendMailToUsername(username: string, subject: string, content: string): Promise<SentMessageInfo> {
        const user = await UserController.getUserByUsername(username);
        if (! user) {
            throw new Error(`User ${username} not found`);
        }
        return this.sendMailToUser(user, subject, content);
    }
}
