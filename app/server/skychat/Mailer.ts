import * as nodemailer from "nodemailer";
import {Config} from "./Config";
import {SentMessageInfo} from "nodemailer";


export class Mailer {

    public static async sendMail(to: string, subject: string, content: string): Promise<SentMessageInfo> {

        if (! Config.EMAIL_TRANSPORT) {
            throw new Error('Email transport not registered');
        }

        const transporter = nodemailer.createTransport(Config.EMAIL_TRANSPORT);

        return transporter.sendMail({
            to: to,
            subject: subject,
            text: content
        });
    }
}
