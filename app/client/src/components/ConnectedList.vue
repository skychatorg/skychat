<!--
    Connected list
-->


<template>
    <div class="connected-list">
        <h2>In this room:</h2>
        <connected-user v-for="user in users" :key="user.username" :user="user"/>
    </div>
</template>

<script>
    import Vue from "vue";
    import ConnectedUser from "./ConnectedUser.vue";

    export default Vue.extend({
        components: {ConnectedUser},
        computed: {
            users: function() {
                return this.$store.state.connectedList;
            }
        }
    });
</script>

<style lang="scss" scoped>
    .connected-list {
        padding-top: 40px;
        color: white;
    }
</style>
