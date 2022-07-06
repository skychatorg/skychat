import { PluginGroup } from "../PluginGroup";
import { GalleryPlugin } from "./GalleryPlugin";


export class GalleryPluginGroup extends PluginGroup {

    roomPluginClasses = [];

    globalPluginClasses = [
        GalleryPlugin,
    ];
}
