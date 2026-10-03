#!/bin/sh
# Пересобирает patches/*.diff и all.diff из orig/ и new/ (пути — от корня /home/cashruflow).
set -e
cd "$(dirname "$0")/.."
rm -f patches/*.diff all.diff
for f in web/public/sidebar.js web/public/sb-resize.js web/public/sb-profile.js \
         web/public/issues_page.js web/public/ticket_page.js web/public/mhead.js \
         web/server.js web/public/habits-sw.js web/public/assets/icons.svg \
         web/public/issues.html web/public/ticket.html; do
  git diff --no-index --no-color "orig/$f" "new/$f" \
    | sed -E 's#(a|b)/(orig|new)/#\1/#g' | grep -v '^index ' > "patches/$(basename "$f").diff" || true
  cat "patches/$(basename "$f").diff" >> all.diff
done
