/** Collect all unique mediaIds from a list of reels (video, thumbnail, author avatar) */
export function collectMediaIds(reels: any[]): string[] {
  const ids = new Set<string>();
  for (const r of reels) {
    if (r.videoMediaId) ids.add(r.videoMediaId);
    if (r.thumbnailMediaId && r.thumbnailMediaId !== r.videoMediaId) ids.add(r.thumbnailMediaId);
    if (r.author?.avatarMediaId) ids.add(r.author.avatarMediaId);
  }
  return [...ids];
}
