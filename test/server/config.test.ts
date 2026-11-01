import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { Config } from '../../app/server/skychat/Config.js';

const repo = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(repo, file), 'utf8');

describe('fresh install config', () => {
    it('loads the preferences template (0765a18)', () => {
        // setup.ts seeds config/ from app/template, and Config throws on import when a required key is missing
        expect(Config.PREFERENCES.minRightForJellyfinBrowse).toBeDefined();
    });

    it('the .env template declares every variable docker compose uses', () => {
        const declared = new Set([...read('app/template/.env.template').matchAll(/^([A-Z_][A-Z0-9_]*)=/gm)].map((m) => m[1]));
        const compose = read('docker-compose.yml') + read('docker-compose.dev.yml');
        // ${VAR:-default} has a fallback, so only bare ${VAR} must be declared
        const used = [...compose.matchAll(/\$\{([A-Z_][A-Z0-9_]*)\}/g)].map((m) => m[1]);
        expect([...new Set(used)].filter((name) => !declared.has(name))).toEqual([]);
    });

    it('setup.sh fills every placeholder of the .env template', () => {
        const placeholders = [...read('app/template/.env.template').matchAll(/^[A-Z_]+="\$([A-Z_]+)"/gm)].map((m) => m[1]);
        const filled = [...read('app/script/setup.sh').matchAll(/^\s*fill ([A-Z_]+) /gm)].map((m) => m[1]);
        expect(placeholders.length).toBeGreaterThan(0);
        expect(placeholders.sort()).toEqual(filled.sort());
    });
});
