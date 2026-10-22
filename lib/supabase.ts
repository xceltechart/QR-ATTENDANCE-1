import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Expo SecureStore limits individual values to 2048 bytes.
const SECURE_STORE_CHUNK_SIZE = 1800;

type SecureStoreManifest = {
  generation: string;
  chunkCount: number;
};

function splitIntoChunks(value: string): string[] {
  const chunks: string[] = [];
  let chunk = '';
  let chunkBytes = 0;

  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    const characterBytes =
      codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;

    if (chunk && chunkBytes + characterBytes > SECURE_STORE_CHUNK_SIZE) {
      chunks.push(chunk);
      chunk = '';
      chunkBytes = 0;
    }

    chunk += character;
    chunkBytes += characterBytes;
  }

  if (chunk || chunks.length === 0) chunks.push(chunk);
  return chunks;
}

function parseManifest(value: string | null, key: string): SecureStoreManifest | null {
  if (value === null) return null;

  let manifest: unknown;
  try {
    manifest = JSON.parse(value);
  } catch {
    throw new Error(`Stored authentication data for "${key}" has an invalid manifest.`);
  }

  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    typeof (manifest as SecureStoreManifest).generation !== 'string' ||
    !Number.isInteger((manifest as SecureStoreManifest).chunkCount) ||
    (manifest as SecureStoreManifest).chunkCount < 1
  ) {
    throw new Error(`Stored authentication data for "${key}" has an invalid manifest.`);
  }

  return manifest as SecureStoreManifest;
}

async function getManifest(key: string): Promise<SecureStoreManifest | null> {
  return parseManifest(
    await SecureStore.getItemAsync(`${key}.chunk-manifest`),
    key
  );
}

async function deleteChunks(key: string, manifest: SecureStoreManifest): Promise<void> {
  await Promise.all(
    Array.from({ length: manifest.chunkCount }, (_, index) =>
      SecureStore.deleteItemAsync(`${key}.chunk.${manifest.generation}.${index}`)
    )
  );
}

const secureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const manifest = await getManifest(key);
    if (!manifest) return SecureStore.getItemAsync(key);

    const chunks = await Promise.all(
      Array.from({ length: manifest.chunkCount }, (_, index) =>
        SecureStore.getItemAsync(`${key}.chunk.${manifest.generation}.${index}`)
      )
    );
    if (chunks.some((chunk) => chunk === null)) {
      throw new Error(`Stored authentication data for "${key}" is incomplete.`);
    }
    return chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const manifestKey = `${key}.chunk-manifest`;
    const pendingKey = `${key}.chunk-pending`;
    const previousManifest = await getManifest(key);
    const pendingManifest = parseManifest(
      await SecureStore.getItemAsync(pendingKey),
      key
    );

    if (pendingManifest && pendingManifest.generation !== previousManifest?.generation) {
      await deleteChunks(key, pendingManifest);
    }
    if (pendingManifest) await SecureStore.deleteItemAsync(pendingKey);

    const chunks = splitIntoChunks(value);
    const generation = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const nextManifest = { generation, chunkCount: chunks.length };
    await SecureStore.setItemAsync(pendingKey, JSON.stringify(nextManifest));
    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(`${key}.chunk.${generation}.${index}`, chunk)
      )
    );
    await SecureStore.setItemAsync(manifestKey, JSON.stringify(nextManifest));
    await SecureStore.deleteItemAsync(pendingKey);

    if (previousManifest) {
      try {
        await deleteChunks(key, previousManifest);
      } catch (error) {
        console.warn('Could not clean up old Supabase session data in SecureStore.', error);
      }
    }
  },

  async removeItem(key: string): Promise<void> {
    const [manifest, pendingManifest] = await Promise.all([
      getManifest(key),
      SecureStore.getItemAsync(`${key}.chunk-pending`).then((value) =>
        parseManifest(value, key)
      ),
    ]);
    const generations = new Map<string, SecureStoreManifest>();
    if (manifest) generations.set(manifest.generation, manifest);
    if (pendingManifest) generations.set(pendingManifest.generation, pendingManifest);

    await Promise.all([...generations.values()].map((entry) => deleteChunks(key, entry)));
    await Promise.all([
      SecureStore.deleteItemAsync(key),
      SecureStore.deleteItemAsync(`${key}.chunk-manifest`),
      SecureStore.deleteItemAsync(`${key}.chunk-pending`),
    ]);
  },
};

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: Platform.OS === 'web' ? undefined : secureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
