/**
 * Supabase configuration module.
 *
 * Credentials can be supplied via:
 * 1. Vite / bundler environment variables: VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY
 * 2. Root .env file (automatically parsed if present)
 * 3. Explicit values in this file below
 * 4. In-app Settings UI (stored in browser localStorage)
 */

// Read from Vite / bundler / Node / global environment if present
const metaEnv = (typeof import.meta !== 'undefined' && import.meta.env) || {};
const procEnv = (typeof process !== 'undefined' && process.env) || {};
const winEnv = (typeof window !== 'undefined' && window.__ENV__) || {};

export const CONFIG = {
  SUPABASE_URL: metaEnv.VITE_SUPABASE_URL || procEnv.VITE_SUPABASE_URL || procEnv.SUPABASE_URL || winEnv.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: metaEnv.VITE_SUPABASE_ANON_KEY || procEnv.VITE_SUPABASE_ANON_KEY || procEnv.SUPABASE_ANON_KEY || winEnv.VITE_SUPABASE_ANON_KEY || '',
};

/**
 * Parses simple KEY=VALUE text from a .env file.
 */
function parseEnv(text) {
  const vars = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      vars[key] = val;
    }
  }
  return vars;
}

/**
 * Asynchronously loads .env file if credentials are not already set.
 */
export async function loadEnvConfig() {
  if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
    return CONFIG;
  }
  if (typeof fetch === 'function') {
    try {
      const res = await fetch('/.env', { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        const parsed = parseEnv(text);
        if (!CONFIG.SUPABASE_URL && (parsed.VITE_SUPABASE_URL || parsed.SUPABASE_URL)) {
          CONFIG.SUPABASE_URL = parsed.VITE_SUPABASE_URL || parsed.SUPABASE_URL || '';
        }
        if (!CONFIG.SUPABASE_ANON_KEY && (parsed.VITE_SUPABASE_ANON_KEY || parsed.SUPABASE_ANON_KEY)) {
          CONFIG.SUPABASE_ANON_KEY = parsed.VITE_SUPABASE_ANON_KEY || parsed.SUPABASE_ANON_KEY || '';
        }
      }
    } catch {
      // Ignore if .env is unreachable or blocked
    }
  }
  return CONFIG;
}
