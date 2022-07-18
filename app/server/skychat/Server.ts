import * as WebSocket from "ws";
import * as http from "http";
import * as https from "https";
import {Connection} from "./Connection";
import * as iof from "io-filter";
import {Session} from "./Session";
import * as express from "express";
import {Config} from "./Config";
import * as fs from "fs";
import * as fileUpload from "express-fileupload";
import { FileManager } from "./FileManager";



type EventHandler<payloadFilter> = (payload: payloadFilter, client: Connection) => Promise<void>;

type EventsDescription = {
    [eventName: string]: {
        handler: EventHandler<any>;
        coolDownMs: number;
        maxCallsPer60Seconds: number;
        payloadFilter?: iof.MaskFilter;
    };
};




/**
 * Generic server object. Handle typed event communication.
 */
export class Server {

    public static readonly UPLOADED_FILE_REGEXP: RegExp = new RegExp('^' + Config.LOCATION + '/uploads/all/([-\\/._a-zA-Z0-9]+)$');

    /**
     * List of accepted events.
     */
    private readonly events: EventsDescription = {};

    private readonly app: express.Application;

    private readonly wss: WebSocket.Server;

    public onConnectionCreated?: (connection: Connection) => Promise<void>;

    /**
     * Builds a session object when a new connection is initiated
     */
    public sessionBuilder: (request: http.IncomingMessage) => Promise<Session>;

    /**
     * Cooldown entries
     */
    private coolDownEntries: {[key: string]: {first: Date, last: Date, count: number}} = {};

    constructor(sessionBuilder: (request: http.IncomingMessage) => Promise<Session>) {
        this.sessionBuilder = sessionBuilder;
        this.app = express();
        this.app.use(express.static('dist'));
        this.app.use('/uploads', express.static('uploads'));
        this.app.use('/gallery', express.static('gallery'));
        this.app.use(fileUpload({
            limits: { fileSize: 10 * 1024 * 1024 },
            createParentPath: true,
            useTempFiles: true,
            tempFileDir: '/tmp/'
        }));
        this.app.post('/upload', this.onFileUpload.bind(this));
        this.app.get('*', function(req: express.Request, res: express.Response){
            res.status(404).send('404');
        });
        let server;
        if (Config.USE_SSL) {
            server = https.createServer({
                cert: fs.readFileSync(Config.SSL_CERTIFICATE),
                key: fs.readFileSync(Config.SSL_CERTIFICATE_KEY)
            }, this.app);
        } else {
            server = http.createServer(this.app);
        }
        this.wss = new WebSocket.Server({ noServer: true });
        this.wss.on('connection', this.onConnection.bind(this));
        server.on('upgrade', (request, socket, head) => {
            this.wss.handleUpgrade(request, socket, head, (ws) => {
                this.wss.emit('connection', ws, request);
            });
        });
        server.listen(Config.PORT, Config.HOSTNAME, function() {
            console.log('Listening on :' + Config.PORT);
        });
    }

    /**
     * On file upload
     * @param req
     * @param res
     */
    public onFileUpload(req: express.Request, res: express.Response): void {
        try {
            const file: fileUpload.UploadedFile | fileUpload.UploadedFile[] | undefined = req.files ? req.files.file : undefined;
            if (! file) {
                throw new Error('File not found');
            }
            if (Array.isArray(file)) {
                throw new Error('Please upload one file at the time');
            }
            res.send(JSON.stringify({"status": 200, "path": FileManager.saveFile(file)}));
        } catch (error) {
            res.send(JSON.stringify({"status": 500, "message": (error as any).toString()}));
        } finally {
            res.end();
        }
    }

    /**
     * Register a new client event
     * @param name
     * @param handler
     * @param coolDownMs
     * @param maxCallsPer60Seconds
     * @param payloadType Type of payload. If set to a string, the type of the payload should be equal to this string. Can also be set to a valid mask filter.
     */
    public registerEvent<PayloadType>(name: string, handler: EventHandler<PayloadType>, coolDownMs: number, maxCallsPer60Seconds: number, payloadType?: string | iof.MaskFilter): void {
        const payloadFilter = typeof payloadType === 'string' ? new iof.ValueTypeFilter(payloadType) : payloadType;
        this.events[name] = {
            handler: handler.bind(handler),
            coolDownMs: coolDownMs,
            maxCallsPer60Seconds: maxCallsPer60Seconds,
            payloadFilter: payloadFilter,
        };
    }

    /**
     * When a new client connects
     * @param webSocket
     * @param request
     */
    private async onConnection(webSocket: WebSocket, request: http.IncomingMessage): Promise<void> {

        // Create a session based on the just-computed identifier
        const session = await this.sessionBuilder(request);

        // Create a new connection object & attach it to the session
        const connection = new Connection(session, webSocket, request);

        if (typeof this.onConnectionCreated === 'function') {
            await this.onConnectionCreated(connection);
        }

        // For every registered event
        Object.keys(this.events).forEach(eventName => {
            // Register it on the connection object
            connection.on(eventName, (payload: any) => this.onConnectionEvent(eventName, payload, connection));
        });
    }

    /**
     * When a new event is received
     * @param eventName
     * @param payload
     * @param connection
     */
    private async onConnectionEvent(eventName: keyof EventsDescription, payload: any, connection: Connection): Promise<void> {
        try {

            const event = this.events[eventName];

            // If payload filter is defined
            if (event.payloadFilter) {
                // Use it as a mask on the payload
                payload = event.payloadFilter.mask(payload);
            }

            // If a cooldown is defined for this event
            if (event.coolDownMs) {
                let key = `${eventName}/${connection.ip}`;
                if (this.coolDownEntries[key] && event.coolDownMs && new Date() < new Date(this.coolDownEntries[key].last.getTime() + event.coolDownMs)) {
                    throw new Error('Please wait before performing this action again');
                }
                // If 10 second window entry still valid
                if (this.coolDownEntries[key] && event.maxCallsPer60Seconds && this.coolDownEntries[key].first.getTime() + 60 * 1000 > new Date().getTime()) {
                    // If maximum number of calls per 10 seconds reached
                    if (this.coolDownEntries[key].count > event.maxCallsPer60Seconds) {
                        throw new Error('Please wait before performing this action again');
                    }
                }
                this.coolDownEntries[key] = this.coolDownEntries[key] || {
                    first: new Date(),
                    last: new Date(),
                    count: 0,
                };
                this.coolDownEntries[key].last = new Date();
                this.coolDownEntries[key].count ++;
            }

            // Call handler
            await event.handler(payload, connection);

        } catch (error) {

            connection.sendError((error as Error));
        }
    }

    /**
     * Cleanup stale cooldown entries
     */
    public cleanup(): void {
        for (const key of Object.keys(this.coolDownEntries)) {
            if (this.coolDownEntries[key].first.getTime() + 60 * 1000 < new Date().getTime()) {
                delete this.coolDownEntries[key];
            }
        }
    }
}
