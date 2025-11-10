import pino from 'pino';

export class Logging {
    private static readonly logger: pino.Logger = pino();

    private static argsToString(args: unknown[]): string {
        return args
            .map((a) => {
                if (typeof a === 'string') {
                    return a;
                }
                try {
                    return JSON.stringify(a);
                } catch {
                    return '[Unserializable]';
                }
            })
            .join(' ');
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
