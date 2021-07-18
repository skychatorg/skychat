<template>
    <div>
        <video
            ref="player"
            class="player embed"
            controls=""
            autoplay="1"
            name="media">
            <source :src="src" :type="videoType">
        </video>
    </div>
</template>

<script>
    import Vue from "vue";
    import { mapState } from "vuex";

    export default Vue.extend({
        data: function() {
            return {
                src: '',
                videoType: '',
                audioAnalyzerUpdateInterval: null,
            };
        },
        watch: {
            'playerState.current.video': { deep: true, handler: 'update' },
        },
        mounted: function() {
            this.update();
            },
        unmounted: function() {
            clearInterval(this.audioAnalyzerUpdateInterval);
            this.$store.commit('Main/SET_PLAYER_INTENSITY', avg);
        },
        methods: {
            update: function() {
                // Update video information
                const timeSinceLastUpdate = new Date().getTime() - this.playerStateLastUpdate.getTime();
                const startTimeMs = this.playerState.cursor + timeSinceLastUpdate;
                this.src = this.playerState.current.video.id + '#t=' + parseInt(startTimeMs / 1000);
                const extension = this.playerState.current.video.id.match(/\.([a-z0-9]+)$/)[1];
                this.videoType = 'video/' + extension;
                // On next tick, update the video stream info
                Vue.nextTick(() => this.startAudioAnalyser());
            },
            startAudioAnalyser: function() {
                const audioContext = new(window.AudioContext || window.webkitAudioContext)();
                const analyser = audioContext.createAnalyser();

                // Connect the source to be analysed
                const mediaSource = audioContext.createMediaElementSource(this.$refs.player);
                mediaSource.connect(analyser); // Connect the video to our custom analyser
                analyser.connect(audioContext.destination); // Ensures the sound still goes to the browser

                analyser.fftSize = 64;
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);

                clearInterval(this.audioAnalyzerUpdateInterval);
                this.audioAnalyzerUpdateInterval = setInterval(() => {
                    analyser.getByteFrequencyData(dataArray);
                    const avg = dataArray.reduce((acc, curr) => acc + curr / 256, 0) / dataArray.length;
                    this.$store.commit('Main/SET_PLAYER_INTENSITY', avg);
                }, 1000 / 50);
            },
        },
        computed: {
            ...mapState('Main', [
                'playerState',
                'playerStateLastUpdate',
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
