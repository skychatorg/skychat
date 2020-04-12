<!--
    Youtube Preview
-->


<template>
    <div class="youtube-preview" v-if="currentVideo">

        <div>
            <h3 class="preview-title">{{currentVideo.video.title}}</h3>
            <img class="preview-thumb" :src="currentVideo.video.thumb">
        </div>
    </div>
</template>

<script>
    import Vue from "vue";

    export default Vue.extend({
        computed: {
            currentVideo: function() {
                return this.$store.state.currentVideo;
            },
        }
    });
</script>

<style lang="scss" scoped>
    .youtube-preview {
        padding-top: 40px;
        color: white;

        .preview-title {
            white-space: nowrap;
            overflow: hidden;
            -ms-text-overflow: ellipsis;
            text-overflow: ellipsis;
            margin-bottom: 2px;
        }

        .preview-thumb {
            width: 100%;
        }
    }
</style>
