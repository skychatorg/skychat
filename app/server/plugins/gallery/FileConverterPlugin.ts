import {Connection} from "../../skychat/Connection";
import { GlobalPlugin } from "../../skychat/GlobalPlugin";
import { RoomManager } from "../../skychat/RoomManager";
import { GalleryMedia } from "./GalleryMedia";
import { GalleryPlugin } from "./GalleryPlugin";
import { spawn } from 'child_process';
import { UserController } from "../../skychat/UserController";
import * as fs from 'fs';
import { Gallery } from "./Gallery";
import { RandomGenerator } from "../../skychat/RandomGenerator";
import { Config } from "../../skychat/Config";


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

    public readonly opOnly = true;

    readonly rules = {
        convert: {
            minCount: 2,
            maxCount: 2,
            params: [
                { name: "media location", pattern: /.+/ },
                { name: "convert destination", pattern: /^([a-z0-9]+)$/ },
            ]
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

        const gallery = galleryPlugin.gallery;

        const [mediaUrl, convertDestination] = param.split(' ');
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
        const convertedMediaPath: string = await method.bind(this)(gallery, connection, media);

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

    async webm_to_mp4(gallery: Gallery, connection: Connection, media: GalleryMedia) {
        return this.convertVideoToMP4(gallery, connection, 'webm', media);
    }

    convertVideoToMP4(gallery: Gallery, connection: Connection, sourceType: string, media: GalleryMedia) {
        return new Promise((resolve, reject) => {
            const currentMediaPath = media.getLocalPath();
            const convertedMediaPath = currentMediaPath.replace(new RegExp('\\.' + sourceType + '$'), `.mp4`);
            const rawCommand = `ffmpeg -i ${currentMediaPath} ${convertedMediaPath} -y`;
            const spawn0 = rawCommand.split(' ')[0];
            const spawnArgs = rawCommand.substr(spawn0.length + 1).split(' ');

            // Prepare a message which will track the updates
            const message = UserController.createNeutralMessage({ content: `Converting..`, });
            connection.send('message', message.sanitized());

            const process = spawn(spawn0, spawnArgs);

            process.stdout.on("data", data => {
                message.append(data);
                connection.send('message-edit', message.sanitized());
            });

            process.stderr.on("data", data => {
                message.append(data);
                connection.send('message-edit', message.sanitized());
            });

            process.on('error', (error) => {
                message.append(`\nProcess errro: ${error}`);
                connection.send('message-edit', message.sanitized());
                reject(`Unable to convert file`);
            });

            process.on("close", code => {
                message.append(`child process exited with code ${code}`);
                connection.send('message-edit', message.sanitized());

                // If there was an error (file is not there)
                if (! fs.existsSync(convertedMediaPath)) {
                    message.append(`\nUnable to convert file.`);
                    connection.send('message-edit', message.sanitized());
                    reject(`Unable to convert file`);
                    return;
                }

                resolve(convertedMediaPath);
            });
        });
    }
}
