import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus, HttpException, UploadedFile, UseInterceptors, ParseIntPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { EmergencyService } from './emergency.service';
import { CreateEmergencyDto } from './dto/create-emergency.dto';
import { UpdateEmergencyDto } from './dto/update-emergency.dto';
import { ApiBody, ApiResponse } from '@nestjs/swagger';

@Controller('emergency')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @ApiBody({ type: CreateEmergencyDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Emergency created successfully.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @Post()
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: '/var/www/emergencies',
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
    const imagePath = `/var/www/emergencies/${file.filename}`;

    return await this.emergencyService.create({
      title: body.title,
      description: body.description,
      user_id: Number(body.user_id),
      project_id: Number(body.project_id),
      image: imagePath
    });
  }

  @Get()
  @ApiResponse({ status: HttpStatus.OK, description: 'List of all emergencies.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No emergencies found.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access.' })
  async findAll() {
    return await this.emergencyService.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: HttpStatus.OK, description: 'Emergency found.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Emergency not found.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access.' })
  async findOne(@Param('id') id: string) {
    return await this.emergencyService.findOne(+id);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateEmergencyDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Emergency updated successfully.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Emergency not found.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access.' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateEmergencyDto: UpdateEmergencyDto) {
    return await this.emergencyService.update(id, updateEmergencyDto);
  }

  @Get('project/:project_id')
  @ApiResponse({ status: HttpStatus.OK, description: 'List of emergencies for the project.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No emergencies found for the project.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access.' })
  async getAllByProjectId(@Param('project_id', ParseIntPipe) project_id: number) {
    return await this.emergencyService.getAllByProjectId(project_id);
  }
  
  @Get('user/:user_id')
  @ApiResponse({ status: HttpStatus.OK, description: 'List of emergencies for the user.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No emergencies found for the user.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access.' })
  async getAllByUserId(@Param('user_id') user_id: string) {
    return await this.emergencyService.getAllByUserId(+user_id);
  }
}