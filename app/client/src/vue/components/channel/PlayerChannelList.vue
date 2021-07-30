<template>
    <div class="channel-list" v-show="playerChannels.length > 0 || op">
        <div class="subtitle" v-show="op">
            <h3>
                video
                <span @click="createChannel()" class="channel-create material-icons md-12">add</span>
            </h3>
        </div>
        
        <hover-card v-for="channel in playerChannels"
            :key="channel.id"
            :clickable="true"
            :selected="playerChannelId === channel.id"
            :border-color="'rgb(255, 130, 130)'"
            class="channel"
            @click.native="joinChannel(channel.id)"
        >
            <div class="channel-content">
                <div class="channel-content-info">
                    <div class="channel-name ml-1" :title="channel.name">
                        <b>{{channel.name}}</b>
                    </div>
                    <div class="channel-meta">
                        <!-- delete channel (op) -->
                        <div v-show="playerChannelId === channel.id && op"
                            @click="deleteChannel()"
                            class="channel-delete"
                            title="Delete this channel">
                            <i class="material-icons md-14">close</i>
                        </div>
                        <!-- users in the channel -->
                        <div v-for="user of (playerChannelUsers[channel.id] || []).slice(0, 4)"
                            :key="user.username"
                            class="avatar image-bubble"
                            :title="user.username + ' is watching'"
                            :style="{'border': '1px solid ' + user.data.plugins.color}">
                            <img :src="user.data.plugins.avatar">
                        </div>
                        <!-- represents other users -->
                        <div v-if="(playerChannelUsers[channel.id] || []).length > 4"
                            :title="(playerChannelUsers[channel.id].length - 4) + ' others are watching'"
                            class="avatar"
                        >
                            <i class="material-icons md-14">more_horiz</i>
                        </div>
                    </div>
                </div>
                <div v-if="channel.currentMedia"
                    class="channel-content-detail">
                    <!-- show if there is a video currently playing -->
                    <div v-show="channel.playing"
                        class="channel-player"
                        :class="{ 'disabled': playerChannelId !== channel.id }"
                        :title="'Media added by ' + channel.currentMedia.owner">

                        <div class="channel-player-owner">{{ channel.currentMedia.title }}</div>
                        <i class="material-icons md-14">movie</i>
                    </div>
                </div>
            </div>
        </hover-card>
    </div>
</template>

<script>
    import Vue from "vue";
    import { mapState } from 'vuex';
    import HoverCard from "../util/HoverCard.vue";

    export default Vue.extend({
        components: { HoverCard },
        props: { },
        methods: {
            joinChannel: function(id) {
                if (this.playerChannelId === id) {
                    this.$client.leavePlayerChannel();
                } else {
                    this.$client.joinPlayerChannel(id);
                }
            },
            createChannel: function() {
                this.$client.sendMessage(`/playerchannelmanage create`);
            },
            deleteChannel: function() {
                this.$client.sendMessage(`/playerchannelmanage delete`);
            }
        },
        computed: {
            ...mapState('Main', [
                'playerChannelUsers',
                'playerChannels',
                'playerChannelId',
                'user',
                'op',
            ]),
        },
    });
</script>

<style lang="scss" scoped>

.channel-list {
    color: white;

    .subtitle {
        width: 100%;
        background: #242427;
        margin-top: 4px;
        text-align: center;

        h3 {
            color: #b4b4b4;
            font-size: 10px;
            text-transform: uppercase;
            padding-top: 2px;
        }

        .channel-create {
            cursor: pointer;
            vertical-align: bottom;
        }
    }

    .channel {
        min-height: 35px;
        margin-top: 2px;

        .channel-content {
            display: flex;
            flex-direction: column;

            .channel-content-info {
                display: flex;
                height: 35px;
                flex-basis: 35px;

                .channel-icon {
                    flex-basis: 20px;
                    margin-top: 10px;
                    margin-left: 10px;
                    font-size: 14px;
                }

                .channel-name {
                    flex-grow: 1;
                    margin-left: 2px;
                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }

                .channel-meta {
                    flex-basis: 105px;
                    margin-top: 10px;
                    padding-right: 10px;
                    display: flex;
                    flex-direction: row-reverse;
                    flex-wrap: nowrap;
                    overflow: hidden;

                    >.avatar {
                        min-width: 15px;
                        width: 15px;
                        height: 15px;
                        margin-right: 4px;
                    }
                
                    .channel-delete {
                        color: #ff8e8e;
                        margin-right: 3px;
                    }
                }
            }
            .channel-content-detail {
                display: flex;
                overflow: hidden;
                justify-content: flex-end;
                margin-bottom: 5px;
                padding-right: 14px;
                padding-left: 10px;
                
                .channel-player {
                    color: #ff8f8f;
                    flex-grow: 1;
                    width: 0;
                    display: flex;

                    .channel-player-owner {
                        vertical-align: top;
                        font-size: 11px;
                        flex-grow: 1;
                        padding-right: 10px;
                        overflow: hidden;
                        display: inline-block;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                }

                .channel-player.disabled {
                    color: #8c8c8c;
                }
            }
        }
    }
}

</style>