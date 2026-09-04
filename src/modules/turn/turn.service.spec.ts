import { createHmac } from 'crypto';
import { buildIceConfig } from './turn.service';

/**
 * The credential is an HMAC that coturn recomputes on its side, so it is
 * either byte-for-byte right or the call silently fails to relay — which is
 * not something reading the code settles.
 */
describe('buildIceConfig', () => {
  const SECRET = 'a-shared-secret-of-at-least-32-characters';

  const withRelay = (
    overrides: Partial<Parameters<typeof buildIceConfig>[0]> = {},
  ) =>
    buildIceConfig({
      stunUrls: 'stun:stun.example:19302',
      turnHost: 'turn.example:3478',
      turnSecret: SECRET,
      ttlSeconds: 3600,
      userId: 'user-1',
      ...overrides,
    });

  const relayOf = (config: ReturnType<typeof buildIceConfig>) =>
    config.iceServers.find((server) => server.username);

  it('signs the username with the shared secret', () => {
    const relay = relayOf(withRelay());

    expect(relay?.credential).toBe(
      createHmac('sha1', SECRET).update(relay!.username!).digest('base64'),
    );
  });

  it('puts an expiry and the user id in the username', () => {
    const before = Math.floor(Date.now() / 1000);
    const config = withRelay({ ttlSeconds: 600, userId: 'user-42' });
    const [expiry, userId] = relayOf(config)!.username!.split(':');

    expect(userId).toBe('user-42');
    expect(Number(expiry)).toBeGreaterThanOrEqual(before + 600);
    expect(Number(expiry)).toBeLessThanOrEqual(before + 601);
    expect(config.ttl).toBe(600);
  });

  it('gives different users different credentials', () => {
    const a = relayOf(withRelay({ userId: 'user-1' }));
    const b = relayOf(withRelay({ userId: 'user-2' }));

    expect(a?.username).not.toBe(b?.username);
    expect(a?.credential).not.toBe(b?.credential);
  });

  it('offers the relay over both UDP and TCP', () => {
    expect(relayOf(withRelay())?.urls).toEqual([
      'turn:turn.example:3478',
      'turn:turn.example:3478?transport=tcp',
    ]);
  });

  it('splits the STUN list and trims it', () => {
    const config = withRelay({ stunUrls: 'stun:a:1, stun:b:2 ,' });

    expect(config.iceServers[0].urls).toEqual(['stun:a:1', 'stun:b:2']);
  });

  it('falls back to STUN alone when no relay is configured', () => {
    const config = buildIceConfig({
      stunUrls: 'stun:stun.example:19302',
      ttlSeconds: 3600,
      userId: 'user-1',
    });

    expect(config.iceServers).toHaveLength(1);
    expect(config.iceServers[0].username).toBeUndefined();
  });

  it('ignores a host without a secret', () => {
    const config = buildIceConfig({
      stunUrls: 'stun:stun.example:19302',
      turnHost: 'turn.example:3478',
      ttlSeconds: 3600,
      userId: 'user-1',
    });

    expect(relayOf(config)).toBeUndefined();
  });
});
