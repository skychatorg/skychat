import { Logging } from '../../app/server/skychat/Logging.js';

// Server logs drown the test report; run with SKYCHAT_TEST_LOGS=1 to see them
if (!process.env.SKYCHAT_TEST_LOGS) {
    (Logging as unknown as { logger: { level: string } }).logger.level = 'silent';
}

// The server modules import each other in a cycle that only resolves when entered from SkyChatServer, as in production.
// Loading it here, after setup.ts, lets test files import any module in any order.
await import('../../app/server/skychat/SkyChatServer.js');
