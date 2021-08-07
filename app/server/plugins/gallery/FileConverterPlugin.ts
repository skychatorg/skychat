import {Connection} from "../../skychat/Connection";
import { GlobalPlugin } from "../GlobalPlugin";
import { RoomManager } from "../../skychat/RoomManager";
import { GalleryMedia } from "./GalleryMedia";
import { GalleryPlugin } from "./GalleryPlugin";
import { spawn } from 'child_process';
import { UserController } from "../../skychat/UserController";
import * as fs from 'fs';
import { Config } from "../../skychat/Config";
import { Session } from "../../skychat/Session";
import { exec } from 'child_process';


/**
 * 
 */
export class FileConverterPlugin extends GlobalPlugin {

    static readonly CONVERT_DESTINATIONS: { [sourceExt: string]: {[destExt: string]: true} } = {
        'mkv': {
            'mp4': true,
        },
        'webm': {
            'mp4': true,
        }
    };

    static readonly commandName = 'convert';

    static readonly commandAliases = ['convertinfo'];

    public readonly minRight = typeof Config.PREFERENCES.minRightForGalleryWrite === 'number' ? Config.PREFERENCES.minRightForGalleryWrite : 0;

    public readonly opOnly = Config.PREFERENCES.minRightForGalleryWrite === 'op';

    readonly rules = {
        convert: {
            minCount: 2,
            params: [
                { name: "media location", pattern: /.+/ },
                { name: "convert destination", pattern: /^([a-z0-9]+)$/ },
                { name: "options", pattern: /./ },
            ]
        },
        convertinfo: {
            minCount: 1,
            maxCount: 1,
            params: [{ name: "media location", pattern: /.+/ }]
        },
    }
    
    public readonly galleryPlugin: GalleryPlugin;

    constructor(manager: RoomManager) {
        super(manager);

        this.galleryPlugin = this.manager.getPlugin('gallery') as GalleryPlugin;
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        const galleryPlugin = this.manager.getPlugin('gallery') as GalleryPlugin | null;
        if (! galleryPlugin) {
            throw new Error('Gallery plugin not found');
        }

        if (alias === 'convertinfo') {
            await this.handleConvertInfo(param, connection, galleryPlugin);
            return;
        }

        if (alias === 'convert') {
            await this.handleConvert(param, connection, galleryPlugin);
            return;
        }
    }

    async handleConvertInfo(param: string, connection: Connection, galleryPlugin: GalleryPlugin): Promise<void> {

        const gallery = galleryPlugin.gallery;

        const media = gallery.getMediaFromUrl(param);
        if (! media) {
            throw new Error('Media does not exist');
        }

        const folder = gallery.getFolderById(media.folderId);
        if (! folder) {
            throw new Error('Folder does not exist');
        }

        const result = await this.getVideoInfo(media);
        const message = UserController.createNeutralMessage({ content: result || 'Error', });
        connection.send('message', message.sanitized());
    }

    async handleConvert(param: string, connection: Connection, galleryPlugin: GalleryPlugin): Promise<void> {

        const gallery = galleryPlugin.gallery;

        const [mediaUrl, convertDestination, ...convertOptions] = param.split(' ');
        const media = gallery.getMediaFromUrl(mediaUrl);
        if (! media) {
            throw new Error('Media does not exist');
        }

        const folder = gallery.getFolderById(media.folderId);
        if (! folder) {
            throw new Error('Folder does not exist');
        }

        // Convert media
        const converts = FileConverterPlugin.CONVERT_DESTINATIONS[media.getExtension()];
        if (! converts || ! converts[convertDestination]) {
            throw new Error(`Conversion from ${media.getExtension()} to ${convertDestination} is not supported.`);
        }

        const method = (this as any)[`${media.getExtension().toLowerCase()}_to_${convertDestination.toLowerCase()}`];
        if (! method) {
            throw new Error('Conversion method has not been implemented');
        }

        // Run convert function
        let convertedMediaPath: string | undefined;
        let thrownError: Error | undefined;
        try {
            convertedMediaPath = await method.bind(this)(connection, media, convertOptions.join(' '));
        } catch (error) {
            thrownError = error;
        }
        const session = Session.getSessionByIdentifier(connection.session.identifier);
        session && session.send('message', UserController.createNeutralMessage({ id: 0, content: `@${session.identifier} ` + (thrownError ? thrownError.message : 'File conversion finished')}).sanitized());
        if (thrownError || ! convertedMediaPath) {
            return;
        }

        // Convert successful: Create new media and move converted file
        const mediaId = GalleryMedia.getNextId();
        const newMediaDirPath = gallery.getMediaPath(mediaId);
        const newMediaFilename = gallery.getRandomName() + '.mp4';
        const newMediaPath = newMediaDirPath + newMediaFilename;
        fs.mkdirSync(newMediaDirPath, { recursive: true });
        fs.renameSync(convertedMediaPath, newMediaPath);
        const newMediaUrl = Config.LOCATION + '/' + newMediaDirPath + newMediaFilename;
        const newMedia = new GalleryMedia({
            id: mediaId,
            folderId: media.folderId,
            location: newMediaUrl,
            tags: Array.from(media.tags),
            thumb: gallery.buildMediaThumb(newMediaUrl),
            username: connection.session.user.username,
        });
        folder.addMedia(newMedia);
        galleryPlugin.syncStorage();
    }

    async webm_to_mp4(connection: Connection, media: GalleryMedia, options: string) {
        return this.convertVideoToMP4(connection, 'webm', media, options);
    }

    async mkv_to_mp4(connection: Connection, media: GalleryMedia, options: string) {
        return this.convertVideoToMP4(connection, 'mkv', media, options);
    }

    /**
     * Convert any video to MP4 (supported in all browsers)
     * @param connection 
     * @param sourceType 
     * @param media 
     * @returns 
     */
    convertVideoToMP4(connection: Connection, sourceType: string, media: GalleryMedia, options?: string) {
        return new Promise((resolve, reject) => {
            const currentMediaPath = media.getLocalPath();
            const convertedMediaPath = currentMediaPath.replace(new RegExp('\\.' + sourceType + '$'), `.mp4`);
            const rawCommand = `ffmpeg -i ${currentMediaPath} -y ${options || ''} ${convertedMediaPath}`;
            const spawn0 = rawCommand.split(' ')[0];
            const spawnArgs = rawCommand.substr(spawn0.length + 1).split(' ');

            // Prepare a message which will track the updates
            const message = UserController.createNeutralMessage({ content: `Started file conversion`, });
            connection.send('message', message.sanitized());

            const process = spawn(spawn0, spawnArgs);

            // STDOUT/STDERR
            process.stdout.on("data", data => { console.info(data.toString()); });
            process.stderr.on("data", data => { console.info(data.toString()); });

            // Process error
            process.on('error', error => {
                reject(`Unable to convert file`);
            });

            // Process finished
            process.on("close", code => {

                // If there was an error (file is not there)
                if (! fs.existsSync(convertedMediaPath)) {
                    reject(`Unable to convert file`);
                    return;
                }

                resolve(convertedMediaPath);
            });
        });
    }

    /**
     * 
     * @param media 
     */
    getVideoInfo(media: GalleryMedia): Promise<string> {
        return new Promise((resolve, reject) => {

            const currentMediaPath = media.getLocalPath();
            const rawCommand = `ffmpeg -i ${currentMediaPath} 2>&1 | grep "Stream #"`;

            exec(rawCommand, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }

                const result = stdout.trim();
                resolve(result);
            });
        });
    }
}
