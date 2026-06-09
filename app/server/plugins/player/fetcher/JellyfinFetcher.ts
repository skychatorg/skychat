import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { Logging } from '../../../skychat/Logging.js';
import { VideoInfo } from '../PlayerChannel.js';
import { PlayerPlugin } from '../PlayerPlugin.js';
import { VideoFetcher } from './VideoFetcher.js';

// Jellyfin canonical item ID: 32 hex chars, with or without dashes.
export const JELLYFIN_ID_REGEX = /^[a-f0-9]{32}$/i;

// How many library items we fetch per page when browsing or searching.
export const PAGE_SIZE = 100;

// Strip dashes from a Jellyfin GUID: some endpoints return "a1b2-..." and some "a1b2...".
function normalizeId(id: string): string {
    return id.replace(/-/g, '').toLowerCase();
}

// Lightweight DTO sent to the library browser (both browse and search share this shape).
export function mapBrowseItem(item: JellyfinItem) {
    return {
        id: normalizeId(item.Id),
        name: item.Name,
        type: item.Type,
        isFolder: Boolean(item.IsFolder),
        productionYear: item.ProductionYear,
        seriesName: item.SeriesName,
        indexNumber: item.IndexNumber,
        parentIndexNumber: item.ParentIndexNumber,
        primaryTag: item.ImageTags?.Primary,
    };
}

// ----- Jellyfin API types (only the fields we read) -----

export type JellyfinMediaStream = {
    Type: 'Video' | 'Audio' | 'Subtitle';
    Index: number;
    Codec?: string;
    Language?: string;
    DisplayTitle?: string;
    Title?: string;
    IsDefault?: boolean;
    IsForced?: boolean;
    IsExternal?: boolean;
    IsTextSubtitleStream?: boolean;
};

export type JellyfinMediaSource = {
    Id: string;
    Container?: string;
    Size?: number;
    Path?: string;
    MediaStreams?: JellyfinMediaStream[];
    SupportsDirectStream?: boolean;
    SupportsTranscoding?: boolean;
};

export type JellyfinItem = {
    Id: string;
    Name: string;
    Type: 'Movie' | 'Episode' | 'Series' | 'Season' | 'Folder' | 'Video' | 'CollectionFolder' | 'UserView' | string;
    RunTimeTicks?: number;
    ProductionYear?: number;
    SeriesName?: string;
    SeasonName?: string;
    IndexNumber?: number;
    ParentIndexNumber?: number;
    ImageTags?: Record<string, string>;
    BackdropImageTags?: string[];
    MediaSources?: JellyfinMediaSource[];
    Overview?: string;
    IsFolder?: boolean;
};

export type JellyfinPlaybackInfoResponse = {
    MediaSources: JellyfinMediaSource[];
    PlaySessionId: string;
};

// Minimal DeviceProfile that steers Jellyfin toward Direct-Stream (container-only remux) for HEVC-in-MKV.
// Without a profile, defaults are conservative and tend to trigger H.264 re-encode. See jellyfin-web #7651.
const DEVICE_PROFILE = {
    Name: 'SkyChat',
    MaxStreamingBitrate: 200_000_000,
    MaxStaticBitrate: 200_000_000,
    MusicStreamingTranscodingBitrate: 192_000,
    DirectPlayProfiles: [{ Container: 'mp4,m4v', Type: 'Video' }],
    TranscodingProfiles: [
        {
            Container: 'mp4',
            Type: 'Video',
            Protocol: 'http',
            AudioCodec: 'aac,ac3,eac3,opus,flac,mp3,copy',
            VideoCodec: 'hevc,h264,vp9,av1,copy',
            Context: 'Streaming',
            MaxAudioChannels: '6',
        },
    ],
    ContainerProfiles: [],
    CodecProfiles: [],
    SubtitleProfiles: [
        { Format: 'vtt', Method: 'External' },
        { Format: 'srt', Method: 'External' },
        { Format: 'ass', Method: 'External' },
        { Format: 'ssa', Method: 'External' },
    ],
};

// ----- Jellyfin HTTP client -----

export class JellyfinClient {
    private readonly http: AxiosInstance;
    private userIdPromise: Promise<string> | null = null;
    private systemInfoPromise: Promise<void> | null = null;

