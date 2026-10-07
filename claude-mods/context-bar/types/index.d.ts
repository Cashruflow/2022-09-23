export type Segment = { key: string; label: string; color: string; tokens: number }
export type Snapshot = { used: number; max: number; segments: Segment[] }

declare module 'claude-code' {
  interface PluginState {
    'context-bar': { snap: Snapshot | null }
  }
}
