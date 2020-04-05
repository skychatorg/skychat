<!--
    Player
-->


<template>
    <div class="messages scrollbar" ref="messages">
        <message v-for="message in messages"
                 @select="$emit('select-message', message)"
                 :key="message.id"
                 :message="message"
                 class="message"/>
    </div>
</template>

<script>
    import Vue from "vue";
    import Message from "./Message.vue";

    export default Vue.extend({
        components: {Message},
        watch: {
            messages: function() {

                Vue.nextTick(() => {
                    this.scrollToBottom();
                });
            }
        },
        methods: {
            scrollToBottom: function() {
                this.scrollTick();
            },
            scrollTick: function() {
                const messages = this.$refs.messages;
                messages.scrollTop += (messages.scrollHeight - messages.offsetHeight - messages.scrollTop) * .2;
                if (Math.abs(messages.scrollHeight - messages.offsetHeight - messages.scrollTop) > 6) {
                    setTimeout(this.scrollTick.bind(this), 16);
                } else {
                    messages.scrollTop = messages.scrollHeight;
                }
            },
        },
        computed: {
            messages: function() {
                return this.$store.state.messages;
            }
        }
    });
</script>

<style lang="scss" scoped>

    .messages {
        flex-grow: 1;
        margin-left: 10px;
        margin-right: 10px;
        height: 0;
        overflow-y: scroll;
        display: flex;
        flex-direction: column;
    }
</style>
