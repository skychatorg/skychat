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



type EventHandler<payloadFilter> = (payload: payloadFilter, client: Connection) => Promise<void>;
type EventsDescription = {
    [eventName: string]: {
        payloadFilter?: iof.MaskFilter,
        handler: EventHandler<any>
    };
};




/**
 * Generic server object. Handle typed event communication.
 */
export class Server {

    public static readonly UPLOADED_FILE_REGEXP: RegExp = new RegExp(Config.LOCATION + '/uploads/([-\\/._a-zA-Z0-9]+)');

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

    constructor(sessionBuilder: (request: http.IncomingMessage) => Promise<Session>) {
        this.sessionBuilder = sessionBuilder;
        this.app = express();
        this.app.use(express.static('dist'));
        this.app.use('/uploads', express.static('uploads'));
        this.app.use(fileUpload({
            limits: { fileSize: 5 * 1024 * 1024 },
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
        this.wss = new WebSocket.Server({noServer: true});
        this.wss.on('connection', this.onConnection.bind(this));
        server.on('upgrade', (request, socket, head) => {
            this.wss.handleUpgrade(request, socket, head, (ws) => {
                this.wss.emit('connection', ws, request);
            });
        });
        server.listen(Config.PORT, function() {
            console.log('Listening on :' + Config.PORT);
        });
    }

    /**
     * On file upload
     * @param req
     * @param res
     */
    public onFileUpload(req: express.Request, res: express.Response): void {
        const file: any = req.files ? req.files.file : undefined;
        if (! file) {
            res.send(JSON.stringify({"status": 500, "message": "File not found"}));
            res.end();
            return;
        }
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
            res.send(JSON.stringify({"status": 500, "message": "Invalid mimetype"}));
            res.end();
            return;
        }
        const extension = mimeTypes[file.mimetype];
        const filePath = 'uploads/' + date.toISOString().substr(0, 19).replace(/(-|T)/g, '/').replace(/:/g, '-') + '-' + Math.floor(1000000000 * Math.random()) + '.' + extension;
        file.mv(filePath);
        res.send(JSON.stringify({"status": 200, "path": filePath}));
        res.end();
    }

    /**
     * Register a new client event
     * @param name
     * @param handler
     * @param payloadType Type of payload. If set to a string, the type of the payload should be equal to this string. Can also be set to a valid mask filter.
     */
    public registerEvent<PayloadType>(name: string, handler: EventHandler<PayloadType>, payloadType?: string | iof.MaskFilter): void {
        const payloadFilter = typeof payloadType === 'string' ? new iof.ValueTypeFilter(payloadType) : payloadType;
        this.events[name] = {
            handler: handler.bind(handler),
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

        // For every registered event
        Object.keys(this.events).forEach(eventName => {
            // Register it on the connection object
            connection.on(eventName, (payload: any) => this.onConnectionEvent(eventName, payload, connection));
        });

        if (typeof this.onConnectionCreated === 'function') {
            await this.onConnectionCreated(connection);
        }
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

            // Call handler
            await event.handler(payload, connection);

        } catch (error) {

            connection.sendError(error);
        }
    }
}
