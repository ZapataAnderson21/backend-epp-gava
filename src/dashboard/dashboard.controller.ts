import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from 'src/user/jwt/jwt-strategy';
import { DashboardQueryDto } from './dashboard-query.dto';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('general')
  findGeneral(@Query() query: DashboardQueryDto, @Req() request: Request) {
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) throw new UnauthorizedException();
    return this.service.findGeneral(query, user.userId);
  }
}
