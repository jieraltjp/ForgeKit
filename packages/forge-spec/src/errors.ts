export const ForgeErrors = {
  PLUGIN_INIT_FAILED: 'FORGE001',
  PLUGIN_START_FAILED: 'FORGE002',
  PLUGIN_STOP_FAILED: 'FORGE003',
  PLUGIN_NOT_FOUND: 'FORGE004',
  PLUGIN_DEP_MISSING: 'FORGE005',
  PLUGIN_DEP_CYCLE: 'FORGE006',
  PLUGIN_LOAD_FAILED: 'FORGE007',
  PLUGIN_HEALTH_FAILED: 'FORGE008',
  BUS_EMIT_FAILED: 'FORGE009',
  ROUTE_ALREADY_REGISTERED: 'FORGE010',
  ROUTE_NOT_FOUND: 'FORGE011',
  CONFIG_KEY_NOT_FOUND: 'FORGE012',
  CONFIG_INVALID_TYPE: 'FORGE013',
} as const;

export type ForgeErrorCode = typeof ForgeErrors[keyof typeof ForgeErrors];

export class ForgeError extends Error {
  constructor(
    public readonly code: ForgeErrorCode,
    message: string,
    public readonly plugin?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ForgeError';
  }
}
