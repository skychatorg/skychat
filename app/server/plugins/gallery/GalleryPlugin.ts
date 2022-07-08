import { Config } from "../../skychat/Config";
import { Connection } from "../../skychat/Connection";
import { GlobalPlugin } from "../GlobalPlugin";
import { Session } from "../../skychat/Session";
import { Gallery } from "./Gallery";


/**
 * 
 */
export class GalleryPlugin extends GlobalPlugin {

    static readonly commandName = 'gallery';

    static readonly commandAliases = [
        'galleryls',
        'galleryrm',
    ];

    readonly minRight = typeof Config.PREFERENCES.minRightForGalleryRead === 'number' ? Config.PREFERENCES.minRightForGalleryRead : 0;

    readonly opOnly = Config.PREFERENCES.minRightForGalleryRead === 'op';

    readonly rules = {
        gallery: { },
        galleryls: {
            minCount: 0,
            maxCount: 1,
            params: [
                { name: "path", pattern: Gallery.FOLDER_PATH_REGEX },
            ]
        },
        galleryrm: {
            minCount: 1,
            maxCount: 1,
            params: [
                { name: "path", pattern: Gallery.FILE_PATH_REGEX },
            ]
        },
    }

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        
        switch (alias) {
            case 'galleryls':
                connection.send('gallery', await Gallery.ls(param));
                break;

            case 'galleryrm':
                if (! Gallery.canDelete(connection.session)) {
                    throw new Error('You do not have the permission to delete files');
                }
                connection.send('gallery', await Gallery.rm(param));
                break;

            default:
                throw new Error(`Unknown alias ${alias}`);
        }
    }

    async onNewConnection(connection: Connection): Promise<void> {
        // If gallery is available for everyone, send it
        if (Config.PREFERENCES.minRightForGalleryRead === -1) {
            connection.send('gallery', await Gallery.ls(''));
        }
    }
    
    public async onConnectionAuthenticated(connection: Connection): Promise<void> {
        // If gallery was already sent
        if (Config.PREFERENCES.minRightForGalleryRead === -1) {
            return;
        }
        // If user can access the gallery
        if (Gallery.canRead(connection.session)) {
            connection.send('gallery', await Gallery.ls(''));
        }
    }
}
