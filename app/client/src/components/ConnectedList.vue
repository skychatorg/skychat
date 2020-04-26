<template>
    <div class="connected-list">

        <connected-user
                v-for="session in sessions"
                @click.native="() => onJoinPrivateChannel(session.identifier)"
                :key="session.identifier"
                :session="session"/>

        <div @click="onMobileShowTchat" class="show-mobile">
            <div class="goto-tchat">
                <i class="material-icons md-28">keyboard_arrow_left</i>
            </div>
        </div>
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
            },
            onMobileShowTchat: function() {
                this.$store.commit('SET_MOBILE_PAGE', 'tchat');
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
        padding-top: 20px;
        padding-right: 20px;
        padding-left: 6px;
        color: white;
    }
    .goto-tchat {
        margin-top: 10px;
    }
</style>
