<!--
    Player
-->


<template>
    <div>
        <form class="form" onsubmit="return false">
            <input @keyup.enter="sendMessage"
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
             * Send the message
             */
            sendMessage: function() {
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

    .form {
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
</style>
