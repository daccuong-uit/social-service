import { Injectable } from '@nestjs/common';
import { createLogger } from '@platform/logger';

const logger = createLogger({ service: 'social-service:media-resolver' });

export interface MediaAccessUrls {
  original: string | null;
  thumbnail: string | null;
  hls: string | null;
}

/**
 * Resolves mediaIds to actual presigned access URLs by calling the Media Service.
 * Social Service NEVER accesses MinIO or Media DB directly.
 */
@Injectable()
export class MediaResolverService {
  private readonly mediaServiceUrl: string;

  constructor() {
    this.mediaServiceUrl = process.env.MEDIA_SERVICE_URL || 'http://localhost:3003';
  }

  /**
   * Fetch access URLs for a single mediaId.
   * Returns null values if the media is not ready or request fails.
   */
  async resolveOne(mediaId: string | null | undefined): Promise<MediaAccessUrls> {
    if (!mediaId) return { original: null, thumbnail: null, hls: null };
    try {
      const res = await fetch(`${this.mediaServiceUrl}/media/${mediaId}/access`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return { original: null, thumbnail: null, hls: null };
      return await res.json() as MediaAccessUrls;
    } catch (e) {
      logger.warn(`Failed to resolve mediaId ${mediaId}`, { error: String(e) });
      return { original: null, thumbnail: null, hls: null };
    }
  }

  /**
   * Batch-resolve multiple mediaIds in parallel.
   * Returns a map of mediaId → access URLs.
   */
  async resolveBatch(mediaIds: (string | null | undefined)[]): Promise<Record<string, MediaAccessUrls>> {
    const unique = [...new Set(mediaIds.filter(Boolean))] as string[];
    if (unique.length === 0) return {};

    const results = await Promise.all(
      unique.map(async (id) => ({ id, urls: await this.resolveOne(id) }))
    );

    return results.reduce((acc, { id, urls }) => {
      acc[id] = urls;
      return acc;
    }, {} as Record<string, MediaAccessUrls>);
  }
}
