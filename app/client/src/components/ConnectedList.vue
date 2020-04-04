<!--
    Connected list
-->


<template>
    <div class="connected-list">

        <connected-user v-for="user in users" :key="user.username" :user="user"/>
    </div>
</template>

<script lang="ts">
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
        padding-top: 10px;
    }
</style>
