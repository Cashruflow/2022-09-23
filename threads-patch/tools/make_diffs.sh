#!/bin/sh
# Пересобирает patches/*.diff и all.diff из orig/ и new/ (пути — от корня /home/cashruflow, patch -p1).
# Изменённые файлы — выдержки orig/ → new/; новые файлы — от /dev/null.
set -e
cd "$(dirname "$0")/.."
rm -f patches/*.diff all.diff
for f in web/server.js web/roles.js web/threads.js web/crm_chats.js \
         web/public/sidebar.js web/public/assets/icons.svg web/public/habits-sw.js; do
  git diff --no-index --no-color "orig/$f" "new/$f" \
    | sed -E 's#(a|b)/(orig|new)/#\1/#g' | grep -v '^index ' > "patches/$(basename "$f").diff" || true
  cat "patches/$(basename "$f").diff" >> all.diff
done
for f in web/discuss.js web/public/discuss.html web/public/discuss.css web/public/discuss_page.js; do
  git diff --no-index --no-color /dev/null "new/$f" \
    | sed -E 's#(a|b)/new/#\1/#g' | grep -v '^index ' > "patches/$(basename "$f").diff" || true
  cat "patches/$(basename "$f").diff" >> all.diff
done
