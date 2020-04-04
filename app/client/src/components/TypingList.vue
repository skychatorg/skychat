<!--
    Typing list
-->


<template>
    <div class="typing-list">
        <p v-html="typingListHtml"></p>
    </div>
</template>

<script lang="ts">
    import Vue from "vue";
    import {SanitizedUser} from "../../../server/skychat/User";
    export default Vue.extend({
        computed: {
            typingList: function() {
                return this.$store.state.typingList;
            },
            typingListHtml: function() {

                const typingList = (this as any).typingList;

                if (typingList.length === 0) {
                    return '';
                }

                if (typingList.length === 1) {
                    return `${typingList[0].username} is typing..`;
                }

                if (typingList.length <= 3) {
                    const usernames = typingList.map((user: SanitizedUser) => user.username);
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
        padding-left: 10px;
        padding-top: 4px;
        flex-basis: 18px;
    }
</style>
