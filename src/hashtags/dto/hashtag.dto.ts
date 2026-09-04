import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum HashtagContentType {
  POST = 'post',
  REEL = 'reel',
  VIDEO = 'video',
  ALL = 'all',
}

export class HashtagsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 20;
}

export class HashtagContentQueryDto extends HashtagsQueryDto {
  @ApiPropertyOptional({ enum: HashtagContentType, default: HashtagContentType.ALL })
  @IsOptional()
  @IsEnum(HashtagContentType)
  type?: HashtagContentType = HashtagContentType.ALL;
}
