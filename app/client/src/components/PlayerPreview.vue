<template>
    <div class="youtube-preview" v-if="currentVideo">
        <div>
            <h3 class="preview-title">{{currentVideo.video.title}}</h3>
            <div class="progress"><div class="progress-bar progress-bar-top" :style="{'width': (100 * cursorPercent) + '%'}"></div></div>
            <div class="image-container">
                <div class="progress-vertical"><div class="progress-bar progress-bar-left" :style="{'height': (100 * cursorPercent) + '%'}"></div></div>
                <img class="preview-thumb" :src="currentVideo.video.thumb">
                <div class="progress-vertical"><div class="progress-bar progress-bar-right" :style="{'height': (100 * cursorPercent) + '%'}"></div></div>
            </div>
            <div class="progress"><div class="progress-bar progress-bar-bottom" :style="{'width': (100 * cursorPercent) + '%'}"></div></div>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";

    export default Vue.extend({
        data: function() {
            return {
                cursorPercent: 0
            }
        },
        mounted: function() {
            setInterval(()=>{
                this.updateCurrentDuration();
            }, 2000);
        },
        methods: {
            updateCurrentDuration: function() {
                let pct = (new Date().getTime() / 1000 - this.currentVideo.startedDate) / this.currentVideo.video.duration;
                pct = Math.max(0, pct);
                pct = Math.min(1, pct);
                this.cursorPercent = pct;
            }
        },
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
        padding-right: 20px;
        padding-left: 6px;
        color: white;

        .preview-title {
            white-space: nowrap;
            overflow: hidden;
            -ms-text-overflow: ellipsis;
            text-overflow: ellipsis;
            margin-bottom: 2px;
        }

        .image-container {
            display: flex;
            height: 176px;
            width: 100%;

            >.progress-vertical {
                flex-basis: 2px;
                position: relative;

                >.progress-bar {
                    width: 100%;
                    background-color: white;
                    position: absolute;
                    transition: all 1s ease-in-out;

                    &.progress-bar-left {
                        bottom: 0;
                    }
                    &.progress-bar-right {
                        top: 0;
                    }
                }
            }

            >.preview-thumb {
                flex-grow: 1;
                width: 0;
            }

        }

        .progress {
            height: 2px;
            width: 100%;

            >.progress-bar {
                height: 100%;
                background-color: white;
                transition: all 1s ease-in-out;

                &.progress-bar-top {
                    float: right;
                }
                &.progress-bar-bottom {
                    float: left;
                }
            }
        }
    }
</style>
