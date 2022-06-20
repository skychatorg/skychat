<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { useToast } from 'vue-toastification';
import { $vfm } from 'vue-final-modal';
import HoverCard from '@/components/util/HoverCard.vue';
import GalleryMedia from '@/components/gallery/GalleryMedia.vue';
import GalleryMediaVisualizerModal from '@/components/modal/GalleryMediaVisualizerModal.vue';


const app = useAppStore();
const client = useClientStore();
const toast = useToast();

const state = reactive({
    searchInput: '',
    tab: 'preview',
});


/**
 * Adapted from previous front-end
 * To be re-written with the new gallery plugin.
 */


// Watch
watch(() => state.searchInput, () => {
    if (state.searchInput === '') {
        state.tab = 'preview';
    } else {
        state.tab = 'search';
        client.sendMessage(`/gallerysearch ${state.searchInput}`);
    }
});


// Methods
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
const openMedia = function(media) {
    $vfm.show({
        component: GalleryMediaVisualizerModal,
        bind: { mediaLocation: media.location, },
    });
};
const deleteMedia = function(media) {
    client.sendMessage(`/gallerydelete ${media.folderId} ${media.id}`);
};
const deleteFolder = function(folderId) {
    client.sendMessage(`/galleryfolderremove ${folderId}`);
};
const canWrite = function() {
    return client.state.gallery && client.state.gallery.canWrite;
};
</script>

<template>
    <vue-final-modal
        classes="modal-container"
        content-class="modal-content"
        :esc-to-close="true"
        v-slot="{  }"
    >
        <div class="gallery-preview" v-if="client.state.gallery.data !== null">
            <div class="gallery-content">

                <div class="gallery-search">
                    <input
                        v-model="state.searchInput"
                        class="gallery-search-input"
                        placeholder="Search medias">
                </div>

                <!-- Gallery preview -->
                <div v-if="state.tab === 'preview'" class="gallery-results scrollbar">

                    <h3 v-show="client.state.gallery.data.folders.length === 0" class="section-title">
                        no media
                    </h3>

                    <!-- 1 folder -->
                    <div v-for="folder in client.state.gallery.data.folders"
                        :key="folder.id"
                        class="gallery-folder">

                        <h3 class="section-title">
                            <span :title="'#' + folder.id + ': ' + folder.name">{{folder.name}}</span>
                            <span v-show="folder.medias.length === 0 && canWrite()" @click="deleteFolder(folder.id)" title="Delete this folder" class="folder-delete material-icons md-14">close</span>
                        </h3>

                        <!-- medias -->
                        <div class="media-list scrollbar">
                            <GalleryMedia
                                v-for="media in folder.medias"
                                :key="media.id"
                                :media="media" />
                        </div>
                    </div>
                </div>

                <!-- Gallery search results -->
                <div v-if="state.tab === 'search'" class="gallery-results scrollbar">

                    <h3 v-show="client.state.gallerySearchResults.length === 0" class="section-title">
                        no matches
                    </h3>

                    <!-- medias -->
                    <div class="gallery-search-results">
                        <div class="media-list scrollbar">
                            <GalleryMedia
                                v-for="media in client.state.gallerySearchResults"
                                :key="media.id"
                                :media="media" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </vue-final-modal>
</template>

<style scoped>
@import url('./modal.css');


.gallery-preview {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    color: white;
    padding-bottom: 10px;
    padding-top: 10px;
    padding-left: 6px;
    padding-right: 6px;
}

.gallery-content {
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.gallery-search {
    flex-basis: 20px;
}

.gallery-search .gallery-search-input {
    width: 100%;
    padding: 10px;
    border: none;
    background: #2c2d31;
    color: white;
    outline-style: none;
    box-shadow: none;
    font-family: inherit;
    transition: box-shadow 0.2s;
}

.gallery-search .gallery-search-input:focus {
    box-shadow: 1px 1px 14px #d1d4f53b;
}

.gallery-results {
    flex-grow: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding-top: 10px;
    padding-bottom: 10px;
}

.gallery-folder {
    display: flex;
    flex-direction: column;
}

.gallery-folder .section-title {
    color: grey;
    margin-left: 8px;
    margin-top: 8px;
    text-align: center;
    flex-basis: 22px;
}

.gallery-folder .section-title .folder-delete {
    cursor: pointer;
    color: #ff8e8e;
}


.gallery-folder .media-list {
    display: flex;
    margin-top: 4px;
    max-height: 320px;
    margin-bottom: 20px;
    margin-left: 20px;
    margin-right: 20px;
    padding-bottom: 10px;
    max-width: 100%;
    flex-wrap: nowrap;
    overflow-y: auto;
}

.gallery-search-results {
    flex-grow: 1;
}

.gallery-search-results .media-list {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
}

.gallery-search-results .media-list > * {
    margin-top: 10px;
}
</style>