    constructor(
        public readonly baseUrl: string,
        apiKey: string,
    ) {
        this.http = axios.create({
            baseURL: baseUrl.replace(/\/+$/, ''),
            headers: { 'X-Emby-Token': apiKey, Accept: 'application/json' },
            timeout: 20_000,
        });
    }

    // Sanity probe + warm cache. Lazy-invoked; not called at construction.
    async ensureReady(): Promise<void> {
        if (this.systemInfoPromise) {
            return this.systemInfoPromise;
        }
        this.systemInfoPromise = (async () => {
            const res = await this.http.get('/System/Info');
            Logging.info(`Jellyfin reachable: ${res.data?.ServerName ?? 'unknown'} v${res.data?.Version ?? '?'}`);
        })().catch((err) => {
            // Reset so a later call retries instead of caching the failure.
            this.systemInfoPromise = null;
            throw err;
        });
        return this.systemInfoPromise;
    }

    // The API key is bound to a user (admin by default). Resolve that user id once.
    async resolveUserId(): Promise<string> {
        if (this.userIdPromise) {
            return this.userIdPromise;
        }
        this.userIdPromise = (async () => {
            const res = await this.http.get('/Users');
            const users: Array<{ Id: string; Policy?: { IsAdministrator?: boolean } }> = res.data ?? [];
            // Prefer the first admin; fall back to the first user.
            const admin = users.find((u) => u.Policy?.IsAdministrator) ?? users[0];
            if (!admin) {
                throw new Error('Jellyfin returned no users for the API key');
            }
            return admin.Id;
        })().catch((err) => {
            this.userIdPromise = null;
            throw err;
        });
        return this.userIdPromise;
    }

    async listLibraries(userId: string): Promise<JellyfinItem[]> {
        const res = await this.http.get(`/Users/${userId}/Views`);
        return (res.data?.Items ?? []) as JellyfinItem[];
    }

    async listChildren(
        userId: string,
        parentId: string | null,
        opts: { startIndex?: number; limit?: number; sortBy?: string } = {},
    ): Promise<{ items: JellyfinItem[]; total: number }> {
        const params: Record<string, string | number> = {
            StartIndex: opts.startIndex ?? 0,
            Limit: opts.limit ?? PAGE_SIZE,
            SortBy: opts.sortBy ?? 'SortName',
            SortOrder: 'Ascending',
            Fields: 'PrimaryImageAspectRatio,ProductionYear,SeriesName,IndexNumber,ParentIndexNumber',
        };
        if (parentId) {
            params.ParentId = parentId;
            params.Recursive = 'false';
        } else {
            // Top-level: show the user's views (libraries).
            const libs = await this.listLibraries(userId);
            return { items: libs, total: libs.length };
        }
        const res = await this.http.get(`/Users/${userId}/Items`, { params });
        return {
            items: (res.data?.Items ?? []) as JellyfinItem[],
            total: (res.data?.TotalRecordCount as number) ?? 0,
        };
    }

    async searchItems(
        userId: string,
        term: string,
        types: Array<'Movie' | 'Episode' | 'Series'>,
        opts: { startIndex?: number; limit: number },
    ): Promise<{ items: JellyfinItem[]; total: number }> {
        const res = await this.http.get(`/Users/${userId}/Items`, {
            params: {
                SearchTerm: term,
                IncludeItemTypes: types.join(','),
                Recursive: 'true',
                StartIndex: opts.startIndex ?? 0,
                Limit: opts.limit,
                Fields: 'PrimaryImageAspectRatio,ProductionYear,SeriesName,IndexNumber,ParentIndexNumber',
            },
        });
        return {
            items: (res.data?.Items ?? []) as JellyfinItem[],
            total: (res.data?.TotalRecordCount as number) ?? 0,
        };
    }

    async getItem(userId: string, itemId: string): Promise<JellyfinItem> {
        const res = await this.http.get(`/Users/${userId}/Items/${itemId}`, {
            params: { Fields: 'MediaSources,MediaStreams,Overview,ProductionYear,SeriesName,IndexNumber,ParentIndexNumber' },
        });
        return res.data as JellyfinItem;
    }

