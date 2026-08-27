import type { EventHandler } from '@forge/spec';

export class PluginBus {
  private handlers = new Map<string, Set<EventHandler>>();

  emit(event: string, payload: unknown): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        const result = handler(payload);
        if (result instanceof Promise) {
          result.catch(() => {});
        }
      } catch {
        // swallow handler errors
      }
    }
  }

  on(event: string, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  once(event: string, handler: EventHandler): void {
    const wrapped: EventHandler = (payload) => {
      this.off(event, wrapped);
      return handler(payload);
    };
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(wrapped);
  }

  off(event: string, handler: EventHandler): void {
    const set = this.handlers.get(event);
    if (!set) return;
    set.delete(handler);
  }
}
