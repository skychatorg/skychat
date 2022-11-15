import { PluginGroup } from '../PluginGroup';
import { GalleryPlugin } from './GalleryPlugin';
import { VideoConverterPlugin } from './VideoConverterPlugin';


export class GalleryPluginGroup extends PluginGroup {

    roomPluginClasses = [];

    globalPluginClasses = [
        GalleryPlugin,
        VideoConverterPlugin,
    ];
}
