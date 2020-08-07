<template>
    <div class="messages">
        <player class="player" v-show="playerState && playerState.enabled"/>

        <DynamicScroller
                class="messages-feed scrollbar"
                :items="messages"
                :min-item-size="52"
                :style="smoothScroll ? 'scroll-behavior: smooth;' : ''"
                :buffer="200"
                ref="scroller"
                @scroll.native="onScroll">

            <template v-slot="{ item, index, active }">
                <DynamicScrollerItem
                    :item="item"
                    :active="active"
                    :watchData="true"
                    :data-index="index"
                >
                    <div style="padding-top: 2px; background-color: #2a2a2f78;">
                        <message @select="$emit('select-message', item)"
                                 @content-loaded="onContentLoaded"
                                 :key="item.id"
                                 :message="item"
                                 :seen-users="lastMessageSeenIds[item.id] || []"
                                 class="message"/>
                    </div>

                </DynamicScrollerItem>
            </template>


        </DynamicScroller>
    </div>
</template>

<script>
    import Vue from "vue";
    import Message from "./Message.vue";
    import Player from "./Player.vue";

    export default Vue.extend({
        components: {Player, Message},
        data: function() {
            return {
                autoScroll: true,
                smoothScroll: true,
                autoScrolling: false,
            };
        },
        watch: {
            messages: function() {
                this.scrollToBottomIfAutoScroll();
            }
        },
        methods: {
            scrollToBottomIfAutoScroll: function() {
                if (! this.autoScroll) {
                    return;
                }
                const previousScrollHeight = this.$refs.scroller.$el.scrollHeight;
                // We need to wait 2 ticks for the dynamic scroller and for our own renderer
                Vue.nextTick(() => {
                    Vue.nextTick(() => {
                        const deltaScrollHeight = this.$refs.scroller.$el.scrollHeight - previousScrollHeight;
                        console.log('delta', deltaScrollHeight);
                        this.scrollToBottom(deltaScrollHeight > 200);
                    });
                });
            },
            onContentLoaded: function() {
                if (this.autoScroll) {
                    this.scrollToBottom();
                }
            },
            distanceToBottom: function() {
                return this.$refs.scroller.$el.scrollHeight - this.$refs.scroller.$el.offsetHeight - this.$refs.scroller.$el.scrollTop;
            },
            onScroll: function() {
                if (this.autoScrolling) {
                    return;
                }
                const distanceToBottom = this.distanceToBottom();
                if (distanceToBottom > 200) {
                    // Stop auto scroll
                    this.autoScroll = false;
                } else if (distanceToBottom < 30) {
                    this.autoScroll = true;
                }
            },
            scrollToBottom: function(immediate) {
                // If already auto scrolling, abort
                if (this.autoScrolling) {
                    return;
                }
                // Set scrolling state to true
                this.autoScrolling = true;
                // If in immediate mode
                if (immediate) {
                    // Disable smooth scroll
                    this.smoothScroll = false;
                    // Wait for smooth scroll to be disabled
                    Vue.nextTick(() => {
                        // Scroll directly to bottom
                        this.$refs.scroller.scrollToBottom();
                        // Re-enable smooth scroll
                        this.smoothScroll = true;
                        // Update scrolling state
                        this.autoScrolling = false;
                    });
                } else {
                    // Smoothly scroll to bottom
                    this.$refs.scroller.scrollToBottom();
                    // In a few ms, check if still need to scroll
                    setTimeout(() => {
                        // Update state
                        this.autoScrolling = false;
                        // If still need to scroll
                        const distance = this.distanceToBottom();
                        if (distance > 1) {
                            this.scrollToBottom(false);
                        }
                    }, 500);
                }
            },
        },
        computed: {
            messages: function() {
                if (this.$store.state.channel) {
                    return this.$store.state.privateMessages[this.$store.state.channel].messages;
                }
                return this.$store.state.messages;
            },
            playerState: function() {
                return this.$store.state.playerState;
            },
            lastMessageSeenIds: function() {
                return this.$store.state.lastMessageSeenIds;
            }
        }
    });
</script>

<style lang="scss" scoped>

    .messages {
        flex-grow: 1;
        display: flex;
        flex-direction: column;

        .player {
            width: 100%;
            height: 40%;
            max-height: 350px;
        }

        .messages-feed {
            flex-grow: 1;
            margin-left: 10px;
            margin-right: 10px;
            height: 0;
            overflow-y: scroll;
            display: flex;
            flex-direction: column;
        }
    }
</style>
