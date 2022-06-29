<script setup>
//import MediaVisualizer from "../modal-legacy/MediaVisualizer.vue";
import { useClientStore } from '@/stores/client';
import { useToast } from 'vue-toastification';
import { $vfm } from 'vue-final-modal';
import GalleryMediaVisualizerModal from '@/components/modal-legacy/GalleryMediaVisualizerModal.vue';

const client = useClientStore();
const toast = useToast();

const props = defineProps({
    media: {
        type: Object,
        required: true,
    },
});


const openMedia = function(media) {
    $vfm.show({
        component: GalleryMediaVisualizerModal,
        bind: { mediaLocation: media.location, },
    });
};
const copyMediaLink = function(media) {
    navigator.clipboard.writeText(media.location);
    toast.success('Media location copied to clipboard');
};
const isPlayable = function(media) {
    const extensionMtc = media.location.match(/\.([a-z0-9]+)$/);
    return extensionMtc && ['mp4', 'webm'].indexOf(extensionMtc[1]) !== -1;
};
const playMedia = function(media) {
    client.sendMessage(`/embed ${media.location}`);
};
</script>

<template>
    <div
        :style="{'background-image': 'url(' + media.thumb + ')'}"
        @click="openMedia(media)"
        class="media">
        <div class="media-title" :title="media.tags.join(', ')">
            <div v-for="tag in media.tags"
                :key="tag"
                class="media-tag">
                {{ tag }}
            </div>
        </div>
        <div class="media-extension">
            .{{ media.location.match(/\.([a-z0-9]+)$/)[1] }}
        </div>
        <div class="media-actions">
            <!-- copy -->
            <div class="media-action" title="Copy link to clipboard" @click.stop="copyMediaLink(media)">
                <fa icon="copy" />
            </div>
            <!-- play (if video) -->
            <div v-show="isPlayable(media)" class="media-action" title="Play media" @click.stop="playMedia(media)">
                <fa icon="play" />
            </div>
            <!-- delete -->
            <div
                v-show="client.state.gallery && client.state.gallery.canWrite"
                class="media-action"
                title="Delete"
                @click.stop="client.sendMessage(`/gallerydelete ${media.folderId} ${media.id}`)"
            >
                <fa icon="xmark" />
            </div>
        </div>
    </div>
</template>

<style scoped>

.media {
    margin-left: 6px;
    margin-right: 6px;
    flex-basis: 120px;
    min-width: 120px;
    height: 160px;
    background-position: 50%;
    background-size: cover;
    position: relative;
    cursor: pointer;
}

.media:hover .media-actions {
    height: 18px;
}

.media-title {
    margin: 4px;
    display: flex;
    flex-wrap: wrap;
    overflow: hidden;
    justify-content: center;
}

.media-tag {
    white-space: nowrap;
    margin-right: 4px;
    border: 1px solid #6a6a6a;
    border-radius: 4px;
    padding: 1px 4px;
    background: #00000036;
}

.media-extension {
    position: absolute;
    bottom: 0;
    right: 0;
    margin: 4px;
    overflow: hidden;
    color: #969696;
}

.media-actions {
    display: flex;
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 0;
    overflow: hidden;
    transition: height 0.2s;
}

.media-action {
    flex-grow: 1;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
    background-color: #2c2d31;
    transition: background-color 0.2s;
}

.media-action:hover {
    background-color: #3f4144;
}
</style>