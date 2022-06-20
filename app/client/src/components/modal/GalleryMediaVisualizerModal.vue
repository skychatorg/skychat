<script setup>
defineProps({
    mediaLocation: {
        type: String,
        required: true,
    },
});
</script>

<template>
    <vue-final-modal
        classes="modal-container"
        content-class="modal-content"
        :esc-to-close="true"
        v-slot="{  }"
    >
        <div class="media-visualizer">
            <a :href="mediaLocation" target="_blank">
                <object :data="mediaLocation"></object>
            </a>
        </div>
    </vue-final-modal>
</template>

<style scoped>
@import url('./modal.css');


.media-visualizer {
    height: 100%;
    width: 100%;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
.media-visualizer a {
    overflow: hidden;
}
.media-visualizer object {
    max-width: 100%;
    max-height: 100%;
}
</style>
