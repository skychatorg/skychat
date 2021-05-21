<template>
    <div class="gallery-preview">
        <h2 class="title">Gallery</h2>
        <div class="gallery-content scrollbar">

            <!-- 1 folder -->
            <div v-for="folder in gallery.folders"
                :key="folder.id">

                <h3 class="section-title">{{folder.name}}</h3>

                <!-- medias -->
                <div class="media-list">
                    <div class="media-list-thumbs">
                        <!-- 1 media -->
                        <div
                            v-for="media in folder.medias"
                            :key="media.id"
                            :style="{'background-image': 'url(' + media.thumb + ')'}"
                            class="media">
                            <span></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";
    import HoverCard from "../util/HoverCard";


    export default Vue.extend({
        components: { HoverCard },
        computed: {
            gallery: function() {
                return this.$store.state.gallery;
            },
        }
    });
</script>

<style lang="scss" scoped>

    .gallery-preview {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        padding-left: 6px;
        color: white;
        margin-bottom: 6px;
        margin-top: 10px;
        padding-right: 20px;

        .gallery-content {
            flex-grow: 1;
            overflow-y: auto;
            background-color: #242427;

            .section-title {
                color: grey;
                margin-left: 8px;
                margin-top: 8px;
            }

            .media-list {
                display: flex;
                margin-top: 4px;
                height: 80px;

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
                        flex-basis: 80px;
                        width: 80px;
                        height: 80px;
                        background-position: 50%;
                        background-size: cover;
                        cursor: pointer;
                    }
                }
            }
        }
    }
</style>
