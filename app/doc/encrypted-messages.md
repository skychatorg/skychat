# End-to-end encrypted messages

SkyChat now lets trusted users encrypt individual messages instead of entire rooms. Encrypted payloads are generated in the browser and the server stores only ciphertext alongside the initialization vector, salt, and a non-secret label. The shared passphrase never leaves the client.

## 1. Configure who can encrypt

1. Open `config/preferences.json` and set `minRightForEncryptedMessages` to the minimum numeric right that should be allowed to send encrypted messages (defaults to `0`, meaning registered users).
2. Restart the server so the [`MessagePlugin`](../server/plugins/core/room/MessagePlugin.ts) enforces the new threshold.

Users whose right is below this value can still read encrypted messages if they know the passphrase, but they cannot upload new ciphertext.

## 2. Send an encrypted message

1. Click the **Encrypt** lock button that sits next to the RisiBank shortcut in the composer toolbar. A panel appears directly above the input field.
2. Enter the shared passphrase (required) and, if you want to give recipients a hint, set an optional non-secret label. The passphrase is never saved locally and is cleared as soon as you send or cancel the panel.
3. Type your message and press **Send**. The client derives a random salt, encrypts the plaintext with AES-GCM, and uploads a JSON payload that contains `{ ciphertext, iv, salt, label }`. The server stores the payload as-is and replaces the visible content with `🔒 Encrypted message`.

## 3. Unlock an encrypted message

1. Locked messages display an italic “Encrypted message” line with a lock icon, followed by a passphrase form.
2. Enter the shared passphrase and click **Unlock**. Successful decryption replaces the ciphertext with the original plaintext. The passphrase is never cached, so you must re-enter it for each encrypted message you want to view.

## 4. Operational notes

- Labels are visible to the server. Do not use labels or passphrases that leak sensitive information.
- Because ciphertext is attached to individual messages, you can mix encrypted and plaintext content within the same room without impacting moderation tools.
- Rotating a passphrase is as simple as picking a new label + passphrase in the composer. Old messages stay encrypted with the previous key unless you repost them manually.
