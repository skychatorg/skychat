import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pipeline } from 'node:stream/promises';
import { Logging } from '../../../skychat/Logging.js';
import { VideoInfo } from '../PlayerChannel.js';
import { PlayerPlugin } from '../PlayerPlugin.js';
import { VideoFetcher } from './VideoFetcher.js';

// Navidrome ids are base62 (22 chars today, md5 hex on old libraries).
export const NAVIDROME_ID_REGEX = /^[A-Za-z0-9]{1,40}$/;

// Cover art ids carry a kind prefix and sometimes a cache hash: `al-<id>_<hash>`, `mf-<id>`, `ar-<id>_<hash>`.
export const NAVIDROME_COVER_REGEX = /^[a-z]{2}-[A-Za-z0-9]{1,40}(_[0-9a-f]{1,32})?$/;

export const NAVIDROME_PAGE_SIZE = 60;

// Every listener streams the same transcode, so a fixed bitrate keeps the home upload predictable.
const STREAM_BITRATE_KBPS = 192;

// Tracks are downloaded once from Navidrome and served from here to every listener (~5-9 MB each).
const CACHE_DIR = path.join(os.tmpdir(), 'skychat-navidrome');
const CACHE_MAX_FILES = 200;

type SubsonicAlbum = { id: string; name: string; artist?: string; year?: number; coverArt?: string; songCount?: number };
type SubsonicSong = {
    id: string;
    title: string;
    artist?: string;
    album?: string;
    albumId?: string;
    duration?: number;
    track?: number;
    discNumber?: number;
    coverArt?: string;
};

export function mapAlbum(album: SubsonicAlbum) {
    return {
        id: album.id,
        name: album.name,
        artist: album.artist ?? '',
        year: album.year,
        coverArt: album.coverArt,
        songCount: album.songCount ?? 0,
    };
}

export function mapSong(song: SubsonicSong) {
    return {
        id: song.id,
        title: song.title,
        artist: song.artist ?? '',
        album: song.album ?? '',
        albumId: song.albumId,
        duration: song.duration ?? 0,
        track: song.track,
        coverArt: song.coverArt,
    };
}

function songToVideo(song: SubsonicSong): VideoInfo {
    return {
        type: 'navidrome',
        id: song.id,
        duration: (song.duration ?? 0) * 1000,
        startCursor: 0,
        title: song.artist ? `${song.artist} - ${song.title}` : song.title,
        thumb: coverUrl(song.coverArt),
    };
}

export function coverUrl(coverArt: string | undefined): string | undefined {
    // Always carries a query string, so clients can append `&t=<token>`.
    return coverArt ? `/api/plugin/player/navidrome/cover/${encodeURIComponent(coverArt)}?size=300` : undefined;
}

// ----- Subsonic HTTP client -----
//
// Only the read-only calls below are ever made: the SkyChat account could create playlists, star
// tracks or change its password through the API, and nothing here exposes a way to.

export class NavidromeClient {
    private readonly http: AxiosInstance;

    constructor(
        baseUrl: string,
        private readonly username: string,
        private readonly password: string,
    ) {
        this.http = axios.create({ baseURL: baseUrl.replace(/\/+$/, ''), timeout: 20_000 });
    }

    // Subsonic token auth: md5(password + salt), with a fresh salt per request.
    private params(extra: Record<string, string | number>): Record<string, string | number> {
        const salt = crypto.randomBytes(8).toString('hex');
        const token = crypto
            .createHash('md5')
            .update(this.password + salt)
            .digest('hex');
        return { u: this.username, t: token, s: salt, v: '1.16.1', c: 'skychat', f: 'json', ...extra };
    }

