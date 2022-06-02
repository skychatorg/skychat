<template>
    <div class="connected-list" v-if="connectedList.length > 0">
        <h2 class="title">Active now</h2>
        <user-list-row
                v-for="session in connectedList"
                @click.native="() => onJoinPrivateChannel(session.identifier)"
                :key="session.identifier"
                :session="session"/>
    </div>
</template>

<script>
    import Vue from "vue";
    import { mapState } from "vuex";
    import UserListRow from "./UserListRow.vue";

    export default Vue.extend({
        components: {UserListRow},
        methods: {
            onJoinPrivateChannel: function(username) {
                this.$client.sendMessage(`/pm ${username}`);
            }
        },
        computed: {
            ...mapState('Main', [
                'connectedList'
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
