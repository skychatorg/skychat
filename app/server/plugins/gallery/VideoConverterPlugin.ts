const util = require('util');
const exec = util.promisify(require('node:child_process').exec);
import { spawn } from 'child_process';
import { Config } from "../../skychat/Config";
import { Connection } from "../../skychat/Connection";
import { FileManager } from "../../skychat/FileManager";
import { GlobalPlugin } from "../GlobalPlugin";
import { Gallery } from "./Gallery";


export type VideoStreamInfo = Array<{
    index: number,
    lang: string | null,
    type: 'Video' | 'Audio' | 'Subtitle',
    info: string,
}>;

export type OngoingConvert = {
    status: 'converting' | 'converted' | 'error',
    source: string,
    target: string,
    info: VideoStreamInfo,
    selectedStreams: Array<number>,
    stdout: string,
    stderr: string,
};


/**
 * 
 */
export class VideoConverterPlugin extends GlobalPlugin {

    static readonly commandName = 'convert';

    static readonly commandAliases = [
        'convertinfo',
    ];

    public readonly gallery: Gallery = new Gallery();

    readonly minRight = typeof Config.PREFERENCES.minRightForGalleryWrite === 'number' ? Config.PREFERENCES.minRightForGalleryWrite : 0;

    readonly opOnly = Config.PREFERENCES.minRightForGalleryWrite === 'op';

    readonly rules = {
        convertinfo: {
            minCount: 1,
            maxCount: 1,
            params: [
                { name: "file path", pattern: Gallery.FILE_PATH_REGEX },
            ]
        },
        convert: {
            minCount: 2,
            maxCount: 2,
            params: [
                { name: "file path", pattern: Gallery.FILE_PATH_REGEX },
                { name: "streams", pattern: /^\d+(,\d+)*$/ },
            ]
        },
    }

    /**
     * Converts in progress
     */
    readonly converts: Array<OngoingConvert> = [];

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        
        switch (alias) {
            case 'convertinfo':
                await this.runConvertInfo(param, connection);
                break;
            
            case 'convert':
                const filePath = param.split(' ')[0];
                const streamIndexes = param.split(' ')[1].split(',').map((index: string) => parseInt(index));
                await this.runConvert(filePath, streamIndexes, connection);
                break;

            default:
                throw new Error(`Unknown alias ${alias}`);
        }
    }

    async runConvertInfo(filePath: string, connection: Connection): Promise<void> {
        if (FileManager.getFileExtension(filePath) !== 'mkv') {
            throw new Error('Can not convert this file');
        }
        if (! (await Gallery.fileExists(filePath))) {
            throw new Error(`File ${filePath} does not exist`);
        }
        try {
            connection.send('convert-info', await this.getVideoStreamInfo(filePath));

        } catch (error) {
            throw new Error(`Unable to convert ${filePath}`);
        }
    }

    async runConvert(filePath: string, streamIndexes: number[], connection: Connection): Promise<void> {
        if (FileManager.getFileExtension(filePath) !== 'mkv') {
            throw new Error('Can not convert this file');
        }
        if (! (await Gallery.fileExists(filePath))) {
            throw new Error(`File ${filePath} does not exist`);
        }
        const streams = await this.getVideoStreamInfo(filePath);
        let command = `ffmpeg -i ${Gallery.BASE_PATH + filePath}`;
        for (const index of streamIndexes) {
            // Get corresponding stream
            const stream = streams.find(stream => stream.index === index);
            if (! stream) {
                throw new Error(`Stream #${index} does not exist`);
            }
            if (['Video', 'Audio'].includes(stream.type)) {
                command += ` -map 0:${stream.index}`;
            } else if (stream.type === 'Subtitle') {
                command += ` -vf subtitles=${filePath}:stream_index=${stream.index}`;
            }
        }
        // -pix_fmt yuv420p
        const target = `${Gallery.BASE_PATH + filePath}-$${streamIndexes.join('-')}.mp4`;
        command += ` ${target}.mp4`;
        // TODO: Run command & show output 
        // TODO: There should be:
        // TODO: - A list of pending converts (storred here, sent to everyone who has permission to write to the gallery on update)
        // TODO: - A way for the client to ask for real time update of a convert (on-demand)
        const convert: OngoingConvert = {
            status: 'converting',
            source: filePath,
            target: `${Gallery.BASE_PATH + filePath}-${streamIndexes.join('-')}.mp4`,
            info: streams,
            selectedStreams: streamIndexes,
            stdout: '',
            stderr: '',
        };
        this.converts.push(convert);
        const process = spawn(command.split(' ')[0], command.split(' ').slice(1));
        process.stdout.on('data', data => convert.stdout += data.toString());
        process.stderr.on('data', data => convert.stdout += data.toString());
        process.on('error', error => convert.status = 'error');
        process.on('close', async code => {
            if (! (await Gallery.fileExists(target))) {
                convert.status = 'error';
                return;
            }
            convert.status = 'converted';
        });
    }

    async getVideoStreamInfo(filePath: string): Promise<VideoStreamInfo> {
        const { stdout, stderr } = await exec(`ffmpeg -i ${Gallery.BASE_PATH + filePath} 2>&1 | grep "Stream #"`);
        return stdout
            .split('\n')
            .map((line: string) => line.trim())
            .filter((line: string) => !! line && line.startsWith('Stream #'))
            .map((streamInfo: string) => {
                const [, index, lang, type, info] = streamInfo.match(/^Stream #0:(\d+)([^:]+)?: ([^:]+): (.*)$/) || [];
                return {
                    index: parseInt(index),
                    lang: lang ? lang.replace(/[^a-zA-Z]/g, '') : null,
                    type,
                    info,
                };
            });
    }
}
