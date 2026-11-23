import { ApiError, hash, json, randomToken } from './http'
import { displayName } from '../src/shared/multiplayer'
import type { SessionUser } from '../src/shared/multiplayer'
import type { Env } from './types'

const DAY = 86_400_000
const IDLE = 30 * 60_000
const MAX_AGE = 7 * DAY
type Legacy = { user: SessionUser; expiresAt: number }
type Session = {
  id: string
  username: string
  nickname: string
  started: number
  seen: number
  deadline: number
}

function retention(value: string | undefined, fallback: number) {
  const days = value === undefined ? fallback : Number(value)
  return (
    (Number.isInteger(days) && days >= 0 && days <= 365 ? days : fallback) * DAY
  )
}

export function visitorMetadata(request: Request, consent: boolean) {
  if (!consent || request.headers.get('Sec-GPC') === '1') return {}
  const ua = request.headers.get('User-Agent') ?? ''
  const os = /iPhone|iPad|iPod/i.test(ua)
    ? 'iOS'
    : /Android/i.test(ua)
      ? 'Android'
      : /Windows/i.test(ua)
        ? 'Windows'
        : /Macintosh/i.test(ua)
          ? 'macOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Other'
  const browser = /Edg(?:e|A|iOS)?\//i.test(ua)
    ? 'Edge'
    : /Firefox|FxiOS/i.test(ua)
      ? 'Firefox'
      : /Chrome|CriOS/i.test(ua)
        ? 'Chrome'
        : /Safari/i.test(ua)
          ? 'Safari'
          : 'Other'
  const device =
    /iPad|Tablet/i.test(ua) || (os === 'Android' && !/Mobile/i.test(ua))
      ? 'Tablet'
      : /Mobile|iPhone|iPod/i.test(ua)
        ? 'Mobile'
        : ua
          ? 'Desktop'
          : 'Other'
  return {
    ip: request.cf ? request.headers.get('CF-Connecting-IP') : null,
    device,
    browser,
    os,
  }
}

function schema(sql: SqlStorage) {
  sql.exec(`CREATE TABLE IF NOT EXISTS guest_accounts (
    token_hash TEXT PRIMARY KEY, id TEXT UNIQUE NOT NULL, username TEXT UNIQUE NOT NULL,
    nickname TEXT NOT NULL, started INTEGER NOT NULL, seen INTEGER NOT NULL, deadline INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS guest_deadline ON guest_accounts(deadline);
    CREATE TABLE IF NOT EXISTS guest_visits (
    id TEXT PRIMARY KEY, username TEXT NOT NULL, started INTEGER NOT NULL, ended INTEGER,
    status TEXT NOT NULL, ip TEXT, ip_until INTEGER, device TEXT, browser TEXT, os TEXT, device_until INTEGER);
    CREATE INDEX IF NOT EXISTS guest_ip_until ON guest_visits(ip_until);
    CREATE INDEX IF NOT EXISTS guest_device_until ON guest_visits(device_until);
    CREATE INDEX IF NOT EXISTS guest_ended ON guest_visits(ended);
    CREATE VIEW IF NOT EXISTS guest_visit_history AS SELECT id, username, started, ended, status,
    max(0,coalesce(ended, min(unixepoch()*1000,(SELECT deadline FROM guest_accounts a WHERE a.id=v.id))) - started) AS duration_ms,
    ip, device, browser, os FROM guest_visits v;`)
}

function expireAccounts(storage: DurableObjectStorage, now: number) {
  const sql = storage.sql
  for (const row of sql
    .exec<{ id: string }>(
      'SELECT id FROM guest_accounts WHERE deadline<=?',
      now,
    )
    .toArray())
    storage.kv.delete('member:' + row.id)
  sql.exec(
    `UPDATE guest_visits SET status='expired', ended=(SELECT deadline FROM guest_accounts a WHERE a.id=guest_visits.id)
    WHERE id IN (SELECT id FROM guest_accounts WHERE deadline<=?)`,
    now,
  )
  sql.exec('DELETE FROM guest_accounts WHERE deadline<=?', now)
}

