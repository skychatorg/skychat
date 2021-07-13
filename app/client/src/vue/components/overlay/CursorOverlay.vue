<template>
    <div class="cursor-container" v-show="cursor">
        <div class="cursor"
             v-for="entry in cursorList"
             :key="entry.cursor.user.id"
             :style="{left: (entry.cursor.x * window.innerWidth) + 'px', top: (entry.cursor.y * window.innerHeight) + 'px'}">
            <img src="/assets/images/cursors/default.png">
            <span class="ml-1">{{entry.cursor.user.username}}</span>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";
    import { mapState } from 'vuex';

    const CURSOR_POSITION_DELAY_MS = 150;

    /**
     * Reference to the timeout that sends cursor position
     */
    let timeout = 0;

    export default Vue.extend({
        data: function() {
            return {
                lastSentDate: new Date()
            };
        },
        created: function() {
            this.window = window;
        },
        mounted: function() {
            /**
             * Send cursor position
             */
            document.addEventListener('mousemove', event => {
                const x = event.clientX / window.innerWidth;
                const y = event.clientY / window.innerHeight;
                if (this.$store.state.Main.currentRoom !== null
                    && this.$store.state && this.$store.state.Main.user.data.plugins.cursor) {
                    this.sendCursorPosition(x, y);
                }
            });
        },
        methods: {
            sendCursorPosition: function(x, y) {

                const delay = new Date().getTime() - this.lastSentDate.getTime();
                if (delay < CURSOR_POSITION_DELAY_MS) {
                    clearTimeout(timeout);
                    timeout = setTimeout(this.sendCursorPosition.bind(this, x, y), CURSOR_POSITION_DELAY_MS - delay);
                    return;
                }
                this.$client.sendCursor(x, y);
                this.lastSentDate = new Date();
            }
        },
        computed: {
            ...mapState('Main', {
                'cursorList': state => Object.values(state.cursors),
                'user': state => state.user.data.plugins.cursor,
            }),
        }
    });
</script>

<style lang="scss" scoped>
    .cursor-container {
        width: 100%;
        height: 100%;
        position: relative;
        pointer-events: none;
        opacity: .5;
        z-index: 10000000000;

        .cursor {
            position: absolute;
            -webkit-transition: all .2s;
            -moz-transition: all .2s;
            -ms-transition: all .2s;
            -o-transition: all .2s;
            transition: all .2s;
            color: white;
            font-size: 80%;
        }
    }
</style>
