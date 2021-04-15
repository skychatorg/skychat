<template>
    <div class="messages-overlay">
        <quick-actions class="quick-actions"></quick-actions>
        <middle-column :hide-player="true" />
    </div>
</template>

<script>
    import Vue from "vue";
    import MiddleColumn from "./MiddleColumn.vue";
    import TypingList from "./TypingList.vue";
    import MessageForm from "./MessageForm.vue";
    import QuickActions from "./QuickActions.vue";

    export default Vue.extend({
        components: {MiddleColumn, TypingList, MessageForm, QuickActions},
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
