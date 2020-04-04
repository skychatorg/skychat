<!--
    Main component
-->


<template>
    <div class="page">
        <page-header id="header"/>
        <page-content id="content"/>
    </div>
</template>

<script lang="ts">
    import Vue from "vue";
    import PageHeader from "./PageHeader.vue";
    import PageContent from "./PageContent.vue";

    export default Vue.extend({
        components: {
            PageHeader,
            PageContent,
        }
    });
</script>

<style lang="scss" scoped>
    .page {
        width: 100vw;
        height: 100vh;
        margin: 0 auto;
        overflow: hidden;
        display: flex;
        flex-direction: column;

        >#content {
            flex-grow: 1;
        }
    }
</style>
