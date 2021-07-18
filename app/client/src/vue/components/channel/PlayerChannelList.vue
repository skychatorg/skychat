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
            :selected="playerChannel === channel.id"
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
                        <div v-show="playerChannel === channel.id && op"
                            @click="deleteChannel()"
                            class="channel-delete mr-1"
                            title="Delete this channel">
                            <i class="material-icons md-14">close</i>
                        </div>
                        <!-- show if there is a video currently playing -->
                        <div v-show="channel.playing"
                            class="channel-player mr-1"
                            :class="{ 'disabled': playerChannel !== channel.id }"
                            title="A video is currently playing">
                            <div class="channel-player-owner">{{channel.currentOwner}}</div>
                            <i class="material-icons md-14">movie</i>
                        </div>
                    </div>
                </div>
                <div class="channel-content-users" v-if="playerChannelUsers[channel.id] && playerChannelUsers[channel.id].length > 0">
                    <!-- users in the channel -->
                    <div v-for="user of playerChannelUsers[channel.id]"
                        :key="user.username"
                        class="avatar image-bubble"
                        :title="user.username + ' is watching'"
                        :style="{'border': '1px solid ' + user.data.plugins.color}">
                        <img :src="user.data.plugins.avatar">
                    </div>
                    <!-- connected users -->
                    <div v-if="playerChannelUsers[channel.id] && playerChannelUsers[channel.id].length > 0"
                        class="channel-users mr-1"
                        title="Number of watchers">
                        <i class="material-icons md-14">{{playerChannelUsers[channel.id].length > 1 ? 'group' : 'person'}}</i>
                        <span>{{ playerChannelUsers[channel.id].length }}</span>
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
                if (this.playerChannel === id) {
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
                'playerChannel',
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
        margin-top: 4px;

        .channel-content {
            display: flex;
            flex-direction: column;

            .channel-content-info {
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
                    height: 20px;
                }

                .channel-meta {
                    flex-basis: 100px;
                    margin-top: 10px;
                    display: flex;
                    flex-direction: row-reverse;

                    .channel-player {
                        color: #ff8f8f;

                        .channel-player-owner {
                            vertical-align: top;
                            font-size: 11px;
                            max-width: 70px;
                            overflow: hidden;
                            display: inline-block;
                            text-overflow: ellipsis;
                        }
                    }

                    .channel-player.disabled {
                        color: #8c8c8c;
                    }
                    
                    .channel-delete {
                        color: #ff8e8e;
                    }
                }
            }
            .channel-content-users {
                display: flex;
                overflow: hidden;
                justify-content: flex-end;
                margin-bottom: 5px;
                margin-left: 12px;

                .channel-users {
                    color: #8ecfff;
                    margin-top: 3px;
                    margin-left: 6px;
                    white-space: nowrap;
                    text-align: right;
                    span { vertical-align: top; }
                }

                >.avatar {
                    min-width: 20px;
                    width: 20px;
                    height: 20px;
                    margin: 1px;
                }
            }
        }
    }
}

</style>
