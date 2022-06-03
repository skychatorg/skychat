<template>
    <div>
        <template v-if="playerEnabled && clientState.player.current">
            <youtube-player class="player-implementation" v-if="clientState.player.current.video.type === 'youtube'"></youtube-player>
            <twitch-player  class="player-implementation" v-if="clientState.player.current.video.type === 'twitch'"></twitch-player>
            <embed-player   class="player-implementation" v-if="clientState.player.current.video.type === 'embed'"></embed-player>
        </template>
    </div>
</template>

<script>
    import Vue from "vue";
    import { mapGetters } from "vuex";
    import YoutubePlayer from "./implementations/YoutubePlayer";
    import TwitchPlayer from "./implementations/TwitchPlayer";
    import EmbedPlayer from "./implementations/EmbedPlayer";

    export default Vue.extend({
        components: { YoutubePlayer, TwitchPlayer, EmbedPlayer },
        computed: {
            ...mapGetters('App', [
                'playerEnabled',
            ]),
            ...mapGetters('SkyChatClient', [
                'clientState',
            ]),
        }
    });
</script>

<style lang="scss" scoped>
    .player-implementation {
        height: 100%;
    }
</style>
