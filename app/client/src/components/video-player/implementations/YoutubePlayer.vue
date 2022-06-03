<template>
    <div>
        <iframe ref="player"
                class="player youtube"
                :src="src"
                frameborder="0"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen></iframe>
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
                let src = 'https://www.youtube.com/embed/' + this.clientState.player.current.video.id;
                src += '?autoplay=1';
                src += '&origin=' + document.location.origin;
                if (this.clientState.player.current.video.duration > 0) {
                    const timeSinceLastUpdate = new Date().getTime() - this.clientState.playerStateLastUpdate.getTime();
                    const startTimeMs = this.clientState.player.cursor + timeSinceLastUpdate;
                    src += '&start=' + parseInt(startTimeMs / 1000);
                }
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
