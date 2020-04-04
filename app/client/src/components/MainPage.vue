<!--
    Main component
-->


<template>
    <div class="page">
        <page-header></page-header>
    </div>
</template>

<script lang="ts">
    import Vue from "vue";
    import PageHeader from "./PageHeader.vue"

    export default Vue.extend({
        components: {
            PageHeader
        }
    });
</script>

<style scoped>
    .page {
        width: 100vw;
        height: 100vh;
        max-width: 1400px;
        margin: 0 auto;
        overflow: hidden;
        background: #2E3136;
    }
</style>
