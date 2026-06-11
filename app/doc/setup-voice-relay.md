# Voice media relay (hide the origin IP)

By default the in-process mediasoup SFU announces the SkyChat server's own public IP as
`VOICE_ANNOUNCED_IP` — that address ends up in every client's ICE candidates. The no-leak
guarantee means no *peer* IP is ever exposed, but the **server's** IP is, by design.

If you must keep the origin IP private (e.g. the SkyChat host sits behind Cloudflare), put a
tiny **L4 relay** on a separate VPS. Clients only ever see the relay's IP; the relay forwards
UDP+TCP on the media port to your origin and masquerades the source, so the origin only ever
replies to the relay — never to a client. Media stays DTLS-SRTP encrypted end to end; the
relay is a dumb packet forwarder and can't read it.

> Cloudflare TURN does **not** work for this. TURN relays the *client* side; the SFU still
> hands its own (origin) address to each client in signaling, and mediasoup (ICE-Lite) can't
> relay its own candidate through TURN. The only thing that hides the origin is announcing a
> different address — i.e. this relay.

## On the relay VPS

Copy `app/script/voice-relay.sh` to the VPS and run it as root:

```bash
# install + start, reboot-safe (default media port 44444)
sudo ./voice-relay.sh up <ORIGIN_IP> [MEDIA_PORT]

# show config + live rules + this relay's public IP
sudo ./voice-relay.sh status

# stop + uninstall completely
sudo ./voice-relay.sh down
```

It installs only iptables NAT rules (DNAT + MASQUERADE) plus a small systemd unit for
reboot persistence — no daemon, no mediasoup, no coturn. A nano VPS handles 5–20 audio
users (~32 kbps/speaker) easily.

Open the media port **inbound** on the relay's own firewall / provider security group:

```bash
sudo ufw allow 44444/udp
sudo ufw allow 44444/tcp
```

## On the SkyChat origin

1. `.env`: set the announced address to the **relay's** public IP (the `up` command prints it):
   ```bash
   VOICE_ANNOUNCED_IP=<RELAY_PUBLIC_IP>
   ```
2. Restart the backend:
   ```bash
   docker compose up -d --force-recreate skychat_backend
   ```
3. Lock the media port so only the relay can reach the origin (don't leave it open to the
   internet, or scanners could fingerprint the origin):
   ```bash
   sudo ufw allow from <RELAY_PUBLIC_IP> to any port 44444 proto udp
   sudo ufw allow from <RELAY_PUBLIC_IP> to any port 44444 proto tcp
   sudo ufw deny 44444
   ```

That's it. Clients reach `RELAY:44444` → relay forwards to origin → origin replies to relay →
relay forwards to client. The origin IP never appears in any packet or candidate the client
sees.

## Notes

- Through the relay, mediasoup sees every client arriving from the relay's IP (distinct by
  source port, so ICE still works). Per-IP **media-layer** distinction is lost, but all
  moderation/rate-limiting runs on the **signaling** path (the chat WebSocket), where each
  client's real IP is still available via `X-Forwarded-For`. Bans/shadowban/blacklist are
  unaffected.
- Optional hardening: tunnel the relay→origin leg over WireGuard and DNAT to the origin's
  WireGuard IP, so the origin's media port never listens on the public internet. The media is
  already DTLS-SRTP encrypted, so this is defense-in-depth, not required.
- IPv4 only. If you announce an IPv6 address, front it with an equivalent `ip6tables` rule.
