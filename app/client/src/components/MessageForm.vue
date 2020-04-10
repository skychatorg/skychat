<!--
    Player
-->


<template>
    <div class="message-form">
        <div class="image-upload" v-show="uploading">
            <label for="file-input">
                <img src="https://i.gifer.com/origin/34/34338d26023e5515f6cc8969aa027bca_w200.gif"/>
            </label>
        </div>
        <div class="image-upload" v-show="! uploading">
            <label for="file-input">
                <i class="upload-icon material-icons md-28">publish</i>
            </label>
            <input ref="file" @change="onFileInputChange" id="file-input" type="file" />
        </div>
        <form class="form" onsubmit="return false">
            <input ref="input"
                   @keyup.enter="sendMessage"
                   @keyup.up="navigateIntoHistory(-1)"
                   @keyup.down="navigateIntoHistory(1)"
                   @keydown.tab.prevent="onKeyUpTab"
                   class="new-message"
                   v-model="message"
                   placeholder="Message.."/>
        </form>
        <div @click="onMobileShowList" class="show-mobile">
            <div class="goto-list">
                <i class="material-icons md-28">keyboard_arrow_right</i>
            </div>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";

    const MESSAGE_HISTORY_LENGTH = 100;

    export default Vue.extend({

        data: function() {
            return {
                message: '',
                historyIndex: null,
                sentMessageHistory: [],
                uploading: false,
            };
        },

        created: function() {
            window.addEventListener('paste', this.onPaste);
        },

        watch: {

            message: function(newMessage, oldMessage) {
                const oldTyping = oldMessage.length > 0 && oldMessage[0] !== '/';
                const newTyping = ! this.$store.state.channel && newMessage.length > 0 && newMessage[0] !== '/';
                if (newTyping !== oldTyping) {
                    this.$client.setTyping(newTyping);
                }
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
                if (this.uploading) {
                    return;
                }
                this.uploading = true;
                try {
                    const data = new FormData();
                    data.append('file', file);
                    const result = await (await fetch("./upload", {method: 'POST', body: data})).json();
                    if (result.status === 500) {
                        throw new Error('Unable to upload: ' + result.message);
                    }
                    this.setMessage(this.message + ' ' + document.location.href + result.path);
                } catch (e) {
                    new Noty({
                        type: 'error',
                        layout: 'topCenter',
                        theme: 'nest',
                        text: e.message,
                        timeout: 2000
                    }).show();
                } finally {
                    this.uploading = false;
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
                if (this.$store.state.channel) {
                    this.$client.sendPrivateMessage(this.$store.state.channel, this.message);
                } else {
                    this.$client.sendMessage(this.message);
                }
                this.message = '';
            },

            /**
             * When clicking the arrow to show the connect list on mobile phones
             */
            onMobileShowList: function() {
                this.$store.commit('SET_MOBILE_PAGE', 'list');
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
            }
        },

        computed: {
            focused: function() {
                return this.$store.state.focused;
            },
            connectedList: function() {
                return this.$store.state.connectedList;
            }
        }
    });
</script>

<style lang="scss" scoped>

    .message-form {
        display: flex;

        .image-upload {
            flex-basis: 24px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            margin-left: 12px;
            color: #cccccc;

            .upload-icon {
                width: 100%;
                cursor: pointer;
            }

            img {
                width: 100%;
                cursor: wait;
            }

            >input {
                display: none;
            }
        }

        .form {
            flex-grow: 1;
            padding: 4px 10px 4px 10px;
            display: flex;

            >.new-message {
                flex-grow: 1;
                padding: 10px;
                border: none;
                background: #2c2d31;
                color: white;
                outline-style: none;
                box-shadow: none;
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

        .goto-list {
            color: #cccccc;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            margin-right: 10px;
        }
    }
</style>
