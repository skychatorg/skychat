<template>
    <div class="messages-overlay">
        <quick-actions class="quick-actions"></quick-actions>
        <messages :hide-player="true" ref="messages" @select-message="onSelectMessage" class="messages scrollbar" />
        <typing-list class="typing-list" />
        <message-form ref="messageForm" class="message-form"/>
    </div>
</template>

<script>
    import Vue from "vue";
    import Messages from "./Messages.vue";
    import TypingList from "./TypingList.vue";
    import MessageForm from "./MessageForm.vue";
    import QuickActions from "./QuickActions.vue";

    export default Vue.extend({
        components: {Messages, TypingList, MessageForm, QuickActions},
        methods: {
            onSelectMessage: function() {

            }
        },
        computed: {
        }
    });
</script>

<style lang="scss" scoped>
.messages-overlay {

    .quick-actions {
        margin-left: 6px;
    }

    .messages {
        height: 200px;
    }

    .typing-list {
        height: 20px;
    }
}
</style>
