<template>

    <!-- content -->
    <div class="page-content">

        <template v-if="page === 'welcome'">
            <auth-page @gotoroom="gotoRoom" id="auth-page"/>
        </template>

        <template v-if="page === 'room'">

            <template v-if="false">
                <section id="cinema" class="scrollbar">
                    <player-background class="player-background"></player-background>
                    <messages-overlay class="messages-overlay"></messages-overlay>
                </section>
            </template>

            <template v-if="true">

                <section class="default-container">
                    <!-- left col -->
                    <section class="left hide-mobile-list">
                        <messages ref="messages" @select-message="onSelectMessage" class="scrollbar" />
                        <typing-list id="typing-list" />
                        <message-form ref="messageForm" id="message-form"/>
                    </section>

                    <!-- right col -->
                    <section class="right hide-mobile-tchat scrollbar">
                        <player-preview></player-preview>
                        <polls></polls>
                        <connected-list></connected-list>
                        <quick-actions></quick-actions>
                    </section>
                </section>
            </template>
        </template>
    </div>
</template>

<script>
    import Vue from "vue";
    import AuthPage from "./AuthPage.vue";
    import Messages from "./Messages.vue";
    import TypingList from "./TypingList.vue";
    import MessageForm from "./MessageForm.vue";
    import Polls from "./Polls.vue";
    import PlayerPreview from "./PlayerPreview.vue";
    import PlayerBackground from "./PlayerBackground.vue";
    import ConnectedList from "./ConnectedList.vue";
    import QuickActions from "./QuickActions.vue";
    import MessagesOverlay from "./MessagesOverlay.vue";

    export default Vue.extend({
        components: {AuthPage, Messages, TypingList, MessageForm, Polls, PlayerPreview, PlayerBackground, ConnectedList, QuickActions, MessagesOverlay},
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

            gotoRoom() {
                this.$store.commit('SET_PAGE', 'room');
                this.$client.ytSync();
            },
        },
        computed: {
            page: function() {
                return this.$store.state.page;
            }
        },
    });
</script>

<style lang="scss" scoped>

    .page-content {
        font-family: Arial,Helvetica Neue,Helvetica,sans-serif;
        font-size: 80%;
        width: 100%;
        height: 0;
        margin: 0 auto;

        display: flex;
        justify-content: center;

        >#cinema {
            flex-grow: 1;
            height: 100%;
            position: relative;

            >.player-background {
                position: absolute;
                width: 100%;
                height: 100%;
                z-index: 0;
            }
            >.messages-overlay {
                position: absolute;
                right: 20px;
                bottom: 50px;
                width: 100%;
                max-width: 380px;
                background-color: #222223;
                opacity: 0.4;

                &:hover {
                    opacity: 1;
                }
            }
        }

        .default-container {
            max-width: 1100px;
            flex-grow: 1;
            display: flex;

            .left {
                flex-grow: 1;
                padding-bottom: 6px;
                height: 100%;
                background: #2a2a2f78;
                display: flex;
                flex-direction: column;

                >#message-form {
                    width: 100%;
                    flex-basis: 44px;
                }
            }

            .right {
                width: 340px;
                height: 100%;
                overflow-y: auto;
                background: #25262b85;
            }
        }
    }
</style>
