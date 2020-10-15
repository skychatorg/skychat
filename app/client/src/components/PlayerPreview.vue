<template>
    <div class="youtube-preview" v-if="playerState">
        <div class="current-video">
            <div class="progress"><div class="progress-bar progress-bar-top" :class="'custom-color-' + progressBarColor" :style="{'width': (100 * cursorPercent) + '%'}"></div></div>
            <div class="image-container">
                <h3 class="preview-title">{{playerState.video.title}}</h3>
                <div class="sliding-window up" :class="{['custom-color-' + progressBarColor]: true, closed: cursorPercent >= 1}"></div>
                <div class="progress-vertical"><div class="progress-bar progress-bar-left" :class="'custom-color-' + progressBarColor" :style="{'height': (100 * cursorPercent) + '%'}"></div></div>
                <img class="preview-thumb" :src="playerState.video.thumb">
                <div class="progress-vertical"><div class="progress-bar progress-bar-right" :class="'custom-color-' + progressBarColor" :style="{'height': (100 * cursorPercent) + '%'}"></div></div>
                <div class="sliding-window down" :class="{['custom-color-' + progressBarColor]: true, closed: cursorPercent >= 1}"></div>
            </div>
            <div class="progress"><div class="progress-bar progress-bar-bottom" :class="'custom-color-' + progressBarColor" :style="{'width': (100 * cursorPercent) + '%'}"></div></div>
        </div>
        <div class="queue" v-show="nextVideos.length > 0">
            <div class="vertical-bar" :class="'custom-color-' + progressBarColor"></div>
            <transition-group name="list" tag="div">
                <div v-for="video, videoIndex in nextVideos"
                     class="video-in-queue"
                    :key="video.video.id">
                    <div class="image avatar">
                        <div class="image-bubble" :style="'box-shadow: #' + progressBarColor +' 0 0 4px 0;'">
                            <img data-v-193da69e="" :src="video.video.thumb">
                        </div>
                    </div>
                    <svg height="60" width="60">
                        <circle cx="30" cy="30" r="25" fill="none" stroke="black"></circle>
                        <circle cx="30" cy="30" r="25" :class="'custom-color-' + progressBarColor" :stroke-dashoffset="- (queueWaitDurations[videoIndex]) * 2 * Math.PI * 25"></circle>
                    </svg>
                    <div class="info">
                        <div class="title">{{video.video.title}}</div>
                        <div class="user">- {{video.user.username}}</div>
                    </div>
                </div>
            </transition-group>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";

    export default Vue.extend({
        data: function() {
            return {
                cursorPercent: 0,
                progressBarColor: 'ffffff',
                queueWaitDurations: []
            }
        },
        mounted: function() {
            this.updateCurrentDuration();
            this.updateQueueWaitDurations();
            this.updateProgressBarColor();
            setInterval(this.updateCurrentDuration, 2000);
            setInterval(this.updateQueueWaitDurations, 2000);
            setInterval(this.updateProgressBarColor, 6 * 1000);
        },
        watch: {
            'nextVideos': {
                deep: true,
                handler: function() {
                    this.updateQueueWaitDurations();
                }
            }
        },
        methods: {
            updateQueueWaitDurations: function() {
                let waitDuration = 0;
                if (this.playerState && this.playerState.video) {
                    waitDuration += this.playerState.video.duration - (new Date().getTime() / 1000 - this.playerState.startedDate);
                }
                let waitDurations = [];
                for (const video of this.nextVideos) {
                    waitDurations.push(waitDuration);
                    waitDuration += video.video.duration - video.start;
                }
                waitDurations = waitDurations.map(duration => Math.max(0, duration / waitDuration));
                this.queueWaitDurations = waitDurations;
            },
            updateCurrentDuration: function() {
                if (! this.playerState) {
                    this.cursorPercent = 0;
                    return;
                }
                if (this.playerState.video.duration === 0) {
                    this.cursorPercent = 0;
                    return;
                }
                let pct = (new Date().getTime() / 1000 - this.playerState.startedDate + this.playerState.start) / this.playerState.video.duration;
                pct = Math.max(0, pct);
                pct = Math.min(1, pct);
                this.cursorPercent = pct;
            },
            updateProgressBarColor: function() {
                if (! this.playerState) {
                    return;
                }
                const colors = ['ffffff', 'ff8f8f', '8ecfff', '6ee067', 'e0a067', '9b71b9'];
                const indexOf = colors.indexOf(this.progressBarColor);
                const newIndex = (indexOf + 1) % colors.length;
                this.progressBarColor = colors[newIndex];
            }
        },
        computed: {
            playerState: function() {
                return this.$store.state.playerState;
            },
            nextVideos: function() {
                if (this.playerState) {
                    return this.playerState.queue.slice(0, 4);
                } else {
                    return [];
                }
            }
        }
    });
