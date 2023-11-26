<script setup>
import { onMounted, computed, ref, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { AudioRecorder } from '@/lib/AudioRecorder';
import { RisiBank } from 'risibank-web-api';

const MESSAGE_HISTORY_LENGTH = 500;

const app = useAppStore();
const client = useClientStore();
const risibank = new RisiBank();

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
const sendMessage = function () {
    sentMessageHistory.value.push(app.newMessage);
    sentMessageHistory.value.splice(0, sentMessageHistory.value.length - MESSAGE_HISTORY_LENGTH);
    historyIndex.value = null;
    messageTextAreaRows.value = 1;
    app.sendMessage();
};

/**
 * Add a RisiBank media
 */
const openRisiBank = function () {
    risibank.activate({
        // Use default options for Overlay + Dark
        // Other defaults are all combinations of Overlay/Modal/Frame and Light/Dark/LightClassic/DarkClassic, e.g. RisiBank.Defaults.Frame.LightClassic
        ...RisiBank.Defaults.Overlay.Dark,

        // Add selected image (risibank) to specified text area
        onSelectMedia: RisiBank.Actions.addRisiBankImageLink(message.value),
    });
};

/**
 * Autocomplete the username
 */
const onKeyUpTab = function () {
    const messageMatch = app.newMessage.match(/([*a-zA-Z0-9_-]+)$/);
    const username = messageMatch ? messageMatch[0].toLowerCase() : null;
    if (!username) {
        return;
    }
    const matches = client.state.connectedList.map((entry) => entry.identifier).filter((identifier) => identifier.indexOf(username) === 0);
    if (matches.length !== 1) {
        return;
    }
    app.setMessage(app.newMessage.substr(0, app.newMessage.length - username.length) + matches[0]);
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
const hasUnreadMessagesInOtherRooms = computed(() => {
    if (client.state.user.id <= 0) {
        return false;
    }
    for (const room of client.state.rooms) {
        if ((client.state.user.data.plugins.lastseen[room.id] || 0) < room.lastReceivedMessageId) {
            return true;
        }
    }
    return false;
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
</script>

<template>
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

                <!-- Go to user list -->
                <div class="lg:hidden grow text-end">
                    <button class="form-control" @click="app.mobileSetView('right')">
                        <fa icon="users" class="mr-2" />
                        <fa icon="chevron-right" />
                    </button>
                </div>
            </div>

            <!-- Message & send button -->
            <div class="mb-2 lg:mb-0 grow w-full lg:w-0 flex">
                <!-- New message -->
                <div class="grow flex flex-col">
                    <!-- Typing list -->
                    <p class="h-5 pl-2 text-xs text-skygray-lightest">
                        {{ typingListText }}
                    </p>
                    <textarea
                        ref="message"
                        :rows="messageTextAreaRows"
                        class="mousetrap form-control lg:ml-2 scrollbar resize-none"
                        type="text"
                        :placeholder="textAreaPlaceholder"
                        :disabled="!client.state.currentRoom"
                        :maxlength="client.state.currentRoom.plugins.messagelimiter ?? null"
                        @input="onMessageInput"
                        @keyup.up.exact="onNavigateIntoHistory($event, -1)"
                        @keyup.down.exact="onNavigateIntoHistory($event, 1)"
                        @keydown.tab.prevent="onKeyUpTab"
                        @keydown.shift.enter.stop=""
                        @keydown.enter.exact.stop="sendMessage"
                    ></textarea>
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

<style scoped></style>
