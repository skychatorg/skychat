<template>
    <div class="messages">

        <!-- player -->
        <video-player v-if="! hidePlayer" class="player" v-show="playerState.current && playerEnabled"/>

        <!-- message feeds -->
        <message-list :messages="messages" @select-message="onSelectMessage" class="scrollbar" />

        <!-- typing list -->         
        <typing-list id="typing-list" />

        <!-- new message form -->
        <message-form ref="messageForm" id="message-form"/>
    </div>
</template>

<script>
    import Vue from "vue";
    import { mapState } from 'vuex';
    import MessageList from "../message/MessageList.vue";
    import VideoPlayer from "../video-player/VideoPlayer.vue";
    import TypingList from "../form/TypingList.vue";
    import MessageForm from "../form/MessageForm.vue";

    export default Vue.extend({

        components: {VideoPlayer, MessageList, TypingList, MessageForm},
        
        props: {
            hidePlayer: {
                required: false,
                default: false,
                type: Boolean
            }
        },
        methods: {
            onSelectMessage: function(message) {

                const editText = '/edit ' + message.id + ' ' + message.content;
                const deleteText = '/delete ' + message.id;
                const quoteText = '@' + message.id + ' ';
                const rotation = [quoteText, editText, deleteText];
                const currentContent = this.$refs.messageForm.getMessage();
                const currentPosition = rotation.indexOf(currentContent);
                const newPosition = (currentPosition + 1) % rotation.length;
                this.$refs.messageForm.setMessage(rotation[newPosition]);
            },
        },
        computed: {
            ...mapState('Main', [
                'playerState',
                'messages',
                'playerEnabled',
            ]),
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
        }
    }
</style>
