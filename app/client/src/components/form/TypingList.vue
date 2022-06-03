<template>
    <div class="typing-list">
        <p v-html="typingListHtml"></p>
    </div>
</template>

<script>
    import Vue from "vue";
    import { mapGetters } from 'vuex';

    export default Vue.extend({
        computed: {
            ...mapGetters('SkyChatClient', [
                'clientState',
            ]),
            typingListHtml: function() {

                if (this.clientState.typingList.length === 0) {
                    return '';
                }

                if (this.clientState.typingList.length === 1) {
                    return `${this.clientState.typingList[0].username} is typing..`;
                }

                if (this.clientState.typingList.length <= 3) {
                    const usernames = this.clientState.typingList.map(user => user.username);
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
