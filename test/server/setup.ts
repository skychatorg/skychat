import fs from 'fs';
import os from 'os';
import path from 'path';

// Server modules read config/ from the cwd and env vars at import time, so this must run before any of them load.
// Seeding from the templates (never the repo's own config/) also proves a fresh install boots.
const repo = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skychat-test-'));
const template = (name: string) => path.join(repo, 'app/template', name);

for (const sub of [
    'config',
    'storage/plugins',
    'storage/rooms',
    'uploads/all',
    'uploads/avatars',
    'uploads/stickers',
    'gallery',
    'backups',
]) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
}
fs.copyFileSync(template('preferences.json.template'), path.join(dir, 'config/preferences.json'));
fs.copyFileSync(template('stickers.json.template'), path.join(dir, 'config/stickers.json'));
fs.copyFileSync(template('guestnames.txt.template'), path.join(dir, 'config/guestnames.txt'));
fs.copyFileSync(template('fakemessages.txt.template'), path.join(dir, 'config/fakemessages.txt'));
fs.copyFileSync(template('welcome.txt.template'), path.join(dir, 'config/welcome.txt'));
process.chdir(dir);

// VoicePluginGroup is left out: it boots a mediasoup worker on a fixed port
process.env.ENABLED_PLUGINS =
    'CorePluginGroup,GamesPluginGroup,ExtraSecurityPluginGroup,PlayerPluginGroup,GalleryPluginGroup,UserDefinedPluginGroup';
process.env.PUBLIC_URL = 'http://localhost:8081';
process.env.USERS_PASSWORD_SALT = 'test-password-salt';
process.env.USERS_TOKEN_SALT = 'test-token-salt';
