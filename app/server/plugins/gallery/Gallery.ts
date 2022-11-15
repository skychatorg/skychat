import { promises as fs } from 'fs';
import { Config } from '../../skychat/Config';
import { FileManager } from '../../skychat/FileManager';
import { Session } from '../../skychat/Session';


export type FileType = 'video' | 'audio' | 'image' | 'subtitle' | 'unknown';


export type FolderContent = {
    exists: boolean;
    thumb?: string;
    folders: string[];
    files: { name: string, type: FileType }[];
};

export type PlayableFileInfo = {
    url: string;
    title: string;
    duration: number;
};


export class Gallery {

    static readonly FOLDER_PATH_REGEX = /^[^/][a-zA-Z0-9-_/]+$/;

    static readonly FILE_PATH_REGEX = /^([^/][a-zA-Z0-9-_/]+\/)?[a-zA-Z0-9-_]+\.[a-z0-9]+$/;

    static readonly THUMB_FILE_NAMES = ['thumb.png', 'thumb.jpg', 'thumb.jpeg'];

    static readonly EXTENSION_FILE_TYPES: {[key: string]: FileType} = {
        'mp4': 'video',
        'webm': 'video',
        'vtt': 'subtitle',
        'mp3': 'audio',
        'ogg': 'audio',
        'jpg': 'image',
        'jpeg': 'image',
        'png': 'image',
    };

    static readonly DEFAULT_FILE_TYPE = 'unknown';

    static readonly BASE_PATH = 'gallery/';

    static canRead(session: Session): boolean {
        const expectedRight = Config.PREFERENCES.minRightForGalleryRead === 'op' ? Infinity : Config.PREFERENCES.minRightForGalleryRead;
        const actualRight = session.isOP() ? Infinity : session.user.right;
        return actualRight >= expectedRight;
    }

    static canWrite(session: Session): boolean {
        const expectedRight = Config.PREFERENCES.minRightForGalleryWrite === 'op' ? Infinity : Config.PREFERENCES.minRightForGalleryWrite;
        const actualRight = session.isOP() ? Infinity : session.user.right;
        return actualRight >= expectedRight;
    }

    static canDelete(session: Session): boolean {
        const expectedRight = Config.PREFERENCES.minRightForGalleryDelete === 'op' ? Infinity : Config.PREFERENCES.minRightForGalleryDelete;
        const actualRight = session.isOP() ? Infinity : session.user.right;
        return actualRight >= expectedRight;
    }

    static checkFolderPath(folderPath: string) {
        if (folderPath !== '' && ! Gallery.FOLDER_PATH_REGEX.test(folderPath)) {
            throw new Error('Invalid folder path');
        }
    }
    
    static checkFilePath(filePath: string) {
        if (! Gallery.FILE_PATH_REGEX.test(filePath)) {
            throw new Error('Invalid file path ' + filePath);
        }
    }

    static async ls(folderPath: string): Promise<FolderContent> {
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
                if (! folderContent.thumb && Gallery.THUMB_FILE_NAMES.includes(fileName)) {
                    folderContent.thumb = Config.LOCATION + '/' + Gallery.BASE_PATH + folderPath + '/' + fileName;
                }
                if (stats.isFile()) {
                    const ext = fileName.split('.').pop() as string;
                    folderContent.files.push({
                        name: fileName,
                        type: Gallery.EXTENSION_FILE_TYPES[ext] || Gallery.DEFAULT_FILE_TYPE,
                    });
                } else if (stats.isDirectory()) {
                    folderContent.folders.push(fileName);
                } else {
                    console.warn('Unknown file type', fileName);
                }
            }
        } catch (err) {
            folderContent.exists = false;
        } finally {
            return folderContent;
        }
    }

    static async rm(filePath: string): Promise<FolderContent> {
        this.checkFilePath(filePath);
        try {
            await fs.unlink(Gallery.BASE_PATH + filePath);
            return await this.ls(filePath.split('/').slice(0, -1).join('/'));
        } catch (err) {
            throw new Error('Unable to remove file');
        }
    }

    /**
     * Tells whether a file exists in the gallery
     */
    static async fileExists(filePath: string): Promise<boolean> {
        this.checkFilePath(filePath);

        try {
            const stats = await fs.stat(Gallery.BASE_PATH + filePath);
            return stats.isFile();
        } catch (err) {
            return false;
        }
    }

    /**
     * Ensure a file type exists and get its type
     */
    static async getFileType(filePath: string): Promise<string> {
        this.checkFilePath(filePath);

        try {
            const stats = await fs.stat(Gallery.BASE_PATH + filePath);
            if (stats.isFile()) {
                const ext = filePath.split('.').pop() as string;
                return Gallery.EXTENSION_FILE_TYPES[ext] || Gallery.DEFAULT_FILE_TYPE;
            } else {
                return Gallery.DEFAULT_FILE_TYPE;
            }
        } catch (err) {
            return Gallery.DEFAULT_FILE_TYPE;
        }
    }

    /**
     * Tells whether a file exists in the gallery
     */
    static async getPlayableFileInfo(filePath: string): Promise<PlayableFileInfo> {
        this.checkFilePath(filePath);

        if (! await this.fileExists(filePath)) {
            throw new Error('File does not exist');
        }

        const fileType = await this.getFileType(filePath);
        if (fileType !== 'video') {
            throw new Error('File is not a video');
        }

        return {
            url: Config.LOCATION + '/' + Gallery.BASE_PATH + filePath,
            title: filePath.split('/').pop() || filePath,
            duration: await FileManager.getVideoDuration(Gallery.BASE_PATH + filePath),
        };
    }
}
