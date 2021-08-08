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
                <i class="material-icons md-14">content_copy</i>
            </div>
            <!-- play (if video) -->
            <div v-show="isPlayable(media)" class="media-action" title="Play media" @click.stop="playMedia(media)">
                <i class="material-icons md-14">play_arrow</i>
            </div>
            <!-- delete -->
            <div v-show="canWrite()" class="media-action" title="Delete" @click.stop="deleteMedia(media)">
                <i class="material-icons md-14">close</i>
            </div>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";
    import { mapState } from 'vuex';
    import MediaVisualizer from "../modal/MediaVisualizer.vue";
    import HoverCard from "../util/HoverCard";


    export default Vue.extend({
        components: { HoverCard, MediaVisualizer },
        props: ['media'],
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
</style>
