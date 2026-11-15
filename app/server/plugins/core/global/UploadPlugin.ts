import express from 'express';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { FileManager } from '../../../skychat/FileManager.js';
import { RateLimiter } from '../../../skychat/RateLimiter.js';
import { UserController } from '../../../skychat/UserController.js';
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

    private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024;

    /** Run by the upload route only, once the uploader is known: anything else would write files to disk for anyone */
    private readonly readFile = fileUpload({
        limits: { fileSize: UploadPlugin.MAX_FILE_SIZE, files: 1 },
        createParentPath: true,
        useTempFiles: true,
        tempFileDir: '/tmp/',
    });

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

    /**
     * The client sends the login token it keeps. Guests have none
     */
    private async authenticate(req: express.Request): Promise<void> {
        const header = req.header('x-auth-token');
        if (!header) {
            throw new Error('Log in to upload files');
        }
        try {
            await UserController.verifyAuthToken(JSON.parse(header));
        } catch {
            throw new Error('Log in to upload files');
        }
    }

    private async onFileUpload(req: express.Request, res: express.Response): Promise<void> {
        let file: fileUpload.UploadedFile | fileUpload.UploadedFile[] | undefined;
        let reply: object;
        try {
            await RateLimiter.rateLimitSafe(this.fileUploadLimiter, RateLimiter.getIP(req));
            await this.authenticate(req);
            await new Promise<void>((resolve, reject) => this.readFile(req, res, (error?: unknown) => (error ? reject(error) : resolve())));
            file = req.files?.file;
            if (!file) {
                throw new Error('File not found');
            }
            if (Array.isArray(file)) {
                throw new Error('Please upload one file at the time');
            }
            if (file.truncated) {
                throw new Error(`Files are limited to ${UploadPlugin.MAX_FILE_SIZE / 1024 / 1024} MB`);
            }
            reply = { status: 200, path: await FileManager.saveFile(file) };
        } catch (error) {
            reply = { status: 500, message: (error as Error).toString() };
        }
        // Moved away when saved: what is still there was refused
        for (const upload of [file ?? []].flat()) {
            await fs.promises.rm(upload.tempFilePath, { force: true });
        }
        res.send(JSON.stringify(reply));
    }
}
