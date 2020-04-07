<!--
    Connected list
-->


<template>
    <div class="connected-list">

        <h2 class="mt-2">In this room:</h2>
        <connected-user
                v-for="user in users"
                @click.native="() => onJoinPrivateChannel(user.username)"
                :key="user.username"
                :user="user"/>

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
            users: function() {
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
        padding-top: 40px;
        color: white;
        cursor: pointer;
    }
    .goto-tchat {
        margin-top: 10px;
    }
</style>
