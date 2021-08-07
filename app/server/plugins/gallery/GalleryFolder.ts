import { GalleryMedia, SanitizedGalleryMedia } from "./GalleryMedia";


export type SanitizedGalleryFolder = {
    id: number;
    name: string;
    medias: SanitizedGalleryMedia[];
}

export type GalleryFolderOptions = {
    id: number;
    name: string;
}

export class GalleryFolder {

    private static CURRENT_ID: number = 1;

    public static getNextId(): number {
        return GalleryFolder.CURRENT_ID ++;
    }

    public readonly id: number;

    public name: string;
    
    public medias: GalleryMedia[] = [];

    constructor(data: GalleryFolderOptions) {
        this.id = data.id;
        this.name = data.name;
        GalleryFolder.CURRENT_ID = Math.max(GalleryFolder.CURRENT_ID, this.id + 1);
    }

    getMediaById(mediaId: number): GalleryMedia | undefined {
        return this.medias.find(media => media.id === mediaId);
    }

    addMedia(media: GalleryMedia) {
        this.medias.push(media);
    }

    deleteMedia(mediaId: number){
        const media = this.getMediaById(mediaId);
        if (! media) {
            throw new Error(`Media ${mediaId} not found`);
        }
        media.delete();
        this.medias = this.medias.filter(media => media.id !== mediaId);
    }

    setMedias(mediasInfo: SanitizedGalleryMedia[]) {
        this.medias = mediasInfo.map(media => new GalleryMedia(media));
    }

    search(query: string): SanitizedGalleryFolder {
        return {
            id: this.id,
            name: this.name,
            medias: this.medias
                .filter(media => {
                    // Try to find a tag which is in the query
                    const match = media.tags.find(tag => tag.indexOf(query) !== -1);
                    return !! match;
                })
                .map(media => media.sanitized())
        };
    }

    sanitized(limit?: number): SanitizedGalleryFolder {
        if (typeof limit === 'undefined') {
            limit = this.medias.length;
        }
        return {
            id: this.id,
            name: this.name,
            medias: this.medias.slice(0, limit).map(media => media.sanitized()),
        }
    }
}