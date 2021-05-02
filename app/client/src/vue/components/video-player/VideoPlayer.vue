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
                if (! this.playerState || ! this.playerEnabled) {
                    this.src = '';
                    this.previousPlayedObject = null;
                    return;
                }
                if (this.previousPlayedObject
                    && this.playerState.video.id === this.previousPlayedObject.video.id
                    && this.playerState.startedDate === this.previousPlayedObject.startedDate) {
                    return;
                }
                let src = 'https://www.youtube.com/embed/' + this.playerState.video.id;
                src += '?autoplay=1';
                src += '&origin=' + document.location.origin;
                if (this.playerState.video.duration > 0) {
                    src += '&start=' + parseInt(this.playerState.cursor);
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
