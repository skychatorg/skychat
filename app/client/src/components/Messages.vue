<!--
    Player
-->


<template>
    <div class="messages">
        <player class="player" v-show="currentVideo && currentVideo.enabled"/>
        <div class="messages-feed scrollbar" ref="messages" @scroll="onScroll">
            <message v-for="message in messages"
                     @select="$emit('select-message', message)"
                     @content-loaded="onContentLoaded"
                     :key="message.id"
                     :message="message"
                     class="message"/>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";
    import Message from "./Message.vue";
    import Player from "./Player.vue";

    export default Vue.extend({
        components: {Player, Message},
        data: function() {
            return {
                autoScroll: true,
                autoScrolling: false,
            };
        },
        watch: {
            messages: function() {
                Vue.nextTick(() => {
                    if (this.autoScroll) {
                        this.scrollToBottom();
                    }
                });
            }
        },
        methods: {
            onContentLoaded: function() {
                if (this.autoScroll) {
                    this.scrollToBottom();
                }
            },
            onScroll: function() {
                if (this.autoScrolling) {
                    return;
                }
                const distanceToBottom = this.$refs.messages.scrollHeight - this.$refs.messages.offsetHeight - this.$refs.messages.scrollTop;
                if (distanceToBottom > 22) {
                    // Stop auto scroll
                    this.autoScroll = false;
                } else if (distanceToBottom < 20) {
                    this.autoScroll = true;
                }
            },
            scrollToBottom: function() {
                if (this.autoScrolling) {
                    return;
                }
                this.autoScrolling = true;
                this.scrollTick();
            },
            scrollTick: function() {
                const messages = this.$refs.messages;
                messages.scrollTop += (messages.scrollHeight - messages.offsetHeight - messages.scrollTop) * .3;
                if (Math.abs(messages.scrollHeight - messages.offsetHeight - messages.scrollTop) > 6) {
                    setTimeout(this.scrollTick.bind(this), 10);
                } else {
                    messages.scrollTop = messages.scrollHeight;
                    this.autoScrolling = false;
                }
            },
        },
        computed: {
            messages: function() {
                if (this.$store.state.channel) {
                    return this.$store.state.privateMessages[this.$store.state.channel].messages;
                }
                return this.$store.state.messages;
            },
            currentVideo: function() {
                return this.$store.state.currentVideo;
            },
        }
    });
</script>

<style lang="scss" scoped>

    .messages {
        flex-grow: 1;
        display: flex;
        flex-direction: column;

        .player {
            width: 100%;
            height: 40%;
            max-height: 350px;
        }

        .messages-feed {
            flex-grow: 1;
            margin-left: 10px;
            margin-right: 10px;
            height: 0;
            overflow-y: scroll;
            display: flex;
            flex-direction: column;
            margin-top: 5px;
        }
    }
</style>
