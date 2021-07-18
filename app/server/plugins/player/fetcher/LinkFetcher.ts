import { FileManager } from "../../../skychat/FileManager";
import { VideoInfo } from "../PlayerChannel";
import { VideoFetcher } from "./VideoFetcher";



export class LinkFetcher implements VideoFetcher {

    static readonly ALLOWED_EXTENSIONS: string[] = ['mp4', 'webm'];

    /**
     * 
     * @param link 
     */
    async getInfoFromLink(link: string): Promise<VideoInfo> {
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
        return {
            type: 'embed',
            id: localPath,
            duration: duration,
            startCursor: 0,
            title: localPath,
        };
    }

    /**
     * 
     * @param param 
     */
    async get(param: string): Promise<VideoInfo[]> {
        return [await this.getInfoFromLink(param)];
    }

    /**
     * 
     * @param type 
     * @param search 
     * @param limit 
     */
    search(type: string, search: string, limit: number): Promise<VideoInfo[]> {
        throw new Error("Method not implemented.");
    }
}
