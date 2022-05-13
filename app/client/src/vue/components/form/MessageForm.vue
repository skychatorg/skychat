<template>
    <div class="message-form">

        <!-- Go to left col -->
        <div class="show-mobile goto-other-cols">
            <div @click="onMobileShowLeftCol" title="See rooms and account info" class="goto-left-col" :class="{'has-new': hasNewContentInOtherRooms}">
                <i class="material-icons md-28">keyboard_arrow_left</i>
            </div>
        </div>

        <!-- Upload -->
        <div class="form-action image-upload" v-show="! recordingAudio && uploadingFile" title="Uploading..">
            <label for="file-input">
                <img src="/assets/images/icons/loading.gif"/>
            </label>
        </div>
        <div class="form-action image-upload" v-show="! recordingAudio && ! uploadingFile" title="Upload an image">
            <label for="file-input">
                <i class="upload-icon material-icons md-28">publish</i>
            </label>
            <input ref="file" @change="onFileInputChange" id="file-input" type="file" />
        </div>

        <!-- Audio recorder -->
        <div class="form-action audio-upload" @click="cancelAudioUpload" v-show="recordingAudio" title="Cancel audio recording">
            <i class="upload-icon material-icons md-28">cancel</i>
        </div>
        <div class="form-action audio-upload" :class="{'recording': recordingAudio}" @click="uploadAudio" title="Send an audio recording">
            <i class="upload-icon material-icons md-28">mic</i>
        </div>

        <!-- RisiBank -->
        <div class="form-action risibank" @click="openRisiBank" title="Ajouter un média RisiBank">
            <img src="/assets/images/icons/risibank.png" width="18" height="18" />
        </div>

        <!-- Message -->
        <form class="form" onsubmit="return false">
            <textarea ref="input"
                      rows="1"
                      @keydown.enter.exact.prevent
                      @keydown.enter.exact="sendMessage"
                      @keyup.up="navigateIntoHistory(-1)"
                      @keyup.down="navigateIntoHistory(1)"
                      @keydown.tab.prevent="onKeyUpTab"
                      class="new-message mousetrap"
                      v-model="message"
                      :placeholder="currentRoomObject ? currentRoomObject.name + ' / Message' : 'Message'"></textarea>
        </form>

        <!-- Collections -->
        <div class="form-action open-gallery" v-show="gallery" @click="openGallery" title="Access gallery">
            <i class="material-icons md-28">collections</i>
        </div>

        <!-- Player schedule -->
        <div class="form-action open-player-schedule" @click="openPlayerSchedule" title="See player schedule">
            <i class="material-icons md-28">event</i>
        </div>

        <!-- Go to right col -->
        <div class="show-mobile goto-other-cols">
            <div @click="onMobileShowRightCol" title="See connected list and quick actions" class="goto-right-col">
                <i class="material-icons md-28">keyboard_arrow_right</i>
            </div>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";
    import { mapState } from 'vuex';
    import GalleryModal from "../modal/GalleryModal.vue";
    import PlayerSchedule from "../modal/PlayerSchedule.vue";

    const MESSAGE_HISTORY_LENGTH = 100;

    export default Vue.extend({

        data: function() {
            return {
                message: '',
                historyIndex: null,
                sentMessageHistory: [],
                uploadingFile: false,
                recordingAudio: false,
                recordingAudioStopCb: null,
            };
        },

        created: function() {
            window.addEventListener('paste', this.onPaste);
        },

        watch: {

            message: function(newMessage, oldMessage) {
                const oldTyping = oldMessage.length > 0 && oldMessage[0] !== '/';
                const newTyping = ! this.$store.state.Main.channel && newMessage.length > 0 && newMessage[0] !== '/';
                if (newTyping !== oldTyping) {
                    this.$client.setTyping(newTyping);
                }
                Vue.nextTick(() => this.updateMessageInputHeight());
            },

            focused: function() {
                this.$refs.input.focus();
            }
        },

        methods: {

            getMessage: function() {
                return this.message;
            },

            setMessage: function(message) {
                this.message = message;
                this.$refs.input.focus();
            },

            updateMessageInputHeight: function() {
                if (! this.$refs.input || this.message === '') {
                    this.$refs.input.style.height = '';
                } else {
                    this.$refs.input.style.height = '1px';
                    const newHeight = Math.min(3 + this.$refs.input.scrollHeight, 110);
                    this.$refs.input.style.height = newHeight + "px";
                }
            },

            openGallery: function() {
                this.$modal.show(GalleryModal);
            },

            openPlayerSchedule: function() {
                this.$modal.show(PlayerSchedule);
            },

            uploadAudio: async function() {
                if (this.recordingAudio) {
                    // Stop recording
                    const {blob, uri, audio} = await this.recordingAudioStopCb();
                    this.$client.webSocket.send(blob);
                } else {
                    // Start recording
                    this.recordingAudioStopCb = await this.$audio.start();
                }
                this.recordingAudio = ! this.recordingAudio;
            },

            cancelAudioUpload: async function() {
                if (! this.recordingAudio) {
                    return;
                }
                // Stop recording
                await this.recordingAudioStopCb();
                this.recordingAudio = false;
            },

            openRisiBank: function() {
                RisiBank.activate({
                    type: 'overlay',
                    theme: 'dark',
                    onSelectMedia: ({ media }) => {
                        this.setMessage(this.message + ' ' + media.cache_url + ' ');
                    },
                })
            },

            /**
             * Navigate into message history
             */
            navigateIntoHistory: function(offset) {
                let index = this.historyIndex === null ? this.sentMessageHistory.length - 1 : this.historyIndex + offset;
                if (typeof this.sentMessageHistory[index] === 'undefined') {
                    return;
                }
                this.historyIndex = index;
                this.message = this.sentMessageHistory[index];
            },

            /**
             * On paste event
             */
            onPaste: async function(event) {
                const files = event.clipboardData.files;
                for (const file of files) {
                    await this.upload(file);
                }
            },

            /**
             * On file input change
             */
            onFileInputChange: async function() {
                const fileInput = this.$refs.file;
                for (const file of fileInput.files) {
                    await this.upload(file);
                }
            },

            /**
             * Upload a given file
             */
            upload: async function(file) {
                if (this.uploadingFile) {
                    return;
                }
                this.uploadingFile = true;
                try {
                    const data = new FormData();
                    data.append('file', file);
                    const result = await (await fetch("./upload", {method: 'POST', body: data})).json();
                    if (result.status === 500) {
                        throw new Error('Unable to upload: ' + result.message);
                    }
                    this.setMessage(this.message + ' ' + document.location.origin + '/' + result.path);
                } catch (e) {
                    new Noty({
                        type: 'error',
                        layout: 'topCenter',
                        theme: 'nest',
                        text: e.message,
                        timeout: 2000
                    }).show();
                } finally {
                    this.uploadingFile = false;
                }
            },

            /**
             * Send the message
             */
            sendMessage: function() {
                if (this.message === "") {
                    return;
                }
                this.$client.setTyping(false);
                this.sentMessageHistory.push(this.message);
                this.sentMessageHistory.splice(0, this.sentMessageHistory.length - MESSAGE_HISTORY_LENGTH);
                this.historyIndex = null;
                if (this.$store.state.Main.channel) {
                    this.$client.sendPrivateMessage(this.$store.state.Main.channel, this.message);
                } else {
                    this.$client.sendMessage(this.message);
                }
                this.message = '';
            },

            /**
             * When clicking the arrow to show the right column
             */
            onMobileShowRightCol: function() {
                this.$store.commit('Main/SET_MOBILE_PAGE', 'right');
            },

            /**
             * When clicking the arrow to show the left column
             */
            onMobileShowLeftCol: function() {
                this.$store.commit('Main/SET_MOBILE_PAGE', 'left');
            },

            /**
             * When tab is pressed
             */
            onKeyUpTab: function() {
                const messageMatch = this.message.match(/([*a-zA-Z0-9_-]+)$/);
                const username = messageMatch ? messageMatch[0].toLowerCase() : null;
                if (! username) {
                    return;
                }
                const matches = this.connectedList
                    .map(entry => entry.identifier)
                    .filter(identifier => identifier.indexOf(username) === 0);
                if (matches.length !== 1) {
                    return;
                }
                this.message = this.message.substr(0, this.message.length - username.length) + matches[0];
            },
        },

        computed: {
            ...mapState('Main', [
                'focused',
                'connectedList',
                'gallery',
                'user',
                'rooms',
                'currentRoom',
            ]),
            hasNewContentInOtherRooms: function() {
                if (this.user.id <= 0) {
                    return false;
                }
                for (const room of this.rooms) {
                    if ((this.user.data.plugins.lastseen[room.id] || 0) < room.lastReceivedMessageId) {
                        return true;
                    }
                }
                return false;
            },
            currentRoomObject: function() {
                return this.rooms.find(room => room.id === this.currentRoom);
            }
        }
    });
