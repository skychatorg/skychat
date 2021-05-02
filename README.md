![](./app/client/assets/assets/logo.png)

# SkyChat

1. [Features](#features)
2. [Install](#how-to-install)
3. [Customize](#customize)


## Features

The **SkyChat** is a modern-looking discussion platform with real-time visualisation of everyone's cursor, and a shared and synchronized youtube player. It includes many customisation/entertainment features:
- Custom text and halo colors to be bought for user messages
- Virtual money with mini-games (casino roulette, guess the number)
- An XP system with associated ranks, based on users activity
- Custom profile pictures (guests have randomly generated ones)

Most of these features can be enabled-disabled from the configuration file.

Overall, here is what it looks like:
![overall-screenshot](./doc/screenshot.png)
### Synchronized Youtube Player

Users can play any youtube video on a shared and synchronized player. Orchestration is implemented through a public queue of videos to play, and decision-making (for instance to skip videos) is done with polls. Democracy 💯
![youtube-short](./doc/youtube-short.gif)

### Live cursor visualization and mini-games

Users can interact and play with integrated mini-games (which can be disabled in the configuration).
Users can also see each other cursors moving in real time. This gives a sense of proximity between users. This is the most iconic feature of the SkyChat.
![cursor-roll](./doc/cursor-roll.gif)

### Cinema mode

If watching long videos, documentaries, or tv shows, the cinema-mode allows users to watch the video in full-screen and have the tchat minimized on the bottom-right of the screen.
![cinema-mode](./doc/cinema-mode.gif)

### And much more

This is not all, but to discover all features, you may as well launch an instance and try it yourself!

## How to install

### Install and run

If using docker you need:
- nodejs/npm, any version
- docker/docker-compose

If not using docker, ensure you have the following installed on your system:
- nodejs >= 10 and npm
- sqlite3

Then, follow these steps:

```bash
# 1. Clone the repository
git clone https://github.com/skychatorg/skychat.git
cd skychat

# 2. Generates the .env.json, stickers.json, config files and the database
bash scripts/setup.sh

# 3. (Choose only one) Run the app
bash scripts/docker-start.sh  # If with docker
npm i && npm run start        # If without docker
npm i && npm run dev          # If without docker with fs watcher and auto rebuild/restart
```


### Application setup

In order to customize the domain name of your SkyChat application, you will need to edit the `.env.json` file. The fields in the .env.json contain private information related to the application.

The semantic of these fields are defined below:


| field | type | default | semantic |
|-------|------|---------|----------|
| location                 | string | "http://localhost:8080" | Server location, i.e. what user need to put in their browser to access your app |
| hostname                 | string | "localhost" | Hostname the server will listen to |
| port                     | number | 8080 | Server port |
| ssl                      | false or {certificate:string,key:string}  | false | SSL configuration (paths to certificate and key files). Use false if SSL is disabled. |
| **users_passwords_salt** | string | "$RANDOM_SALT" | Password salt. MUST be set manually. |
| **users_token_salt**     | string | "$RANDOM_SALT" | Token salt. MUST be set manually. |
| **youtube_api_key**      | string | "" | [Youtube api key](#setup-youtube) |
| op                       | string[] | [] | OP usernames. OP usernames can use the /setright command. |
| email_transport          | nodemailer.JSONTransport | {"sendmail": true,"newline": "unix","path": "/usr/sbin/sendmail"} | Value given to [nodemailer.createTransport](https://nodemailer.com/about/) to initialize the mailer |


### Setup Youtube

The SkyChat requires a key for the Youtube plugin to work. This key needs to be put in your `.env.json` file.

Using the Youtube API is free but there is a daily quota, which when exceeded blocks the requests until the next day. If it happens, the Youtube plugin will be disabled until the next day. 

1. Go to [the Google Cloud Platform](https://console.cloud.google.com/apis/api/youtube.googleapis.com/credentials). If you never activated the account, you will have to activate it. 
2. Click `Create credentials > API key`
3. Copy the generated API key, and paste it in your `.env.json` file (the variable name is `youtube_api_key`)
4. Restart the server


### Develop

```bash
npm run dev
```

This will start a static file server & websocket server on http://localhost:8080
When the source files change, the build processes runs automatically

## Customize


### Customize preferences

The preferences.json file specifies application preferences. The available fields are detailed below.


| field | type | default | description |
|-------|------|---------|-------------|
| minRightForPrivateMessages    | number |  -1 | Min. right to send private messages |
| minRightForMessageHistory     | number |  -1 | Min. right to access room message history |
| minRightForAudioRecording     | number |  -1 | Min. right to share and play audio recordings |
| minRightForConnectedList      | number |  -1 | Min. right to visualize the list of currently active users |
| minRightForPolls              | number |  -1 | Min. right to create polls |
| maxReplacedImagesPerMessage   | number |  50 | Max. number of replaced images per message |
| maxReplacedStickersPerMessage | number |  50 | Max. number of replaced stickers per message |
| maxNewlinesPerMessage         | number |  20 | Max. number of newlines per message |


### Customize plugins

Enabled plugins. Must only define classes exported by `app/server/skychat/commands/impl/index.ts`


### Customize ranks

Rank definition (xp threshold and image path). Must be sorted by descending limit. The fields for each rank are:
  - limit: XP limit to have this rank. The last rank definition must have `0` as the limit, otherwise new users will not have any rank.
  - images: Image path corresponding to the rank icon for each 18 and 26px sizes. Image paths should be relative to `/assets/images/`.


### Customize the fake message history

This file contains the fake raw messages that are displayed to users whose right level is less than `minRightForMessageHistory` defined in `preferences.json`.


### Customize guest names

When a guest logs in, a random name is associated to its session. These names are randomly used from this file. If you want to change these names, keep in mind that they should not contain whitespace characters (anything matched by \s so newline, tab, space, ..). Default random names are animal names.
