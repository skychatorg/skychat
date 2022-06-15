<script setup>
import { nextTick, computed, ref, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { RisiBank } from 'risibank-web-api';
import HoverCard from '@/components/util/HoverCard.vue';

const MESSAGE_HISTORY_LENGTH = 500;


const app = useAppStore();
const client = useClientStore();
const risibank = new RisiBank();

const message = ref(null);
const messageTextAreaRows = ref(1);
const fileUploadInput = ref(null);
const historyIndex = ref(null);
const sentMessageHistory = ref([]);

let typingListStr = computed(() => {

    if (client.state.typingList.length === 0) {
        return '';
    }

    if (client.state.typingList.length === 1) {
        return `${client.state.typingList[0].username} is typing..`;
    }

    if (client.state.typingList.length <= 3) {
        const usernames = client.state.typingList.map(user => user.username);
        return `${usernames.join(', ')} are typing..`;
    }

    return `multiple users are currently typing..`;
});


// Watch when the new message input changes. The change does not necessarily come from this component, as the message input can be prepared elsewhere.
watch(() => app.newMessage, (newValue, oldValue) => {
    // Auto-set the message value
    if (newValue !== message.value.value) {
        message.value.value = newValue;
    }
    // Focus message input if not already focused
    if (document.activeElement !== message.value) {
        message.value.focus();
    }
});


/**
 * When the message changes
 */
const onMessageInput = event => {

    let newMessage = event.target.value;

    // Catches when pressing enter while the message input is empty.
    // Also catches the enter input just after a message is sent, to prevent it from being added to the message content.
    if (newMessage.trim() === '') {
        newMessage = '';
        message.value.value = '';
    }

    // Otherwise, set the message
    app.setMessage(newMessage);

    // Infer number of lines of the text area and make it scale accordingly
    let lineCount = newMessage.split('\n').length;
    lineCount = Math.min(lineCount, 5);
    messageTextAreaRows.value = lineCount;
};

/**
 * Navigate into message history
 */
const onNavigateIntoHistory = function(event, offset) {
    let index = historyIndex.value === null ? sentMessageHistory.value.length - 1 : historyIndex.value + offset;
    if (typeof sentMessageHistory.value[index] === 'undefined') {
        return;
    }
    // Set message
    historyIndex.value = index;
    app.setMessage(sentMessageHistory.value[index]);
};

/**
 * Send the new message
 */
const sendMessage = function() {
    sentMessageHistory.value.push(app.newMessage);
    sentMessageHistory.value.splice(0, sentMessageHistory.value.length - MESSAGE_HISTORY_LENGTH);
    historyIndex.value = null;
    messageTextAreaRows.value = 1;
    app.sendMessage();
};

/**
 * Add a RisiBank media
 */
const openRisiBank = function() {

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
const onKeyUpTab = function() {
    const messageMatch = app.newMessage.match(/([*a-zA-Z0-9_-]+)$/);
    const username = messageMatch ? messageMatch[0].toLowerCase() : null;
    if (! username) {
        return;
    }
    const matches = client.state.connectedList
        .map(entry => entry.identifier)
        .filter(identifier => identifier.indexOf(username) === 0);
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
        await app.upload(file);
    }
};

</script>

<template>
    <div class="pt-2 pb-4 px-4">
        <!-- Typing list -->
        <p class="h-5 pl-32 text-xs text-skygray-lightest">
            {{ typingListStr }}
        </p>
        <!-- New message form -->
        <div class="flex">

            <!-- Upload media -->
            <div title="Upload a media">
                <label
                    class="form-control cursor-pointer"
                    for="file-input"
                >
                    <fa icon="upload" />
                </label>
                <input
                    ref="fileUploadInput"
                    @change="onFileInputChange"
                    type="file"
                    id="file-input"
                    class="hidden"
                />
            </div>

            <!-- RisiBank -->
            <button @click="openRisiBank" class="form-control ml-2 h-fit align-bottom">
                <img src="/assets/images/icons/risibank.png" class="p-1 w-6 h-6">
            </button>

            <!-- New message -->
            <textarea
                ref="message"
                :rows="messageTextAreaRows"
                class="form-control ml-2 w-0 grow overflow-x-hidden scrollbar"
                type="text"
                :placeholder="'New message / ' + client.state.currentRoom.name"
                @input="onMessageInput"
                @keyup.up="onNavigateIntoHistory($event, -1)"
                @keyup.down="onNavigateIntoHistory($event, 1)"
                @keydown.tab.prevent="onKeyUpTab"
                @keydown.shift.enter.stop=""
                @keydown.enter.exact.stop="sendMessage"
            ></textarea>

            <!-- Send button -->
            <button @click="sendMessage" class="form-control ml-2 h-fit align-bottom">
                <fa icon="paper-plane" />
            </button>
        </div>
    </div>
</template>

<style scoped>
</style>
