<template>
    <div class="gallery-preview" v-if="shownFolders !== null">
        <h2 class="title clickable" @click="setGalleryVisibility(! isGalleryVisible)" title="Show/hide the gallery">
            Gallery
            <i class="material-icons md-12 title-icon">{{ isGalleryVisible ? 'expand_more' : 'expand_less' }}</i>
        </h2>
        <div class="gallery-content" v-if="isGalleryVisible">

            <div class="gallery-search">
                <input
                    v-model="searchInput"
                    class="gallery-search-input"
                    placeholder="Search medias">
            </div>

            <div class="gallery-results scrollbar">

                <h3 v-show="shownFolders.length === 0" class="section-title">
                    {{ tab === 'preview' ? 'no media' : 'no matches' }}
                </h3>

                <!-- 1 folder -->
                <div v-for="folder in shownFolders"
                    :key="folder.id">

                    <h3 class="section-title">
                        {{folder.name}}
                        <span v-show="folder.medias.length === 0 && op" @click="deleteFolder(folder.id)" title="Delete this folder" class="folder-delete material-icons md-14">close</span>
                    </h3>

                    <!-- medias -->
                    <div class="media-list">
                        <div class="media-list-thumbs">
                            <!-- 1 media -->
                            <div
                                v-for="media in folder.medias"
                                :key="media.id"
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
                                <div class="media-actions">
                                    <!-- copy -->
                                    <div class="media-action" title="Copy link to clipboard" @click.stop="copyMediaLink(media)">
                                        <i class="material-icons md-14">content_copy</i>
                                    </div>
                                    <!-- play (if video) -->
                                    <div v-show="isPlayable(media)" class="media-action" title="Play media" @click.stop="playMedia(media)">
                                        <i class="material-icons md-14">live_tv</i>
                                    </div>
                                    <!-- delete -->
                                    <div v-show="op" class="media-action" title="Delete" @click.stop="deleteMedia(media)">
                                        <i class="material-icons md-14">close</i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";
    import MediaVisualizer from "../modal/MediaVisualizer.vue";
    import HoverCard from "../util/HoverCard";


    export default Vue.extend({
        components: { HoverCard, MediaVisualizer },
        data: function() {
            return {
                shownFolders: null,
                searchInput: '',

                /**
                 * @type {'preview'|'search'}
                 */
                tab: 'preview',
            }
        },
        watch: {
            'tab': function() {
                if (this.tab === 'preview') {
                    this.shownFolders = this.gallery.folders;
                } else {
                    this.shownFolders = this.gallerySearchResults.folders;
                }
            },
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
                    this.shownFolders = this.gallery.folders;
                }
            },
            'gallerySearchResults': {
                deep: true,
                handler: function() {
                    if (this.tab !== 'search') {
                        return;
                    }
                    this.shownFolders = this.gallerySearchResults.folders;
                }
            },
        },
        mounted: function() {
            if (this.gallery) {
                this.shownFolders = this.gallery.folders;
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
                return extensionMtc && ['mp4'].indexOf(extensionMtc[1]) !== -1;
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
            setGalleryVisibility: function(newVisibility) {
                this.$store.commit('SET_GALLERY_VISIBILITY', newVisibility);
            },
            deleteFolder: function(folderId) {
                this.$client.sendMessage(`/galleryfolderremove ${folderId}`);
            }
        },
        computed: {
            gallery: function() {
                return this.$store.state.gallery;
            },
            gallerySearchResults: function() {
                return this.$store.state.gallerySearchResults;
            },
            isGalleryVisible: function() {
                return this.$store.state.isGalleryVisible;
            },
            op: function() {
                return this.$store.state.op;
            }
        }
    });
</script>

<style lang="scss" scoped>

    .gallery-preview {
        width: 100%;
        display: flex;
        flex-direction: column;
        padding-left: 6px;
        color: white;
        margin-bottom: 6px;
        margin-top: 10px;
        padding-right: 20px;

        .gallery-content {
            flex-basis: 140px;
            min-height: 140px;
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

                .section-title {
                    color: grey;
                    margin-left: 8px;
                    margin-top: 8px;
                    text-align: center;

                    .folder-delete {
                        cursor: pointer;
                        color: #ff8e8e;
                    }
                }

                .media-list {
                    display: flex;
                    margin-top: 4px;
                    height: 70px;

                    .media-list-arrow {
                        flex-basis: 20px;
                    }

                    .media-list-thumbs {
                        margin-left: 20px;
                        margin-right: 20px;
                        display: flex;
                        overflow: hidden;

                        .media {
                            margin-left: 6px;
                            margin-right: 6px;
                            flex-basis: 70px;
                            min-width: 70px;
                            height: 70px;
                            background-position: 50%;
                            background-size: cover;
                            position: relative;
                            cursor: pointer;

                            .media-title {
                                margin: 4px;
                                display: flex;
                                flex-wrap: nowrap;
                                overflow: hidden;

                                .media-tag {
                                    white-space: nowrap;
                                    margin-right: 4px;
                                    border: 1px solid #6a6a6a;
                                    border-radius: 4px;
                                    padding: 1px 4px;
                                    background: #00000036;
                                }
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

                                .media-action {
                                    flex-grow: 1;
                                    text-align: center;
                                    display: flex;
                                    flex-direction: column;
                                    justify-content: center;
                                    background-color: #2c2d31;
                                    transition: background-color 0.2s;

                                    &:hover {
                                        background-color: #3f4144;
                                    }
                                }
                            }

                            &:hover .media-actions {
                                height: 18px;
                            }
                        }
                    }
                }
            }
        }
    }
</style>
