<template>
    <div>
        <template v-if="playerEnabled && playerState.current">
            <youtube-player class="player-implementation" v-if="playerState.current.video.type === 'youtube'"></youtube-player>
            <embed-player   class="player-implementation" v-if="playerState.current.video.type === 'embed'"></embed-player>
        </template>
    </div>
</template>

<script>
    import Vue from "vue";
    import YoutubePlayer from "./implementations/YoutubePlayer";
    import EmbedPlayer from "./implementations/EmbedPlayer";

    export default Vue.extend({
        components: { YoutubePlayer, EmbedPlayer },
        computed: {
            playerState: function() {
                return this.$store.state.playerState;
            },
            playerEnabled: function() {
                return this.$store.state.playerEnabled;
            },
        }
    });
</script>

<style lang="scss" scoped>
    .player-implementation {
        height: 100%;
    }
</style>
