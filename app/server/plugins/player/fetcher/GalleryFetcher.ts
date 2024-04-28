import { GalleryPlugin } from '../../gallery/GalleryPlugin.js';
import { Gallery } from '../../gallery/Gallery.js';
import { VideoInfo } from '../PlayerChannel.js';
import { PlayerPlugin } from '../PlayerPlugin.js';
import { VideoFetcher } from './VideoFetcher.js';

export class GalleryFetcher implements VideoFetcher {
    static readonly ALLOWED_EXTENSIONS: string[] = ['mp4', 'webm'];

    /**
     *
     */
    async getInfoFromLink(playerPlugin: PlayerPlugin, filePath: string): Promise<VideoInfo> {
        // Check that the gallery plugin exists
        const galleryPlugin = playerPlugin.manager.getPlugin('gallery') as GalleryPlugin;
        if (!galleryPlugin) {
            throw new Error('Gallery plugin not found');
        }

        // Get file info
        const playableFileInfo = await Gallery.getPlayableFileInfo(filePath);

        return {
            type: 'gallery',
            id: playableFileInfo.url,
            title: playableFileInfo.title,
            duration: playableFileInfo.duration,
            startCursor: 0,
        };
    }

    /**
     * @override
     */
    async get(playerPlugin: PlayerPlugin, param: string): Promise<VideoInfo[]> {
        return [await this.getInfoFromLink(playerPlugin, param)];
    }

    /**
     * @override
     */
    search(): Promise<VideoInfo[]> {
        throw new Error('Method not implemented.');
    }
}
