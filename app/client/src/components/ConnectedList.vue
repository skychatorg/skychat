<template>
    <div class="connected-list">
        <connected-user
                v-for="session in sessions"
                @click.native="() => onJoinPrivateChannel(session.identifier)"
                :key="session.identifier"
                :session="session"/>
    </div>
</template>

<script>
    import Vue from "vue";
    import ConnectedUser from "./ConnectedUser.vue";

    export default Vue.extend({
        components: {ConnectedUser},
        methods: {
            onJoinPrivateChannel: function(username) {
                if (this.$store.state.channel === username.toLowerCase()) {
                    this.$store.commit('GOTO_MAIN_CHANNEL');
                } else {
                    this.$store.commit('SET_CHANNEL', username);
                }
            }
        },
        computed: {
            sessions: function() {
                return this.$store.state.connectedList;
            },
            privateMessages: function() {
                return this.$store.state.privateMessages;
            }
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
