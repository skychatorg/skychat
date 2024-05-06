import EventEmitter from 'events';
import express from 'express';
import fileUpload from 'express-fileupload';
import * as http from 'http';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import internal from 'stream';
import { WebSocket, WebSocketServer } from 'ws';
import { Config } from './Config.js';
import { FileManager } from './FileManager.js';
import { RateLimiter } from './RateLimiter.js';

export type ConnectionUpgradeEvent = {
    request: http.IncomingMessage;
    socket: internal.Duplex;
    head: Buffer;
    webSocket: WebSocket;
};

/**
 * Generic server object. Handle typed event communication.
 *
 * @emits connection-upgraded
 */
export class HttpServer extends EventEmitter {
    public static readonly UPLOADED_FILE_REGEXP: RegExp = new RegExp('^' + Config.LOCATION + '/uploads/all/([-\\/._a-zA-Z0-9]+)$');

    static readonly MAX_UPGRADES_PER_SECOND = 3;

    static readonly MAX_UPGRADES_PER_MINUTE = 20;

    static readonly MAX_UPLOADS_PER_MINUTE = 10;

    private readonly app: express.Application;

    private readonly httpServer: http.Server;

    private readonly wss: WebSocketServer;

    private readonly wsCreateSecLimiter: RateLimiterMemory = new RateLimiterMemory({
        points: HttpServer.MAX_UPGRADES_PER_SECOND,
        duration: 60,
    });

    private readonly wsCreateMinLimiter: RateLimiterMemory = new RateLimiterMemory({
        points: HttpServer.MAX_UPGRADES_PER_MINUTE,
        duration: 60,
    });

    private readonly fileUploadLimiter: RateLimiterMemory = new RateLimiterMemory({
        points: HttpServer.MAX_UPLOADS_PER_MINUTE,
        duration: 60,
    });

    constructor() {
        super();

        this.app = this.getExpressApp();
        this.httpServer = http.createServer(this.app);
        this.wss = new WebSocketServer({ noServer: true });
    }

    start() {
        this.httpServer.on('upgrade', this.onServerUpgradeRequest.bind(this));
        this.httpServer.listen(Config.PORT, Config.HOSTNAME, function () {
            console.log(`Listening on : ${Config.PORT}`);
        });
    }

    private getExpressApp() {
        const app = express();

        // Bind static files
        // TODO: Use a reverse proxy
        app.use(express.static('dist'));
        app.use('/uploads', express.static('uploads'));
        app.use('/gallery', express.static('gallery'));

        // Handle file upload
        app.use(
            fileUpload({
                limits: { fileSize: 10 * 1024 * 1024 },
                createParentPath: true,
                useTempFiles: true,
                tempFileDir: '/tmp/',
            }),
        );
        app.post('/upload', this.onFileUpload.bind(this));

        return app;
    }

    private async onServerUpgradeRequest(request: http.IncomingMessage, socket: internal.Duplex, head: Buffer) {
        try {
            // Rate-limit upgrade requests per IP (creating new connections is costly)
            await RateLimiter.rateLimit(this.wsCreateSecLimiter, RateLimiter.getIP(request));
            await RateLimiter.rateLimit(this.wsCreateMinLimiter, RateLimiter.getIP(request));
        } catch (error) {
            console.error('Rate limit exceeded for', RateLimiter.getIP(request), JSON.stringify(error));
            socket.destroy();
        }

        // Register upgrade callback
        this.wss.handleUpgrade(request, socket, head, (webSocket: WebSocket) => {
            this.emit('connection-upgraded', { request, socket, head, webSocket } as ConnectionUpgradeEvent);
        });
    }

    /**
     * On file upload
     */
    async onFileUpload(req: express.Request, res: express.Response): Promise<void> {
        try {
            await RateLimiter.rateLimit(this.fileUploadLimiter, RateLimiter.getIP(req));
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
