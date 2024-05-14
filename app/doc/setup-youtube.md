# Setup Youtube

The SkyChat requires an API key for the Youtube plugin to work. This key needs to be put in your `.env` file.

Using the Youtube API is free. There is a daily quota which when exceeded blocks requests until the next day. If it happens, the Youtube plugin won't work until the next day.

## How to generate

1. Go to [the Google Cloud Platform](https://console.cloud.google.com/apis/api/youtube.googleapis.com/credentials). If you never activated the account, you will have to activate it.
2. Click `Create credentials > API key`
3. Copy the generated API key, and paste it in your `.env` file (`YOUTUBE_API_KEY`)
4. Restart the server
