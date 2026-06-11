#!/usr/bin/env bash
#
# SkyChat Voice — media relay installer (run this ON A SEPARATE VPS, not the SkyChat host).
#
# Hides the SkyChat origin IP: the browser only ever sees THIS relay's public IP. The relay
# is a dumb L4 forwarder (kernel netfilter) — it forwards UDP+TCP on the media port to your
# origin and masquerades the source, so the origin only ever replies to the relay, never to
# a client. Media stays DTLS-SRTP encrypted end-to-end; the relay can't read it.
#
# On the ORIGIN you must then set, in .env:   VOICE_ANNOUNCED_IP=<this relay's public IP>
# and firewall the media port so only this relay can reach it.
#
# Usage (as root on the relay VPS):
#   ./voice-relay.sh up <ORIGIN_IP> [MEDIA_PORT]   # install + start (default port 44444), reboot-safe
#   ./voice-relay.sh down                          # stop + uninstall completely
#   ./voice-relay.sh status                        # show config + live rules
#
set -euo pipefail

CONF=/etc/voice-relay.conf
SELF_DST=/usr/local/sbin/voice-relay.sh
UNIT=/etc/systemd/system/voice-relay.service
SYSCTL=/etc/sysctl.d/99-voice-relay.conf

# Canonical location of THIS script, used to re-fetch itself for reboot persistence when run
# via `curl ... | bash` (piped, so $0 is "bash" and there's no file to copy). Override with
# VOICE_RELAY_URL=... if you host it elsewhere (e.g. a fork or a different branch).
RAW_URL="${VOICE_RELAY_URL:-https://raw.githubusercontent.com/skychatorg/skychat/master/app/script/voice-relay.sh}"

NAT_PRE=VOICE_RELAY_PRE
NAT_POST=VOICE_RELAY_POST
FWD=VOICE_RELAY_FWD

die() { echo "voice-relay: $*" >&2; exit 1; }
need_root() { [ "$(id -u)" = 0 ] || die "must run as root"; }
have_systemd() { [ -d /run/systemd/system ]; }

fetch() { # <url> <dest>
    if command -v curl >/dev/null 2>&1; then curl -fsSL "$1" -o "$2"
    elif command -v wget >/dev/null 2>&1; then wget -qO "$2" "$1"
    else return 1; fi
}

# Put a copy of this script at $SELF_DST so the systemd unit can re-apply on boot. When run
# from a real file (local checkout) we copy it; when piped via curl|bash we re-download it.
install_self() {
    if [ -f "$0" ] && grep -q 'VOICE_RELAY_PRE' "$0" 2>/dev/null; then
        install -m 0755 "$0" "$SELF_DST"
    else
        echo "voice-relay: fetching script for reboot persistence from $RAW_URL"
        fetch "$RAW_URL" "$SELF_DST" || die "could not download $RAW_URL (set VOICE_RELAY_URL to a reachable raw URL)"
        chmod 0755 "$SELF_DST"
        grep -q 'VOICE_RELAY_PRE' "$SELF_DST" || die "downloaded file does not look like voice-relay.sh"
    fi
}

ensure_iptables() {
    command -v iptables >/dev/null 2>&1 && return 0
    echo "voice-relay: installing iptables…"
    if command -v apt-get >/dev/null 2>&1; then apt-get update -qq && apt-get install -y -qq iptables
    elif command -v dnf >/dev/null 2>&1; then dnf install -y -q iptables
    elif command -v yum >/dev/null 2>&1; then yum install -y -q iptables
    elif command -v apk >/dev/null 2>&1; then apk add --no-cache iptables
    else die "could not auto-install iptables; install it and re-run"; fi
}

relay_public_ip() {
    # Best-effort: source IP toward the internet, then fall back to an echo service.
    ip -4 route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -n1 \
        || curl -fsS https://api.ipify.org 2>/dev/null || echo "<this-VPS-public-IP>"
}

# ---- live rule (de)application; also called by systemd on boot/stop ----

apply_rules() {
    # shellcheck source=/dev/null
    . "$CONF"
    sysctl -qw net.ipv4.ip_forward=1

    # DNAT inbound media -> origin
    iptables -t nat -N "$NAT_PRE" 2>/dev/null || iptables -t nat -F "$NAT_PRE"
    iptables -t nat -A "$NAT_PRE" -p udp --dport "$MEDIA_PORT" -j DNAT --to-destination "$ORIGIN_IP:$MEDIA_PORT"
    iptables -t nat -A "$NAT_PRE" -p tcp --dport "$MEDIA_PORT" -j DNAT --to-destination "$ORIGIN_IP:$MEDIA_PORT"
    iptables -t nat -C PREROUTING -j "$NAT_PRE" 2>/dev/null || iptables -t nat -A PREROUTING -j "$NAT_PRE"

    # MASQUERADE so the origin replies to the relay (never to the client) -> origin IP stays hidden
    iptables -t nat -N "$NAT_POST" 2>/dev/null || iptables -t nat -F "$NAT_POST"
    iptables -t nat -A "$NAT_POST" -p udp -d "$ORIGIN_IP" --dport "$MEDIA_PORT" -j MASQUERADE
    iptables -t nat -A "$NAT_POST" -p tcp -d "$ORIGIN_IP" --dport "$MEDIA_PORT" -j MASQUERADE
    iptables -t nat -C POSTROUTING -j "$NAT_POST" 2>/dev/null || iptables -t nat -A POSTROUTING -j "$NAT_POST"

    # Allow the forwarded flows (inserted at the TOP of FORWARD so it wins over ufw/firewalld drops)
    iptables -N "$FWD" 2>/dev/null || iptables -F "$FWD"
    iptables -A "$FWD" -p udp -d "$ORIGIN_IP" --dport "$MEDIA_PORT" -j ACCEPT
    iptables -A "$FWD" -p tcp -d "$ORIGIN_IP" --dport "$MEDIA_PORT" -j ACCEPT
    iptables -A "$FWD" -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
    iptables -C FORWARD -j "$FWD" 2>/dev/null || iptables -I FORWARD 1 -j "$FWD"
}