    async getPlaybackInfo(userId: string, itemId: string): Promise<JellyfinPlaybackInfoResponse> {
        const res = await this.http.post(
            `/Items/${itemId}/PlaybackInfo`,
            {
                UserId: userId,
                MaxStreamingBitrate: 200_000_000,
                DeviceProfile: DEVICE_PROFILE,
                AutoOpenLiveStream: false,
            },
            { params: { userId } },
        );
        return res.data as JellyfinPlaybackInfoResponse;
    }

    // URL builders return paths relative to the Jellyfin base URL. Callers hit them via rawHttp.
    // Clients never see Jellyfin URLs directly — everything is proxied through SkyChat routes.

    // Stream a remuxed MP4 of the selected media source.
    //   videoCodec=copy        -> pure container rewrite, no re-encode. ~1-3% CPU per viewer.
    //   audioCodec=aac         -> transcode audio only. BD rips are typically TrueHD / DTS-HD / EAC3
    //                             which browsers cannot decode in MP4; AAC is universally supported.
    //                             Audio transcoding is cheap (~1-2% CPU).
    //   audioChannels=2        -> downmix to stereo. Multichannel AAC-in-MP4 is spotty across
    //                             browsers; stereo plays everywhere.
    //
    // Route is GetVideoStreamByContainer in VideosController.cs.
    // We intentionally do NOT pass static=true: that makes Jellyfin serve the original file bytes
    // and ignore the container suffix, returning raw MKV which <video> cannot play.
    buildRemuxStreamPath(
        itemId: string,
        mediaSourceId: string,
        playSessionId: string,
        audioStreamIndex?: number,
        startTimeTicks?: number,
    ): string {
        const params = new URLSearchParams({
            mediaSourceId,
            PlaySessionId: playSessionId,
            videoCodec: 'copy',
            audioCodec: 'aac',
            audioChannels: '2',
            audioBitRate: '192000',
        });
        if (typeof audioStreamIndex === 'number') {
            params.set('audioStreamIndex', String(audioStreamIndex));
        }
        if (typeof startTimeTicks === 'number' && startTimeTicks > 0) {
            params.set('startTimeTicks', String(startTimeTicks));
        }
        return `/Videos/${itemId}/stream.mp4?${params.toString()}`;
    }

    buildSubtitleVttPath(itemId: string, mediaSourceId: string, streamIndex: number, startTimeTicks?: number): string {
        // /Videos/{itemId}/{mediaSourceId}/Subtitles/{streamIndex}/{startPositionTicks}/Stream.vtt
        // Jellyfin rebases cue timestamps to startPositionTicks (relative to that origin), so this
        // MUST match the video stream's startTimeTicks (loadedStartMs) — otherwise cues drift from
        // the video by the seek offset after a seek. format=vtt forces VTT even if source is SRT.
        const ticks = typeof startTimeTicks === 'number' && startTimeTicks > 0 ? startTimeTicks : 0;
        return `/Videos/${itemId}/${mediaSourceId}/Subtitles/${streamIndex}/${ticks}/Stream.vtt?format=vtt`;
    }

    buildImagePath(itemId: string, type: 'Primary' | 'Backdrop' | 'Thumb', tag?: string): string {
        const suffix = tag ? `?tag=${encodeURIComponent(tag)}` : '';
        return `/Items/${itemId}/Images/${type}${suffix}`;
    }

    // Internal: fetch a URL with API-key header, returning the axios response for streaming.
    // Used by JellyfinRoutes.ts for proxy passthrough.
    get rawHttp(): AxiosInstance {
        return this.http;
    }
}

// ----- Signed stream tokens -----
//
// Why tokens at all: <video src> and <track src> can't send Authorization headers, so we need
// URL-embedded proof that the requester is a SkyChat user. There's no per-item ACL in this
// system (anyone who can browse can stream anything they browse) — so binding to itemId or
// mediaSourceId would protect nothing. Minimal scheme: HMAC(userId + expiresAt, SALT).

export type StreamTokenPayload = { u: number; e: number };

function getSalt(): string {
    const salt = process.env.USERS_TOKEN_SALT;
    if (!salt) {
        throw new Error('USERS_TOKEN_SALT not set');
    }
    return salt;
}

