import { Controller, Get, Post, Body, Patch, Param, HttpStatus, UploadedFile, UseInterceptors, ParseIntPipe, NotFoundException, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { EmergencyService } from './emergency.service';
import { CreateEmergencyDto } from './dto/create-emergency.dto';
import { UpdateEmergencyDto } from './dto/update-emergency.dto';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';

@Controller('emergency')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      // destination: '/var/www/emergencies',
      destination: './uploads/emergencies',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      }
    }),
    limits: {
      fileSize: 5 * 1024 * 1024, // Máximo 5MB
    },
  }))
  async create(@UploadedFile() file: any, @Body() body: any) {

    return await this.emergencyService.create({
      title: body.title,
      description: body.description,
      userId: Number(body.userId),
      projectId: Number(body.projectId),
      image: file.filename
    });
  }

  @Get()
  async findAll() {
    return await this.emergencyService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.emergencyService.findOne(+id);
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateEmergencyDto: UpdateEmergencyDto) {
    return await this.emergencyService.update(id, updateEmergencyDto);
  }

  @Get('project/:project_id')
  async getAllByProjectId(@Param('project_id', ParseIntPipe) project_id: number) {
    return await this.emergencyService.getAllByProjectId(project_id);
  }
  
  @Get('user/:user_id')
  async getAllByUserId(@Param('user_id') user_id: string) {
    return await this.emergencyService.getAllByUserId(+user_id);
  }
  
  @Get('image/:filename')
  async getImage(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = join(process.cwd(), 'uploads', 'emergencies', filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Image not found');
    }

    return res.sendFile(filePath);
  }
}