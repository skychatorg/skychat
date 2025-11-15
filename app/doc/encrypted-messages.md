# End-to-end encrypted messages

SkyChat now lets trusted users encrypt individual messages instead of entire rooms. Encrypted payloads are generated in the browser and the server stores only ciphertext alongside the initialization vector, salt, and a non-secret label. The shared passphrase never leaves the client.

## 1. Configure who can encrypt

1. Open `config/preferences.json` and set `minRightForEncryptedMessages` to the minimum numeric right that should be allowed to send encrypted messages (defaults to `0`, meaning registered users).
2. Restart the server so the [`MessagePlugin`](../server/plugins/core/room/MessagePlugin.ts) enforces the new threshold.

Users whose right is below this value can still read encrypted messages if they know the passphrase, but they cannot upload new ciphertext.

## 2. Send an encrypted message

1. Open the chat composer and flip the **Encrypt the next message** toggle.
2. Pick one of your saved keys from the dropdown or keep "Use new passphrase" selected.
3. If you are creating a new key, enter the passphrase and optionally set a human-friendly label. The label is visible to everyone and helps recipients choose the right passphrase; it is not secret.
4. Choose whether to remember the passphrase for the current browser session. Remembered keys are stored as non-exportable `CryptoKey` instances so you can send future encrypted messages without retyping the passphrase.
5. Type your message and press **Send**. The client derives a random salt, encrypts the plaintext with AES-GCM, and uploads a JSON payload that contains `{ ciphertext, iv, salt, keyHash, label }`. The server stores the payload as-is and replaces the visible content with `[encrypted message]`.

## 3. Unlock an encrypted message

1. Encrypted messages display a lock banner (and the label if provided). Click into the passphrase input below the banner.
2. Enter the shared passphrase and click **Unlock**. Successful decryption replaces the ciphertext with the original plaintext, and the key is cached for future messages that reuse the same passphrase hash.
3. If a key was remembered by mistake, use the **Saved keys** list in the composer to forget it.

## 4. Operational notes

- Passphrase hashes (`keyHash`) and labels are visible to the server. Do not use easily guessable phrases if metadata leakage is a concern.
- Because ciphertext is attached to individual messages, you can mix encrypted and plaintext content within the same room without impacting moderation tools.
- Rotating a passphrase is as simple as picking a new label + passphrase in the composer. Old messages stay encrypted with the previous key unless you repost them manually.
