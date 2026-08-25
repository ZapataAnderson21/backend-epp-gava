import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UploadedFile,
  UseInterceptors,
  ParseIntPipe,
  NotFoundException,
  Res,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join, resolve } from 'path';
import { EmergencyService } from './emergency.service';
import { UpdateEmergencyDto } from './dto/update-emergency.dto';
import { Response } from 'express';
import * as fs from 'fs';
import 'dotenv/config';
import { ListEmergenciesQueryDto } from './dto/list-emergencies-query.dto';

const EMERGENCIES_UPLOAD_DIR =
  process.env.EMERGENCIES_UPLOAD_DIR || './uploads/emergencies';

@Controller('emergency')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: EMERGENCIES_UPLOAD_DIR,
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024, // Máximo 5MB
      },
    }),
  )
  async create(@UploadedFile() file: any, @Body() body: any) {
    return await this.emergencyService.create({
      title: body.title,
      description: body.description,
      userId: Number(body.userId),
      projectId: Number(body.projectId),
      image: file.filename,
    });
  }

  @Get()
  async findAll(
    @Query('projectId', new ParseIntPipe({ optional: true }))
    projectId?: number,
    @Query('userId', new ParseIntPipe({ optional: true })) userId?: number,
  ) {
    return await this.emergencyService.findAll(projectId, userId);
  }

  @Get('paginated')
  async findPaginated(@Query() query: ListEmergenciesQueryDto) {
    return await this.emergencyService.findPaginated(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.emergencyService.findOne(+id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEmergencyDto: UpdateEmergencyDto,
  ) {
    return await this.emergencyService.update(id, updateEmergencyDto);
  }

  @Get('image/:filename')
  async getImage(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = resolve(join(EMERGENCIES_UPLOAD_DIR, filename));

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Image not found');
    }

    return res.sendFile(filePath);
  }
}
