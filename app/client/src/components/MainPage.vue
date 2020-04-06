<!--
    Main component
-->


<template>
    <div class="page">
        <page-header @logout="logout" @login="login" id="header"/>
        <page-content @gotoroom="gotoRoom" :page="page" id="content"/>
    </div>
</template>

<script>
    import Vue from "vue";
    import PageHeader from "./PageHeader.vue";
    import PageContent from "./PageContent.vue";

    export default Vue.extend({
        components: {PageHeader, PageContent},
        data: function() {
            return {
                page: 'welcome'
            }
        },
        methods: {
            logout: function() {
                this.$client.logout();
                this.page = 'welcome';
            },
            login: function() {
                this.page = 'welcome';
            },
            gotoRoom: function() {
                this.page = 'room';
            }
        }
    });
</script>

<style lang="scss" scoped>
    .page {
        width: 100vw;
        height: 100vh;
        margin: 0 auto;
        overflow: hidden;
        display: flex;
        flex-direction: column;

        >#content {
            flex-grow: 1;
        }
    }
</style>
