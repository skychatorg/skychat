<script setup>
import { AudioRecorder } from '@/lib/AudioRecorder';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { useEncryptionStore } from '@/stores/encryption';
import { RisiBank } from 'risibank-web-api';
import { computed, onMounted, ref, watch } from 'vue';
import { SmartSuggest } from 'vue-smart-suggest';
import { useClientState } from '../../composables/useClientState';

const MESSAGE_HISTORY_LENGTH = 500;

const app = useAppStore();
const client = useClientStore();
const encryption = useEncryptionStore();

const message = ref(null);
const messageTextAreaRows = ref(1);
const fileUploadInput = ref(null);
const historyIndex = ref(null);
const sentMessageHistory = ref([]);
const savedCurrentMessage = ref('');

// UX improvement states
const isFocused = ref(false);
const isManuallyExpanded = ref(false);
const showMoreActions = ref(false);
const moreActionsContainer = ref(null);

onMounted(() => {
    message.value.focus();

    // Close popover when clicking outside
    document.addEventListener('click', (event) => {
        if (showMoreActions.value && moreActionsContainer.value && !moreActionsContainer.value.contains(event.target)) {
            showMoreActions.value = false;
        }
    });
});

const typingListText = computed(() => {
    let typingUsers = client.state.typingList;

    typingUsers = typingUsers.filter((user) => user.username.toLowerCase() !== client.state.user.username.toLowerCase());

    if (typingUsers.length === 0) {
        return '';
    }

    if (typingUsers.length === 1) {
        return `${typingUsers[0].username} is typing..`;
    }

    if (typingUsers.length <= 4) {
        const usernames = typingUsers.map((user) => user.username);
        return `${usernames.join(', ')} are typing..`;
    }

    return 'multiple users are currently typing..';
});

const textAreaPlaceholder = computed(() => {
    if (!client.state.currentRoom) {
        return '❌ Disconnected';
    }
    let placeholder = `New message / ${client.state.currentRoom.name}`;
    if (client.state.currentRoom.plugins.messagelimiter) {
        placeholder += ` (char limit: ${client.state.currentRoom.plugins.messagelimiter})`;
    }
    return placeholder;
});

// Watch when the new message input changes. The change does not necessarily come from this component, as the message input can be prepared elsewhere.
watch(
    () => app.newMessage,
    (newValue) => {
        // Auto-set the message value
        if (newValue !== message.value.value) {
            message.value.value = newValue;
        }
        // Focus message input if not already focused
        if (document.activeElement !== message.value) {
            message.value?.focus();
        }
    },
);

// Focus message input when app is newly focused
watch(
    () => app.focused,
    (focused) => focused && message.value?.focus(),
);

// Focus message input when app changes room
watch(
    () => client.state.currentRoomId,
    (currentRoomId) => currentRoomId && message.value?.focus(),
);

/**
 * When the message changes
 */
const onMessageInput = (event) => {
    let newMessage = event.target.value;

    // Catches when pressing enter while the message input is empty.
    // Also catches the enter input just after a message is sent, to prevent it from being added to the message content.
    if (newMessage.trim() === '') {
        newMessage = '';
        message.value.value = '';
    }

    // Otherwise, set the message
    app.setMessage(newMessage);
    updateTextAreaSize();
};

const updateTextAreaSize = () => {
    // Infer number of lines of the text area and make it scale accordingly
    let lineCount = app.newMessage.split('\n').length;
    lineCount = lineCount + app.newMessage.split('\n').filter((line) => line.length > 80).length;

    // Determine minimum rows based on state
    // Only expand after user starts typing (not just on focus)
    let minRows = 1;
    if (isManuallyExpanded.value) {
        minRows = 6;
    } else if (isFocused.value && app.newMessage.length > 0) {
        minRows = 3;
    }

    messageTextAreaRows.value = Math.min(Math.max(lineCount, minRows), 8);
};

const onFocus = () => {
    isFocused.value = true;
    updateTextAreaSize();
};

const onBlur = () => {
    isFocused.value = false;
    // Delay to allow click events on buttons to fire first
    setTimeout(() => {
        if (!isFocused.value) {
            updateTextAreaSize();
        }
    }, 150);
};

