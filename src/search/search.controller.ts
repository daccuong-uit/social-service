import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Tìm kiếm toàn cục (Global Search)' })
  search(@Query() query: SearchQueryDto, @CurrentUser() userId: string) {
    return this.searchService.search(query, userId);
  }
}
