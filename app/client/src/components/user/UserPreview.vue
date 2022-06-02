<template>
    <div>
        <h2 class="title">Account</h2>
        
        <div class="user-preview ml-1">
            <div class="user-preview-avatar">
                <div class="image-bubble" >
                    <img :src="user.data.plugins.avatar">
                </div>
            </div>

            <div class="user-preview-info">
                
                <div class="session"
                    :style="{ 'color': user.data.plugins.color }">
                    {{user.username}}
                </div>

                <!-- rank progress bar -->
                <div class="progress-bar">

                    <!-- Progress bar -->
                    <div class="progress-bar-progress" :style="{ width: xpProgressPct + '%' }"></div>

                    <!-- Rank icons -->
                    <div class="rank current-rank" :title="'Current rank unlocked at ' + currentRank.limit + ' xp'"><img :src="'/assets/images/' + currentRank.images['26']"></div>
                    <div class="rank next-rank" :title="'Next rank at ' + nextRank.limit + ' xp'" v-if="nextRank"><img :src="'/assets/images/' + nextRank.images['26']"></div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";
    import { mapState } from "vuex";

    export default Vue.extend({
        data: function() {
            return {

            }
        },
        computed: {
            ...mapState('Main', [
                'user',
                'config',
            ]),
            xpProgressPct: function() {
                if (! this.nextRank) {
                    return 0;                
                }
                return Math.max(1, Math.floor(100 * (this.user.xp - this.currentRank.limit) / (this.nextRank.limit - this.currentRank.limit)));
            },
            currentRank: function() {
                return this.config.ranks.filter(rank => this.user.xp >= rank.limit)[0];
            },
            nextRank: function() {
                const remainingRanks = this.config.ranks.filter(rank => this.user.xp < rank.limit);
                if (remainingRanks.length === 0) {
                    return null;
                }
                return remainingRanks[remainingRanks.length - 1];
            }
        }
    });
</script>

<style lang="scss" scoped>

.user-preview {

    display: flex;

    > .user-preview-avatar {
        flex-basis: 35px;
        width: 35px;
        height: 35px;
        margin-top: 8px;
        position: relative;

        >.image-bubble{
            width: 100%;
            height: 100%;
        }
    }

    > .user-preview-info {

        flex-grow: 1;
        width: 0;
        display: flex;
        flex-direction: column;
        padding-left: 12px;
        padding-right: 22px;
        overflow: hidden;

        >.session {
            display: inline;
            color: #a3a5b4;
            font-weight: 800;
            font-size: 110%;
            flex-basis: 20px;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 6px;
        }

        > .progress-bar {
            width: 100%;
            border: 4px solid #2c2d31;
            background-color: #2c2d31;
            border-radius: 22px;
            height: 18px;
            position: relative;

            >.rank {
                position: absolute;
                top: -10px;

                &.current-rank {
                    left: 0;
                }
                
                &.next-rank {
                    right: 0;
                }
            }

            .progress-bar-progress {
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                background-color: #8b3742;
                border-top-left-radius: 22px;
                border-bottom-left-radius: 22px;
            }
        }
    }
}
</style>
