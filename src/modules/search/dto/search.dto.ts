import { IsString, IsOptional, IsEnum, MinLength, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SearchType {
  ALL = 'all',
  USERS = 'users',
  POSTS = 'posts',
  REELS = 'reels',
  VIDEOS = 'videos',
  NOVELS = 'novels',
  GROUPS = 'groups',
  HASHTAGS = 'hashtags',
}

export class SearchQueryDto {
  @ApiProperty({ description: 'Từ khóa tìm kiếm' })
  @IsString()
  @MinLength(1)
  q!: string;

  @ApiPropertyOptional({ enum: SearchType, default: SearchType.ALL })
  @IsOptional()
  @IsEnum(SearchType)
  type?: SearchType = SearchType.ALL;

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
