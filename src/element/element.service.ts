import { BadRequestException, ConflictException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateElementDto } from './dto/create-element.dto';
import { UpdateElementDto } from './dto/update-element.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ElementType } from './enum/element-type.enum';

@Injectable()
export class ElementService {

  private readonly logger = new Logger("ElementService");

  constructor(private readonly prismaService: PrismaService) {}

  async create(createElementDto: CreateElementDto){

    this.logger.log('Creating element', JSON.stringify(createElementDto));
    if(!Object.values(ElementType).includes(createElementDto.type)){
      this.logger.error(`Element creation failed: Invalid type specified: ${createElementDto.type}`);
      throw new BadRequestException('Selecciona un tipo válido.');
    }

    this.logger.log(`Checking for existing element with name: ${createElementDto.name}`);
    const existingProject = await this.findByName(createElementDto.name);

    if (existingProject && existingProject.length > 0){
      this.logger.error(`Element creation failed: Element with this name already exists: ${createElementDto.name}`);
      throw new ConflictException('Ya existe un elemento con este nombre.');
    }

    this.logger.log(`Creating element: ${JSON.stringify(createElementDto)}`);
    const element = await this.prismaService.element.create({data: createElementDto})

    if (!element){
      this.logger.error(`Element creation failed: ${JSON.stringify(createElementDto)}`);
      throw new BadRequestException('Element creation failed');
    }

    this.logger.log(`Element created successfully: ${JSON.stringify(element)}`);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'El elemento ha sido creado exitosamente.',
      data: element
    };
  }

  async findAll() {
    this.logger.log('Retrieving all elements');
    const foundElements = await this.prismaService.element.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' }
    });

    if (!foundElements || foundElements.length === 0){
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se han encontrado elementos.',
        data: []
      }
    }

    this.logger.log(`Found ${foundElements.length} elements`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Elementos encontrados exitosamente.',
      data: foundElements
    };
  }

  async findOne(elementId: number) {
    this.logger.log(`Retrieving element with ID: ${elementId}`);
    const foundElement = await this.prismaService.element.findUnique({
      where: {
        elementId,
        deletedAt: null
      }
    })

    if (!foundElement){
      this.logger.warn(`Element with ID ${elementId} not found`);
      throw new NotFoundException('Element not found');
    }

    this.logger.log(`Element with ID ${elementId} retrieved successfully: ${JSON.stringify(foundElement)}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Elemento encontrado exitosamente.',
      data: foundElement
    };
  }

  async findByName(name: string) {
    return await this.prismaService.element.findMany({
      where: { 
        name, 
        deletedAt: null 
      }
    });
  }

  async findAllByType(type: ElementType) {

    this.logger.log(`Retrieving elements with type: ${type}`);
    if (!Object.values(ElementType).includes(type)){
      throw new BadRequestException('Invalid type specified');
    }

    this.logger.log(`Finding elements of type: ${type}`);
    const foundElements = await this.prismaService.element.findMany({
      where: { 
        type,
        deletedAt: null
      } 
    })

    if (!foundElements || foundElements.length === 0){
      this.logger.warn(`No elements found of type: ${type}`);
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: `No se han encontrado elementos de este tipo.`,
        data: []
      };
    }

    this.logger.log(`Found ${foundElements.length} elements of type ${type}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Elementos encontrados exitosamente.',
      data: foundElements
    };
  }

  async update(elementId: number, updateElementDto: UpdateElementDto) {
    this.logger.log(`Updating element with ID: ${elementId}`);

    if (updateElementDto.name) {
      this.logger.log(`Checking for existing element with name: ${updateElementDto.name}`);
      const existingElement = await this.findByName(updateElementDto.name);

      if (existingElement && existingElement.length > 0) {
        const hasConflict = existingElement.some(element => element.elementId !== elementId);
        if (hasConflict) {
          this.logger.error(`Element update failed: Element with name '${updateElementDto.name}' already exists with different ID`);
          throw new ConflictException('Ya existe un elemento con este nombre.');
        }
      }
    }

    const updatedElement = await this.prismaService.element.update({
      where: { elementId },
      data: updateElementDto
    })
    
    if (!updatedElement){
      this.logger.error(`Element update failed: ${JSON.stringify(updateElementDto)}`);
      throw new BadRequestException('Element update failed');
    }

    this.logger.log(`Element updated successfully: ${JSON.stringify(updatedElement)}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'El elemento ha sido actualizado exitosamente.',
      data: updatedElement
    };
  }
}
