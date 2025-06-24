import { Injectable } from '@nestjs/common';
import { CreateElementDto } from './dto/create-element.dto';
import { UpdateElementDto } from './dto/update-element.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Element } from 'generated/prisma';

@Injectable()
export class ElementService {

  constructor(private readonly prismaService: PrismaService) {}

  async create(createElementDto: CreateElementDto): Promise<Element | null> {
    
    const element = await this.prismaService.element.create({data: createElementDto})

    if (!element){
      return null;
    }

    return element;
  }

  async findAll(): Promise<Element[]> {
    const foundElements = await this.prismaService.element.findMany();

    if (!foundElements || foundElements.length === 0){
      return [];
    }

    return foundElements;
  }

  async findOne(element_id: number): Promise<Element | null> {
    const foundElement = await this.prismaService.element.findUnique({
      where: {element_id}
    })

    if (!foundElement){
      return null;
    }

    return foundElement;
  }

  async findByType(type: string): Promise<Element[] | null> {
    const foundElements = await this.prismaService.element.findMany({
      where: { type }
    })

    if (!foundElements || foundElements.length === 0){
      return [];
    }

    return foundElements;
  }

  async update(element_id: number, updateElementDto: UpdateElementDto): Promise<Element | null> {
    const updatedElement = await this.prismaService.element.update({
      where: { element_id },
      data: updateElementDto
    })

    if (!updatedElement){
      return null;
    }

    return updatedElement;
  }
}
