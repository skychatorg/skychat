import * as fileUpload from "express-fileupload";
import * as fs from 'fs';
const { exec } = require('child_process');
import {RandomGenerator} from "./RandomGenerator";
import {MessageFormatter} from "./MessageFormatter";
import {Config} from "./Config";
import { ShellHelper } from "./ShellHelper";


export class FileManager {

    static saveFile(file: fileUpload.UploadedFile): string {
        const date = new Date();
        const mimeTypes: {[mimetype: string]: string} = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'application/pdf': 'pdf',
            'video/mp4': 'mp4',
            'video/webm': 'webm',
        };
        if (typeof mimeTypes[file.mimetype] === 'undefined') {
            throw new Error('Invalid mimetype');
        }
        const extension = mimeTypes[file.mimetype];
        const filePath = 'uploads/' + date.toISOString().substr(0, 19).replace(/(-|T)/g, '/').replace(/:/g, '-') + '-' + Math.floor(1000000000 * RandomGenerator.random(8)) + '.' + extension;
        file.mv(filePath);
        return filePath;
    }

    static isFileUrlUploaded(fileUrl: string): boolean {
        return !! fileUrl.match(new RegExp('^' + MessageFormatter.escapeRegExp(Config.LOCATION) + '\/uploads\/([0-9a-zA-Z/-]+)\.(jpg|jpeg|png|webp|gif|pdf|mp4|webm)$'));
    }

    static isFileUrlInGallery(fileUrl: string): boolean {
        return !! fileUrl.match(new RegExp('^' + MessageFormatter.escapeRegExp(Config.LOCATION) + '\/gallery\/([0-9]+)\/([0-9]+)\/([0-9a-z-]+)\.(jpg|jpeg|png|webp|gif|pdf|mp4|webm)$'));
    }

    static uploadedFileExists(fileUrl: string): boolean {
        return (this.isFileUrlUploaded(fileUrl) || this.isFileUrlInGallery(fileUrl)) && fs.existsSync(FileManager.getLocalPathFromFileUrl(fileUrl));
    }

    static getLocalPathFromFileUrl(url: string): string {
        return '.' + url.substr(Config.LOCATION.length).split('?')[0];
    }

    /**
     * Get a locally stored video duration in ms
     * @param path 
     * @returns 
     */
    static async getVideoDuration(path: string): Promise<number> {
        const cmd = `ffprobe -v error -show_format -show_streams ${path} | grep 'duration=' | head -n 1 | cut -d'=' -f2`;
        const {stdout, stderr} = await ShellHelper.exec(cmd);
        return parseFloat(stdout.trim()) * 1000;
    }

    static getFileExtension(pathOrUrl: string): string {
        return (pathOrUrl.match(/\.[a-z0-9]+$/) || [''])[0].substr(1);
    }
}
