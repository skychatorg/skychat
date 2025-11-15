<p align="center">
    <img src="./app/client/public/assets/logo.png"><br>
    Future-proof virtual cinema platform
</p>

<hr>

<p align="center"><a href="#overview">Overview</a> → <a href="#how-to-install">Install</a> → <a href="#customize">Customize</a> → <a href="#contribute">Contribute</a></p>
<p align="right">Like this project? Please give a star ⭐</p>

## Overview

The SkyChat lets you:

-   📺 Play medias in a shared synchronized player (Youtube, Twitch, self-hosted)
-   📁 Organize self-hosted medias in folders to easily search & play them.
-   ⚽ Have fun with live cursor visualization, casino roulette, cursor-based football, etc..
-   🔒 Feel safe. OP double auth, log fuzzing, shadow ban, TOR network detection/ban, etc..
-   💻 Install and set it up in 2 minutes.

![screenshot-desktop](./app/doc/screenshot-ui.png)

## How to install

### Install in 30 seconds

You only need docker.

```sh
# 1. Use the autoinstall script (Clones the repository then executes app/script/setup.sh)
sh <(wget -q https://raw.githubusercontent.com/skychatorg/skychat/master/app/script/autoinstall.sh -O -) && cd skychat

# 2. Run the setup script and complete .env files as you wish (see sections below for tips)
npm run setup
cat .env

# 3. Run the app
docker compose up
```

### Application setup

By default, the application will be listening to `localhost:8081` and assume it is accessed from `http://localhost:8081`. In order to customize the domain name of your SkyChat application, edit the `.env` file.

### Setup Youtube

Refer to [the guide](app/doc/setup-youtube.md) to use the YouTube plugin to watch videos.

## Customize

### Disabling features

Plugins are grouped in so-called `PluginGroup` instances. It is possible to disable specific features of the application by removing the plugin group name from the `env.json` file. By default, these plugin groups are included:

| name                     | removable | description                                                                                                                 |
| ------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| CorePluginGroup          | ❌        | Basic features for the SkyChat to run properly                                                                              |
| PlayerPluginGroup        | ✅        | Shared player functionnality                                                                                                |
| GamesPluginGroup         | ✅        | All the fun features, live cursor visualization and mini games                                                              |
| ExtraSecurityPluginGroup | ✅        | Log fuzzer, TOR auto-ban, IP history tracker, user usurp command                                                            |
| GalleryPluginGroup       | ✅        | Gallery for self-hosted medias                                                                                              |
| UserDefinedPluginGroup   | ✅        | Custom plugins. By default, this plugin group contains no plugin, but any user-created plugin will be held by this instance |

In private rooms, only core plugins are loaded.

### Send end-to-end encrypted messages

Trusted users can encrypt individual messages directly from the composer. The browser derives a key from the provided passphrase, encrypts the plaintext with AES-GCM, and uploads only ciphertext plus metadata (`salt`, `iv`, and a non-secret label). Configure who can send encrypted messages via `minRightForEncryptedMessages`.

### Customize preferences

The `config/preferences.json` file specifies application preferences. The available fields are detailed below.

