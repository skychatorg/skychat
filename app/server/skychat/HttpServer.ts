import EventEmitter from 'events';
import express from 'express';
import fileUpload from 'express-fileupload';
import * as http from 'http';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import internal from 'stream';
import { WebSocket, WebSocketServer } from 'ws';
import { Config } from './Config.js';
import { FileManager } from './FileManager.js';
import { GlobalPlugin } from '../plugins/GlobalPlugin.js';
import { Logging } from './Logging.js';
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

    static readonly MAX_UPGRADES_PER_SECOND = 4;

    static readonly MAX_UPGRADES_PER_MINUTE = 20;

    static readonly MAX_UPLOADS_PER_MINUTE = 10;

    private readonly app: express.Application;

    private readonly httpServer: http.Server;

    private readonly wss: WebSocketServer;

    private readonly wsCreateSecLimiter: RateLimiterMemory = new RateLimiterMemory({
        points: HttpServer.MAX_UPGRADES_PER_SECOND,
        duration: 1,
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
            Logging.info(`Listening on : ${Config.PORT}`);
        });
    }

    /**
     * Register routes from plugins
     */
    registerPluginRoutes(plugins: GlobalPlugin[]) {
        for (const plugin of plugins) {
            const commandName = (plugin.constructor as any).commandName;
            const routes = plugin.getRoutes();
            for (const route of routes) {
                const fullPath = `/api/plugin/${commandName}${route.path}`;
                Logging.info(`Registering plugin route: ${route.method.toUpperCase()} ${fullPath}`);
                this.app[route.method](fullPath, route.handler);
            }
        }
    }

    private getExpressApp() {
        const app = express();

        // Handle file upload
        app.use(
            fileUpload({
                limits: { fileSize: 10 * 1024 * 1024 },
                createParentPath: true,
                useTempFiles: true,
                tempFileDir: '/tmp/',
            }),
        );
        app.post('/api/upload', this.onFileUpload.bind(this));

        return app;
    }

    private async onServerUpgradeRequest(request: http.IncomingMessage, socket: internal.Duplex, head: Buffer) {
        const ip = RateLimiter.getIP(request);

        try {
            // Rate-limit upgrade requests per IP (creating new connections is costly)
            await this.wsCreateSecLimiter.consume(ip);
            await this.wsCreateMinLimiter.consume(ip);
        } catch (error) {
            Logging.error('Rate limit exceeded for', ip, JSON.stringify(error));
            socket.destroy();
            return;
        }

        // Register upgrade callback
        this.wss.handleUpgrade(request, socket, head, (webSocket: WebSocket) => {
            // We need to listen for error events on the webSocket as soon as it is created,
            //  otherwise the error will be thrown and crash the server
            webSocket.on('error', (error) => {
                Logging.error(`WebSocket error from ${ip}: ${error}`);
            });

            this.emit('connection-upgraded', { request, socket, head, webSocket } as ConnectionUpgradeEvent);
        });
    }

    /**
     * On file upload
     */
    async onFileUpload(req: express.Request, res: express.Response): Promise<void> {
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
