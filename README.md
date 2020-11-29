# SkyChat

The SkyChat is a modern-looking discussion platform with a few original features:
- A shared youtube player (If you are familiar with plug.dj, that's exactly it)
- Real-time visualisation of everyone's cursor

And many customisation/entertainment features such as:
- Custom text and halo colors to be bought for user messages
- Virtual money with mini-games (casino roulette, guess the number)
- An XP system with associated ranks, based on users activity
- Custom profile pictures (guests have randomly generated ones)

<img src="./doc/screenshot.png">

## How to install

Ensure you have the following installed on your system:
- sqlite3
- nodejs/npm

Then, clone the repository, install nodejs dependencies, and run the setup script.

```bash
git clone https://github.com/skychatorg/skychat.git
cd skychat
npm i
npm run setup
```

## How to dev

```bash
npm run dev
```

This will start a static file server & websocket server on http://localhost:8080
When the source files change, the build processes runs automatically

## The env.json file

The fields in the .env.json contain private information related to the application.

The semantic of these fields are defined below:


| field                    | type                                      | default                                                           | semantic                                                                                            |
|--------------------------|-------------------------------------------|-------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| location                 | string                                    | "http://localhost:8080"                                           | Server location, i.e. what user need to put in their browser to access your app                     |
| hostname                 | string                                    | "localhost"                                                       | Hostname the server will listen to                                                                  |
| port                     | number                                    | 8080                                                              | Server port                                                                                         |
| ssl                      | false or {certificate:string,key:string}  | false                                                             | SSL configuration (paths to certificate and key files). Use false if SSL is disabled.               |
| **users_passwords_salt** | string                                    | ""                                                                | Password salt. MUST be set manually.                                                                |
| **users_token_salt**     | string                                    | ""                                                                | Token salt. MUST be set manually.                                                                   |
| **youtube_api_key**      | string                                    | ""                                                                | Youtube api key                                                                                     |
| op                       | string[]                                  | []                                                                | OP usernames. OP usernames can use the /setright command.                                           |
| email_transport          | nodemailer.JSONTransport                  | {"sendmail": true,"newline": "unix","path": "/usr/sbin/sendmail"} | Value given to [nodemailer.createTransport](https://nodemailer.com/about/) to initialize the mailer |


## The config.json file

The config.json file specifies application preferences. The available fields are detailed below.

**ranks**

- Type: `Array<{limit: number, images: {'18': string, '26': string}}>`
- Description: Rank definition (xp threshold and image path). Must be sorted by descending limit.
  - limit: XP limit to have this rank. The last rank definition must have `0` as the limit, otherwise new users will not have any rank.
  - images: Image path corresponding to the rank icon for each 18 and 26px sizes. Image paths should be relative to `/assets/images/`.


**plugins**

- Type: `Array<string>`
- Description: Enabled plugins. Must only define classes exported by `app/server/skychat/commands/impl/index.ts`


**fakeMessages**

- Type: `Array<string>`
- Description: Fake raw messages that are displayed to guests and low-rank users when they connect to the skychat. 


**guestNames**

- Type: `Array<string>`
- Description: When a guest logs in, a random name is associated to its session. These names are randomly fetched from this file. If you want to change these names, keep in mind that they should not contain whitespace characters (anything matched by \s so newline, tab, space, ..). Default random names are animal names.
