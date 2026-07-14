import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { UserTypes } from 'src/decorators/user-types.decorator';
import { CreateExpiringDocumentCategoryDto } from './dto/create-expiring-document-category.dto';
import { CreateExpiringDocumentDto } from './dto/create-expiring-document.dto';
import { ListExpiringDocumentsQueryDto } from './dto/list-expiring-documents-query.dto';
import { UpdateExpiringDocumentCategoryDto } from './dto/update-expiring-document-category.dto';
import { UpdateExpiringDocumentDto } from './dto/update-expiring-document.dto';
import { ExpiringDocumentService } from './expiring-document.service';

const DOCUMENT_ROLES = [
  'GERENTE',
  'ADMINISTRADORA',
  'LOGISTICA',
  'PREVENCIONISTA DE RIESGOS',
] as const;

@Controller('expiring-documents')
@UserTypes(...DOCUMENT_ROLES)
export class ExpiringDocumentController {
  constructor(private readonly service: ExpiringDocumentService) {}

  private userId(req: Request) {
    return Number((req.user as { userId: number }).userId);
  }

  @Post('categories')
  createCategory(@Body() dto: CreateExpiringDocumentCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Get('categories')
  listCategories(@Query('includeDeleted') includeDeleted?: string) {
    return this.service.listCategories(includeDeleted === 'true');
  }

  @Patch('categories/:categoryId')
  updateCategory(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Body() dto: UpdateExpiringDocumentCategoryDto,
  ) {
    return this.service.updateCategory(categoryId, dto);
  }

  @Delete('categories/:categoryId')
  deleteCategory(@Param('categoryId', ParseIntPipe) categoryId: number) {
    return this.service.deleteCategory(categoryId);
  }

  @Post('categories/:categoryId/restore')
  restoreCategory(@Param('categoryId', ParseIntPipe) categoryId: number) {
    return this.service.restoreCategory(categoryId);
  }

  @Get('dashboard')
  dashboard(
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.service.dashboard(
      month ? Number(month) : undefined,
      year ? Number(year) : undefined,
      categoryId ? Number(categoryId) : undefined,
    );
  }

  @Post()
  createDocument(@Body() dto: CreateExpiringDocumentDto, @Req() req: Request) {
    return this.service.createDocument(dto, this.userId(req));
  }

  @Get()
  listDocuments(@Query() query: ListExpiringDocumentsQueryDto) {
    return this.service.listDocuments(query);
  }

  @Get(':documentId/history')
  history(@Param('documentId', ParseIntPipe) documentId: number) {
    return this.service.getHistory(documentId);
  }

  @Get(':documentId')
  getDocument(@Param('documentId', ParseIntPipe) documentId: number) {
    return this.service.getDocument(documentId);
  }

  @Patch(':documentId')
  updateDocument(
    @Param('documentId', ParseIntPipe) documentId: number,
    @Body() dto: UpdateExpiringDocumentDto,
    @Req() req: Request,
  ) {
    return this.service.updateDocument(documentId, dto, this.userId(req));
  }

  @Delete(':documentId')
  deleteDocument(
    @Param('documentId', ParseIntPipe) documentId: number,
    @Req() req: Request,
  ) {
    return this.service.deleteDocument(documentId, this.userId(req));
  }

  @Post(':documentId/restore')
  restoreDocument(
    @Param('documentId', ParseIntPipe) documentId: number,
    @Req() req: Request,
  ) {
    return this.service.restoreDocument(documentId, this.userId(req));
  }
}
