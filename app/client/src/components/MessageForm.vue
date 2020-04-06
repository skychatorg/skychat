<!--
    Player
-->


<template>
    <div class="message-form">
        <div class="image-upload">
            <label for="file-input">
                <img src="https://redsky.fr/picts/galerie/uploaded/2016-05-28/03-05-51-231dea597d8973819b31-psycho.gif"/>
            </label>
            <input ref="file" @change="upload" id="file-input" type="file" />
        </div>
        <form class="form" onsubmit="return false">
            <input ref="input"
                   @keyup.enter="sendMessage"
                   @keyup.up="navigateIntoHistory(-1)"
                   @keyup.down="navigateIntoHistory(1)"
                   class="new-message"
                   v-model="message"
                   placeholder="Message.."/>
        </form>
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
                sentMessageHistory: []
            };
        },

        watch: {

            message: function(newMessage, oldMessage) {
                const oldTyping = oldMessage.length > 0 && oldMessage[0] !== '/';
                const newTyping = newMessage.length > 0 && newMessage[0] !== '/';
                if (newTyping !== oldTyping) {
                    this.$client.setTyping(newTyping);
                }
            }
        },

        methods: {

            /**
             * Set the message
             */
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
             * Upload a file
             */
            upload: async function() {
                const fileInput = this.$refs.file;
                const file = fileInput.files[0];

                const data = new FormData();
                data.append('file', file);

                const result = await (await fetch("./upload", {method: 'POST', body: data})).json();
                if (result.status === 500) {
                    new Noty({
                        type: 'error',
                        layout: 'topCenter',
                        theme: 'nest',
                        text: result.message,
                        timeout: 2000
                    }).show();
                    return;
                }
                this.setMessage(this.message + ' ' + document.location.href + result.path);
            },

            /**
             * Send the message
             */
            sendMessage: function() {
                this.$client.setTyping(false);
                this.sentMessageHistory.push(this.message);
                this.sentMessageHistory.splice(0, this.sentMessageHistory.length - MESSAGE_HISTORY_LENGTH);
                this.historyIndex = null;
                this.$client.sendMessage(this.message);
                this.message = '';
            }
        }
    });
</script>

<style lang="scss" scoped>

    .message-form {
        display: flex;

        .image-upload {
            flex-basis: 30px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            margin-left: 12px;

            img {
                width: 100%;
                cursor: pointer;
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
    }
</style>
