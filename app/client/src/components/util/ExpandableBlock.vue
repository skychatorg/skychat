<script setup lang="ts">
import { Ref, onMounted, onUnmounted, ref } from 'vue';
const props = defineProps({
    forceExpand: {
        type: Boolean,
        required: false,
        default: () => false,
    },
});

const emit = defineEmits(['content-size-changed']);

const EXPANDABLE_HEIGHT = 300;

const observer: Ref<null | ResizeObserver> = ref(null);
const container: Ref<null | HTMLDivElement> = ref(null);
onMounted(() => {
    if (!container.value) {
        return;
    }
    observer.value = new ResizeObserver(() => {
        expandable.value = (container.value?.clientHeight || 0) > EXPANDABLE_HEIGHT;
    });
    observer.value.observe(container.value);
});

onUnmounted(() => {
    if (observer.value) {
        observer.value.disconnect();
    }
});

const expandable = ref(false);
const expanded = ref(false);
function expand() {
    expanded.value = true;
    emit('content-size-changed');
}
</script>

<template>
    <div
        ref="container"
        :class="{
            expandable: expandable && !expanded && !props.forceExpand,
        }"
    >
        <slot />
        <div v-if="expandable" class="expandable-overlay">
            <button @click="expand" class="form-control">
                <fa class="text-sm" icon="chevron-down" />
            </button>
        </div>
    </div>
</template>

<style scoped>
.expandable {
    height: 301px; /* 1px more than EXPANDABLE_HEIGHT */
    overflow: hidden;
    position: relative;
}
.expandable-overlay {
    position: absolute;
    bottom: 0.2em;
    left: 1em;
}
</style>
