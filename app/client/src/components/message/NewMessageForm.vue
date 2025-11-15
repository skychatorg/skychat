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

onMounted(() => {
    message.value.focus();
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
            message.value.focus();
        }
    },
);

// Focus message input when app is newly focused
watch(
    () => app.focused,
    (focused) => focused && message.value.focus(),
);

// Focus message input when app changes room
watch(
    () => client.state.currentRoomId,
    (currentRoomId) => currentRoomId && message.value.focus(),
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
    messageTextAreaRows.value = Math.min(lineCount, 8);
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
    const index = historyIndex.value === null ? sentMessageHistory.value.length - 1 : historyIndex.value + offset;
    if (typeof sentMessageHistory.value[index] === 'undefined') {
        return;
    }
    // Set message
    historyIndex.value = index;
    app.setMessage(sentMessageHistory.value[index]);
    updateTextAreaSize();
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
            <div class="flex justify-center">
                <!-- Go to room list -->
                <div class="lg:hidden grow">
                    <button class="form-control" @click="app.mobileSetView('left')">
                        <fa
                            icon="chevron-left"
                            :class="{
                                'text-danger': hasUnreadMessagesInOtherRooms,
                            }"
                        />
                        <fa v-if="hasUnreadMessagesInOtherRooms" icon="bell" class="ml-2 text-danger" />
                        <fa v-else icon="gears" class="ml-2" />
                    </button>
                </div>

                <!-- Upload media -->
                <div title="Upload a media" class="flex flex-col justify-end">
                    <label class="form-control cursor-pointer w-12" for="file-input">
                        <fa icon="upload" />
                    </label>
                    <input id="file-input" ref="fileUploadInput" type="file" class="hidden" @change="onFileInputChange" />
                </div>

                <!-- Send audio -->
                <div title="Send an audio" class="ml-2 flex flex-col justify-end">
                    <div class="flex">
                        <button class="w-12 form-control" @click="uploadAudio">
                            <fa icon="microphone" :class="{ 'text-primary': recordingAudio }" />
                        </button>
                        <button v-show="recordingAudio" class="ml-2 w-12 form-control" @click="cancelAudio">
                            <fa icon="ban" class="text-danger" />
                        </button>
                    </div>
                </div>

                <!-- RisiBank -->
                <div title="Add a media from RisiBank" class="flex flex-col justify-end">
                    <button class="form-control ml-2 w-12 h-10 align-bottom" @click="openRisiBank">
                        <img src="/assets/images/icons/risibank.png" class="w-4 h-4" />
                    </button>
                </div>

                <!-- Encrypt message -->
                <div title="Encrypt the next message" class="flex flex-col justify-end">
                    <button
                        type="button"
                        class="form-control ml-2 w-12 h-10 align-bottom"
                        :class="{ 'text-primary': encryptMessage }"
                        @click="toggleEncryptionPanel"
                    >
                        <fa icon="lock" />
                    </button>
                </div>

                <!-- Go to user list -->
                <div class="lg:hidden grow text-end">
                    <button class="form-control" @click="app.mobileSetView('right')">
                        <fa icon="users" class="mr-2" />
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
                            @keyup.up.exact="!autoSuggestOpen && onNavigateIntoHistory($event, -1)"
                            @keyup.down.exact="!autoSuggestOpen && onNavigateIntoHistory($event, 1)"
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
</style>
