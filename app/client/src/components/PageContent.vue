<!--
    Page content
-->


<template>

    <!-- content -->
    <div class="page-content">

        <template v-if="page === 'welcome'">
            <auth-page @gotoroom="page = 'room'" id="auth-page"/>
        </template>

        <template v-if="page === 'room'">
            <!-- left col -->
            <section id="left">
                <player id="player"/>
                <messages @select-message="onSelectMessage" id="messages" class="scrollbar" />
                <typing-list id="typing-list" />
                <message-form ref="messageForm" id="message-form"/>
            </section>

            <!-- right col -->
            <section id="right" class="scrollbar">
                <connected-list></connected-list>
            </section>
        </template>

    </div>
</template>

<script>
    import Vue from "vue";
    import AuthPage from "./AuthPage.vue";
    import Messages from "./Messages.vue";
    import TypingList from "./TypingList.vue";
    import MessageForm from "./MessageForm.vue";
    import Player from "./Player.vue";
    import ConnectedList from "./ConnectedList.vue";

    export default Vue.extend({

        components: {AuthPage, Player, Messages, TypingList, MessageForm, ConnectedList},

        data: function() {
            return {
                page: 'welcome'
            }
        },

        methods: {
            onSelectMessage: function(message) {
                this.$refs.messageForm.setMessage('@' + message.id + ' ');
            }
        }
    });
</script>

<style lang="scss" scoped>

    .page-content {
        font-size: 80%;
        width: 100%;
        height: 0;
        max-width: 1400px;
        margin: 0 auto;

        display: flex;

        >#left {
            flex-grow: 1;
            padding-bottom: 6px;
            height: 100%;
            background: #2a2a2f78;
            display: flex;
            flex-direction: column;

            >#player {
                width: 100%;
                height: 40%;
                max-height: 350px;
            }
            >#message-form {
                width: 100%;
                flex-basis: 44px;
            }
        }

        >#right {
            width: 340px;
            height: 100%;
            overflow-y: auto;
            background: #25262b85;
        }
    }
</style>
