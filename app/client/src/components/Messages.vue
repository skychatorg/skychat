<!--
    Player
-->


<template>
    <div class="messages scrollbar" ref="messages">
        <message v-for="message in messages"
                 :message="message"
                 class="message"/>
    </div>
</template>

<script lang="ts">
    import Vue from "vue";
    import Message from "./Message.vue";
    export default Vue.extend({
        components: {Message},
        watch: {
            messages: function() {

                Vue.nextTick(() => {
                    (this.$refs as any).messages.scrollTop = (this.$refs as any).messages.scrollHeight;
                });
            }
        },
        computed: {
            messages: function() {
                return this.$store.state.messages;
            }
        }
    });
</script>

<style lang="scss" scoped>

    .messages {
        flex-grow: 1;
        margin-left: 10px;
        margin-right: 10px;
        height: 0;
        overflow-y: scroll;
        display: flex;
        flex-direction: column;
    }
</style>
