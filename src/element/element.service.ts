import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateElementDto } from './dto/create-element.dto';
import { UpdateElementDto } from './dto/update-element.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Element } from 'generated/prisma';

@Injectable()
export class ElementService {

  private readonly logger = new Logger("ElementService");

  constructor(private readonly prismaService: PrismaService) {}

  async create(createElementDto: CreateElementDto){

    this.logger.log(`Checking for existing element with name: ${createElementDto.name}`);
    const existingProject = await this.findByName(createElementDto.name);

    if (existingProject && existingProject.length > 0){
      this.logger.error(`Element creation failed: Element with this name already exists: ${createElementDto.name}`);
      throw new ConflictException('Element with this name already exists');
    }

    this.logger.log(`Creating element: ${JSON.stringify(createElementDto)}`);
    const element = await this.prismaService.element.create({data: createElementDto})

    if (!element){
      this.logger.error(`Element creation failed: ${JSON.stringify(createElementDto)}`);
      throw new BadRequestException('Element creation failed');
    }

    this.logger.log(`Element created successfully: ${JSON.stringify(element)}`);
    return element;
  }

  async findAll() {
    this.logger.log('Retrieving all elements');
    const foundElements = await this.prismaService.element.findMany();

    if (!foundElements || foundElements.length === 0){
      this.logger.warn('No elements found');
      return [];
    }

    this.logger.log(`Found ${foundElements.length} elements`);
    return foundElements;
  }

  async findOne(element_id: number) {
    this.logger.log(`Retrieving element with ID: ${element_id}`);
    const foundElement = await this.prismaService.element.findUnique({
      where: {element_id}
    })

    if (!foundElement){
      this.logger.warn(`Element with ID ${element_id} not found`);
      throw new NotFoundException('Element not found');
    }

    this.logger.log(`Element with ID ${element_id} retrieved successfully: ${JSON.stringify(foundElement)}`);
    return foundElement;
  }

  async findByName(name: string) {
    return await this.prismaService.element.findMany({
      where: { name }
    });
  }

  async findAllByType(type: string) {

    this.logger.log(`Retrieving elements with type: ${type}`);
    if (type !== 'operative' && type !== 'security') {
      throw new BadRequestException('Invalid type specified');
    }

    this.logger.log(`Finding elements of type: ${type}`);
    const foundElements = await this.prismaService.element.findMany({
      where: { type }
    })

    if (!foundElements || foundElements.length === 0){
      this.logger.warn(`No elements found of type: ${type}`);
      return [];
    }

    this.logger.log(`Found ${foundElements.length} elements of type ${type}`);
    return foundElements;
  }

  async update(element_id: number, updateElementDto: UpdateElementDto) {
    this.logger.log(`Updating element with ID: ${element_id}`);
    const updatedElement = await this.prismaService.element.update({
      where: { element_id },
      data: updateElementDto
    })
    
    if (!updatedElement){
      this.logger.error(`Element update failed: ${JSON.stringify(updateElementDto)}`);
      throw new BadRequestException('Element update failed');
    }

    this.logger.log(`Element updated successfully: ${JSON.stringify(updatedElement)}`);
    return updatedElement;
  }
}
