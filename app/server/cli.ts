import { DatabaseHelper } from './skychat/DatabaseHelper';


/**
 * Import a file in the gallery
 */
export async function importFileToGallery() {
    throw new Error('Not implemented');
}

/**
 * Possible actions
 */
const ACTIONS: {[action: string]: { argCount: number, handler: (...args: string[]) => Promise<void>, usage: string }} = {
    'file-import': {
        argCount: 1,
        handler: importFileToGallery,
        usage: '{filePath}',
    }
};

/**
 * Main entry point
 * @returns
 */
export async function main() {
    await DatabaseHelper.load();

    const [action, ...args] = process.argv.slice(2);

    if (typeof ACTIONS[action] === 'undefined') {
        throw new Error('Action does not exist');
    }

    const { argCount, handler, usage } = ACTIONS[action];

    if (args.length !== argCount) {
        console.warn(`Usage:\ncli.js ${action} ${usage}`);
        return;
    }

    handler(...args);
}

main();
