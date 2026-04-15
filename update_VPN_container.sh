#!/bin/bash
docker rm -f wg-easy
docker run -d \
  --name=wg-easy \
  -e LANG=ja \
  -e WG_HOST=vpn.mansuke.jp \
  -e PASSWORD_HASH='$2a$12$ujqzFqpU1qVKBOweEutoN.XYDH5ghOQ/CGhVScRF7ZT7UERIZegK6' \
  -e PORT=51821 \
  -v ~/.wg-easy:/etc/wireguard \
  -p 51820:51820/udp \
  -p 51821:51821/tcp \
  -p 80:51821/tcp \
  --cap-add=NET_ADMIN \
  --cap-add=SYS_MODULE \
  --sysctl="net.ipv4.conf.all.src_valid_mark=1" \
  --sysctl="net.ipv4.ip_forward=1" \
  --restart unless-stopped \
  ghcr.io/wg-easy/wg-easy
