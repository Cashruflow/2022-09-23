import { test, expect } from 'claude-code/testing'
import { toSnapshot, toText, widths } from './register'

const cat = (name: string, tokens: number, kind: any = 'used') =>
  ({ name, tokens, kind, color: 'x', isDeferred: kind === 'deferred' })

test('groups categories by type and fills the bar', () => {
  const s = toSnapshot({
    categories: [
      cat('System prompt', 16000), cat('System tools', 20000), cat('Skills', 4000),
      cat('MCP tools', 18000), cat('Memory files', 62000), cat('Messages', 44000),
      cat('Free space', 33000, 'free'), cat('Autocompact buffer', 3000, 'buffer'),
      cat('MCP tools (deferred)', 9999, 'deferred'),
    ],
    totalTokens: 164000, rawMaxTokens: 200000,
  } as any)
  const by = Object.fromEntries(s.segments.map(x => [x.key, x.tokens]))
  expect(by).toEqual({ system: 16000, tools: 24000, mcp: 18000, files: 62000, dialog: 44000, free: 36000 })
  expect(widths(s).reduce((a, b) => a + b, 0)).toBe(48)
  expect(toText(s)).toContain('Контекст · 164k / 200k · 82%')
})
