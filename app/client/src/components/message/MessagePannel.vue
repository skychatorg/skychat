<script setup>
import SingleMessage from '@/components/message/SingleMessage.vue';
import { useClientStore } from '@/stores/client';
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';

const client = useClientStore();

const isSearchMode = computed(() => {
    const hasQuery = client.messageSearch.roomId === client.state.currentRoomId && client.messageSearch.query;
    return hasQuery || client.messageSearchLoading;
});

const displayedMessages = computed(() => (isSearchMode.value ? client.messageSearch.results : client.messages));

const messagePannel = ref(null);

const scrollState = reactive({
    auto: true,
    smooth: true,
    scrolling: false,
});

const distanceToBottom = function () {
    return messagePannel.value.scrollHeight - messagePannel.value.offsetHeight - messagePannel.value.scrollTop;
};

const scrollToBottomIfAutoScroll = function () {
    // Don't auto-scroll in search mode
    if (isSearchMode.value || !scrollState.auto) {
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
watch(
    () => displayedMessages.value.length,
    (newMessageCount, oldMessageCount) => {
        if (newMessageCount < oldMessageCount) {
            return;
        }
        scrollToBottomIfAutoScroll();
        if (!scrollState.auto && messagePannel.value.scrollTop === 0 && !isSearchMode.value) {
            const previousScrollHeight = messagePannel.value.scrollHeight;
            nextTick(() => {
                const newElementsHeight = messagePannel.value.scrollHeight - previousScrollHeight;
                // Set scroll position back to where it was before appending elements
                messagePannel.value.scrollTop = newElementsHeight;
            });
        }
    },
);

// When entering search mode, scroll to bottom to show latest results
watch(isSearchMode, (inSearchMode) => {
    if (inSearchMode) {
        nextTick(() => {
            if (messagePannel.value) {
                messagePannel.value.scrollTop = messagePannel.value.scrollHeight;
            }
        });
    }
});

// When scrolling in the div either auto or manually
const onScroll = () => {
    // If scrolling automatically, do not touch auto-scroll state
    if (scrollState.scrolling) {
        return;
    }
    // If scrolled to top and not in search mode
    if (messagePannel.value.scrollTop === 0 && !isSearchMode.value) {
        client.loadPreviousMessages();
    }
    // Depending on distance to bottom, decide whether to keep auto-scroll (but not in search mode)
    if (!isSearchMode.value) {
        const distance = distanceToBottom();
        if (distance > 60) {
            // Stop auto scroll
            scrollState.auto = false;
        } else if (distance < 30) {
            scrollState.auto = true;
        }
    }
};

function isMessageFirstOfDay(index) {
    if (index === 0) {
        return true;
    }
    const message = displayedMessages.value[index];
    const previousMessage = displayedMessages.value[index - 1];
    const messageDate = new Date(message.createdTimestamp * 1000);
    const previousMessageDate = new Date(previousMessage?.createdTimestamp * 1000);
    return (
        messageDate.getDate() !== previousMessageDate.getDate() ||
        messageDate.getMonth() !== previousMessageDate.getMonth() ||
        messageDate.getFullYear() !== previousMessageDate.getFullYear()
    );
}
</script>

<template>
    <div
        ref="messagePannel"
        class="overflow-x-hidden overflow-y-auto pl-2 scrollbar"
        :style="{
            'scroll-behavior': scrollState.smooth && scrollState.auto ? 'smooth' : 'auto',
        }"
        @scroll="onScroll"
    >
        <template v-if="client.state.currentRoomReady">
            <div
                v-if="isSearchMode && client.messageSearch.query"
                class="sticky top-0 bg-skygray-lighter/25 backdrop-blur-sm px-4 py-2 text-sm text-center border-b border-skygray-lighter/20 z-10"
            >
                <p v-if="!client.messageSearchLoading">
                    Found {{ displayedMessages.length }} result{{ displayedMessages.length > 1 ? 's' : '' }} for "{{
                        client.messageSearch.query
                    }}".
                </p>
                <p v-else>Searching for "{{ client.messageSearch.query }}"...</p>
            </div>
            <div v-if="client.messageSearchLoading" class="text-center py-6 text-skygray-light">Loading search results...</div>
            <template v-else-if="isSearchMode">
                <SingleMessage
                    v-for="(message, index) in displayedMessages"
                    :key="message.id"
                    :message="message"
                    :show-date="isMessageFirstOfDay(index)"
                    @content-size-changed="scrollToBottomIfAutoScroll"
                />
                <div v-if="displayedMessages.length === 0" class="text-center text-skygray-light py-6">
                    No messages found for "{{ client.messageSearch.query }}" in this room.
                </div>
            </template>
            <template v-else>
                <SingleMessage
                    v-for="(message, index) in displayedMessages"
                    :key="message.id"
                    :message="message"
                    :show-date="isMessageFirstOfDay(index)"
                    @content-size-changed="scrollToBottomIfAutoScroll"
                />
            </template>
        </template>
        <template v-else>
            <div class="text-center text-gray-500 mt-4">loading...</div>
        </template>
    </div>
</template>

<style scoped></style>
