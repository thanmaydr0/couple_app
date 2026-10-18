export type FeatureId = 'vault';
export type VaultKind = 'photo' | 'video' | 'note';
export type VaultVisibility = 'both' | 'owner';
export type VaultCipher = {
  v: 1;
  visibility: VaultVisibility;
  mime?: string;
  payload?: { nonce: string; ciphertext: string };
  wrappedKey: unknown;
};
export type VaultItem = {
  id: string;
  couple_id: string;
  owner_id: string;
  kind: VaultKind;
  enc: VaultCipher;
  storage_path: string | null;
  created_at: string;
  deleted_at: string | null;
};
export type DecryptedItem = VaultItem & { note?: string; localUri?: string };