export function issueStreamToken(userId: number, expiresAt: number): string {
    const payload = Buffer.from(JSON.stringify({ u: userId, e: expiresAt } satisfies StreamTokenPayload)).toString('base64url');
    const sig = crypto.createHmac('sha256', getSalt()).update(payload).digest('base64url');
    return `${payload}.${sig}`;
}

export function verifyStreamToken(token: string): { userId: number } | null {
    if (typeof token !== 'string') {
        return null;
    }
    const dot = token.indexOf('.');
    if (dot <= 0 || dot === token.length - 1) {
        return null;
    }
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    let expected: Uint8Array;
    let given: Uint8Array;
    try {
        expected = new Uint8Array(crypto.createHmac('sha256', getSalt()).update(payload).digest());
        given = new Uint8Array(Buffer.from(sig, 'base64url'));
    } catch {
        return null;
    }
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
        return null;
    }
    let parsed: StreamTokenPayload;
    try {
        parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as StreamTokenPayload;
    } catch {
        return null;
    }
    if (typeof parsed.u !== 'number' || typeof parsed.e !== 'number' || Date.now() > parsed.e) {
        return null;
    }
    return { userId: parsed.u };
}

// Default token lifetime — 2 hours is long enough that seeking across a single movie never
// expires mid-playback, while staying short enough that leaked URLs age out.
export const STREAM_TOKEN_TTL_MS = 2 * 3600 * 1000;

// ----- VideoFetcher implementation -----

function ticksToMs(ticks: number | undefined): number {
    // Jellyfin uses 100ns ticks (10^7 per second)
    return typeof ticks === 'number' ? Math.floor(ticks / 10_000) : 0;
}

// Inverse of ticksToMs — Jellyfin uses 100ns ticks (10^4 per ms).
export function msToTicks(ms: number): number {
    return ms * 10_000;
}

function buildTitle(item: JellyfinItem): string {
    if (item.Type === 'Episode' && item.SeriesName) {
        const s = typeof item.ParentIndexNumber === 'number' ? String(item.ParentIndexNumber).padStart(2, '0') : '??';
        const e = typeof item.IndexNumber === 'number' ? String(item.IndexNumber).padStart(2, '0') : '??';
        return `${item.SeriesName} - S${s}E${e} - ${item.Name}`;
    }
    if (item.Type === 'Movie' && item.ProductionYear) {
        return `${item.Name} (${item.ProductionYear})`;
    }
    return item.Name;
}

export class JellyfinFetcher implements VideoFetcher {
    private clientInstance: JellyfinClient | null = null;

    constructor() {
        const url = process.env.JELLYFIN_INTERNAL_URL;
        const key = process.env.JELLYFIN_API_KEY;
        if (!url || !key || url.trim().length === 0 || key.trim().length === 0) {
            Logging.warn('Jellyfin env vars missing (JELLYFIN_INTERNAL_URL / JELLYFIN_API_KEY). Jellyfin fetcher is disabled.');
            return;
        }
        this.clientInstance = new JellyfinClient(url, key);
    }

    get enabled(): boolean {
        return this.clientInstance !== null;
    }

    get client(): JellyfinClient {
        if (!this.clientInstance) {
            throw new Error('Jellyfin is not configured on the server');
        }
        return this.clientInstance;
    }

    private async ready(): Promise<JellyfinClient> {
        const client = this.client;
        await client.ensureReady();
        return client;
    }

    /**
     * @override
     * Accepts one or more space-separated item ids and queues them in the given order.
     * A bad id is skipped so one stale selection doesn't sink the whole batch; if every id
     * fails we surface the first error (keeps the single-id error message intact).
     */
    async get(_playerPlugin: PlayerPlugin, param: string): Promise<VideoInfo[]> {
        const ids = param.trim().split(/\s+/).map(normalizeId).filter(Boolean);
        if (ids.length === 0 || ids.some((id) => !JELLYFIN_ID_REGEX.test(id))) {
            throw new Error('Invalid Jellyfin item id');
        }
        const client = await this.ready();
        const userId = await client.resolveUserId();

        const videos: VideoInfo[] = [];
        let firstError: Error | null = null;
        for (const id of ids) {
            try {
                videos.push(await this.getOne(client, userId, id));
            } catch (err) {
                firstError ??= err as Error;
                Logging.warn(`Jellyfin queue skipped ${id}: ${(err as Error).message}`);
            }
        }
        if (videos.length === 0) {
            throw firstError ?? new Error('Unable to fetch items');
        }
        return videos;
    }

