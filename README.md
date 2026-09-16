# ASCII Discord Bot

Converts images and videos to ASCII art, and builds photomosaics from a set of source images, using Discord slash commands.

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `config.example.yaml` to `config.yaml` and fill in:
   - `discordToken` - your bot token
   - `discordClientId` - your application's client ID
   - `discordGuildId` - optional, a guild ID for instant command registration during development. Leave blank for global registration (can take up to an hour to propagate).
3. In the Discord Developer Portal, enable the **Message Content Intent** for the bot (required for mention-based auto-convert and for collecting images during a compose session).
4. Register the slash commands:
   ```
   npm run deploy-commands
   ```
5. Start the bot:
   ```
   npm start
   ```

## Commands

- `/ascii [image] [url] [color]` - convert an image to ASCII text. Provide an attachment or a URL.
- `/video [video] [url]` - convert a video (up to 10 seconds by default) to an ASCII GIF.
- `/compose start` - begin a photomosaic session in the current channel. Upload the target image first, then source images, as normal message attachments.
- `/compose finish` - process the uploaded images into a photomosaic.
- `/compose cancel` - cancel the active session and discard its files.
- `/setwidth <width>` - set the ASCII width used for conversions in the current channel. Requires the Manage Server permission.
- `/help` - list commands.
- Mentioning the bot with an image or video attached auto-converts it, without needing a slash command.

## Limits and safeguards

- Image downloads are capped at `maxImageBytes`, video downloads at `maxVideoBytes` (see `src/config.js`). Downloads are rejected early via the `Content-Length` header when available, and are hard-capped mid-stream otherwise.
- Video duration is checked remotely via `ffprobe` before downloading when the source supports it, and always re-checked on the downloaded file as a fallback.
- Only one video conversion or compose job runs per channel at a time; a second request is rejected with a clear message instead of queuing silently.
- Idle compose sessions are automatically cancelled and their temp files removed after a period of inactivity (`composeSessionTtlMs`).

## Architecture

```
index.js              bot entry point, slash command routing, mention/compose message handling
deploy-commands.js     registers slash commands with Discord
src/
  config.js            tunable constants
  utils.js             id generation, safe cleanup, size-capped downloads
  metrics.js            measures real monospace glyph metrics for correct ASCII aspect ratio
  ascii.js             image -> ASCII string, with Floyd-Steinberg dithering
  video.js             video -> ASCII GIF pipeline
  compose.js            photomosaic tile matching and rendering
  locks.js             per-channel concurrency lock
  sessions.js            compose session store with TTL sweeper
  channel-width.js       per-channel ASCII width preference
commands/
  ascii.js, video.js, compose.js, setwidth.js, help.js
  index.js              aggregates commands for registration and lookup
```