export function sweepGuestVisits(
  storage: DurableObjectStorage,
  now: number,
  env: Env,
) {
  const sql = storage.sql
  storage.transactionSync(() => {
    expireAccounts(storage, now)
    sql.exec(
      'UPDATE guest_visits SET ip=NULL, ip_until=NULL WHERE ip_until<=?',
      now,
    )
    sql.exec(
      'UPDATE guest_visits SET device=NULL,browser=NULL,os=NULL,device_until=NULL WHERE device_until<=?',
      now,
    )
    sql.exec(
      'DELETE FROM guest_visits WHERE ended<=?',
      now - retention(env.GUEST_HISTORY_DAYS, 90),
    )
  })
  // Keep an alarm only while there is data to expire.
  const { deadline } = sql
    .exec<{ deadline: number | null }>(
      `SELECT min(t) AS deadline FROM (
    SELECT min(deadline) t FROM guest_accounts UNION ALL SELECT min(ip_until) FROM guest_visits
    UNION ALL SELECT min(device_until) FROM guest_visits UNION ALL SELECT min(ended)+? FROM guest_visits)`,
      retention(env.GUEST_HISTORY_DAYS, 90),
    )
    .one()
  // Pre-upgrade session keys all reach their original seven-day expiry. Drain in bounded batches.
  let legacyNext = Infinity
  const rollout = storage.kv.get<number>('guest-legacy-cleanup')
  if (rollout !== undefined && now >= rollout) {
    const keys = [...storage.kv.list({ prefix: 'session:', limit: 100 })]
    for (const [key] of keys) storage.kv.delete(key)
    if (keys.length === 100) legacyNext = now + 1000
    else storage.kv.delete('guest-legacy-cleanup')
  } else if (rollout !== undefined) legacyNext = rollout
  return Math.min(deadline ?? Infinity, legacyNext)
}

function username(sql: SqlStorage) {
  const start = 10000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 90000)
  const candidate = 'guest' + start
  if (
    !sql
      .exec('SELECT 1 FROM guest_accounts WHERE username=?', candidate)
      .toArray().length
  )
    return candidate
  // Find the first gap even when almost all 90,000 names are occupied.
  const gap = sql
    .exec<{ name: string }>(
      `SELECT name FROM (
    SELECT 'guest10000' AS name UNION ALL SELECT 'guest'||(CAST(substr(username,6) AS INTEGER)+1) FROM guest_accounts
    WHERE username<'guest99999') WHERE NOT EXISTS (SELECT 1 FROM guest_accounts WHERE username=name) LIMIT 1`,
    )
    .toArray()[0]
  if (!gap)
    throw new ApiError(
      503,
      'All guest usernames are in use. Please try again later.',
    )
  return gap.name
}

function summary(sql: SqlStorage, now: number) {
  const counts = sql
    .exec(
      `SELECT count(*) totalVisits,count(DISTINCT id) uniqueSessions,
    count(CASE WHEN status='active' THEN 1 END) activeGuests FROM guest_visits`,
    )
    .one()
  const grouped = (expression: string) =>
    sql
      .exec(
        `SELECT ${expression} value,count(*) visits
    FROM guest_visits GROUP BY 1 ORDER BY 1`,
      )
      .toArray()
  return {
    ...counts,
    asOf: new Date(now).toISOString(),
    byDate: grouped("date(started/1000,'unixepoch')"),
    byDevice: grouped("coalesce(device,'Unknown')"),
    byBrowser: grouped("coalesce(browser,'Unknown')"),
    byOS: grouped("coalesce(os,'Unknown')"),
  }
}

