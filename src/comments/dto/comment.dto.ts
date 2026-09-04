import { IsString, IsOptional, IsUUID, MinLength, MaxLength, IsInt, Min, Max, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class MentionRangeDto {
  @ApiProperty({ description: 'ID user được tag' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ description: 'Vị trí bắt đầu của mention trong content' })
  @IsInt()
  @Min(0)
  start!: number;

  @ApiProperty({ description: 'Vị trí kết thúc của mention trong content' })
  @IsInt()
  @Min(0)
  end!: number;
}

export class CreateCommentDto {
  @ApiProperty({ example: 'Bài viết hay quá! 🔥' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  @ApiPropertyOptional({ description: 'Parent comment ID khi reply' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Danh sách userId được tag trong comment', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  mentionedUserIds?: string[];

  @ApiPropertyOptional({ description: 'Danh sách vùng mention trong content', type: [MentionRangeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MentionRangeDto)
  mentionRanges?: MentionRangeDto[];
}

export class UpdateCommentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}

export class ReportDto {
  @ApiProperty({ enum: ['spam', 'harassment', 'hate_speech', 'violence', 'nudity', 'other'] })
  @IsString()
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class PaginationQueryDto {
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
