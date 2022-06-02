<template>
    <div>
        <iframe
            class="player twitch"
            :src="src"
            frameborder="0"
            allowfullscreen="true"
            scrolling="no"></iframe>
    </div>
</template>

<script>
    import Vue from "vue";
    import { mapState } from "vuex";

    export default Vue.extend({
        data: function() { return { src: '', previousVideoHash: null, } },
        watch: {
            'playerState.current.video': { deep: true, handler: 'update' },
        },
        mounted: function() { this.update(); },
        methods: {
            update: function() {
                // If video did not change since last sync, pass
                const hash = JSON.stringify(this.playerState.current.video);
                if (hash === this.previousVideoHash) {
                    return;
                }
                let src = `https://player.twitch.tv/`;
                src += `?channel=${this.playerState.current.video.id}`;
                src += `&parent=${document.location.hostname}`;
                this.src = src + '&random=' + Math.random();
                this.previousVideoHash = hash;
            }
        },
        computed: {
            ...mapState('Main', [
                'playerState',
            ]),
        }
    });
</script>

<style lang="scss" scoped>

    .player {
        width: 100%;
        height: 100%;
        padding: 5px 5px 0;
    }
</style>
