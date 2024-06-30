import pino from 'pino';

export class Logging {
    private static readonly logger: pino.Logger = pino();

    private static argsToString(args: unknown[]): string {
        return args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    }

    static info(...messages: unknown[]) {
        Logging.logger.info(Logging.argsToString(messages));
    }

    static error(...messages: unknown[]) {
        Logging.logger.error(Logging.argsToString(messages));
    }

    static warn(...messages: unknown[]) {
        Logging.logger.warn(Logging.argsToString(messages));
    }

    static debug(...messages: unknown[]) {
        Logging.logger.debug(Logging.argsToString(messages));
    }

    static trace(...messages: unknown[]) {
        Logging.logger.trace(Logging.argsToString(messages));
    }
}
