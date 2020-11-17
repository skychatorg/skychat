import {Connection} from "../../../Connection";
import {Plugin} from "../../Plugin";
import {Room} from "../../../Room";
import {Config} from "../../../Config";
import * as nodemailer from "nodemailer";
import * as Mail from "nodemailer/lib/mailer";
import {SentMessageInfo} from "nodemailer";
import {UserController} from "../../../UserController";
import {User} from "../../../User";
import {Message} from "../../../Message";


export class MailPlugin extends Plugin {

    readonly name = 'mail';

    readonly opOnly = true;

    readonly rules = {
        give: {
            minCount: 2,
            maxCount: 2,
            coolDown: 1000,
            params: [{name: 'username', pattern: User.USERNAME_REGEXP}, {name: 'message', pattern: /./}]
        }
    };

    readonly minRight = 30;

    private readonly transporter?: Mail;

    constructor(room: Room) {
        super(room);

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
        connection.send('message', UserController.createNeutralMessage(result.response).sanitized());
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

        return await this.transporter.sendMail({
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
        return await this.sendMail(user.email, subject, content);
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
        return await this.sendMailToUser(user, subject, content);
    }
}
