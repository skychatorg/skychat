<template>
    <div>
        <video
            ref="player"
            class="player embed"
            controls=""
            autoplay="1"
            :src="src"
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
                previousVideoHash: null,
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
                // Get current cursor time
                const timeSinceLastUpdate = new Date().getTime() - this.playerStateLastUpdate.getTime();
                const currentTime = parseInt((this.playerState.cursor + timeSinceLastUpdate) / 1000);
                const hash = JSON.stringify(this.playerState.current.video.id);
                if (hash === this.previousVideoHash) {
                    // If video did not change since last sync, update time
                    this.$refs.player.currentTime = currentTime;
                } else {
                    // If new video, update the player
                    this.src = `${this.playerState.current.video.id}#t=${currentTime}`;
                    const extension = this.playerState.current.video.id.match(/\.([a-z0-9]+)$/)[1];
                    this.videoType = 'video/' + extension;
                    // On next tick, update the video stream info
                    Vue.nextTick(() => this.startAudioAnalyser());
                    this.previousVideoHash = hash;
                }
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
