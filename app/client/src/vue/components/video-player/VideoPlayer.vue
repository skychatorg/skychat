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
                previousPlayedObject: null
            }
        },
        watch: {
            playerState: function() {
                if (! this.playerState.current || ! this.playerEnabled) {
                    this.src = '';
                    this.previousPlayedObject = null;
                    return;
                }
                if (this.previousPlayedObject
                    && this.previousPlayedObject.current
                    && this.playerState.current.video.id === this.previousPlayedObject.current.video.id
                    && this.playerState.current.video.startTime === this.previousPlayedObject.current.video.startTime) {
                    return;
                }
                let src = 'https://www.youtube.com/embed/' + this.playerState.current.video.id;
                src += '?autoplay=1';
                src += '&origin=' + document.location.origin;
                if (this.playerState.current.video.duration > 0) {
                    src += '&start=' + parseInt(this.playerState.cursor / 1000);
                }
                this.src = src + '&random=' + Math.random();
                this.previousPlayedObject = this.playerState;
            }
        },
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

    .player {
        width: 100%;
        height: 100%;
        padding: 5px 5px 0;
    }
</style>
