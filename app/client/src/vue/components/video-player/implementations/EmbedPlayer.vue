<template>
    <div>
        <video
            class="player"
            controls=""
            autoplay="1"
            name="media">
            <source :src="src" :type="videoType">
        </video>
    </div>
</template>

<script>
    import Vue from "vue";

    export default Vue.extend({
        data: function() { return { src: '', videoType: '' } },
        watch: {
            playerState: { deep: true, handler: 'update' },
        },
        mounted: function() { this.update(); },
        methods: {
            update: function() {
                this.src = this.playerState.current.video.id;
                const extension = this.src.match(/\.([a-z0-9]+)$/)[1];
                this.videoType = 'video/' + extension;
            }
        },
        computed: {
            playerState: function() {
                return this.$store.state.playerState;
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
