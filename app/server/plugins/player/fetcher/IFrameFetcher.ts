import { VideoInfo } from '../PlayerChannel.js';
import { PlayerPlugin } from '../PlayerPlugin.js';
import { VideoFetcher } from './VideoFetcher.js';

export class IFrameFetcher implements VideoFetcher {
    static ALLOWED_SOURCES: string[] = [
        'https://w.soundcloud.com',
        'https://airmash.online',
        'https://scdn.nrjaudio.fm',
        'https://bruh.io',
        'https://stream-49.zeno.fm',
        'https://digdig.io',
        'https://streamable.com',
        'https://catbox.moe',
        'https://vocaroo.com',
        'https://voca.ro',
    ];

    /**
     * @override
     */
    async get(playerPlugin: PlayerPlugin, src: string): Promise<VideoInfo[]> {
        // Check if src is an URL starting with one of the list of allowed sources
        const isAllowed = !!IFrameFetcher.ALLOWED_SOURCES.find((allowed) => src.startsWith(allowed));
        if (!isAllowed) {
            throw new Error('Source not allowed. Ask an adminstrator to add it to the list of allowed sources.');
        }

        return [
            {
                type: 'iframe',
                id: src,
                startCursor: 0,
                thumb: '',
                duration: 0,
                title: src,
            },
        ];
    }

    /**
     * @override
     */
    search(): Promise<VideoInfo[]> {
        throw new Error('Method not implemented.');
    }
}
