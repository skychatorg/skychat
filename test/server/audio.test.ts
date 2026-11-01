import { describe, expect, it, vi } from 'vitest';
import { Config } from '../../app/server/skychat/Config.js';
import { FileManager } from '../../app/server/skychat/FileManager.js';
import { MessageFormatter } from '../../app/server/skychat/MessageFormatter.js';

const upload = (mimetype: string) => FileManager.saveFile({ mimetype, mv: vi.fn() } as never);

describe('voice notes', () => {
    it('saves recordings as uploads, with a distinct extension per recorder format', () => {
        // Chrome sends audio/webm;codecs=opus, Firefox audio/ogg;codecs=opus, Safari audio/mp4
        expect(upload('audio/webm;codecs=opus')).toMatch(/^uploads\/all\/.+\.weba$/);
        expect(upload('audio/ogg;codecs=opus')).toMatch(/\.ogg$/);
        expect(upload('audio/mp4')).toMatch(/\.m4a$/);
        expect(upload('video/webm')).toMatch(/\.webm$/);
    });

    it('renders an uploaded recording as a player from the message content alone', () => {
        // History and restarts re-format messages from their content, which used to lose the audio
        const url = FileManager.getFileUrlFromLocalPath(upload('audio/webm;codecs=opus'));
        expect(url.startsWith(Config.LOCATION + '/uploads/all/')).toBe(true);

        const formatted = MessageFormatter.getInstance().format(url);

        expect(formatted).toBe(`<audio class="skychat-audio-tag" controls preload="metadata" src="${url}"></audio>`);
        expect(MessageFormatter.getInstance().format(url, true)).toBe('');
    });

    it('does not render a video upload as audio', () => {
        const url = FileManager.getFileUrlFromLocalPath(upload('video/webm'));
        expect(MessageFormatter.getInstance().format(url)).not.toContain('<audio');
    });
});