export async function guestOperation(
  storage: DurableObjectStorage,
  env: Env,
  path: string,
  data: Record<string, unknown>,
) {
  const token =
    typeof data.token === 'string' && /^[a-f0-9]{64}$/.test(data.token)
      ? data.token
      : ''
  if (!token && (path === '/session' || path === '/logout')) return json(null)
  const previous = token ? await hash(token) : ''
  const freshToken = path === '/guest' ? randomToken() : ''
  const freshHash = freshToken ? await hash(freshToken) : ''
  const sql = storage.sql,
    now = Date.now()
  if (!storage.kv.get('guest-schema')) {
    schema(sql)
    storage.kv.put('guest-legacy-cleanup', now + MAX_AGE)
    storage.kv.put('guest-schema', true)
  }
  // Arm before writing. An interrupted request cannot strand private data without a cleanup alarm.
  const alarm = await storage.getAlarm()
  if (alarm === null || alarm > now + IDLE) await storage.setAlarm(now + IDLE)
  if (path === '/guest-stats') {
    sweepGuestVisits(storage, now, env)
    return json(summary(sql, now))
  }
  return storage.transactionSync(() => {
    let row = previous
      ? sql
          .exec<Session>(
            'SELECT * FROM guest_accounts WHERE token_hash=?',
            previous,
          )
          .toArray()[0]
      : undefined
    if (row && row.deadline <= now) {
      expireAccounts(storage, now)
      row = undefined
    }
    const legacyKey = 'session:' + previous
    const legacy =
      previous && !row ? storage.kv.get<Legacy>(legacyKey) : undefined
    if (legacy) storage.kv.delete(legacyKey)
    const restore = legacy && legacy.expiresAt > now ? legacy : undefined
    let issued = ''
    if (!row && (path === '/guest' || restore)) {
      expireAccounts(storage, now)
      const handle = username(sql)
      let nickname = restore?.user.player.displayName || handle
      if (!restore && data.displayName) {
        try {
          nickname = displayName(data.displayName)
        } catch {
          throw new ApiError(
            400,
            'Enter a valid guest display name or leave it blank.',
          )
        }
      }
      const id = restore?.user.player.id ?? 'guest:' + crypto.randomUUID()
      const started = restore ? Date.parse(restore.user.createdAt) : now
      const deadline = Math.min(now + IDLE, restore?.expiresAt ?? now + MAX_AGE)
      row = { id, username: handle, nickname, started, seen: now, deadline }
      issued = restore ? '' : freshToken
      sql.exec(
        'INSERT INTO guest_accounts VALUES (?,?,?,?,?,?,?)',
        restore ? previous : freshHash,
        id,
        handle,
        nickname,
        started,
        now,
        deadline,
      )
      const ipAge = retention(env.GUEST_IP_DAYS, 1),
        deviceAge = retention(env.GUEST_DEVICE_DAYS, 30)
      const ip =
        !restore && ipAge && typeof data.ip === 'string' ? data.ip : null
      const device =
        !restore && deviceAge && typeof data.device === 'string'
          ? data.device
          : null
      sql.exec(
        'INSERT INTO guest_visits VALUES (?,?,?,NULL,?,?,?,?,?,?,?)',
        id,
        handle,
        started,
        'active',
        ip,
        ip ? now + ipAge : null,
        device,
        device ? String(data.browser) : null,
        device ? String(data.os) : null,
        device ? now + deviceAge : null,
      )
    }
    if (!row) return json(null)
    if (path === '/logout') {
      sql.exec(
        "UPDATE guest_visits SET status='logged_out',ended=? WHERE id=?",
        now,
        row.id,
      )
      sql.exec('DELETE FROM guest_accounts WHERE id=?', row.id)
      storage.kv.delete('member:' + row.id)
      if (!retention(env.GUEST_HISTORY_DAYS, 90))
        sql.exec('DELETE FROM guest_visits WHERE id=?', row.id)
      return json(null)
    }
    if (!data.observe) {
      row.seen = now
      row.deadline = Math.min(row.started + MAX_AGE, now + IDLE)
      sql.exec(
        'UPDATE guest_accounts SET seen=?,deadline=? WHERE id=?',
        now,
        row.deadline,
        row.id,
      )
    }
    const user: SessionUser = {
      player: {
        id: row.id,
        username: row.username,
        displayName: row.nickname,
        avatarUrl: null,
        accountType: 'guest',
      },
      email: null,
      createdAt: new Date(row.started).toISOString(),
      lastActiveAt: new Date(row.seen).toISOString(),
    }
    return json({
      user,
      expiresAt: row.deadline,
      ...(issued ? { token: issued } : {}),
    })
  })
}
