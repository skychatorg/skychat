import { Config } from '../../skychat/Config.js';
import { Connection } from '../../skychat/Connection.js';
import { GlobalPlugin } from '../GlobalPlugin.js';
import { Gallery } from './Gallery.js';

/**
 *
 */
export class GalleryPlugin extends GlobalPlugin {
    static readonly commandName = 'gallery';

    static readonly commandAliases = ['galleryls', 'galleryrm'];

    readonly minRight = typeof Config.PREFERENCES.minRightForGalleryRead === 'number' ? Config.PREFERENCES.minRightForGalleryRead : 0;

    readonly opOnly = Config.PREFERENCES.minRightForGalleryRead === 'op';

    readonly rules = {
        gallery: {},
        galleryls: {
            minCount: 0,
            maxCount: 1,
            params: [{ name: 'path', pattern: Gallery.FOLDER_PATH_REGEX }],
        },
        galleryrm: {
            minCount: 1,
            maxCount: 1,
            params: [{ name: 'path', pattern: Gallery.FILE_PATH_REGEX }],
        },
    };

    async run(alias: string, param: string, connection: Connection): Promise<void> {
        switch (alias) {
            case 'galleryls':
                Gallery.ensureNoParentDirectoryAccess(param);
                connection.send('gallery', await Gallery.ls(param));
                break;

            case 'galleryrm':
                if (!Gallery.canDelete(connection.session)) {
                    throw new Error('You do not have the permission to delete files');
                }
                Gallery.ensureNoParentDirectoryAccess(param);
                connection.send('gallery', await Gallery.rm(param));
                break;

            default:
                throw new Error(`Unknown alias ${alias}`);
        }
    }

    async onNewConnection(connection: Connection): Promise<void> {
        // If gallery was already sent
        if (Config.PREFERENCES.minRightForGalleryRead === -1 || Gallery.canRead(connection.session)) {
            connection.send('gallery', await Gallery.ls(''));
        }
    }
}