</script>

<style lang="scss" scoped>

@media screen and (max-width: 600px) {

    .message-form {
        padding-bottom: 50px;

        .form {
            position: absolute;
            bottom: 0;
            left: 5px;
            width: calc(100% - 10px);
        }

        .form-action {
            flex-grow: 1;

            &.risibank {
                display: flex !important;
                flex-direction: row !important;
                justify-content: center !important;
                margin-top: 8px !important;
            }
        }
    }
}

.message-form {
    position: relative;
    display: flex;

    .form-action {
        flex-basis: 24px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        text-align: center;
        margin-left: 12px;
        color: #cccccc;
        cursor: pointer;
        height: 100%;
    }

    .image-upload {
        margin-bottom: 8px;

        .upload-icon {
            width: 100%;
        }

        img {
            width: 100%;
            cursor: wait;
        }

        >input {
            display: none;
        }
    }

    .audio-upload {
        margin-bottom: 10px;

        .upload-icon {
            width: 100%;
        }

        &.recording {
            color: #ff7d7d;
        }
    }

    .risibank {
        margin-bottom: 12px;
    }

    .open-gallery {
        margin-bottom: 12px;
        margin-right: 10px;
    }

    .open-player-schedule {
        margin-bottom: 12px;
        margin-right: 10px;
    }

    .goto-left-col,
    .goto-right-col {
        cursor: pointer;
    }

    .form {
        flex-grow: 1;
        padding: 4px 10px 4px 10px;
        display: flex;

        >.new-message {
            flex-grow: 1;
            height: 38px;
            padding: 10px;
            resize: none;
            border: none;
            background: #2c2d31;
            color: white;
            outline-style: none;
            box-shadow: none;
            font-family: inherit;
            -webkit-transition: box-shadow 0.2s;
            -moz-transition: box-shadow 0.2s;
            -ms-transition: box-shadow 0.2s;
            -o-transition: box-shadow 0.2s;
            transition: box-shadow 0.2s;
        }

        >.new-message:focus {
            box-shadow: 1px 1px 14px #d1d4f53b;
        }
    }

    .goto-other-cols {

        display: flex;
        height: 100%;

        .goto-left-col {
            color: #cccccc;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            margin-left: 10px;

            &.has-new {
                color: #ff7d7d;
            }
        }

        .goto-right-col {
            color: #cccccc;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            margin-right: 10px;
        }
    }
}
</style>
