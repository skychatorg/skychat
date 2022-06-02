<template>
    <div class="gallery-preview" v-if="gallery.data !== null">
        <div class="gallery-content">

            <div class="gallery-search">
                <input
                    v-model="searchInput"
                    class="gallery-search-input"
                    placeholder="Search medias">
            </div>

            <!-- Gallery preview -->
            <div v-if="tab === 'preview'" class="gallery-results scrollbar">

                <h3 v-show="gallery.data.folders.length === 0" class="section-title">
                    no media
                </h3>

                <!-- 1 folder -->
                <div v-for="folder in gallery.data.folders"
                    :key="folder.id"
                    class="gallery-folder">

                    <h3 class="section-title">
                        <span :title="'#' + folder.id + ': ' + folder.name">{{folder.name}}</span>
                        <span v-show="folder.medias.length === 0 && canWrite()" @click="deleteFolder(folder.id)" title="Delete this folder" class="folder-delete material-icons md-14">close</span>
                    </h3>

                    <!-- medias -->
                    <div class="media-list scrollbar">
                        <gallery-media
                            v-for="media in folder.medias"
                            :key="media.id"
                            :media="media" />
                    </div>
                </div>
            </div>

            <!-- Gallery search results -->
            <div v-if="tab === 'search'" class="gallery-results scrollbar">

                <h3 v-show="gallerySearchResults.length === 0" class="section-title">
                    no matches
                </h3>

                <!-- medias -->
                <div class="gallery-search-results">
                    <div class="media-list scrollbar">
                        <gallery-media
                            v-for="media in gallerySearchResults"
                            :key="media.id"
                            :media="media" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";
    import { mapState } from 'vuex';
    import MediaVisualizer from "../modal/MediaVisualizer.vue";
    import HoverCard from "../util/HoverCard";
    import GalleryMedia from "./GalleryMedia";


    export default Vue.extend({
        components: { HoverCard, MediaVisualizer, GalleryMedia },
        data: function() {
            return {
                searchInput: '',

                /**
                 * @type {'preview'|'search'}
                 */
                tab: 'preview',
            }
        },
        watch: {
            'searchInput': function() {
                if (this.searchInput === '') {
                    this.tab = 'preview';
                } else {
                    this.tab = 'search';
                    this.$client.sendMessage(`/gallerysearch ${this.searchInput}`);
                }
            },
            'gallery': {
                deep: true,
                handler: function() {
                    if (this.tab !== 'preview') {
                        return;
                    }
                    this.shownFolders = this.gallery.data.folders;
                }
            },
        },
        mounted: function() {
            if (this.gallery) {
                this.shownFolders = this.gallery.data.folders;
            }
        },
        methods: {
            copyMediaLink: function(media) {
                this.$clipboard.copy(media.location);
                Vue.prototype.$noty({
                    type: 'success',
                    layout: 'topCenter',
                    theme: 'nest',
                    text: 'Media location copied to clipboard',
                    timeout: 2000
                });
            },
            isPlayable: function(media) {
                const extensionMtc = media.location.match(/\.([a-z0-9]+)$/);
                return extensionMtc && ['mp4', 'webm'].indexOf(extensionMtc[1]) !== -1;
            },
            playMedia: function(media) {
                this.$client.sendMessage(`/embed ${media.location}`);
            },
            openMedia: function(media) {
                this.$modal.show(
                    MediaVisualizer,
                    { mediaLocation: media.location },
                    { scrollable: false },
                )
            },
            deleteMedia: function(media) {
                this.$client.sendMessage(`/gallerydelete ${media.folderId} ${media.id}`);
            },
            deleteFolder: function(folderId) {
                this.$client.sendMessage(`/galleryfolderremove ${folderId}`);
            },
            canWrite: function() {
                return this.gallery && this.gallery.canWrite;
            },
        },
        computed: {
            ...mapState('Main', [
                'gallery',
                'gallerySearchResults',
                'op',
            ]),
        }
    });
</script>

<style lang="scss" scoped>

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

        .gallery-content {
            height: 100%;
            background-color: #242427;
            overflow: hidden;
            display: flex;
            flex-direction: column;

            .gallery-search {
                flex-basis: 20px;

                .gallery-search-input {
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

                .gallery-search-input:focus {
                    box-shadow: 1px 1px 14px #d1d4f53b;
                }
            }

            .gallery-results {
                flex-grow: 1;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                padding-top: 10px;
                padding-bottom: 10px;

                .gallery-folder {
                    display: flex;
                    flex-direction: column;

                    .section-title {
                        color: grey;
                        margin-left: 8px;
                        margin-top: 8px;
                        text-align: center;
                        flex-basis: 22px;

                        .folder-delete {
                            cursor: pointer;
                            color: #ff8e8e;
                        }
                    }
                

                    .media-list {
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
                }

                .gallery-search-results {
                    flex-grow: 1;

                    .media-list {
                        display: flex;
                        flex-wrap: wrap;
                        justify-content: center;

                        & > * {
                            margin-top: 10px;
                        }
                    }
                }
            }
        }
    }
</style>
