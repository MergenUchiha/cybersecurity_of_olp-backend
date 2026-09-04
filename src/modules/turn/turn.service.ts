import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import { loadEnv } from '../../config/env.validation';

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface IceConfig {
  iceServers: IceServer[];
  /** Seconds the returned credentials stay valid. */
  ttl: number;
}

export interface IceConfigOptions {
  /** Comma-separated STUN URLs. */
  stunUrls: string;
  /** Host and port of the relay, or empty to run on STUN alone. */
  turnHost?: string;
  /** Shared secret, matching coturn's `static-auth-secret`. */
  turnSecret?: string;
  ttlSeconds: number;
  userId: string;
}

/**
 * Builds the ICE configuration a browser needs to place a call.
 *
 * TURN credentials have to reach the browser to be usable, so the only thing
 * that helps is making them short-lived. coturn's `use-auth-secret` mode does
 * exactly that: the username is an expiry timestamp, the password is an HMAC
 * of that username under a secret only the servers know. coturn recomputes
 * the HMAC to check it, so nothing is stored on either side and a leaked pair
 * stops working once the timestamp passes.
 *
 * Configure the relay with:
 *   use-auth-secret
 *   static-auth-secret=<the same TURN_STATIC_AUTH_SECRET>
 *   realm=<your domain>
 *
 * Kept as a plain function so the credential can be checked without standing
 * up the application.
 */
export function buildIceConfig(options: IceConfigOptions): IceConfig {
  const iceServers: IceServer[] = [
    {
      urls: options.stunUrls
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean),
    },
  ];

  // Without a relay the call still works between peers that can reach each
  // other directly; it is symmetric NAT that needs TURN.
  if (options.turnHost && options.turnSecret) {
    const expiresAt = Math.floor(Date.now() / 1000) + options.ttlSeconds;
    const username = `${expiresAt}:${options.userId}`;

    iceServers.push({
      urls: [
        `turn:${options.turnHost}`,
        `turn:${options.turnHost}?transport=tcp`,
      ],
      username,
      credential: createHmac('sha1', options.turnSecret)
        .update(username)
        .digest('base64'),
    });
  }

  return { iceServers, ttl: options.ttlSeconds };
}

@Injectable()
export class TurnService {
  getIceConfig(userId: string): IceConfig {
    const env = loadEnv();

    return buildIceConfig({
      stunUrls: env.STUN_URLS,
      turnHost: env.TURN_HOST,
      turnSecret: env.TURN_STATIC_AUTH_SECRET,
      ttlSeconds: env.TURN_TTL_SECONDS,
      userId,
    });
  }
}
