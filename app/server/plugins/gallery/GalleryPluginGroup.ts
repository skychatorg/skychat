import { PluginGroup } from "../PluginGroup";
import { FileConverterPlugin } from "./FileConverterPlugin";
import { GalleryPlugin } from "./GalleryPlugin";


export class GalleryPluginGroup extends PluginGroup {

    roomPluginClasses = [];

    globalPluginClasses = [
        GalleryPlugin,
        FileConverterPlugin,
    ];
}
