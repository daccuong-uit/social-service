import { IsString, IsOptional, IsUrl, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProfileDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty({ example: 'johndoe' })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores' })
  username!: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;

  @ApiPropertyOptional({ example: 'I am a software engineer' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsString()
  @IsOptional()
  avatarMediaId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  coverMediaId?: string;
}
