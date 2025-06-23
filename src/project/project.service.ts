import { Injectable } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Project } from 'generated/prisma';

@Injectable()
export class ProjectService {

  constructor(private readonly prismaService: PrismaService) {}

  async create(createProjectDto: CreateProjectDto): Promise<Project | null> {

    const status = 'active';

    const project = await this.prismaService.project.create({
      data: { ...createProjectDto, status }
    });

    if (!project) {
      return null;
    }

    return project;
  }

  async findAll(): Promise<Project[]> {
    const foundProjects = await this.prismaService.project.findMany();

    if (!foundProjects || foundProjects.length === 0) {
      return [];
    }

    return foundProjects;
  }

  async findOne(project_id: number): Promise<Project | null> {
    const foundProject = await this.prismaService.project.findUnique({
      where: { project_id },
      include: {
        requests: true
      }
    });

    if (!foundProject) {
      return null;
    }

    return foundProject;
  }

  async findByCode(code: string): Promise<Project | null> {
    const foundProject = await this.prismaService.project.findUnique({
      where: { code },
      include: {
        requests: true
      }
    });

    if (!foundProject) {
      return null;
    }

    return foundProject;
  }

  async findByStatus(status: string): Promise<Project[]> {
    const foundProjects = await this.prismaService.project.findMany({
      where: { status }
    });

    if (!foundProjects || foundProjects.length === 0) {
      return [];
    }

    return foundProjects;
  }

  async update(project_id: number, updateProjectDto: UpdateProjectDto): Promise<Project | null> {
    const updatedProject = await this.prismaService.project.update({
      where: { project_id },
      data: updateProjectDto
    });

    if (!updatedProject) {
      return null;
    }

    return updatedProject;
  }

  async updateStatus(project_id: number, status: string): Promise<Project | null> {
    const updatedProject = await this.prismaService.project.update({
      where: { project_id },
      data: { status }
    });

    if (!updatedProject) {
      return null;
    }

    return updatedProject;
  }
}
