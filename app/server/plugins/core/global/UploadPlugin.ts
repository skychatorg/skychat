import express from 'express';
import fileUpload from 'express-fileupload';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { FileManager } from '../../../skychat/FileManager.js';
import { RateLimiter } from '../../../skychat/RateLimiter.js';
import { GlobalPlugin, PluginRoute } from '../../GlobalPlugin.js';

export class UploadPlugin extends GlobalPlugin {
    static readonly commandName = 'upload';

    static readonly commandAliases: string[] = [];

    readonly callable = false;

    readonly hidden = true;

    private static readonly MAX_UPLOADS_PER_MINUTE = 10;

    private readonly fileUploadLimiter: RateLimiterMemory = new RateLimiterMemory({
        points: UploadPlugin.MAX_UPLOADS_PER_MINUTE,
        duration: 60,
    });

    public install(app: express.Application): void {
        app.use(
            fileUpload({
                limits: { fileSize: 10 * 1024 * 1024 },
                createParentPath: true,
                useTempFiles: true,
                tempFileDir: '/tmp/',
            }),
        );
    }

    getRoutes(): PluginRoute[] {
        return [
            {
                method: 'post',
                path: '',
                handler: this.onFileUpload.bind(this),
            },
            {
                method: 'post',
                path: '/api/upload',
                handler: this.onFileUpload.bind(this),
            },
        ];
    }

    public async run(): Promise<void> {
        throw new Error('Upload plugin cannot be called as a command');
    }

    private async onFileUpload(req: express.Request, res: express.Response): Promise<void> {
        try {
            await RateLimiter.rateLimitSafe(this.fileUploadLimiter, RateLimiter.getIP(req));
            const file: fileUpload.UploadedFile | fileUpload.UploadedFile[] | undefined = req.files ? req.files.file : undefined;
            if (!file) {
                throw new Error('File not found');
            }
            if (Array.isArray(file)) {
                throw new Error('Please upload one file at the time');
            }
            res.send(JSON.stringify({ status: 200, path: FileManager.saveFile(file) }));
        } catch (error) {
            res.send(JSON.stringify({ status: 500, message: (error as any).toString() }));
        } finally {
            res.end();
        }
    }
}
