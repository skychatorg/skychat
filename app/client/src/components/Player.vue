<!--
    Player
-->


<template>
    <div>
        <iframe class="player"
                src="https://www.youtube.com/embed/dfYiIbqVhkA"
                frameborder="0"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen></iframe>
    </div>
</template>

<script lang="ts">
    import Vue from "vue";
    export default Vue.extend({

    });
</script>

<style lang="scss" scoped>

    .player {
        width: 100%;
        height: 100%;
        padding: 10px;
    }
</style>
