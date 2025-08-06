import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus, HttpException, UploadedFile, UseInterceptors } from '@nestjs/common';
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
      destination: '../../../output/emergencies', // carpeta donde se guarda
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
    try {
      const imagePath = `uploads/emergencies/${file.filename}`;

      const emergency = await this.emergencyService.create({
        title: body.title,
        description: body.description,
        user_id: Number(body.user_id),
        project_id: Number(body.project_id),
        image: imagePath
      });

      return {
        statusCode: HttpStatus.CREATED,
        message: 'Emergency created successfully.',
        data: emergency
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error.',
        error: error.message
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  @ApiResponse({ status: HttpStatus.OK, description: 'List of all emergencies.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No emergencies found.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access.' })
  async findAll() {
    try{
      const emergencies = await this.emergencyService.findAll();

      if (!emergencies || emergencies.length === 0) {
        return { 
          statusCode: HttpStatus.NOT_FOUND, 
          message: 'No emergencies found.',
          data: [] 
        };
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'List of all emergencies.',
        data: emergencies
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error.',
        error: error.message
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  @ApiResponse({ status: HttpStatus.OK, description: 'Emergency found.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Emergency not found.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access.' })
  async findOne(@Param('id') id: string) {
    try{
      const emergency = await this.emergencyService.findOne(+id);

      if (!emergency) {
        return { 
          statusCode: HttpStatus.NOT_FOUND, 
          message: 'Emergency not found.' 
        };
      }

      return { 
        statusCode: HttpStatus.OK,
        message: 'Emergency found.',
        data: emergency
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve emergency.',
        error: error.message || 'Internal server error.'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch(':id')
  @ApiBody({ type: UpdateEmergencyDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Emergency updated successfully.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Emergency not found.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access.' })
  async update(@Param('id') id: string, @Body() updateEmergencyDto: UpdateEmergencyDto) {
    try {
      const updatedEmergency = await this.emergencyService.update(+id, updateEmergencyDto);

      if (!updatedEmergency) {
        throw new HttpException('Emergency not found.', HttpStatus.NOT_FOUND);
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Emergency updated successfully.',
        data: updatedEmergency
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to update emergency.',
        error: error.message || 'Internal server error.'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('project/:project_id')
  @ApiResponse({ status: HttpStatus.OK, description: 'List of emergencies for the project.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No emergencies found for the project.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access.' })
  async getAllByProjectId(@Param('project_id') project_id: string) {
    try {
      const emergencies = await this.emergencyService.getAllByProjectId(+project_id);

      if (!emergencies || emergencies.length === 0) {
        throw new HttpException('No emergencies found for the project.', HttpStatus.NOT_FOUND);
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'List of emergencies for the project.',
        data: emergencies
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve emergencies for the project.',
        error: error.message || 'Internal server error.'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('user/:user_id')
  @ApiResponse({ status: HttpStatus.OK, description: 'List of emergencies for the user.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No emergencies found for the user.' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Internal server error.' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access.' })
  async getAllByUserId(@Param('user_id') user_id: string) {
    try {
      const emergencies = await this.emergencyService.getAllByUserId(+user_id);

      if (!emergencies || emergencies.length === 0) {
        throw new HttpException('No emergencies found for the user.', HttpStatus.NOT_FOUND);
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'List of emergencies for the user.',
        data: emergencies
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve emergencies for the user.',
        error: error.message || 'Internal server error.'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}