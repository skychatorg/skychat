<script setup>
import { onMounted, nextTick, watch, ref, reactive } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import SingleMessage from '@/components/message/SingleMessage.vue';

const app = useAppStore();
const client = useClientStore();

const messagePannel = ref(null);

const scrollState = reactive({
    auto: true,
    smooth: true,
    scrolling: false,
});


const distanceToBottom = function() {
    return messagePannel.value.scrollHeight - messagePannel.value.offsetHeight - messagePannel.value.scrollTop;
};

const scrollToBottomIfAutoScroll = function() {
    if (! scrollState.auto) {
        return;
    }
    // We need to wait 1 tick for the message to be rendered
    nextTick(() => {
        scrollToBottom(distanceToBottom() > 200);
    });
};

// Detect when the pannel size changes to scroll to bottom
onMounted(() => {
    new ResizeObserver(scrollToBottomIfAutoScroll).observe(messagePannel.value);
});

const scrollToBottom = (immediate) => {
    // If already auto scrolling, abort
    if (scrollState.scrolling) {
        return;
    }
    if (distanceToBottom() <= 0) {
        return;
    }
    // Set scrolling state to true
    scrollState.scrolling = true;
    // If in immediate mode
    if (immediate) {
        // Disable smooth scroll
        scrollState.smooth = false;
        // Wait for smooth scroll to be disabled
        nextTick(() => {
            // Scroll directly to bottom
            messagePannel.value.scrollTop = messagePannel.value.scrollHeight;
            // Re-enable smooth scroll
            scrollState.smooth = true;
            // Update scrolling state
            scrollState.scrolling = false;
        });
    } else {
        // Smoothly scroll to bottom
        messagePannel.value.scrollTop = messagePannel.value.scrollHeight;
        // In a few ms, check if still need to scroll
        setTimeout(() => {
            // Update state
            scrollState.scrolling = false;
            // If still need to scroll
            const distance = distanceToBottom();
            if (distance > 1) {
                scrollToBottom(distance > 200);
            }
        }, 100);
    }
};

// When the list of messages changes, scroll to bottom
watch(() => client.messages.length, (newMessageCount, oldMessageCount) => {
    if (newMessageCount < oldMessageCount) {
        return;
    }
    scrollToBottomIfAutoScroll();
    if (! scrollState.auto && messagePannel.value.scrollTop === 0) {
        const previousScrollHeight = messagePannel.value.scrollHeight;
        nextTick(() => {
            const newElementsHeight = messagePannel.value.scrollHeight - previousScrollHeight;
            // Set scroll position back to where it was before appending elements
            messagePannel.value.scrollTop = newElementsHeight;
        });
    }
});

// When scrolling in the div either auto or manually
const onScroll = () => {
    // If scrolling automatically, do not touch auto-scroll state
    if (scrollState.scrolling) {
        return;
    }
    // If scrolled to top
    if (messagePannel.value.scrollTop === 0) {
        client.loadPreviousMessages();
    }
    // Depending on distance to bottom, decide whether to keep auto-scroll
    const distance = distanceToBottom();
    if (distance > 60) {
        // Stop auto scroll
        scrollState.auto = false;
    } else if (distance < 30) {
        scrollState.auto = true;
    }
};
</script>

<template>
    <div
        class="overflow-x-hidden overflow-y-auto pl-2 scrollbar"
        ref="messagePannel"
        @scroll="onScroll"
        :style="{
            'scroll-behavior': scrollState.smooth && scrollState.auto ? 'smooth' : 'auto',
        }"
    >
        <SingleMessage
            v-for="message in client.messages"
            :key="message.id"
            :message="message"
            @content-changed="scrollToBottomIfAutoScroll"
        />
    </div>
</template>

<style scoped>
</style>
