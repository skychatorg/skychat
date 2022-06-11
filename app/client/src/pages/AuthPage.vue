<template>
    <div class="auth-page">
        <div class="page-title">Login/Register</div>
        <div class="auth-modal">
            <input @keyup.enter="onLogin" v-model="username" class="form-control" type="text" placeholder="username">
            <input @keyup.enter="onLogin" v-model="password" class="form-control" type="password" placeholder="password">
            <button @click="onLogin" class="form-submit" type="submit">Login</button>
            <button @click="onRegister" class="form-submit" type="submit">Register</button>
            <button @click="onGuestLogin" class="form-submit" type="submit">Login as guest</button>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";
    import { mapGetters, mapActions } from "vuex";

    export default Vue.extend({
        data: function() {
            return {
                username: '',
                password: ''
            }
        },
        watch: {
            'clientState.user': function() {
                if (this.clientState.user.right >= 0) {
                    new Noty({
                        type: 'success',
                        layout: 'topCenter',
                        theme: 'nest',
                        text: "Welcome back, " + this.clientState.user.username,
                        timeout: 2000
                    }).show();
                    this.$emit('gotoroom');
                }
            },
            'clientState.currentRoomId': function() {
                if (this.clientState.currentRoomId !== null) {
                    this.$emit('gotoroom');
                }
            }
        },
        methods: {
            ...mapActions('SkyChatClient', [
                'sendMessage',
                'join',
                'login',
                'register',
            ]),
            onLogin: function() {
                this.login({ username: this.username, password: this.password });
            },
            onRegister: function() {
                this.register({ username: this.username, password: this.password });
            },
            onGuestLogin: function() {

                // Join room #1
                this.join(this.clientState.rooms[0].id);

                // Join first player channel
                if (this.clientState.playerChannels.length > 0) {
                    this.sendMessage('/playerchannel join ' + this.clientState.playerChannels[0].id);
                }
            }
        },
        computed: {
            ...mapGetters('SkyChatClient', [
                'clientState',
            ]),
        }
    });
</script>

<style lang="scss" scoped>
    .auth-page {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        margin-top: 10%;

        >.page-title {
            font-family: Russo One,sans-serif;
            text-align: center;
            color: white;
            font-size: 200%;
        }

        >.auth-modal {
            width: 100%;
            max-width: 500px;
            margin: 0 auto;
            background: #18191c;
            color: white;
            padding: 3em 2em;
            -webkit-box-shadow: 1px 1px 1px 1px #000;
            box-shadow: 1px 1px 1px 1px #000;
            -webkit-transform: translateY(30px);
            transform: translateY(30px);
        }
    }
</style>
