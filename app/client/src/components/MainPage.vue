<!--
    Main component
-->


<template>
    <div class="page">
        <page-header @logout="logout" @login="login" id="header"/>
        <page-content id="content"/>
    </div>
</template>

<script>
    import Vue from "vue";
    import PageHeader from "./PageHeader.vue";
    import PageContent from "./PageContent.vue";

    export default Vue.extend({
        components: {PageHeader, PageContent},
        methods: {
            logout: function() {
                this.$client.logout();
                this.$store.commit('SET_PAGE', 'welcome');
            },
            login: function() {
                this.$store.commit('SET_PAGE', 'welcome');
            }
        },
        computed: {
            page: function() {
                return this.$store.state.page;
            }
        },
    });
</script>

<style lang="scss" scoped>
    .page {
        width: 100%;
        height: 100%;
        margin: 0 auto;
        overflow: hidden;
        flex-grow: 1;
        display: flex;
        flex-direction: column;

        >#content {
            flex-grow: 1;
        }
    }
</style>
