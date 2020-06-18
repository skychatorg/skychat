<template>
    <div>
        <iframe ref="player"
                class="player"
                :src="src"
                frameborder="0"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen></iframe>
    </div>
</template>

<script>
    import Vue from "vue";

    export default Vue.extend({
        data: function() {
            return {
                src: '',
                previousPlayedId: null
            }
        },
        watch: {
            playerState: function() {
                if (! this.playerState || ! this.playerState.enabled) {
                    this.src = '';
                    this.previousPlayedId = null;
                    return;
                }
                if (this.playerState.video.id === this.previousPlayedId) {
                    return;
                }
                let src = 'https://www.youtube.com/embed/' + this.playerState.video.id;
                src += '?autoplay=1';
                src += '&origin=' + document.location.origin;
                src += '&start=' + parseInt(this.playerState.cursor);
                this.src = src;
                this.previousPlayedId = this.playerState.video.id;
            }
        },
        computed: {
            playerState: function() {
                return this.$store.state.playerState;
            }
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
