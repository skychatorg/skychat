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

    static readonly commandAliases = ['gallerysearch', 'galleryfolderadd', 'galleryfolderremove', 'galleryadd', 'gallerydelete'];

    public readonly minRight = Config.PREFERENCES.minRightForGallery;

    readonly rules = {
        gallery: { },
        gallerysearch: {
            minCount: 1,
        },
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
        gallerydelete: {
            minCount: 2,
            maxCount: 2,
            params: [
                {name: "folderId", pattern: /^\d+$/},
                {name: "mediaId", pattern: /^\d+$/},
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

        if (alias === 'gallerysearch') {
            return await this.handleGallerySearch(param, connection);
        }
        
        if (alias === 'galleryfolderadd') {
            return await this.handleGalleryFolderAdd(param, connection);
        }

        if (alias === 'galleryfolderremove') {
            return await this.handleGalleryFolderRemove(param, connection);
        }
        
        if (alias === 'galleryadd') {
            return await this.handleGalleryAdd(param, connection);
        }

        if (alias === 'gallerydelete') {
            return await this.handleGalleryDelete(param, connection);
        }
    }

    async handleGallerySearch(param: string, connection: Connection): Promise<void> {
        const results = this.gallery.search(param);
        connection.send('gallery-search', results);
    }

    async handleGalleryFolderAdd(param: string, connection: Connection): Promise<void> {
        if (! connection.session.isOP()) {
            throw new Error(`Only OP can manage folders`);
        }
        const folderName = param.trim();
        const folder = this.gallery.createFolder(folderName);
        this.syncStorage();
    }

    async handleGalleryFolderRemove(param: string, connection: Connection): Promise<void> {
        if (! connection.session.isOP()) {
            throw new Error(`Only OP can manage folders`);
        }
        const folderId = parseInt(param);
        this.gallery.deleteFolder(folderId);
        this.syncStorage();
    }

    async handleGalleryAdd(param: string, connection: Connection): Promise<void> {
        if (! connection.session.isOP()) {
            throw new Error(`Only OP can manage medias`);
        }
        const [rawLink, rawFolderId, rawTags] = param.split(' ');
        const link = rawLink;
        const folderId = parseInt(rawFolderId);
        const tags = rawTags.split(',').map(tag => tag.trim());
        if (! FileManager.isFileUrlUploaded(link)) {
            throw new Error('File is not stored on this server');
        }
        this.gallery.addMedia(connection.session.user, folderId, link, tags);
        this.syncStorage();
    }

    async handleGalleryDelete(param: string, connection: Connection): Promise<void> {
        if (! connection.session.isOP()) {
            throw new Error(`Only OP can manage medias`);
        }
        const [rawFolderId, rawMediaId] = param.split(' ');
        const folderId = parseInt(rawFolderId);
        const mediaId = parseInt(rawMediaId);
        this.gallery.deleteMedia(folderId, mediaId);
        this.syncStorage();
    }

    async onNewConnection(connection: Connection): Promise<void> {
        // If gallery is available for everyone, send it
        if (Config.PREFERENCES.minRightForGallery === -1) {
            this.sync([connection.session]);
        }
    }
    
    public async onConnectionAuthenticated(connection: Connection): Promise<void> {
        // If user can access the gallery
        if (Config.PREFERENCES.minRightForGallery > -1 && connection.session.user.right >= Config.PREFERENCES.minRightForGallery) {
            this.sync([connection.session]);
        }
    }
    
    public sanitized(): SanitizedGallery {
        return this.gallery.sanitized();
    }

    public sync(sessionsOrNothing?: Session[]): void {
        const sessions: Session[] = sessionsOrNothing || Object.values(Session.sessions);
        for (const session of sessions) {
            session.send('gallery', this.gallery.sanitized(4));
        }
    }
}
