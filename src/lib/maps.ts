// Expo inlines this public URL at bundle time. No provider key or fallback is bundled.
// Features must show a configuration/empty state when the URL is not supplied.
export const mapStyleUrl = process.env.EXPO_PUBLIC_MAP_STYLE_URL?.trim() || undefined;
