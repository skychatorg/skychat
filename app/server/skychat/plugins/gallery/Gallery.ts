import { FileManager } from "../../FileManager";
import { RandomGenerator } from "../../RandomGenerator";
import { GalleryFolder, GalleryFolderOptions, SanitizedGalleryFolder } from "./GalleryFolder";
import { GalleryMedia, SanitizedGalleryMedia } from "./GalleryMedia";
import * as fs from 'fs';
import { Config } from "../../Config";
import { User } from "../../User";


export type SanitizedGallery = {
    folders: SanitizedGalleryFolder[];
}


export class Gallery {

    static readonly ALLOWED_EXTENSIONS: string[] = ['png', 'jpg', 'jpeg', 'gif', 'mp4'];

    private folders: GalleryFolder[] = [];

    getFolderById(folderId: number): GalleryFolder | undefined {
        return this.folders.find(f => f.id === folderId);
    }

    createFolder(name: string): GalleryFolder {
        const folder = new GalleryFolder({
            id: GalleryFolder.getNextId(),
            name: name,
        });
        this.folders.push(folder);
        return folder;
    }

    deleteFolder(folderId: number): boolean {
        const index = this.folders.findIndex(folder => folder.id === folderId);
        if (index === -1) {
            return false;
        }
        this.folders.splice(index, 1);
        return true;
    }

    getMediaPath(mediaId: number): string {
        return `uploads/gallery/${Math.floor(mediaId / 1e6)}/${Math.floor(mediaId / 1e3)}/`;
    }

    buildMediaThumb(mediaUrl: string): string {
        const extension = FileManager.getFileExtension(mediaUrl);

        if (extension === 'mp4') {
            return 'assets/images/icons/video.png';
        }

        if (['png', 'jpg', 'jpeg', 'gif'].indexOf(extension) !== -1) {
            return mediaUrl;
        }

        throw new Error('Unable to build media thumbnail');
    }

    addMedia(user: User, folderId: number, link: string, tags: string[]) {
        const folder = this.getFolderById(folderId);
        if (! folder) {
            throw new Error(`Folder ${folderId} does not exist`);
        }
        if (! FileManager.isFileUrlUploaded(link)) {
            throw new Error(`File ${link} not found`);
        }
        const uploadedFilePath = FileManager.getLocalPathFromFileUrl(link);
        const extension = FileManager.getFileExtension(uploadedFilePath);
        if (Gallery.ALLOWED_EXTENSIONS.indexOf(extension) === -1) {
            throw new Error(`Extension ${extension} not supported`)
        }
        const mediaId = GalleryMedia.getNextId();
        const newMediaDirPath = this.getMediaPath(mediaId);
        const newMediaFilename = Math.floor(RandomGenerator.random(8) * 1e16) + '-' + new Date().toISOString().substr(0, 19).replace(/[-T:]/g, '-') + '.' + extension;
        const newMediaPath = newMediaDirPath + newMediaFilename;
        fs.mkdirSync(newMediaDirPath, { recursive: true });
        fs.renameSync(uploadedFilePath, newMediaPath);
        const mediaUrl = Config.LOCATION + '/' + newMediaDirPath + newMediaFilename;
        const media = new GalleryMedia({
            id: mediaId,
            folderId: folderId,
            location: mediaUrl,
            tags: tags,
            thumb: this.buildMediaThumb(mediaUrl),
            username: user.username,
        });
        folder.addMedia(media);
    }

    deleteMedia(folderId: number, mediaId: number) {
        const folder = this.getFolderById(folderId);
        if (! folder) {
            throw new Error(`Folder ${folderId} does not exist`);
        }
        folder.deleteMedia(mediaId);
    }

    search(query: string) {
        const matches = this.folders
            .map(folder => folder.search(query))
            .filter(folder => folder.medias.length > 0);
        return { folders: matches };
    }

    sanitized(limit?: number): SanitizedGallery {
        return {
            folders: this.folders.map(folder => folder.sanitized(limit)),
        }
    }

    setData(data: SanitizedGallery) {
        this.folders = [];
        for (const folderData of data.folders) {
            const folder = new GalleryFolder({id: folderData.id, name: folderData.name});
            folder.setMedias(folderData.medias);
            this.folders.push(folder);
        }
    }
}
