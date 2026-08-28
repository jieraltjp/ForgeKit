import type { ForgePlugin, PluginContext, HealthStatus, RouteHandler } from '@forge/spec';
import { authPluginSpec } from './PluginSpec.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export interface JwtPayload {
  sub: string;      // user id
  username?: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}

export interface AuthPluginConfig {
  'auth.jwtSecret': string;
  'auth.jwtExpiresIn'?: string;
  'auth.jwtAlgorithm'?: string;
}

export class AuthPlugin implements ForgePlugin {
  readonly name = '@forge/auth-plugin';
  readonly version = '0.2.0';
  readonly description = 'JWT-based authentication — sign tokens, verify tokens, middleware guard';
  readonly dependencies: string[] = ['@forge/config-plugin'];
  readonly provides: string[] = ['auth'];
  readonly events: string[] = ['auth:login', 'auth:token-verified', 'auth:error'];
  readonly spec = authPluginSpec;

  private secret = 'change-me-in-production';
  private expiresIn = '7d';
  private algorithm = 'HS256';
  private startTime = 0;

  async init(ctx: PluginContext): Promise<void> {
    this.secret = ctx.config.get<string>('auth.jwtSecret', 'change-me-in-production') ?? 'change-me-in-production';
    this.expiresIn = ctx.config.get<string>('auth.jwtExpiresIn', '7d') ?? '7d';
    this.algorithm = ctx.config.get<string>('auth.jwtAlgorithm', 'HS256') ?? 'HS256';
  }

  async start(): Promise<void> {
    this.startTime = Date.now();
  }

  async stop(): Promise<void> {}

  async healthCheck(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      plugin: this.name,
      version: this.version,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  /** Verify a JWT token, throws on invalid/expired */
  async verify(token: string): Promise<JwtPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(token, this.secret, { algorithms: [this.algorithm as jwt.Algorithm] }, (err, decoded) => {
        if (err) {
          reject(new Error(`JWT verification failed: ${err.message}`));
        } else {
          resolve(decoded as JwtPayload);
        }
      });
    });
  }

  /** Sign a payload into a JWT token */
  sign(payload: JwtPayload, expiresIn?: string): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: expiresIn ?? this.expiresIn,
      algorithm: this.algorithm as jwt.Algorithm,
    });
  }

  /** Returns a RouteHandler that guards routes — reads Authorization: Bearer <token> */
  middleware(): RouteHandler {
    return async (params, body, query, req?: { headers?: Record<string, string> }) => {
      const authHeader = req?.headers?.['authorization'] ?? (body as any)?.headers?.['authorization'] ?? '';

      if (!authHeader.startsWith('Bearer ')) {
        throw Object.assign(new Error('Unauthorized: missing Bearer token'), { statusCode: 401 });
      }

      const token = authHeader.slice(7);
      try {
        const payload = await this.verify(token);
        return { authorized: true, user: payload };
      } catch (e) {
        throw Object.assign(new Error(`Unauthorized: ${(e as Error).message}`), { statusCode: 401 });
      }
    };
  }

  /** Hash a password using bcrypt (cost factor 10) */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /** Verify a password against a bcrypt hash */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

export default function createPlugin(): ForgePlugin {
  return new AuthPlugin();
}