    // Subsonic reports errors as HTTP 200 with status "failed".
    private async call<T>(
        endpoint: 'search3' | 'getAlbum' | 'getSong' | 'getAlbumList2',
        extra: Record<string, string | number>,
    ): Promise<T> {
        const res = await this.http.get(`/rest/${endpoint}`, { params: this.params(extra) });
        const body = res.data?.['subsonic-response'];
        if (body?.status !== 'ok') {
            const err = new Error(body?.error?.message ?? 'Navidrome request failed') as Error & { code?: number };
            err.code = body?.error?.code;
            throw err;
        }
        return body as T;
    }

    async newestAlbums(offset: number): Promise<SubsonicAlbum[]> {
        const body = await this.call<{ albumList2: { album?: SubsonicAlbum[] } }>('getAlbumList2', {
            type: 'newest',
            size: NAVIDROME_PAGE_SIZE,
            offset,
        });
        return body.albumList2.album ?? [];
    }

    async getAlbum(id: string): Promise<SubsonicAlbum & { song?: SubsonicSong[] }> {
        const body = await this.call<{ album: SubsonicAlbum & { song?: SubsonicSong[] } }>('getAlbum', { id });
        return body.album;
    }

    async getSong(id: string): Promise<SubsonicSong> {
        const body = await this.call<{ song: SubsonicSong }>('getSong', { id });
        return body.song;
    }

    async search(query: string, offset: number): Promise<{ albums: SubsonicAlbum[]; songs: SubsonicSong[] }> {
        const body = await this.call<{ searchResult3: { album?: SubsonicAlbum[]; song?: SubsonicSong[] } }>('search3', {
            query,
            artistCount: 0,
            albumCount: NAVIDROME_PAGE_SIZE,
            albumOffset: offset,
            songCount: NAVIDROME_PAGE_SIZE,
            songOffset: offset,
        });
        return { albums: body.searchResult3.album ?? [], songs: body.searchResult3.song ?? [] };
    }

    // Raw byte responses, for the proxy routes.
    coverPath(coverArt: string, size: number): string {
        const query = new URLSearchParams(Object.entries(this.params({ id: coverArt, size })).map(([k, v]) => [k, String(v)]));
        return `/rest/getCoverArt?${query.toString()}`;
    }

    async downloadTrack(id: string, file: string): Promise<void> {
        const res = await this.http.get('/rest/stream', {
            params: this.params({ id, format: 'mp3', maxBitRate: STREAM_BITRATE_KBPS }),
            responseType: 'stream',
            timeout: 120_000,
        });
        // An error comes back as a 200 JSON body rather than audio.
        if (!String(res.headers['content-type'] ?? '').startsWith('audio/')) {
            res.data.destroy();
            throw new Error(`Navidrome stream returned ${res.headers['content-type']}`);
        }
        await pipeline(res.data, fs.createWriteStream(file));
    }

    get rawHttp(): AxiosInstance {
        return this.http;
    }
}

// ----- Track cache -----

export class TrackCache {
    private readonly downloads = new Map<string, Promise<string>>();

    constructor(private readonly client: NavidromeClient) {}

    // Path of the cached mp3, downloading it first if needed. Concurrent callers share one download.
    get(id: string): Promise<string> {
        let pending = this.downloads.get(id);
        if (!pending) {
            pending = this.fetch(id).finally(() => this.downloads.delete(id));
            this.downloads.set(id, pending);
        }
        return pending;
    }

    private async fetch(id: string): Promise<string> {
        const file = path.join(CACHE_DIR, `${id}.mp3`);
        try {
            const now = new Date();
            // Touch on hit, so eviction drops the least recently played
            await fs.promises.utimes(file, now, now);
            return file;
        } catch {
            // Not cached yet
        }
        await fs.promises.mkdir(CACHE_DIR, { recursive: true });
        const partial = `${file}.${crypto.randomBytes(4).toString('hex')}.part`;
        try {
            await this.client.downloadTrack(id, partial);
            await fs.promises.rename(partial, file);
        } catch (err) {
            await fs.promises.rm(partial, { force: true });
            throw err;
        }
        await this.evict().catch((err) => Logging.warn(`Navidrome cache eviction failed: ${(err as Error).message}`));
        return file;
    }

