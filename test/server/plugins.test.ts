import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import * as impl from '../../app/server/plugins/index.js';
import { PluginGroup } from '../../app/server/plugins/PluginGroup.js';
import { TestServer } from './harness.js';

const repo = path.resolve(__dirname, '../..');

// Every plugin group the code base ships, VoicePluginGroup included (it is only listed, not started)
const groups = Object.entries(impl)
    .filter(([exportName]) => exportName.endsWith('PluginGroup'))
    .map(([groupName, Group]) => ({ groupName, group: new (Group as unknown as new () => PluginGroup)() }));
const pluginClasses = groups.flatMap(({ group }) => [...group.globalPluginClasses, ...group.roomPluginClasses]);

function sourceFiles(dir: string): string[] {
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((entry) =>
            entry.isDirectory() ? sourceFiles(path.join(dir, entry.name)) : entry.name.endsWith('.ts') ? [path.join(dir, entry.name)] : [],
        );
}

describe('plugin loading', () => {
    it('every group in the .env template exists', () => {
        const env = fs.readFileSync(path.join(repo, 'app/template/.env.template'), 'utf8');
        const enabled = env.match(/^ENABLED_PLUGINS="?([^"\n]*)"?/m)![1].split(',');
        expect(enabled.filter((name) => !groups.some((g) => g.groupName === name))).toEqual([]);
    });

    it('starts every enabled group', async () => {
        const server = await new TestServer().start();
        expect(server.pluginManager.plugins.length).toBeGreaterThan(0);
        expect(server.roomManager.rooms[0].plugins.length).toBeGreaterThan(0);
    });

    it('no two plugins claim the same command name or alias', () => {
        // Global commands shadow room commands, and a later plugin silently overwrites an earlier one
        const owners: Record<string, string[]> = {};
        for (const PluginClass of pluginClasses) {
            for (const command of new Set([PluginClass.commandName, ...PluginClass.commandAliases])) {
                (owners[command] ??= []).push(PluginClass.name);
            }
        }
        expect(Object.entries(owners).filter(([, names]) => names.length > 1)).toEqual([]);
    });

    it('every plugin looked up by name exists (71af048)', () => {
        // /pointscollector crashed the server after the cursor plugin was renamed and a string lookup was missed
        const commandNames = new Set(pluginClasses.map((PluginClass) => PluginClass.commandName));
        const missing = sourceFiles(path.join(repo, 'app/server')).flatMap((file) =>
            [...fs.readFileSync(file, 'utf8').matchAll(/getPlugin(?:<\w+>)?\('([^']+)'\)/g)]
                .map((match) => match[1])
                .filter((name) => !commandNames.has(name))
                .map((name) => `${path.relative(repo, file)}: ${name}`),
        );
        expect(missing).toEqual([]);
    });
});

describe('give money', () => {
    it('moves the money minus the commission, with no error for the giver', async () => {
        const server = await new TestServer().start();
        const [alice, bob] = [await server.connect('givealice'), await server.connect('givebob')];
        alice.session.user.money = 1000;
        bob.session.user.money = 0;

        await alice.send('/give givebob 500');

        expect(alice.errors()).toEqual([]);
        expect([alice.session.user.money, bob.session.user.money]).toEqual([500, 400]);
    });
});
