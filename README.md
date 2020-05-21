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


| field                | type                                      | default                 | semantic                                                                              |
|----------------------|-------------------------------------------|-------------------------|---------------------------------------------------------------------------------------|
| location             | string                                    | "http://localhost:8080" | server location, i.e. what user need to put in their browser to access your app       |
| hostname             | string                                    | "localhost"             | Hostname the server will listen to                                                    |
| port                 | number                                    | 8080                    | Server port                                                                           |
| ssl                  | false or {certificate:string,key:string}  | false                   | SSL configuration (paths to certificate and key files). Use false if SSL is disabled. |
| users_passwords_salt | string                                    | ""                      | Password salt. MUST be set manually.                                                  |
| users_token_salt     | string                                    | ""                      | Token salt. MUST be set manually.                                                     |
| youtube_api_key      | string                                    | ""                      | Youtube api key                                                                       |
| op                   | string[]                                  | []                      | OP usernames. OP usernames can use the /setright command.                             |


## The config.json file

The config.json file specifies application preferences. The available fields are detailed below.

**guestNames**

When a guest logs in, a random animal name is associated to its session. These animal names are randomly fetched from this file. If you want to change these names, keep in mind that they should not contain whitespace characters (anything matched by \s so newline, tab, space, ..)
