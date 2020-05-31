<template>
    <div class="youtube-video-searcher">
        <div class="search-form">
            <input v-model="searchInput" type="text" placeholder="Search" class="form-control" @keyup.enter.stop="search(searchInput)">
        </div>
        <div class="search-results">

            <!-- 1 item -->
            <div v-for="item in searchResults"
                 :key="item.etag"
                 @click="playVideo(item.id.videoId)"
                 class="search-item">

                <!-- thumb -->
                <div class="thumb">
                    <img :src="item.snippet.thumbnails.default.url">
                </div>

                <!-- informations -->
                <div class="info">
                    <div class="title">{{item.snippet.title}}</div>
                    <div class="description">{{item.snippet.description}}</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
    import Vue from "vue";

    export default Vue.extend({
        data: function() {
            return {
                searchInput: ''
            }
        },
        methods: {
            search: function(search) {
                this.$client.sendMessage(`/ytapi:search ${search}`);
            },
            playVideo: function(video) {
                this.$client.sendMessage(`/play ${video}`);
                this.$emit('close');
            }
        },
        computed: {
            searchResults: function() {
                return this.$store.state.ytApiSearchResults;
            }
        }
    });
</script>

<style lang="scss" scoped>
    .youtube-video-searcher {
        display: flex;
        flex-direction: column;
        height: 100%;

        .search-form {

        }
        .search-results {
            flex-grow: 1;
            overflow-y: auto;
        }
    }

    .search-item {
        display: flex;
        margin: 10px;

        .thumb {
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .info {
            display: flex;
            flex-direction: column;
            flex-grow: 1;
            padding: 10px;

            .title {
                font-weight: 800;
            }
            .description {
                margin-top: 10px;
                font-size: 80%;
            }
        }
    }
</style>
