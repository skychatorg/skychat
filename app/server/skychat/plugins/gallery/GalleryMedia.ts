

export type SanitizedGalleryMedia = {
    id: number;
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

    public thumb: string;

    public location: string;

    public username: string;

    public tags: string[];

    constructor(data: SanitizedGalleryMedia) {
        this.id = data.id;
        this.thumb = data.thumb;
        this.location = data.location;
        this.username = data.username;
        this.tags = data.tags;
        GalleryMedia.CURRENT_ID = Math.max(GalleryMedia.CURRENT_ID, this.id + 1);
    }

    sanitized(): SanitizedGalleryMedia {
        return {
            id: this.id,
            thumb: this.thumb,
            location: this.location,
            username: this.username,
            tags: this.tags,
        }
    }
}