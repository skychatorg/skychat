import * as fileUpload from "express-fileupload";
import * as fs from 'fs';
import {RandomGenerator} from "./RandomGenerator";
import {MessageFormatter} from "./MessageFormatter";
import {Config} from "./Config";


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

    static isUploadedFileUrl(fileUrl: string): boolean {
        return !! fileUrl.match(new RegExp('^' + MessageFormatter.escapeRegExp(Config.LOCATION) + '\/uploads\/([0-9a-zA-Z/-]+)\.(jpg|jpeg|png|webp|gif|pdf|mp4|webm)$'));
    }

    static uploadedFileExists(fileUrl: string): boolean {
        return this.isUploadedFileUrl(fileUrl) && fs.existsSync(FileManager.getLocalPathFromFileUrl(fileUrl));
    }

    static getLocalPathFromFileUrl(url: string): string {
        return '.' + url.substr(Config.LOCATION.length).split('?')[0];
    }

    static getFileExtension(pathOrUrl: string): string {
        return (pathOrUrl.match(/\.[a-z]+$/) || [''])[0].substr(1);
    }
}
