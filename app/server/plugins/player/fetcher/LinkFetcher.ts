import { FileManager } from "../../../skychat/FileManager";
import { GalleryPlugin } from "../../gallery/GalleryPlugin";
import { VideoInfo } from "../PlayerChannel";
import { PlayerPlugin } from "../PlayerPlugin";
import { VideoFetcher } from "./VideoFetcher";



export class LinkFetcher implements VideoFetcher {

    static readonly ALLOWED_EXTENSIONS: string[] = ['mp4', 'webm'];

    /**
     * 
     */
    async getInfoFromLink(playerPlugin: PlayerPlugin, link: string): Promise<VideoInfo> {
        if (! FileManager.isFileUrlUploaded(link) && ! FileManager.isFileUrlInGallery(link)) {
            throw new Error('Only videos stored on this server can be fetched');
        }
        if (! FileManager.uploadedFileExists(link)) {
            throw new Error('Video does not exist');
        }
        const localPath = FileManager.getLocalPathFromFileUrl(link);
        const extension = FileManager.getFileExtension(localPath);
        if (LinkFetcher.ALLOWED_EXTENSIONS.indexOf(extension) === -1) {
            throw new Error('Extension not allowed');
        }
        const duration = await FileManager.getVideoDuration(localPath);
        // If file coming from the gallery, get the associated media
        let title = `Media.${extension}`;
        let thumb: string | undefined = undefined;
        if (FileManager.isFileUrlInGallery(link) && playerPlugin.manager.getPlugin('gallery')) {
            const gallery = (playerPlugin.manager.getPlugin('gallery') as GalleryPlugin).gallery;
            const media = gallery.getMediaFromUrl(link);
            if (media) {
                title = media.tags.join(' ') + '.' + extension;
                thumb = media.thumb;
            }
        }
        return {
            type: 'embed',
            id: localPath,
            startCursor: 0,
            thumb,
            duration,
            title,
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
    search(playerPlugin: PlayerPlugin, type: string, search: string, limit: number): Promise<VideoInfo[]> {
        throw new Error("Method not implemented.");
    }
}
