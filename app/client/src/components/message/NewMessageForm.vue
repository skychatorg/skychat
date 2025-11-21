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
    <div class="p-2">
        <!-- New message form -->
        <div class="flex flex-col-reverse lg:flex-row flex-nowrap">
            <!-- Add elements to message -->
            <div class="flex justify-center items-end gap-1">
                <!-- Go to room list (mobile) -->
                <div class="lg:hidden">
                    <button class="form-control h-10 px-3" @click="app.mobileSetView('left')">
                        <fa
                            icon="chevron-left"
                            :class="{
                                'text-danger': hasUnread,
                            }"
                        />
                        <fa v-if="hasUnread" icon="bell" class="ml-1 text-danger" />
                        <fa v-else icon="gears" class="ml-1" />
                    </button>
                </div>

                <!-- Primary actions -->
                <!-- Upload media -->
                <div title="Upload a media">
                    <label class="form-control cursor-pointer w-10 h-10 flex items-center justify-center" for="file-input">
                        <fa icon="upload" />
                    </label>
                    <input id="file-input" ref="fileUploadInput" type="file" class="hidden" @change="onFileInputChange" />
                </div>

                <!-- Send audio -->
                <div title="Send an audio">
                    <div class="flex gap-1">
                        <button class="w-10 h-10 form-control" @click="uploadAudio">
                            <fa icon="microphone" :class="{ 'text-primary': recordingAudio }" />
                        </button>
                        <button v-show="recordingAudio" class="w-10 h-10 form-control" @click="cancelAudio">
                            <fa icon="ban" class="text-danger" />
                        </button>
                    </div>
                </div>

                <!-- More actions menu -->
                <div ref="moreActionsContainer" class="relative">
                    <button
                        title="More actions"
                        class="form-control w-10 h-10 flex items-center justify-center"
                        :class="{ 'text-primary': showMoreActions || encryptMessage }"
                        @click="toggleMoreActions"
                    >
                        <fa icon="plus" />
                    </button>

                    <!-- Popover menu -->
                    <div
                        v-show="showMoreActions"
                        class="absolute bottom-12 left-0 form-control p-2 flex flex-col gap-1 z-50 min-w-max"
                    >
                        <!-- RisiBank -->
                        <button
                            title="Add a media from RisiBank"
                            class="form-control w-full h-10 flex items-center gap-2 px-3"
                            @click="openRisiBank(); showMoreActions = false"
                        >
                            <img src="/assets/images/icons/risibank.png" class="w-4 h-4" />
                            <span class="text-sm">RisiBank</span>
                        </button>

                        <!-- Encrypt message -->
                        <button
                            title="Encrypt the next message"
                            class="form-control w-full h-10 flex items-center gap-2 px-3"
                            :class="{ 'text-primary': encryptMessage }"
                            @click="toggleEncryptionPanel(); showMoreActions = false"
                        >
                            <fa icon="lock" />
                            <span class="text-sm">Encrypt</span>
                        </button>

                        <!-- Expand/collapse -->
                        <button
                            title="Expand input"
                            class="form-control w-full h-10 flex items-center gap-2 px-3"
                            :class="{ 'text-primary': isManuallyExpanded }"
                            @click="toggleExpand(); showMoreActions = false"
                        >
                            <fa :icon="isManuallyExpanded ? 'compress' : 'expand'" />
                            <span class="text-sm">{{ isManuallyExpanded ? 'Collapse' : 'Expand' }}</span>
                        </button>
                    </div>
                </div>

                <!-- Go to user list (mobile) -->
                <div class="lg:hidden">
                    <button class="form-control h-10 px-3" @click="app.mobileSetView('right')">
                        <fa icon="users" class="mr-1" />
                        <fa icon="chevron-right" />
                    </button>
                </div>
            </div>

            <!-- Message & send button -->
            <div v-if="client.state.currentRoom" class="mb-2 lg:mb-0 grow w-full lg:w-0 flex">
                <!-- New message -->
                <div class="grow flex flex-col">
                    <!-- Typing list -->
                    <p class="h-5 pl-2 text-xs text-skygray-lightest">
                        {{ typingListText }}
                    </p>

                    <div
                        v-if="encryptMessage"
                        class="bg-skygray-dark/25 border border-primary rounded px-3 py-3 mb-2 text-xs text-skygray-lightest"
                    >
                        <div class="flex items-center text-primary gap-2">
                            <fa icon="lock" />
                            <span>Encrypt the next message before sending.</span>
                            <button
                                type="button"
                                class="ml-auto text-[11px] uppercase tracking-wide text-skygray-lightest/70 hover:text-white"
                                @click="toggleEncryptionPanel"
                            >
                                Cancel
                            </button>
                        </div>
                        <div class="mt-3 space-y-3">
                            <input
                                v-model="encryptionPassphrase"
                                type="password"
                                class="form-control w-full"
                                placeholder="Enter passphrase"
                            />
                            <input
                                v-model="encryptionLabel"
                                type="text"
                                class="form-control w-full"
                                placeholder="Optional label shown to recipients"
                            />
                            <p v-if="encryptionError" class="text-danger">{{ encryptionError }}</p>
                        </div>
                    </div>

                    <SmartSuggest class="flex" :triggers="suggestTriggers" @open="autoSuggestOpen = true" @close="autoSuggestOpen = false">
                        <textarea
                            ref="message"
                            type="text"
                            :rows="messageTextAreaRows"
                            class="mousetrap form-control lg:ml-2 scrollbar resize-none w-full"
                            :placeholder="textAreaPlaceholder"
                            :disabled="!client.state.currentRoom"
                            :maxlength="client.state.currentRoom.plugins.messagelimiter ?? null"
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
                </div>

                <!-- Send button -->
                <div title="Send" class="flex flex-col justify-end">
                    <button class="form-control ml-2 h-fit align-bottom" @click="sendMessage">
                        <fa icon="paper-plane" />
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
