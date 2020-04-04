<!--
    Player
-->


<template>
    <div>
        <form class="form" onsubmit="return false">
            <input @keyup.enter="sendMessage"
                   class="new-message"
                   v-model="message"
                   placeholder="Message.."/>
        </form>
    </div>
</template>

<script lang="ts">
    import Vue from "vue";
    export default Vue.extend({

        data: function() {
            return {
                message: ''
            }
        },

        methods: {

            sendMessage: function() {
                this.$client.sendMessage(this.message);
                this.message = '';
            }
        }
    });
</script>

<style lang="scss" scoped>

    .form {
        padding: 10px;
        display: flex;

        >.new-message {
            flex-grow: 1;
            padding: 10px;
            border: none;
            background: #2c2d31;
            color: white;
            outline-style: none;
            box-shadow: none;
            -webkit-transition: box-shadow 0.2s;
            -moz-transition: box-shadow 0.2s;
            -ms-transition: box-shadow 0.2s;
            -o-transition: box-shadow 0.2s;
            transition: box-shadow 0.2s;
        }

        >.new-message:focus {
            box-shadow: 1px 1px 14px #646ee43b;
        }
    }
</style>