| field                                 | type                 | default      | description                                                                                                      |
| ------------------------------------- | -------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| minRightForPublicMessages             | number               | -1           | Min. right to send public messages                                                                               |
| minRightForPrivateMessages            | number               | -1           | Min. right to send private messages                                                                              |
| minRightForMessageQuoting             | number               | -1           | Min. right to quote messages                                                                                     |
| minRightForUserMention                | number               | -1           | Min. right to mention users                                                                                      |
| minRightForShortTermMessageHistory    | number               | -1           | Min. right to access short term room message history                                                             |
| minRightForMessageHistory             | number               | -1           | Min. right to access full room message history                                                                   |
| minRightForEncryptedMessages          | number               | 0            | Min. right to send end-to-end encrypted messages                                                                 |
| minRightForUserModeration             | number               | 'op'         | Min. right to ban, kick and access user ips                                                                      |
| minRightForSetRight                   | number               | 'op'         | Min. right to set user right                                                                                     |
| minRightForAudioRecording             | number               | -1           | Min. right to share and play audio recordings                                                                    |
| minRightForConnectedList              | number               | -1           | Min. right to access the list of currently active users                                                          |
| minRightForPolls                      | number               | -1           | Min. right to create polls                                                                                       |
| minRightForGalleryRead                | number \| 'op'       | 0            | Min. right to access the gallery                                                                                 |
| minRightForGalleryWrite               | number \| 'op'       | 'op'         | Min. right to add and remove gallery documents                                                                   |
| minRightForPlayerAddMedia             | number \| 'op'       | 0            | Min. right to add medias to the player                                                                           |
| minRightForPlayerManageSchedule       | number \| 'op'       | 'op'         | Min. right to manage the player schedules                                                                        |
| maxReplacedImagesPerMessage           | number               | 50           | Max. number of replaced images per message                                                                       |
| maxReplacedStickersPerMessage         | number               | 50           | Max. number of replaced stickers per message                                                                     |
| maxReplacedRisiBankStickersPerMessage | number               | 50           | Max. number of replaced RisiBank stickers per message                                                            |
| maxNewlinesPerMessage                 | number               | 20           | Max. number of newlines per message                                                                              |
| maxConsecutiveMessages                | number               | 1            | Max. number of consecutive messages in a room                                                                    |
| maxMessageMergeDelayMin               | number               | 10           | Max. minutes before not merging consecutive messages                                                             |
| daysBeforeMessageFuzz                 | number               | 7            | Number of days before messages are fuzzed, if ExtraSecurityPluginGroup is enabled                                |
| invertedBlacklist                     | boolean              | false        | Whether blacklisted users can not see messages from users who blacklisted them                                   |
| messagesCooldown                      | ([number, number])[] | [ [ -1, 1] ] | (Rate limit) Number of points a message costs to be sent per right level. There is 100 pts / 10-sec time window. |

### Customize the fake message history

`config/fakemessages.txt` contains the fake messages shown to users whose right level is less than `minRightForShortTermMessageHistory` defined in `preferences.json`. If `minRightForShortTermMessageHistory` is set to -1, you do not need to modify the fake messages since not one will see them.

`minRightForMessageHistory` defines who can quote old messages and navigate room old history.

### Customize the welcome message

By default, guests are welcomes with a welcome message that you can change in `config/welcome.txt`. If you remove this file, there won't be a welcome message anymore.

### Enable the file browser

There is a file browser which allows managing uploads and gallery files. Enable it in your `.env` by setting:

-   `ADMIN_FILEBROWSER_ENABLED=true`
-   `ADMIN_FILEBROWSER_AUTH="xxxxxxxxx" # Basic auth (htpasswd -nb user password)`

It is crucial to set up `ADMIN_FILEBROWSER_AUTH`, otherwise all gallery and uploads would be exposed.

### Customize guest names

`config/guestnames.txt` is the pool of non-logged usernames.
When a guest logs in, a random name is associated to its session. These names are randomly used from this file. If you want to change these names, keep in mind that they should not contain whitespace characters (anything matched by \s so newline, tab, space, ..). Default random names are animal names.

### Adding features

The SkyChat is easily extensible through plugins. You can define custom plugins in `app/server/skychat/plugins/user_defined/`. It will be automatically loaded during the next application startup.

## Contribute

### Add features

Refer to [the Wiki](https://github.com/skychatorg/skychat/wiki) guides to contribute:

-   [Write a plugin](https://github.com/skychatorg/skychat/wiki/SkyChat-Plugin-Development-Documentation)
-   [Example: Write the TypingList Plugin](https://github.com/skychatorg/skychat/wiki/Room-Plugin-Example:-Writing-the-TypingList-Plugin)
-   [Plugin hooks](https://github.com/skychatorg/skychat/wiki/SkyChat-Plugin-Hooks-Documentation)

Please use only one of the following to suggest new features (or bug fixes):

-   Create a pull request
-   Open an issue with your proposal
