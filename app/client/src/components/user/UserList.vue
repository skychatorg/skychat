<template>
    <div class="connected-list" v-if="clientState.connectedList.length > 0">
        <h2 class="title">Active now</h2>
        <user-list-row
                v-for="session in clientState.connectedList"
                @click.native="() => onJoinPrivateChannel(session.identifier)"
                :key="session.identifier"
                :session="session"/>
    </div>
</template>

<script>
    import Vue from "vue";
    import { mapActions, mapGetters } from "vuex";
    import UserListRow from "./UserListRow.vue";

    export default Vue.extend({
        components: {UserListRow},
        methods: {
            ...mapActions('SkyChatClient', [
                "sendMessage",
            ]),
            onJoinPrivateChannel: function(username) {
                this.sendMessage(`/pm ${username}`);
            }
        },
        computed: {
            ...mapGetters('SkyChatClient', [
                'clientState'
            ]),
        }
    });
</script>

<style lang="scss" scoped>
    .connected-list {
        padding-left: 6px;
        color: white;
    }
    .goto-tchat {
        margin-top: 10px;
    }
</style>
