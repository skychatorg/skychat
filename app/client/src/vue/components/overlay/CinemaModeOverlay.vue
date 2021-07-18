<template>
    <div class="messages-overlay">
        <quick-actions class="quick-actions"></quick-actions>
        <tchat-middle-column :hide-player="true" />
    </div>
</template>

<script>
    import Vue from "vue";
    import TchatMiddleColumn from "../layout/TchatMiddleColumn.vue";
    import TypingList from "../form/TypingList.vue";
    import MessageForm from "../form/MessageForm.vue";
    import QuickActions from "../form/QuickActions.vue";

    export default Vue.extend({
        components: { TchatMiddleColumn, TypingList, MessageForm, QuickActions },
    });
</script>

<style lang="scss" scoped>
.messages-overlay {

    .quick-actions {
        margin-left: 6px;
        padding-top: 4px;
    }

    .messages {
        height: 280px;
    }

    .typing-list {
        height: 20px;
    }
}
</style>
