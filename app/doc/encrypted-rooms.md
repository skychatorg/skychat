# End-to-end encrypted rooms

SkyChat now supports rooms where the server only relays opaque ciphertext. This document walks you through enabling the feature on the server and explains what users will see in the client.

## 1. Enable encryption for a room

1. **Stop the server** so it does not overwrite the room file while you edit it.
2. Open the room definition stored at `storage/rooms/<roomId>.json`. All rooms (including private ones) are persisted there and contain their `name`, plugin groups, whitelist, etc.
3. Add (or update) the `encryption` block so it looks like the example below:

    ```json
    {
        "name": "Secret Ops",
        "order": 6,
        "pluginGroupNames": ["CorePluginGroup"],
        "isPrivate": true,
        "whitelist": ["alice", "bob"],
        "encryption": {
            "enabled": true,
            "salt": null,
            "version": 1
        }
    }
    ```

    * Set `enabled` to `true` to mark the room as encrypted.
    * Keep `salt` as `null` (or delete it) to let the server regenerate a fresh random salt during startup. The salt is advertised to clients so they derive the correct key from the passphrase; changing it forces every client to re-enter the passphrase.
    * Leave `version` at the default (`1`) unless you roll out a new payload format in the future.
4. Start the server again. The room descriptor that is sent to clients will now include `{ encryption: { enabled: true, salt: "...", version: 1 } }`. The message plugin will refuse plaintext payloads in that room, so moderation/logging tools will only see placeholders.

> **Tip:** When you toggle encryption on an existing room, older messages remain plaintext. Consider creating a dedicated room or cleaning the history before enabling the flag.

## 2. Share the passphrase out-of-band

SkyChat never stores the passphrase; clients turn it into an AES-GCM key locally using PBKDF2. Decide how you want to distribute the passphrase (voice call, in-person, etc.) and remind users that anyone who learns it can read the room history.

## 3. Client workflow

When a user enters an encrypted room, the composer displays a lock banner:

1. The user enters the shared passphrase and presses **Unlock**. The browser derives the key and keeps it only in memory for the current session. Use the **Forget** button at any time to wipe it.
2. Once unlocked, sending a message works as usual. The client:
    * Strips an optional quote prefix such as `@123` (only when quoting is allowed).
    * Encrypts the rest of the text plus the quoted ID (if any) with AES-GCM and prepends the `::skychat-encrypted::` prefix required by the server.
    * Leaves slash commands (`/kick`, `/help`, …) untouched, so administrative commands continue to work even when the room is marked as encrypted.
3. Incoming messages are decrypted automatically when the derived key is present. If the user has not provided the passphrase (or used a wrong one), the message bubble shows a small warning explaining why it is still locked.

Because decrypted content only lives in memory, reloading the page or switching browsers requires entering the passphrase again. Encourage users to unlock rooms only on trusted devices.

## 4. Rotating passphrases

To rotate a passphrase:

1. Flip `encryption.salt` to `null` (or delete it) inside the room file and restart the server. That generates a new salt so cached keys become invalid.
2. Notify room members of the new passphrase through a secure side channel. Everyone must re-enter it once the lock banner reappears.

At the moment, historical messages remain encrypted with the old key. You can optionally delete the history or re-upload important notes manually after the rotation.