teardown_rules() {
    iptables -t nat -D PREROUTING -j "$NAT_PRE" 2>/dev/null || true
    iptables -t nat -F "$NAT_PRE" 2>/dev/null || true
    iptables -t nat -X "$NAT_PRE" 2>/dev/null || true
    iptables -t nat -D POSTROUTING -j "$NAT_POST" 2>/dev/null || true
    iptables -t nat -F "$NAT_POST" 2>/dev/null || true
    iptables -t nat -X "$NAT_POST" 2>/dev/null || true
    iptables -D FORWARD -j "$FWD" 2>/dev/null || true
    iptables -F "$FWD" 2>/dev/null || true
    iptables -X "$FWD" 2>/dev/null || true
}

# ---- top-level commands ----

cmd_up() {
    need_root
    local origin="${1:-}" port="${2:-44444}"
    [ -n "$origin" ] || die "usage: voice-relay.sh up <ORIGIN_IP> [MEDIA_PORT]"
    echo "$origin" | grep -Eq '^[0-9]{1,3}(\.[0-9]{1,3}){3}$' || die "ORIGIN_IP must be an IPv4 literal (got '$origin')"
    echo "$port" | grep -Eq '^[0-9]{1,5}$' || die "MEDIA_PORT must be numeric (got '$port')"
    ensure_iptables

    # Persist config + this script + ip_forward, then install a reboot-safe systemd unit.
    printf 'ORIGIN_IP=%s\nMEDIA_PORT=%s\n' "$origin" "$port" > "$CONF"
    install_self
    printf 'net.ipv4.ip_forward=1\n' > "$SYSCTL"

    cat > "$UNIT" <<EOF
[Unit]
Description=SkyChat Voice media relay (L4 forward ${origin}:${port})
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=${SELF_DST} apply
ExecStop=${SELF_DST} teardown

[Install]
WantedBy=multi-user.target
EOF

    if have_systemd; then
        systemctl daemon-reload || true
        systemctl enable --now voice-relay.service >/dev/null 2>&1 || { apply_rules; echo "voice-relay: systemd enable failed, applied rules directly"; }
    else
        apply_rules
        echo "voice-relay: no systemd; rules applied (NOT reboot-persistent on this system)"
    fi

    local rip; rip="$(relay_public_ip)"
    echo
    echo "voice-relay: UP — forwarding udp+tcp/${port} on this VPS -> ${origin}:${port}"
    echo
    echo "Next, on the SkyChat ORIGIN (${origin}):"
    echo "  1. .env:   VOICE_ANNOUNCED_IP=${rip}"
    echo "  2. restart: docker compose up -d --force-recreate skychat_backend"
    echo "  3. lock the media port to THIS relay only. The port is published by Docker, which"
    echo "     BYPASSES ufw — so filter it in the DOCKER-USER chain (relay masquerades, so the"
    echo "     origin sees traffic from this relay's IP):"
    echo "       iptables -I DOCKER-USER -p udp --dport ${port} ! -s ${rip} -j DROP"
    echo "       iptables -I DOCKER-USER -p tcp --dport ${port} ! -s ${rip} -j DROP"
    echo "       apt-get install -y iptables-persistent && netfilter-persistent save   # persist"
    echo
    echo "Open ${port}/udp and ${port}/tcp INBOUND on THIS relay's cloud provider security group"
    echo "(the relay's own ufw INPUT does not apply — DNAT happens before INPUT)."
}

cmd_down() {
    need_root
    if have_systemd && [ -f "$UNIT" ]; then
        systemctl disable --now voice-relay.service >/dev/null 2>&1 || true
    fi
    teardown_rules
    rm -f "$UNIT" "$SYSCTL" "$CONF"
    if have_systemd; then systemctl daemon-reload || true; fi
    # leave $SELF_DST in place is harmless, but remove for a clean uninstall:
    [ "$0" = "$SELF_DST" ] || rm -f "$SELF_DST"
    echo "voice-relay: DOWN — rules removed, service uninstalled."
}

cmd_status() {
    echo "== config =="; cat "$CONF" 2>/dev/null || echo "(none)"
    echo "== ip_forward =="; sysctl net.ipv4.ip_forward 2>/dev/null || true
    echo "== nat PREROUTING ($NAT_PRE) =="; iptables -t nat -S "$NAT_PRE" 2>/dev/null || echo "(absent)"
    echo "== nat POSTROUTING ($NAT_POST) =="; iptables -t nat -S "$NAT_POST" 2>/dev/null || echo "(absent)"
    echo "== filter FORWARD ($FWD) =="; iptables -S "$FWD" 2>/dev/null || echo "(absent)"
    if have_systemd; then echo "== service =="; systemctl is-active voice-relay.service 2>/dev/null || true; fi
    echo "== this relay's public IP (set VOICE_ANNOUNCED_IP to this) =="; relay_public_ip
}

case "${1:-}" in
    up)       shift; cmd_up "$@" ;;
    down)     cmd_down ;;
    status)   cmd_status ;;
    apply)    need_root; apply_rules ;;     # internal: used by systemd ExecStart
    teardown) need_root; teardown_rules ;;  # internal: used by systemd ExecStop
    *) echo "usage: $0 {up <ORIGIN_IP> [MEDIA_PORT] | down | status}" >&2; exit 1 ;;
esac
