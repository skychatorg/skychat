import { Config } from "../../skychat/Config";
import { Connection } from "../../skychat/Connection";
import { GlobalPlugin } from "../GlobalPlugin";
import { Session } from "../../skychat/Session";
import { Gallery } from "./impl/Gallery";


/**
 * 
 */
export class GalleryPlugin extends GlobalPlugin {

    static readonly commandName = 'gallery';

    static readonly commandAliases = [
        'galleryls',
    ];

    public readonly gallery: Gallery = new Gallery();

    public readonly minRight = typeof Config.PREFERENCES.minRightForGalleryRead === 'number' ? Config.PREFERENCES.minRightForGalleryRead : 0;

    public readonly opOnly = Config.PREFERENCES.minRightForGalleryRead === 'op';

    readonly rules = {
        gallery: { },
        galleryls: {
            minCount: 0,
            maxCount: 1,
            params: [
                { name: "path", pattern: Gallery.FOLDER_PATH_REGEX },
            ]
        },
    }

    public canRead(session: Session): boolean {
        const expectedRight = Config.PREFERENCES.minRightForGalleryRead === 'op' ? Infinity : Config.PREFERENCES.minRightForGalleryRead;
        const actualRight = session.isOP() ? Infinity : session.user.right;
        return actualRight >= expectedRight;
    }

    public canWrite(session: Session): boolean {
        const expectedRight = Config.PREFERENCES.minRightForGalleryWrite === 'op' ? Infinity : Config.PREFERENCES.minRightForGalleryWrite;
        const actualRight = session.isOP() ? Infinity : session.user.right;
        return actualRight >= expectedRight;
    }

    public canDelete(session: Session): boolean {
        const expectedRight = Config.PREFERENCES.minRightForGalleryDelete === 'op' ? Infinity : Config.PREFERENCES.minRightForGalleryDelete;
        const actualRight = session.isOP() ? Infinity : session.user.right;
        return actualRight >= expectedRight;
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        
        switch (alias) {
            case 'galleryls':
                connection.send('gallery', await this.gallery.ls(param));
                break;

            default:
                throw new Error(`Unknown alias ${alias}`);
        }
    }

    async onNewConnection(connection: Connection): Promise<void> {
        // If gallery is available for everyone, send it
        if (Config.PREFERENCES.minRightForGalleryRead === -1) {
            connection.send('gallery', await this.gallery.ls(''));
        }
    }
    
    public async onConnectionAuthenticated(connection: Connection): Promise<void> {
        // If gallery was already sent
        if (Config.PREFERENCES.minRightForGalleryRead === -1) {
            return;
        }
        // If user can access the gallery
        if (this.canRead(connection.session)) {
            connection.send('gallery', await this.gallery.ls(''));
        }
    }
}