</script>

<style lang="scss" scoped>
    .youtube-preview {
        padding-top: 20px;
        padding-right: 20px;
        padding-left: 6px;
        color: white;

        .preview-title {
            position: absolute;
            left: 10px;
            top: 3px;
            white-space: nowrap;
            overflow: hidden;
            -ms-text-overflow: ellipsis;
            text-overflow: ellipsis;
            margin-bottom: 2px;
            width: 100%;
        }

        .image-container {
            display: flex;
            height: 176px;
            width: 100%;
            position: relative;
            overflow: hidden;
            z-index: 1;

            >.sliding-window {
                width: 100%;
                position: absolute;
                left: 0;
                height: 0;
                -webkit-transition: all 1s ease-in-out;
                -moz-transition: all 1s ease-in-out;
                -ms-transition: all 1s ease-in-out;
                -o-transition: all 1s ease-in-out;
                transition: all 1s ease-in-out;

                &.up {
                    top: 0;
                }
                &.down {
                    bottom: 0;
                }
                &.closed {
                    height: 50%;
                }
            }

            >.progress-vertical {
                flex-basis: 2px;
                position: relative;

                >.progress-bar {
                    width: 100%;
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
                transition: all 1s ease-in-out;

                &.progress-bar-top {
                    float: right;
                }
                &.progress-bar-bottom {
                    float: left;
                }
            }
        }

        .custom-color-ffffff {
            background-color: white;
            stroke: white;
        }
        .custom-color-ff8f8f {
            background-color: #ff8f8f;
            stroke: #ff8f8f;
        }
        .custom-color-8ecfff {
            background-color: #8ecfff;
            stroke: #8ecfff;
        }
        .custom-color-6ee067 {
            background-color: #6ee067;
            stroke: #6ee067;
        }
        .custom-color-e0a067 {
            background-color: #e0a067;
            stroke: #e0a067;
        }
        .custom-color-9b71b9 {
            background-color: #9b71b9;
            stroke: #9b71b9;
        }

        .queue {
            display: flex;
            flex-direction: column;
            position: relative;
            background: #2b2b2f;
            padding-right: 30px;
            padding-left: 30px;
            padding-bottom: 10px;
            max-height: 260px;

            .vertical-bar {
                position: absolute;
                transition: all 1s ease-in-out;
                width: 2px;
                height: calc(100% - 60px);
                left: 55px;
            }
            .video-in-queue {
                display: flex;
                width: 100%;
                height: 40px;
                margin: 20px 0 10px 0;
                position: relative;

                .image {
                    width: 50px;
                    height: 50px;
                    display: flex;

                    .image-bubble {
                        transition: all 1s ease-in-out;
                    }
                }
                svg {
                    position: absolute;
                    top: -5px;
                    left: -5px;

                    circle {
                        fill: none;
                        transition: all 1s ease-in-out;
                        stroke-width: 2px;
                        stroke-dasharray: 1000;
                        transform-origin: center center;
                        transform: rotate(-85deg);
                        animation: rotate 60s linear infinite;
                    }

                    @keyframes rotate {
                        to {
                        }
                    }
                }
                .info {
                    width: 0;
                    flex-grow: 1;
                    display: flex;
                    flex-direction: column;
                    padding: 5px;
                    margin-left: 6px;

                    >.title {
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                }
            }
        }

        .list-enter-active, .list-leave-active {
            transition: all 1s;
        }
        .list-leave-to {
            margin-top: -60px !important;
            margin-bottom: 40px !important;
        }
        .list-enter {
            opacity: 0;
        }
    }
</style>
