import * as fileUpload from 'express-fileupload';
import fs from 'fs';
import { RandomGenerator } from './RandomGenerator';
import { MessageFormatter } from './MessageFormatter';
import { Config } from './Config';
import { ShellHelper } from './ShellHelper';

export class FileManager {
    static getNewFileLocation(extension: string): string {
        const date = new Date();
        return 'uploads/all/' + date.toISOString().substr(0, 19).replace(/(-|T)/g, '/').replace(/:/g, '-') + '-' + Math.floor(1000000000 * RandomGenerator.random(8)) + '.' + extension;
    }

    static saveFile(file: fileUpload.UploadedFile): string {
        const mimeTypes: { [mimetype: string]: string } = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'application/pdf': 'pdf',
            'video/mp4': 'mp4',
            'video/mkv': 'mkv',
            'video/webm': 'webm',
        };
        if (typeof mimeTypes[file.mimetype] === 'undefined') {
            throw new Error('Invalid mimetype');
        }
        const extension = mimeTypes[file.mimetype];
        const filePath = FileManager.getNewFileLocation(extension);
        file.mv(filePath);
        return filePath;
    }

    static isFileUrlUploaded(fileUrl: string): boolean {
        return !!fileUrl.match(new RegExp('^' + MessageFormatter.escapeRegExp(Config.LOCATION + '/uploads/all/') + '([0-9a-zA-Z/-]+)\\.(jpg|jpeg|png|webp|gif|pdf|mp4|mkv|webm)$'));
    }

    static isFileUrlInGallery(fileUrl: string): boolean {
        return !!fileUrl.match(new RegExp('^' + MessageFormatter.escapeRegExp(Config.LOCATION + '/gallery/') + '([a-zA-Z0-9-_/]+).[a-z0-9]+$'));
    }

    static uploadedFileExists(fileUrl: string): boolean {
        return (this.isFileUrlUploaded(fileUrl) || this.isFileUrlInGallery(fileUrl)) && fs.existsSync(FileManager.getLocalPathFromFileUrl(fileUrl));
    }

    static getLocalPathFromFileUrl(url: string): string {
        return '.' + url.substr(Config.LOCATION.length).split('?')[0];
    }

    static getFileUrlFromLocalPath(path: string): string {
        // Remove the leading '.' if there is one
        if (path.substr(0, 1) === '.') {
            path = path.substr(1);
        }
        // Add the first slash if it is missing
        if (path.substr(0, 1) !== '/') {
            path = '/' + path;
        }
        return Config.LOCATION + path;
    }

    static getFileDirectory(path: string): string {
        const dir = path.substr(0, path.lastIndexOf('/'));
        return dir.length === 0 ? '.' : dir;
    }

    /**
     * Get a locally stored video duration in ms
     * @param path
     * @returns
     */
    static async getVideoDuration(path: string): Promise<number> {
        const cmd = `ffprobe -v error -show_format -show_streams ${path} | grep 'duration=' | grep -v 'N/A' | head -n 1 | cut -d'=' -f2`;
        const { stdout } = await ShellHelper.exec(cmd);
        return parseFloat(stdout.trim()) * 1000;
    }

    static getFileExtension(pathOrUrl: string): string {
        return (pathOrUrl.match(/\.[a-z0-9]+$/) || [''])[0].substr(1);
    }
}
