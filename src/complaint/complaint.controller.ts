import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { ComplaintService } from './complaint.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';

@Controller('complaint')
export class ComplaintController {
  constructor(private readonly complaintService: ComplaintService) {}

  private userId(req: Request) {
    return Number((req.user as { userId: number }).userId);
  }

  @Post()
  create(@Body() dto: CreateComplaintDto, @Req() req: Request) {
    return this.complaintService.create(dto, this.userId(req));
  }

  @Get()
  findVisible(@Req() req: Request) {
    return this.complaintService.findVisibleToUser(this.userId(req));
  }
}
