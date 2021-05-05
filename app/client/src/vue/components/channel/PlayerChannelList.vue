<template>
    <div class="channel-list" v-show="playerChannels.length > 0">
        <div class="subtitle"><h3>video</h3></div>
        
        <hover-card v-for="channel in playerChannels"
            :key="channel.id"
            :selected="playerChannel === channel.id"
            :border-color="'#9b71b9'"
            class="channel"
            @click.native="joinChannel(channel.id)"
        >
            <div class="channel-content">
                <div class="channel-icon material-icons md-18">tv</div>
                <div class="channel-name" :title="channel.name">
                    <b>{{channel.name}}</b>
                </div>
                <div class="channel-meta">
                    <!-- show if there is a video currently playing -->
                    <div v-show="channel.playing"
                        class="channel-player mr-1"
                        :class="{ 'disabled': playerChannel !== channel.id }"
                        title="Player state">
                        <i class="material-icons md-14">movie</i>
                    </div>
                </div>
            </div>
        </hover-card>
    </div>
</template>

<script>
    import Vue from "vue";
    import HoverCard from "../util/HoverCard.vue";

    export default Vue.extend({
        components: { HoverCard },
        props: { },
        methods: {
            joinChannel: function(id) {
                if (this.playerChannel === id) {
                    this.$client.leavePlayerChannel();
                } else {
                    this.$client.joinPlayerChannel(id);
                }
            },
        },
        computed: {
            playerChannels: function() {
                return this.$store.state.playerChannels;
            },
            playerChannel: function() {
                return this.$store.state.playerChannel;
            },
            user: function() {
                return this.$store.state.user;
            },
        },
    });
</script>

<style lang="scss" scoped>

.channel-list {
    padding-right: 10px;
    padding-left: 10px;
    color: white;

    .subtitle {
        width: 100%;
        height: 16px;
        background: #242427;
        margin-top: 4px;
        text-align: center;

        h3 {
            color: #b4b4b4;
            font-size: 10px;
            text-transform: uppercase;
            padding-top: 2px;
        }
    }

    .channel {
        height: 35px;
        margin-top: 4px;

        .channel-content {
            display: flex;

            .channel-icon {
                flex-basis: 20px;
                margin-top: 10px;
                margin-left: 10px;
                font-size: 14px;
            }

            .channel-name {
                flex-grow: 1;
                margin-top: 10px;
                margin-left: 2px;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
            }

            .channel-meta {
                flex-basis: 65px;
                margin-top: 10px;
                display: flex;
                flex-direction: row-reverse;

                .channel-player {
                    color: #ff8f8f;
                }

                .channel-player.disabled {
                    color: #8c8c8c;
                }
            }
        }
    }
}

</style>
