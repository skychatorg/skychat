<!--
    Page content
-->


<template>

    <!-- content -->
    <div class="page-content">

        <!-- left col -->
        <section id="left">
            <player id="player"/>
            <messages id="messages" class="scrollbar" />
            <message-form id="message-form"/>
        </section>

        <!-- right col -->
        <section id="right" class="scrollbar">
            <connected-list></connected-list>
        </section>
    </div>
</template>

<script lang="ts">
    import Vue from "vue";
    import Messages from "./Messages.vue";
    import MessageForm from "./MessageForm.vue";
    import Player from "./Player.vue";
    import ConnectedList from "./ConnectedList.vue";
    export default Vue.extend({
        components: {Player, Messages, MessageForm, ConnectedList}
    });
</script>

<style lang="scss" scoped>

    .page-content {
        width: 100%;
        height: 100%;
        max-width: 1400px;
        margin: 0 auto;

        display: flex;

        >#left {
            flex-grow: 1;
            padding-bottom: 6px;
            height: 100%;
            background: #2a2a2f78;
            display: flex;
            flex-direction: column;

            >#player {
                width: 100%;
                height: 30%;
                max-height: 300px;
            }
            >#message-form {
                width: 100%;
                flex-basis: 55px;
            }
        }

        >#right {
            width: 340px;
            height: 100%;
            overflow-y: auto;
            background: #25262b85;
        }
    }
</style>
