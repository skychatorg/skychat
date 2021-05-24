<template>
    <div class="page-content">

        <!-- Cinema mode -->
        <template v-if="cinemaMode">
            <section id="cinema" class="scrollbar">
                <video-player class="player-background"></video-player>
                <cinema-mode-overlay class="messages-overlay"></cinema-mode-overlay>
            </section>
        </template>

        <!-- Normal mode -->
        <template v-if="! cinemaMode">
            <section class="default-container">

                <!-- left col (room list) -->
                <section class="left hide-mobile-middle hide-mobile-right">
                    <h2 class="title mt-2 ml-1">Channels</h2>
                    <div class="channels scrollbar ml-1 pr-1">
                        <text-channel-list class="left-room-list"></text-channel-list>
                        <player-channel-list class="left-channel-room-list"></player-channel-list>
                    </div>
                    <poll-list class="mb-2 ml-1"></poll-list>
                    <user-preview class="mb-3 ml-1 mt-1"></user-preview>
                    <quick-actions id="quick-actions"></quick-actions>
                    <div @click="onMobileShowMiddleCol" class="show-mobile" style="text-align: right;">
                        <div class="goto-middle-col">
                            <i class="material-icons md-28">keyboard_arrow_right</i>
                        </div>
                    </div>
                </section>
                
                <!-- middle col (main content) -->
                <section class="middle hide-mobile-left hide-mobile-right">
                    <tchat-middle-column />
                </section>

                <!-- right col (connected list and metas) -->
                <section class="right hide-mobile-left hide-mobile-middle scrollbar">

                    <video-player-preview id="player-preview"></video-player-preview>

                    <user-list id="connected-list" class="scrollbar"></user-list>

                    <gallery-preview id="gallery"></gallery-preview>

                    <div @click="onMobileShowMiddleCol" class="show-mobile">
                        <div class="goto-middle-col">
                            <i class="material-icons md-28">keyboard_arrow_left</i>
                        </div>
                    </div>
                </section>
            </section>
        </template>
    </div>
</template>

<script>
    import Vue from "vue";
    import TextChannelList from "../components/channel/TextChannelList.vue";
    import PlayerChannelList from "../components/channel/PlayerChannelList.vue";
    import TchatMiddleColumn from "../components/layout/TchatMiddleColumn.vue";
    import PollList from "../components/poll/PollList.vue";
    import UserPreview from "../components/user/UserPreview.vue";
    import GalleryPreview from "../components/gallery/GalleryPreview.vue";
    import VideoPlayerPreview from "../components/video-player/VideoPlayerPreview.vue";
    import VideoPlayer from "../components/video-player/VideoPlayer.vue";
    import UserList from "../components/user/UserList.vue";
    import QuickActions from "../components/form/QuickActions.vue";
    import CinemaModeOverlay from "../components/overlay/CinemaModeOverlay.vue";

    export default Vue.extend({
        components: {TextChannelList, GalleryPreview, PlayerChannelList, TchatMiddleColumn, PollList, UserPreview, VideoPlayerPreview, VideoPlayer, UserList, QuickActions, CinemaModeOverlay},
        watch: {
            cinemaMode: function() {

            },
        },
        methods: {

            gotoRoom() {
                this.$store.commit('SET_PAGE', 'room');
            },
            onMobileShowMiddleCol: function() {
                this.$store.commit('SET_MOBILE_PAGE', 'middle');
            },
        },
        computed: {
            page: function() {
                return this.$store.state.page;
            },
            cinemaMode: function() {
                return this.$store.state.cinemaMode;
            },
        },
    });
</script>

<style lang="scss" scoped>

    .page-content {
        font-family: Arial,Helvetica Neue,Helvetica,sans-serif;
        font-size: 80%;
        width: 100%;
        height: 0;
        margin: 0 auto;
        color: white;

        display: flex;
        justify-content: center;

        >#cinema {
            flex-grow: 1;
            height: 100%;
            position: relative;

            >.player-background {
                position: absolute;
                width: 100%;
                height: 100%;
                z-index: 0;
            }
            >.messages-overlay {
                position: absolute;
                right: 20px;
                bottom: 50px;
                width: 100%;
                max-width: 380px;
                background-color: #222223;
                opacity: 0.75;

                &:hover {
                    opacity: 1;
                }
            }
        }

        .default-container {
            max-width: 1800px;
            flex-grow: 1;
            display: flex;

            .left {
                flex-basis: 250px;
                width: 0;
                height: 100%;
                display: flex;
                flex-direction: column;
                
                .channels {
                    flex-grow: 1;
                    overflow-y: auto;
                }
            }

            .middle {
                flex-grow: 1;
                padding-bottom: 6px;
                height: 100%;
                background: #16161978;
                display: flex;
                flex-direction: column;

                >#message-form {
                    width: 100%;
                    flex-basis: 44px;
                }
            }

            .right {
                flex-basis: 400px;
                height: 100%;
                overflow-y: hidden;
                background: #16161978;
                display: flex;
                flex-direction: column;
                padding-bottom: 4px;

                #player-preview {
                    flex-basis: 160px;
                    min-height: 160px;
                }

                #connected-list {
                    flex-grow: 1;
                    overflow-y: auto;
                    margin-right: 20px;
                    margin-top: 10px;
                    padding-right: 14px;
                }
            }
        }
    }
</style>