    private async getOne(client: JellyfinClient, userId: string, id: string): Promise<VideoInfo> {
        // getItem returns MediaSources + MediaStreams without minting a PlaySessionId.
        // We intentionally do NOT call PlaybackInfo here (that would create a ghost session
        // visible in Jellyfin's dashboard on every queue). The proxy route calls PlaybackInfo
        // lazily when an actual byte stream is requested.
        // Map upstream failures to clear messages — the raw axios message ("Request failed with
        // status code 404") reaches the user verbatim and leaks nothing useful.
        let item: JellyfinItem;
        try {
            item = await client.getItem(userId, id);
        } catch (err) {
            if (axios.isAxiosError(err) && err.response?.status === 404) {
                throw new Error('Jellyfin item not found');
            }
            Logging.warn(`Jellyfin getItem failed for ${id}: ${(err as Error).message}`);
            throw new Error('Could not reach Jellyfin');
        }
        const source = item.MediaSources?.[0];
        if (!source) {
            throw new Error('Jellyfin item has no playable media source');
        }

        const streams = source.MediaStreams ?? [];
        const videoStream = streams.find((s) => s.Type === 'Video');
        const audioTracks = streams
            .filter((s) => s.Type === 'Audio')
            .map((s) => ({
                index: s.Index,
                language: s.Language,
                label: s.DisplayTitle ?? s.Title ?? s.Language ?? `Audio ${s.Index}`,
                codec: s.Codec ?? 'unknown',
                isDefault: Boolean(s.IsDefault),
            }));
        const subtitleTracks = streams
            .filter((s) => s.Type === 'Subtitle')
            .map((s) => ({
                index: s.Index,
                language: s.Language,
                label: s.DisplayTitle ?? s.Title ?? s.Language ?? `Subtitle ${s.Index}`,
                codec: s.Codec ?? 'unknown',
                isTextBased: Boolean(s.IsTextSubtitleStream),
                isDefault: Boolean(s.IsDefault),
                isForced: Boolean(s.IsForced),
            }));

        const primaryTag = item.ImageTags?.Primary;

        const video: VideoInfo = {
            type: 'jellyfin',
            id,
            duration: ticksToMs(item.RunTimeTicks),
            startCursor: 0,
            title: buildTitle(item),
            thumb: primaryTag ? `/api/plugin/player/jellyfin/image/${id}/Primary?tag=${encodeURIComponent(primaryTag)}` : undefined,
            jellyfin: {
                mediaSourceId: source.Id,
                container: source.Container ?? 'unknown',
                videoCodec: videoStream?.Codec ?? 'unknown',
                audioTracks,
                subtitleTracks,
            },
        };
        return video;
    }

    /** @override */
    async search(_playerPlugin: PlayerPlugin, type: string, search: string, limit: number): Promise<VideoInfo[]> {
        const client = await this.ready();
        const userId = await client.resolveUserId();

        // Type may be 'movie', 'episode', 'series', or anything else -> default to Movie+Episode.
        const normalized = type?.toLowerCase();
        const types: Array<'Movie' | 'Episode' | 'Series'> =
            normalized === 'movie'
                ? ['Movie']
                : normalized === 'episode'
                ? ['Episode']
                : normalized === 'series'
                ? ['Series']
                : ['Movie', 'Episode'];

        const { items } = await client.searchItems(userId, search, types, { startIndex: 0, limit });
        return items.map((item) => ({
            type: 'jellyfin',
            id: normalizeId(item.Id),
            duration: ticksToMs(item.RunTimeTicks),
            startCursor: 0,
            title: buildTitle(item),
            thumb: item.ImageTags?.Primary
                ? `/api/plugin/player/jellyfin/image/${normalizeId(item.Id)}/Primary?tag=${encodeURIComponent(item.ImageTags.Primary)}`
                : undefined,
        }));
    }
}
