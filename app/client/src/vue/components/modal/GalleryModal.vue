<template>
    <div>
        <gallery-preview></gallery-preview>
    </div>
</template>

<script>
    import Vue from "vue";
    import GalleryPreview from "../gallery/GalleryPreview.vue";

    export default Vue.extend({
        components: { GalleryPreview },
    });
</script>

<style lang="scss" scoped>

</style>
