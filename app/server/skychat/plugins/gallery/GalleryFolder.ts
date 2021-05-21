import { Gallery } from "./Gallery";
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
        if (! this.getMediaById(mediaId)) {
            throw new Error(`Media ${mediaId} not found`);
        }
        this.medias = this.medias.filter(media => media.id !== mediaId);
    }

    setMedias(mediasInfo: SanitizedGalleryMedia[]) {
        this.medias = mediasInfo.map(media => new GalleryMedia(media));
    }

    sanitized(): SanitizedGalleryFolder {
        return {
            id: this.id,
            name: this.name,
            medias: this.medias.map(media => media.sanitized()),
        }
    }
}