const toggleExpand = () => {
    isManuallyExpanded.value = !isManuallyExpanded.value;
    updateTextAreaSize();
};

const toggleMoreActions = () => {
    showMoreActions.value = !showMoreActions.value;
};

/**
 * Navigate into message history
 */
const onNavigateIntoHistory = function (event, offset) {
    if (offset < 0 && event.target.selectionStart > 1) {
        return;
    }
    if (offset > 0 && event.target.selectionStart < event.target.value.length - 1) {
        return;
    }

    // Save current message when first entering history
    if (historyIndex.value === null && offset < 0) {
        savedCurrentMessage.value = app.newMessage;
    }

    const newIndex = historyIndex.value === null ? sentMessageHistory.value.length - 1 : historyIndex.value + offset;

    // If navigating past the end of history, restore saved message
    if (newIndex >= sentMessageHistory.value.length) {
        historyIndex.value = null;
        app.setMessage(savedCurrentMessage.value);
        updateTextAreaSize();
        return;
    }

    if (newIndex < 0 || typeof sentMessageHistory.value[newIndex] === 'undefined') {
        return;
    }

    // Set message from history
    historyIndex.value = newIndex;
    app.setMessage(sentMessageHistory.value[newIndex]);
    updateTextAreaSize();
};

/**
 * Exit history navigation and restore current message
 */
const exitHistory = function () {
    if (historyIndex.value !== null) {
        historyIndex.value = null;
        app.setMessage(savedCurrentMessage.value);
        updateTextAreaSize();
    }
};

/**
 * Send the new message
 */
const sendMessage = async function () {
    const currentMessage = app.newMessage;
    if (currentMessage.trim().length === 0) {
        return;
    }
    const sent = await app.sendMessage({
        encrypt: encryptMessage.value,
        passphrase: encryptMessage.value ? encryptionPassphrase.value.trim() : '',
        label: encryptMessage.value ? encryptionLabel.value.trim() : '',
    });
    if (!sent) {
        return;
    }
    sentMessageHistory.value.push(currentMessage);
    sentMessageHistory.value.splice(0, sentMessageHistory.value.length - MESSAGE_HISTORY_LENGTH);
    historyIndex.value = null;
    savedCurrentMessage.value = '';
    messageTextAreaRows.value = 1;
    if (encryptMessage.value) {
        encryptMessage.value = false;
    }
};

/**
 * Add a RisiBank media
 */
const openRisiBank = function () {
    RisiBank.activate({
        // Use default options for Overlay + Dark
        // Other defaults are all combinations of Overlay/Modal/Frame and Light/Dark/LightClassic/DarkClassic, e.g. RisiBank.Defaults.Frame.LightClassic
        ...RisiBank.Defaults.Overlay.Dark,

        // Add selected image (risibank) to specified text area
        onSelectMedia: RisiBank.Actions.addRisiBankImageLink(message.value),
    });
};

/**
 * When the file input changed
 */
const onFileInputChange = async () => {
    for (const file of fileUploadInput.value.files) {
        app.setMessage(app.newMessage + ' ' + (await app.upload(file)));
    }
};

/**
 * Whether the user has unread messages in any other rooms
 */
const hasUnread = ref(client.hasUnreadMessages());
useClientState(() => {
    hasUnread.value = client.hasUnreadMessages();
});

/**
 * Start an audio upload
 */
const recordingAudio = ref(false);
const recordingAudioStopCb = ref(null);
const uploadAudio = async function () {
    if (recordingAudio.value) {
        // Stop recording
        const { blob } = await recordingAudioStopCb.value();
        client.sendAudio(blob);
    } else {
        // Start recording
        recordingAudioStopCb.value = await AudioRecorder.start();
    }
    recordingAudio.value = !recordingAudio.value;
};
const cancelAudio = function () {
    if (recordingAudio.value) {
        recordingAudioStopCb.value();
    }
    recordingAudio.value = false;
};

const autoSuggestOpen = ref(false);

