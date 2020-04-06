<!--
    Typing list
-->


<template>
    <div class="typing-list">
        <p v-html="typingListHtml"></p>
    </div>
</template>

<script>
    import Vue from "vue";

    export default Vue.extend({
        computed: {
            typingList: function() {
                return this.$store.state.typingList;
            },
            typingListHtml: function() {

                if (this.typingList.length === 0) {
                    return '';
                }

                if (this.typingList.length === 1) {
                    return `${this.typingList[0].username} is typing..`;
                }

                if (this.typingList.length <= 3) {
                    const usernames = this.typingList.map(user => user.username);
                    return `${usernames.join(', ')} are typing..`;
                }

                return `multiple users are currently typing..`;
            }
        }
    });
</script>

<style lang="scss" scoped>

    .typing-list {
        color: white;
        padding-left: 54px;
        padding-top: 4px;
        flex-basis: 20px;
        font-size: 80%;
    }
</style>
