import { Global, Module } from '@nestjs/common';
import { MediaResolverService } from '../services/media-resolver.service';

@Global()
@Module({
  providers: [MediaResolverService],
  exports: [MediaResolverService],
})
export class MediaResolverModule {}
