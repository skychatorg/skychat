import util from 'util';
import { exec as oldExec, spawn } from 'child_process';
import { Config } from '../../skychat/Config';
import { Connection } from '../../skychat/Connection';
import { FileManager } from '../../skychat/FileManager';
import { Session } from '../../skychat/Session';
import { GlobalPlugin } from '../GlobalPlugin';
import { Gallery } from './Gallery';

const exec = util.promisify(oldExec);


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
    lastUpdate: string | null,
};


/**
 *
 */
export class VideoConverterPlugin extends GlobalPlugin {
    static readonly commandName = 'convert';

    static readonly commandAliases = [
        'convertinfo',
        'convertlist',
    ];

    public readonly gallery: Gallery = new Gallery();

    readonly minRight = typeof Config.PREFERENCES.minRightForGalleryRead === 'number' ? Config.PREFERENCES.minRightForGalleryRead : 0;

    readonly opOnly = Config.PREFERENCES.minRightForGalleryRead === 'op';

    readonly rules = {
        convertinfo: {
            minCount: 1,
            maxCount: 1,
            params: [
                { name: 'file path', pattern: Gallery.FILE_PATH_REGEX },
            ]
        },
        convert: {
            minCount: 2,
            maxCount: 2,
            params: [
                { name: 'file path', pattern: Gallery.FILE_PATH_REGEX },
                { name: 'streams', pattern: /^\d+(,\d+)*$/ },
            ]
        },
        convertlist: {
            minCount: 0,
            maxCount: 0,
        },
    };

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
            // eslint-disable-next-line no-case-declarations
            const filePath = param.split(' ')[0];
            // eslint-disable-next-line no-case-declarations
            const streamIndexes = param.split(' ')[1].split(',').map((index: string) => parseInt(index));
            await this.runConvert(filePath, streamIndexes, connection);
            break;

        case 'convertlist':
            await this.runConvertList(connection);
            break;

        default:
            throw new Error(`Unknown alias ${alias}`);
        }
    }

    async runConvertInfo(filePath: string, connection: Connection): Promise<void> {
        if (! Gallery.canWrite(connection.session)) {
            throw new Error('You do not have the permission to convert files');
        }
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
        if (! Gallery.canWrite(connection.session)) {
            throw new Error('You do not have the permission to convert files');
        }
        if (FileManager.getFileExtension(filePath) !== 'mkv') {
            throw new Error('Can not convert this file');
        }
        if (! (await Gallery.fileExists(filePath))) {
            throw new Error(`File ${filePath} does not exist`);
        }
        const streams = await this.getVideoStreamInfo(filePath);
        let command = `ffmpeg -i ${Gallery.BASE_PATH + filePath} -y`;
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
        const target = `${Gallery.BASE_PATH + filePath}-${streamIndexes.join('-')}.mp4`;
        command += ` ${target}.mp4`;
        const convert: OngoingConvert = {
            status: 'converting',
            source: filePath,
            target: `${Gallery.BASE_PATH + filePath.replace(/\.[a-z0-9]$/, '')}-${streamIndexes.join('-')}.mp4`,
            info: streams,
            selectedStreams: streamIndexes,
            lastUpdate: null,
        };
        this.converts.push(convert);
        const process = spawn(command.split(' ')[0], command.split(' ').slice(1));
        // ffmpeg sends data on stderr
        process.stderr.on('data', data => {
            const line = data.toString().trim();
            if (! line.startsWith('frame=')) {
                return;
            }
            convert.lastUpdate = line;
        });
        process.on('error', () => {
            convert.status = 'error';
            this.syncConvertList();
        });
        process.on('exit', async () => {
            if (! (await Gallery.fileExists(target))) {
                convert.status = 'error';
                return;
            }
            convert.status = 'converted';
        });
        this.syncConvertList();
    }

    async runConvertList(connection: Connection) {
        connection.send('convert-list', this.converts);
    }

    async getVideoStreamInfo(filePath: string): Promise<VideoStreamInfo> {
        const { stdout } = await exec(`ffmpeg -i ${Gallery.BASE_PATH + filePath} 2>&1 | grep "Stream #"`);
        return stdout
            .split('\n')
            .map((line: string) => line.trim())
            .filter((line: string) => !! line && line.startsWith('Stream #'))
            .map((streamInfo: string) => {
                const [, index, lang, type, info] = streamInfo.match(/^Stream #0:(\d+)([^:]+)?: ([^:]+): (.*)$/) || [];
                return {
                    index: parseInt(index),
                    lang: lang ? lang.replace(/[^a-zA-Z]/g, '') : null,
                    type: type as 'Video' | 'Audio' | 'Subtitle',
                    info,
                };
            });
    }

    async onNewConnection(connection: Connection): Promise<void> {
        // If list of converting files is available for everyone, send it
        if (Config.PREFERENCES.minRightForGalleryRead === -1) {
            connection.send('convert-list', this.converts);
        }
    }

    async onConnectionAuthenticated(connection: Connection): Promise<void> {
        // If list of converting files was already sent
        if (Config.PREFERENCES.minRightForGalleryRead === -1) {
            return;
        }
        if (Gallery.canRead(connection.session)) {
            connection.send('convert-list', this.converts);
        }
    }

    async syncConvertList(): Promise<void> {
        for (const connection of Session.connections) {
            if (! Gallery.canRead(connection.session)) {
                continue;
            }
            connection.send('convert-list', this.converts);
        }
    }
}
