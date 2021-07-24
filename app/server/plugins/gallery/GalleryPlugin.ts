import { Config } from "../../skychat/Config";
import {Connection} from "../../skychat/Connection";
import { FileManager } from "../../skychat/FileManager";
import { GlobalPlugin } from "../../skychat/GlobalPlugin";
import { RoomManager } from "../../skychat/RoomManager";
import { Server } from "../../skychat/Server";
import { Session } from "../../skychat/Session";
import { User } from "../../skychat/User";
import { Gallery, SanitizedGallery } from "./Gallery";


/**
 * 
 */
export class GalleryPlugin extends GlobalPlugin {

    static readonly MAX_SHOWN_MEDIAS_PER_FOLDER = 20;

    static readonly commandName = 'gallery';

    static readonly commandAliases = ['gallerysearch', 'galleryfolderadd', 'galleryfolderremove', 'galleryadd', 'gallerydelete'];

    public readonly minRight = typeof Config.PREFERENCES.minRightForGalleryRead === 'number' ? Config.PREFERENCES.minRightForGalleryRead : 0;

    public readonly opOnly = Config.PREFERENCES.minRightForGalleryRead === 'op';

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
    public syncStorage(): void {
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

    public canWrite(session: Session): boolean {
        const expectedRight = Config.PREFERENCES.minRightForGalleryWrite === 'op' ? Infinity : Config.PREFERENCES.minRightForGalleryWrite;
        const actualRight = session.isOP() ? Infinity : session.user.right;
        return actualRight >= expectedRight;
    }

    public canRead(session: Session): boolean {
        const expectedRight = Config.PREFERENCES.minRightForGalleryRead === 'op' ? Infinity : Config.PREFERENCES.minRightForGalleryRead;
        const actualRight = session.isOP() ? Infinity : session.user.right;
        return actualRight >= expectedRight;
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {

        if (alias === 'gallerysearch') {
            return await this.handleGallerySearch(param, connection);
        }

        // After this point, all calls must have write permission
        if (! this.canWrite(connection.session)) {
            throw new Error('You do not have write permission to the gallery');
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
        const folderName = param.trim();
        const folder = this.gallery.createFolder(folderName);
        this.syncStorage();
    }

    async handleGalleryFolderRemove(param: string, connection: Connection): Promise<void> {
        const folderId = parseInt(param);
        this.gallery.deleteFolder(folderId);
        this.syncStorage();
    }

    async handleGalleryAdd(param: string, connection: Connection): Promise<void> {
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
        const [rawFolderId, rawMediaId] = param.split(' ');
        const folderId = parseInt(rawFolderId);
        const mediaId = parseInt(rawMediaId);
        this.gallery.deleteMedia(folderId, mediaId);
        this.syncStorage();
    }

    async onNewConnection(connection: Connection): Promise<void> {
        // If gallery is available for everyone, send it
        if (Config.PREFERENCES.minRightForGalleryRead === -1) {
            this.sync([connection.session]);
        }
    }
    
    public async onConnectionAuthenticated(connection: Connection): Promise<void> {
        // If gallery was already sent
        if (Config.PREFERENCES.minRightForGalleryRead === -1) {
            return;
        }
        // If user can access the gallery
        if (this.canRead(connection.session)) {
            this.sync([connection.session]);
        }
    }
    
    public sanitized(session: Session, limit?: number): { data: SanitizedGallery, canWrite: boolean } {
        return {
            data: this.gallery.sanitized(limit),
            canWrite: this.canWrite(session),
        };
    }

    public sync(sessionsOrNothing?: Session[]): void {
        const sessions: Session[] = sessionsOrNothing || Object.values(Session.sessions);
        for (const session of sessions) {
            session.send('gallery', this.sanitized(session, GalleryPlugin.MAX_SHOWN_MEDIAS_PER_FOLDER));
        }
    }
}