    private async evict(): Promise<void> {
        const names = (await fs.promises.readdir(CACHE_DIR)).filter((name) => name.endsWith('.mp3'));
        if (names.length <= CACHE_MAX_FILES) {
            return;
        }
        const files = await Promise.all(
            names.map(async (name) => {
                const file = path.join(CACHE_DIR, name);
                return { file, mtime: (await fs.promises.stat(file)).mtimeMs };
            }),
        );
        files.sort((a, b) => a.mtime - b.mtime);
        // Unlinking a file that is being served is fine: open handles keep reading it.
        await Promise.all(files.slice(0, files.length - CACHE_MAX_FILES).map(({ file }) => fs.promises.rm(file, { force: true })));
    }
}

// ----- VideoFetcher implementation -----

export class NavidromeFetcher implements VideoFetcher {
    private clientInstance: NavidromeClient | null = null;

    private cacheInstance: TrackCache | null = null;

    // Prefetches run one at a time, so queueing an album doesn't fire 20 transcodes at home at once.
    private prefetchChain: Promise<unknown> = Promise.resolve();

    constructor() {
        const url = process.env.NAVIDROME_INTERNAL_URL?.trim();
        const username = process.env.NAVIDROME_USERNAME?.trim();
        const password = process.env.NAVIDROME_PASSWORD;
        if (!url || !username || !password) {
            Logging.warn(
                'Navidrome env vars missing (NAVIDROME_INTERNAL_URL / NAVIDROME_USERNAME / NAVIDROME_PASSWORD). Navidrome is disabled.',
            );
            return;
        }
        this.clientInstance = new NavidromeClient(url, username, password);
        this.cacheInstance = new TrackCache(this.clientInstance);
    }

    get enabled(): boolean {
        return this.clientInstance !== null;
    }

    get client(): NavidromeClient {
        if (!this.clientInstance) {
            throw new Error('Navidrome is not configured on the server');
        }
        return this.clientInstance;
    }

    get cache(): TrackCache {
        if (!this.cacheInstance) {
            throw new Error('Navidrome is not configured on the server');
        }
        return this.cacheInstance;
    }

    /**
     * @override
     * Queues one or more space-separated song ids, in order. A bad id is skipped so one stale
     * selection doesn't sink the batch.
     */
    async get(_playerPlugin: PlayerPlugin, param: string): Promise<VideoInfo[]> {
        const ids = param.trim().split(/\s+/).filter(Boolean);
        if (ids.length === 0 || ids.some((id) => !NAVIDROME_ID_REGEX.test(id))) {
            throw new Error('Invalid Navidrome song id');
        }
        // In parallel: a whole album is one request per song
        const results = await Promise.allSettled(ids.map((id) => this.client.getSong(id)));
        const videos = results.flatMap((result) => (result.status === 'fulfilled' ? [songToVideo(result.value)] : []));
        const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
        if (failure) {
            Logging.warn(`Navidrome queue skipped ${results.length - videos.length} song(s): ${failure.reason?.message}`);
        }
        if (videos.length === 0) {
            // Subsonic code 70 is "not found"; anything else means Navidrome itself is unreachable or broken
            throw new Error(failure?.reason?.code === 70 ? 'Song not found' : 'Could not reach the music library');
        }
        for (const video of videos) {
            this.prefetch(video.id);
        }
        return videos;
    }

    // Warm the cache ahead of playback, so the track starts right away when its turn comes.
    private prefetch(id: string) {
        this.prefetchChain = this.prefetchChain
            .then(() => this.cache.get(id))
            .catch((err) => Logging.warn(`Navidrome prefetch failed for ${id}: ${(err as Error).message}`));
    }

    /** @override */
    async search(_playerPlugin: PlayerPlugin, _type: string, search: string, limit: number): Promise<VideoInfo[]> {
        const { songs } = await this.client.search(search, 0);
        return songs.slice(0, limit).map(songToVideo);
    }
}