const suggestTriggers = computed(() => [
    {
        char: '@',
        whitespaceBefore: true,
        items: Object.values(client.state.connectedList)
            .map((user) => ({
                value: `@${user.identifier}`,
                searchText: user.identifier,
            }))
            .concat([
                {
                    value: `@here`,
                    searchText: `@here (all connected users)`,
                },
            ]),
    },
    {
        char: ':',
        searchRegExp: /([a-zA-Z0-9-_)(]*)$/,
        whitespaceBefore: true,
        items: Object.entries(client.state.stickers).map(([name, sticker]) => ({
            value: name,
            image: sticker,
        })),
        maxRenderedItems: 12,
    },
    {
        char: '#',
        items: Object.values(client.state.rooms)
            .filter((room) => !room.isPrivate)
            .map((room) => ({
                value: room.id.toString(),
                label: `# ${room.name}`,
                searchMatch: room.name,
            })),
    },
]);

const encryptMessage = ref(false);
const encryptionPassphrase = ref('');
const encryptionLabel = ref('');
const encryptionError = computed(() => encryption.composerError);

watch(encryptMessage, (value) => {
    if (!value) {
        encryptionPassphrase.value = '';
        encryptionLabel.value = '';
        encryption.clearComposerError();
    }
});

watch([encryptionPassphrase, encryptionLabel], () => {
    if (encryptionError.value) {
        encryption.clearComposerError();
    }
});

const toggleEncryptionPanel = () => {
    encryptMessage.value = !encryptMessage.value;
};
</script>

