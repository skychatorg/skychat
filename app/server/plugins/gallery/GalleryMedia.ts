import { FileManager } from "../../skychat/FileManager";


export type SanitizedGalleryMedia = {
    id: number;
    folderId: number;
    thumb: string;
    location: string;
    username: string;
    tags: string[];
}


export class GalleryMedia {

    private static CURRENT_ID: number = 1;

    public static getNextId(): number {
        return GalleryMedia.CURRENT_ID ++;
    }

    public readonly id: number;

    public readonly folderId: number;

    public thumb: string;

    public location: string;

    public username: string;

    public tags: string[];

    constructor(data: SanitizedGalleryMedia) {
        this.id = data.id;
        this.folderId = data.folderId;
        this.thumb = data.thumb;
        this.location = data.location;
        this.username = data.username;
        this.tags = data.tags;
        GalleryMedia.CURRENT_ID = Math.max(GalleryMedia.CURRENT_ID, this.id + 1);
    }

    getLocalPath() {
        return FileManager.getLocalPathFromFileUrl(this.location);
    }

    getExtension(): string {
        const mtc = this.location.match(/\.([a-z0-9]+)$/);
        if (! mtc) {
            throw new Error('Unable to find media extension');
        }
        return mtc[1];
    }

    sanitized(): SanitizedGalleryMedia {
        return {
            id: this.id,
            folderId: this.folderId,
            thumb: this.thumb,
            location: this.location,
            username: this.username,
            tags: this.tags,
        }
    }
}