import { promises as fs } from 'fs';
import { VideoInfo } from '../../player/PlayerChannel';
import { Config } from '../../../skychat/Config';
import { FileManager } from '../../../skychat/FileManager';


export type FolderContent = {
    exists: boolean;
    folders: String[];
    files: String[];
};

export type PlayableFileInfo = {
    url: string;
    title: string;
    duration: number;
};


export class Gallery {

    static readonly FOLDER_PATH_REGEX = /^[^/][a-zA-Z0-9-_/]+$/;

    static readonly FILE_PATH_REGEX = /^[^/][a-zA-Z0-9-_/]+\/[a-zA-Z0-9-_]+\.[a-z0-9]+$/;

    static readonly PLAYABLE_FILES_EXTENSION = ['mp4', 'webm'];

    static readonly BASE_PATH = 'gallery/';

    checkFolderPath(folderPath: string) {
        if (folderPath !== '' && ! Gallery.FOLDER_PATH_REGEX.test(folderPath)) {
            throw new Error('Invalid folder path');
        }
    }
    
    checkFilePath(filePath: string) {
        if (! Gallery.FILE_PATH_REGEX.test(filePath)) {
            throw new Error('Invalid file path ' + filePath);
        }
    }

    async ls(folderPath: string): Promise<FolderContent> {
        this.checkFolderPath(folderPath);

        // Default response structure
        const folderContent: FolderContent = {
            exists: true,
            folders: [],
            files: [],
        };
        try {
            const fileNames = await fs.readdir(Gallery.BASE_PATH + folderPath);
            for (const fileName of fileNames) {
                const stats = await fs.stat(Gallery.BASE_PATH + folderPath + '/' + fileName);
                if (stats.isFile()) {
                    folderContent.files.push(fileName);
                } else {
                    folderContent.folders.push(fileName);
                }
            }
        } catch (err) {
            folderContent.exists = false;
        } finally {
            return folderContent;
        }
    }

    /**
     * Tells whether a file exists in the gallery
     */
    async fileExists(filePath: string): Promise<boolean> {
        this.checkFilePath(filePath);

        try {
            const stats = await fs.stat(Gallery.BASE_PATH + filePath);
            return stats.isFile();
        } catch (err) {
            return false;
        }
    }

    /**
     * Tells whether a file exists in the gallery
     */
    async getPlayableFileInfo(filePath: string): Promise<PlayableFileInfo> {
        this.checkFilePath(filePath);

        if (! await this.fileExists(filePath)) {
            throw new Error('File does not exist');
        }

        const extension = filePath.split('.').pop() || 'unknown';
        if (! Gallery.PLAYABLE_FILES_EXTENSION.includes(extension)) {
            throw new Error('File extension not allowed');
        }

        return {
            url: Config.LOCATION + '/' + Gallery.BASE_PATH + filePath,
            title: filePath.split('/').pop() || filePath,
            duration: await FileManager.getVideoDuration(Gallery.BASE_PATH + filePath),
        };
    }
}
