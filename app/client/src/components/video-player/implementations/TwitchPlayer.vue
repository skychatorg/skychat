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
    import { mapGetters } from "vuex";

    export default Vue.extend({
        data: function() { return { src: '', previousVideoHash: null, } },
        watch: {
            'clientState.player.current.video': { deep: true, handler: 'update' },
        },
        mounted: function() { this.update(); },
        methods: {
            update: function() {
                // If video did not change since last sync, pass
                const hash = JSON.stringify(this.clientState.player.current.video);
                if (hash === this.previousVideoHash) {
                    return;
                }
                let src = `https://player.twitch.tv/`;
                src += `?channel=${this.clientState.player.current.video.id}`;
                src += `&parent=${document.location.hostname}`;
                this.src = src + '&random=' + Math.random();
                this.previousVideoHash = hash;
            }
        },
        computed: {
            ...mapGetters('SkyChatClient', [
                'clientState',
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
