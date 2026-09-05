import { IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BookmarkTarget {
  POST = 'post',
  REEL = 'reel',
  VIDEO = 'video',
  NOVEL = 'novel',
}

export class AddBookmarkDto {
  @ApiProperty()
  targetId!: string;

  @ApiProperty({ enum: BookmarkTarget })
  @IsEnum(BookmarkTarget)
  targetType!: BookmarkTarget;
}

export class RemoveBookmarkDto {
  @ApiProperty()
  targetId!: string;

  @ApiProperty({ enum: BookmarkTarget })
  @IsEnum(BookmarkTarget)
  targetType!: BookmarkTarget;
}

export class BookmarksQueryDto {
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

  @ApiPropertyOptional({ enum: BookmarkTarget })
  @IsOptional()
  @IsEnum(BookmarkTarget)
  type?: BookmarkTarget;
}
