#!/bin/sh
# Подъём ?v= у /sidebar.js во ВСЕХ подключениях (правило CLAUDE.md: ?v= кэшируется 7 дней).
# 20261026f → 20261027a (значение не выдавалось: search_code «sidebar.js?v=2026102[7-9]» = 0, 26.10.2026).
# Запуск из /home/cashruflow ПОСЛЕ patch. Сначала сухой прогон: sh bump_sidebar_v.sh --dry
set -e
OLD='sidebar.js?v=20261026f'; NEW='sidebar.js?v=20261027a'
FILES=$(grep -rl --include='*.html' --include='*.js' -F "/$OLD" web/public web/blog_app web/roles.js | grep -v '\.bak' || true)
echo "файлов: $(echo "$FILES" | grep -c . || true)"
[ "$1" = "--dry" ] && { echo "$FILES"; exit 0; }
for f in $FILES; do sed -i "s#/$OLD#/$NEW#g" "$f"; done
echo "осталось старых: $(grep -rl -F "/$OLD" web/public web/blog_app web/roles.js | grep -v '\.bak' | wc -l) (ждём 0)"
