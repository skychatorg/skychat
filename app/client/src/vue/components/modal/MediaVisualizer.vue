<template>
    <div class="media-visualizer">
        <a :href="mediaLocation" target="_blank">
            <object :data="mediaLocation"></object>
        </a>
    </div>
</template>

<script>
    import Vue from "vue";

    export default Vue.extend({
        props: ['mediaLocation'],
    });
</script>

<style lang="scss" scoped>

.media-visualizer {
    height: 100%;
    width: 100%;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;

    a {
        overflow: hidden;

        object {
            max-width: 100%;
            max-height: 100%;
        }
    }
}
</style>
