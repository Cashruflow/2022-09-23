import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextBreakdown } from 'claude-code'

import type { Segment, Snapshot } from '../types'

const snap = atom({ plugin: 'context-bar', key: 'snap' } as const, null)

const BAR_WIDTH = 48

// Группы в порядке отрисовки; free всегда последняя
const GROUPS = [
  { key: 'system', label: 'системный', color: '#8a8a8a', emoji: '⬛' },
  { key: 'tools', label: 'инструменты', color: '#6c63ff', emoji: '🟪' },
  { key: 'mcp', label: 'MCP', color: '#1a7cff', emoji: '🟦' },
  { key: 'files', label: 'файлы', color: '#22b05a', emoji: '🟩' },
  { key: 'dialog', label: 'диалог', color: '#ff9f0a', emoji: '🟧' },
  { key: 'free', label: 'свободно', color: '#d9d9d9', emoji: '⬜' },
] as const

function groupOf(name: string, kind: string): string {
  if (kind === 'free' || kind === 'buffer') return 'free'
  const n = name.toLowerCase()
  if (n.includes('mcp')) return 'mcp'
  if (n.includes('system prompt')) return 'system'
  if (n.includes('memory') || n.includes('file')) return 'files'
  if (n.includes('message')) return 'dialog'
  return 'tools' // System tools, Custom agents, Skills, Slash commands
}

export function toSnapshot(b: SessionContextBreakdown): Snapshot {
  const sums = new Map<string, number>()
  for (const c of b.categories) {
    if (c.kind === 'deferred') continue
    const g = groupOf(c.name, c.kind)
    sums.set(g, (sums.get(g) ?? 0) + c.tokens)
  }
  const segments: Segment[] = GROUPS.map(({ key, label, color }) => ({ key, label, color, tokens: sums.get(key) ?? 0 }))
  return { used: b.totalTokens, max: b.rawMaxTokens, segments }
}

const k = (n: number) => `${Math.round(n / 1000)}k`

// Ширина каждого сегмента в символах, сумма ровно BAR_WIDTH
export function widths(s: Snapshot, width = BAR_WIDTH): number[] {
  const total = s.segments.reduce((a, x) => a + x.tokens, 0) || 1
  const raw = s.segments.map(x => (x.tokens / total) * width)
  const out = raw.map(r => (r > 0 ? Math.max(1, Math.floor(r)) : 0))
  let diff = width - out.reduce((a, x) => a + x, 0)
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0])
  for (let j = 0; diff !== 0 && j < order.length * 4; j++) {
    const i = order[j % order.length]![1]
    const cur = out[i]!
    if (diff > 0) { out[i] = cur + 1; diff-- } else if (cur > 1) { out[i] = cur - 1; diff++ }
  }
  return out
}

async function refresh($: EngineInterface) {
  try {
    const usage = await $.session.usage({ breakdown: 'summary' })
    const b = usage.context.breakdown
    if (!b) return
    const s = toSnapshot(b)
    await update($, snap, () => s)
    $.ui.status(`Контекст ${k(s.used)}/${k(s.max)} · ${pctOf(s, s.used)}%`)
  } catch {
    // нет сессии — просто не рисуем
  }
}

const pctOf = (s: Snapshot, t: number) => Math.round((t / s.max) * 100)

// Текстовая версия: эмодзи-полоска, читается на любом экране, включая телефон
export function toText(s: Snapshot): string {
  const emoji = (key: string) => GROUPS.find(g => g.key === key)?.emoji ?? '⬜'
  const w = widths(s, 20)
  const bar = s.segments.map((seg, i) => emoji(seg.key).repeat(w[i] ?? 0)).join('')
  const legend = s.segments.map(seg => `${emoji(seg.key)} ${seg.label} ${pctOf(s, seg.tokens)}%`).join('  ')
  return `Контекст · ${k(s.used)} / ${k(s.max)} · ${pctOf(s, s.used)}%\n${bar}\n${legend}`
}

function drawBar({ Box, Text }: { Box: any; Text: any }, s: Snapshot) {
  const pct = Math.round((s.used / s.max) * 100)
  const pctColor = pct >= 80 ? '#d9480f' : pct >= 60 ? '#ff9f0a' : '#22b05a'
  const w = widths(s)

  return (
    <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold>Контекст · {k(s.used)} / {k(s.max)}</Text>
        <Text bold color={pctColor}>{pct}%</Text>
      </Box>
      <Box>
        {s.segments.map((seg, i) =>
          (w[i] ?? 0) > 0 ? <Text key={seg.key} color={seg.color}>{'█'.repeat(w[i] ?? 0)}</Text> : null,
        )}
      </Box>
      <Box flexWrap="wrap" columnGap={2}>
        {s.segments.map(seg => (
          <Text key={`l-${seg.key}`}>
            <Text color={seg.color}>●</Text>
            <Text dimColor> {seg.label} {pctOf(s, seg.tokens)}%</Text>
          </Text>
        ))}
      </Box>
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'ctx', description: 'Полоска контекста с разбивкой по типу' })
    const r = await next(e)
    await refresh($)
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    await refresh($)
    return r
  })

  on('command.run', { command: 'ctx' }, async $ => {
    await refresh($)
    const s = await read($, snap)
    return { text: s ? toText(s) : 'Контекст ещё не посчитан — попробуйте после первого ответа.' }
  })

  // Вывод /ctx — цветной полосой; на поверхностях без ui.render остаётся текст
  on('ui.render', { component: 'CommandOutput', props: { command: 'ctx' } }, async ($, e, next) => {
    const s = await read($, snap)
    if (s === null || s.max === 0) return next(e)
    return drawBar($.ui.resolve(e), s)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const s = await read($, snap)
    if (e.props.hasSurvey || s === null || s.max === 0) return next(e)

    return drawBar($.ui.resolve(e), s)
  })
}
