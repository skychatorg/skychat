import { Config } from "../../Config";
import {Connection} from "../../Connection";
import { FileManager } from "../../FileManager";
import { GlobalPlugin } from "../../GlobalPlugin";
import { RoomManager } from "../../RoomManager";
import { Server } from "../../Server";
import { Session } from "../../Session";
import { Gallery, SanitizedGallery } from "./Gallery";


/**
 * 
 */
export class GalleryPlugin extends GlobalPlugin {

    static readonly commandName = 'gallery';

    static readonly commandAliases = ['galleryfolderadd', 'galleryfolderremove', 'galleryadd', 'galleryremove'];

    readonly rules = {
        gallery: { },
        galleryfolderadd: {
            minCount: 1,
            params: [
                {name: "name", pattern: /.+/},
            ]
        },
        galleryfolderremove: {
            minCount: 1,
            params: [
                {name: "id", pattern: /^\d+$/},
            ]
        },
        galleryadd: {
            minCount: 3,
            maxCount: 3,
            params: [
                {name: "link", pattern: Server.UPLOADED_FILE_REGEXP},
                {name: "folder", pattern: /^\d+$/},
                {name: "tags", pattern: /^.+$/},
            ]
        },
        galleryremove: {
            minCount: 1,
            maxCount: 1,
            params: [
                {name: "id", pattern: /^\d+$/},
            ]
        }
    }
    

    public readonly gallery: Gallery = new Gallery();

    constructor(manager: RoomManager) {
        super(manager);

        this.loadStorage();
    }

    /**
     * @override
     */
    protected syncStorage(): void {
        this.storage = this.gallery.sanitized();
        super.syncStorage();
        this.sync();
    }

    /**
     * @override
     */
    protected loadStorage(): void {
        super.loadStorage();
        if (this.storage) {
            this.gallery.setData(this.storage);
        }
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        
        if (alias === 'galleryfolderadd') {
            return await this.handleGalleryFolderAdd(param, connection);
        }

        if (alias === 'galleryfolderremove') {
            return await this.handleGalleryFolderRemove(param, connection);
        }
        
        if (alias === 'galleryadd') {
            return await this.handleGalleryAdd(param, connection);
        }

        if (alias === 'galleryremove') {
            return await this.handleGalleryRemove(param, connection);
        }
    }

    async handleGalleryFolderAdd(param: string, connection: Connection): Promise<void> {
        if (! Config.isOP(connection.session.identifier)) {
            throw new Error(`Only OP can manage folders`);
        }
        const folderName = param.trim();
        const folder = this.gallery.createFolder(folderName);
        this.syncStorage();
    }

    async handleGalleryFolderRemove(param: string, connection: Connection): Promise<void> {
        if (! Config.isOP(connection.session.identifier)) {
            throw new Error(`Only OP can manage folders`);
        }
        const folderId = parseInt(param);
        this.gallery.deleteFolder(folderId);
        this.syncStorage();
    }

    async handleGalleryAdd(param: string, connection: Connection): Promise<void> {
        if (! Config.isOP(connection.session.identifier)) {
            throw new Error(`Only OP can manage medias`);
        }
        const [rawLink, rawFolderId, rawTags] = param.split(' ');
        const link = rawLink;
        const folderId = parseInt(rawFolderId);
        const tags = rawTags.split(',').map(tag => tag.trim());
        if (! FileManager.isUploadedFileUrl(link)) {
            throw new Error('File is not stored on this server');
        }
        this.gallery.addMedia(connection.session.user, folderId, link, tags);
        this.syncStorage();
    }

    async handleGalleryRemove(param: string, connection: Connection): Promise<void> {
        if (! Config.isOP(connection.session.identifier)) {
            throw new Error(`Only OP can manage medias`);
        }
        const [rawFolderId, rawMediaId] = param.split(' ');
        const folderId = parseInt(rawFolderId);
        const mediaId = parseInt(rawMediaId);
        this.gallery.deleteMedia(folderId, mediaId);
        this.syncStorage();
    }

    async onNewConnection(connection: Connection): Promise<void> {
        this.sync([connection.session]);
    }

    public sanitized(): SanitizedGallery {
        return this.gallery.sanitized();
    }

    public sync(sessionsOrNothing?: Session[]): void {
        const sessions: Session[] = sessionsOrNothing || Object.values(Session.sessions);
        for (const session of sessions) {
            session.send('gallery', this.sanitized());
        }
    }
}
