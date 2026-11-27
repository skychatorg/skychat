import pino from 'pino';

export class Logging {
    private static readonly logger: pino.Logger = pino();

    private static argsToString(args: unknown[]): string {
        return args
            .map((a) => {
                if (typeof a === 'string') {
                    return a;
                }
                // JSON.stringify gives {} for an Error
                if (a instanceof Error) {
                    return a.stack ?? a.message;
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

/**
 * Work started without waiting for it, like a timer's: log its failure, since an unhandled rejection stops the server
 */
export const logFailure = (work: Promise<unknown>, label: string): void => {
    work.catch((error) => Logging.error(label, error));
};
