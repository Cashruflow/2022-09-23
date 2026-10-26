#!/usr/bin/env python3
"""Собрать orig/ (выдержки) из tools/excerpt_src.py. Пустые строки-заглушки выше и между блоками —
только для сборки диффа: номера строк хунков совпадают с боевыми, поэтому patch -p1 на сервере
ляжет без смещений. Запуск: python3 tools/make_excerpts.py (из корня threads-patch)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from excerpt_src import SRC, NO_EOL
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'orig')
for path, lines in SRC.items():
    last = max(lines)
    out = [lines.get(i, '') for i in range(1, last + 1)]
    p = os.path.join(root, path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out) + ('' if path in NO_EOL else '\n'))
    print('orig/' + path, last, 'строк')
