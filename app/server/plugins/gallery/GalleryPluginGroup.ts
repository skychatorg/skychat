import { PluginGroup } from '../PluginGroup.js';
import { GalleryPlugin } from './GalleryPlugin.js';
import { VideoConverterPlugin } from './VideoConverterPlugin.js';

export class GalleryPluginGroup extends PluginGroup {
    roomPluginClasses = [];

    globalPluginClasses = [GalleryPlugin, VideoConverterPlugin];
}