<template>
    <!-- eslint-disable vue/valid-attribute-name -->
    <!-- eslint-disable vue/no-lone-template -->
    <div class="p-3 pt-0">
        <div class="rounded-xl hairline-strong bg-white/[.02]">
            <!-- Typing indicator -->
            <div class="px-3 pt-2 text-xs text-white/40 flex items-center gap-1.5 h-5">
                <template v-if="typingListText">
                    <span class="flex gap-0.5">
                        <span class="w-1 h-1 rounded-full bg-primary animate-pulse" />
                        <span class="w-1 h-1 rounded-full bg-primary animate-pulse" style="animation-delay: 0.15s" />
                        <span class="w-1 h-1 rounded-full bg-primary animate-pulse" style="animation-delay: 0.3s" />
                    </span>
                    <span>{{ typingListText }}</span>
                </template>
            </div>

            <!-- Encryption inline panel -->
            <div
                v-if="encryptMessage"
                class="mx-3 mb-2 bg-skygray-dark/25 border border-primary rounded px-3 py-3 text-xs text-skygray-lightest"
            >
                <div class="flex items-center text-primary gap-2">
                    <fa icon="lock" />
                    <span>Encrypt the next message before sending.</span>
                    <button
                        type="button"
                        class="ml-auto text-xs uppercase tracking-wide text-skygray-lightest/70 hover:text-white"
                        @click="toggleEncryptionPanel"
                    >
                        Cancel
                    </button>
                </div>
                <div class="mt-3 space-y-3">
                    <input v-model="encryptionPassphrase" type="password" class="form-control w-full" placeholder="Enter passphrase" />
                    <input
                        v-model="encryptionLabel"
                        type="text"
                        class="form-control w-full"
                        placeholder="Optional label shown to recipients"
                    />
                    <p v-if="encryptionError" class="text-danger">{{ encryptionError }}</p>
                </div>
            </div>

            <!-- Textarea -->
            <SmartSuggest class="flex" :triggers="suggestTriggers" @open="autoSuggestOpen = true" @close="autoSuggestOpen = false">
                <textarea
                    ref="message"
                    type="text"
                    :rows="messageTextAreaRows"
                    class="mousetrap w-full bg-transparent px-3 py-2 text-base resize-none focus:outline-none placeholder:text-white/30 scrollbar"
                    :placeholder="textAreaPlaceholder"
                    :disabled="!client.state.currentRoom"
                    :maxlength="client.state.currentRoom?.plugins.messagelimiter ?? null"
                    @input="onMessageInput"
                    @focus="onFocus"
                    @blur="onBlur"
                    @keyup.up.exact="!autoSuggestOpen && onNavigateIntoHistory($event, -1)"
                    @keyup.down.exact="!autoSuggestOpen && onNavigateIntoHistory($event, 1)"
                    @keydown.escape="exitHistory"
                    @keydown.shift.enter.stop=""
                    @keydown.enter.exact.stop="!autoSuggestOpen && sendMessage()"
                ></textarea>
            </SmartSuggest>

            <!-- Button row -->
            <div class="flex items-center gap-1 px-2 pb-2">
                <!-- Mobile: room list -->
                <button
                    class="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/5"
                    title="Rooms"
                    @click="app.mobileSetView('left')"
                >
                    <fa icon="chevron-left" :class="{ 'text-danger': hasUnread }" />
                </button>

                <!-- More actions -->
                <div ref="moreActionsContainer" class="relative">
                    <button
                        class="w-8 h-8 rounded-lg flex items-center justify-center transition"
                        :class="
                            showMoreActions || encryptMessage
                                ? 'bg-primary/15 text-primary ring-1 ring-primary/40'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                        "
                        title="More actions"
                        @click="toggleMoreActions"
                    >
                        <fa icon="plus" />
                    </button>
                    <div v-show="showMoreActions" class="absolute bottom-10 left-0 form-control p-2 flex flex-col gap-1 z-50 min-w-max">
                        <button
                            title="Encrypt the next message"
                            class="form-control w-full h-10 flex items-center gap-2 px-3"
                            :class="{ 'text-primary': encryptMessage }"
                            @click="
                                toggleEncryptionPanel();
                                showMoreActions = false;
                            "
                        >
                            <fa icon="lock" />
                            <span class="text-sm">Encrypt</span>
                        </button>
                        <button
                            title="Expand input"
                            class="form-control w-full h-10 flex items-center gap-2 px-3"
                            :class="{ 'text-primary': isManuallyExpanded }"
                            @click="
                                toggleExpand();
                                showMoreActions = false;
                            "
                        >
                            <fa :icon="isManuallyExpanded ? 'compress' : 'expand'" />
                            <span class="text-sm">{{ isManuallyExpanded ? 'Collapse' : 'Expand' }}</span>
                        </button>
                    </div>
                </div>

                <!-- Upload -->
                <label
                    for="file-input"
                    class="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/5 cursor-pointer"
                    title="Upload a file"
                >
                    <fa icon="paperclip" />
                </label>
                <input id="file-input" ref="fileUploadInput" type="file" class="hidden" @change="onFileInputChange" />

                <!-- RisiBank -->
                <button
                    class="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/5"
                    title="Add a media from RisiBank"
                    @click="openRisiBank"
                >
                    <img src="/assets/images/icons/risibank.png" class="w-4 h-4" />
                </button>

                <!-- Audio -->
                <button
                    class="w-8 h-8 rounded-lg flex items-center justify-center transition"
                    :class="
                        recordingAudio
                            ? 'bg-primary/15 text-primary ring-1 ring-primary/40'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                    "
                    title="Record audio"
                    @click="uploadAudio"
                >
                    <fa icon="microphone" />
                </button>
                <button
                    v-show="recordingAudio"
                    class="w-8 h-8 rounded-lg flex items-center justify-center text-danger hover:bg-white/5"
                    title="Cancel audio"
                    @click="cancelAudio"
                >
                    <fa icon="ban" />
                </button>

                <!-- Mobile: user list -->
                <button
                    class="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/5"
                    title="Users"
                    @click="app.mobileSetView('right')"
                >
                    <fa icon="users" />
                </button>

                <!-- Send -->
                <div class="ml-auto flex items-center gap-2">
                    <span class="font-mono text-xs text-white/30 hidden xl:inline"> <kbd>↵</kbd> send </span>
                    <button
                        class="px-3 h-10 rounded-lg text-sm font-medium text-white flex items-center gap-1.5 hover:brightness-110 transition disabled:opacity-50"
                        :class="app.newMessage.trim() ? 'bg-primary' : 'bg-white/[.08]'"
                        :disabled="!client.state.currentRoom"
                        title="Send"
                        @click="sendMessage"
                    >
                        <fa icon="paper-plane" />
                        Send
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="postcss">
.autosuggest-item {
    @apply px-1 cursor-pointer;
}

textarea {
    transition: height 0.15s ease-out;
}
</style>
