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
  BadRequestException,
  Res,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { basename, join, resolve, sep } from 'path';
import { EmergencyService } from './emergency.service';
import { UpdateEmergencyDto } from './dto/update-emergency.dto';
import { Response } from 'express';
import * as fs from 'fs';
import 'dotenv/config';
import { ListEmergenciesQueryDto } from './dto/list-emergencies-query.dto';
import { CreateEmergencyUploadDto } from './dto/create-emergency-upload.dto';
import { GetUser } from 'src/decorators/get-user.decorator';
import { randomUUID } from 'crypto';

const EMERGENCIES_UPLOAD_DIR =
  process.env.EMERGENCIES_UPLOAD_DIR || './uploads/emergencies';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function detectImageExtension(
  buffer: Buffer,
): '.jpg' | '.png' | '.webp' | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  )
    return '.jpg';
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return '.png';
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return '.webp';
  return null;
}

@Controller('emergency')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          fs.mkdirSync(EMERGENCIES_UPLOAD_DIR, { recursive: true });
          cb(null, EMERGENCIES_UPLOAD_DIR);
        },
        filename: (_req, _file, cb) => cb(null, `${randomUUID()}.upload`),
      }),
      limits: {
        fileSize: 5 * 1024 * 1024, // Máximo 5MB
      },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
          return cb(
            new BadRequestException(
              'Solo se permiten imágenes JPG, PNG o WebP.',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateEmergencyUploadDto,
    @GetUser('userId') userId: number,
  ) {
    if (!file)
      throw new BadRequestException('La imagen de evidencia es obligatoria.');

    let finalPath: string | null = null;
    try {
      const signature = fs.readFileSync(file.path).subarray(0, 16);
      const extension = detectImageExtension(signature);
      if (!extension) {
        throw new BadRequestException(
          'El contenido del archivo no es una imagen válida.',
        );
      }
      const finalFilename = `${randomUUID()}${extension}`;
      finalPath = join(EMERGENCIES_UPLOAD_DIR, finalFilename);
      fs.renameSync(file.path, finalPath);

      return await this.emergencyService.create({
        title: body.title,
        description: body.description,
        userId,
        projectId: body.projectId,
        image: finalFilename,
      });
    } catch (error) {
      for (const candidate of [file.path, finalPath]) {
        if (candidate && fs.existsSync(candidate)) fs.unlinkSync(candidate);
      }
      throw error;
    }
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

  @Get('image/:filename')
  getImage(@Param('filename') filename: string, @Res() res: Response) {
    if (
      filename !== basename(filename) ||
      !/^[a-f0-9-]+\.(?:jpg|png|webp)$/i.test(filename)
    ) {
      throw new NotFoundException('Image not found');
    }
    const uploadRoot = resolve(EMERGENCIES_UPLOAD_DIR);
    const filePath = resolve(uploadRoot, filename);

    if (
      !filePath.startsWith(`${uploadRoot}${sep}`) ||
      !fs.existsSync(filePath)
    ) {
      throw new NotFoundException('Image not found');
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.sendFile(filePath);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.emergencyService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEmergencyDto: UpdateEmergencyDto,
  ) {
    return await this.emergencyService.update(id, updateEmergencyDto);
  }
}
