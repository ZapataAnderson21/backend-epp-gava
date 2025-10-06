import { BadRequestException, ConflictException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProjectStatus } from './enum/project-status.enum';

@Injectable()
export class ProjectService {

  private readonly logger = new Logger("ProjectService");

  constructor(private readonly prismaService: PrismaService) {}

  async create(createProjectDto: CreateProjectDto) {

    this.logger.log('Creating project', JSON.stringify(createProjectDto));

    this.logger.log('Checking for existing project with code', createProjectDto.code);
    const existingProject = await this.findByCode(createProjectDto.code);

    if (existingProject) {
      this.logger.error('Project creation failed: Project with this code already exists', createProjectDto.code);
      throw new ConflictException('Ya existe un proyecto con este código.');
    }

    const status = 'active';

    this.logger.log(`Creating project in database: ${JSON.stringify(createProjectDto)}`);
    const project = await this.prismaService.project.create({
      data: { ...createProjectDto, status }
    });

    if (!project) {
      this.logger.error(`Project creation failed: ${JSON.stringify(createProjectDto)}`);
      throw new BadRequestException('No se pudo crear el proyecto.');
    }

    this.logger.log(`Project created successfully: ${JSON.stringify(project)}`);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'El proyecto ha sido registrado exitosamente.',
      data: project
    };
  }

  async findAll() {
    this.logger.log('Retrieving all projects');
    const foundProjects = (await this.prismaService.project.findMany({
      where: { 
        deletedAt: null
      },
    })).sort((a, b) => b.projectId - a.projectId);

    if (!foundProjects || foundProjects.length === 0) {
      this.logger.warn('No projects found');
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se han encontrado proyectos.',
        data: []
      };
    }

    this.logger.log(`Found ${foundProjects.length} projects`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Projects retrieved successfully',
      data: foundProjects
    };
  }

  async findOne(projectId: number) {
    
    this.logger.log('Retrieving project with ID', projectId);
    const foundProject = await this.prismaService.project.findUnique({
      where: { 
        projectId,
        deletedAt: null
      },
      include: {
        requests: true
      }
    });

    this.logger.log(`Found project with ID ${projectId}`, foundProject);
    if (!foundProject) {
      throw new NotFoundException('No se ha encontrado el proyecto.');
    }

    this.logger.log(`Found project with ID ${projectId}: ${JSON.stringify(foundProject)}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Proyecto encontrado exitosamente.',
      data: foundProject
    };
  }

  async findByCode(code: string) {
    this.logger.log(`Retrieving project with code: ${code}`);
    const foundProject = await this.prismaService.project.findUnique({
      where: { 
        code,
        deletedAt: null
      },
      include: {
        requests: true
      }
    });

    if (!foundProject) {
      this.logger.log(`No project found with code: ${code}`);
      return false;
    }

    this.logger.log('Found project with code', foundProject);
    return true;
  }

  async findByStatus(status: ProjectStatus) {
    this.logger.log(`Retrieving projects with status: ${status}`);
    const foundProjects = await this.prismaService.project.findMany({
      where: { 
        status,
        deletedAt: null
      }
    });

    if (!foundProjects || foundProjects.length === 0) {
      this.logger.warn('No projects found');
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se han encontrado proyectos.',
        data: []
      };
    }

    this.logger.log(`Found ${foundProjects.length} projects with status: ${status}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Projects retrieved successfully',
      data: foundProjects
    };
  }

  async update(projectId: number, updateProjectDto: UpdateProjectDto) {

    this.logger.log(`Updating project with ID: ${projectId}`);

    this.logger.log(`Verifying existence of project with ID: ${projectId}`);
    this.findOne(projectId);

    if (updateProjectDto.code) {
      this.logger.log(`Checking for existing project with code: ${updateProjectDto.code}`);
      const existingProject = await this.prismaService.project.findUnique({
        where: { 
          code: updateProjectDto.code,
          deletedAt: null
        }
      });

      if (existingProject && existingProject.projectId !== projectId) {
        this.logger.error(`Update failed: Project with code ${updateProjectDto.code} already exists`);
        throw new ConflictException('Ya existe un proyecto con este código.');
      }
    }

    this.logger.log(`Updating project in db. Data: ${JSON.stringify(updateProjectDto)}`);
    const updatedProject = await this.prismaService.project.update({
      where: { projectId },
      data: updateProjectDto
    });

    if (!updatedProject) {
      this.logger.warn(`Project with ID ${projectId} cannot be updated.`);
      throw new BadRequestException('El proyecto no pudo ser actualizado.');
    }

    this.logger.log(`Project with ID ${projectId} updated successfully: ${JSON.stringify(updatedProject)}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'El proyecto ha sido actualizado exitosamente.',
      data: updatedProject
    };
  }

  async updateStatus(projectId: number, status: ProjectStatus) {
    this.logger.log(`Updating status for project with ID: ${projectId} to: ${status}`);
    const updatedProject = await this.prismaService.project.update({
      where: { projectId },
      data: { status }
    });

    if (!updatedProject) {
      this.logger.warn(`Project with ID ${projectId} not found`);
      throw new NotFoundException('Project not found');
    }

    this.logger.log(`Project with ID ${projectId} status updated successfully: ${JSON.stringify(updatedProject)}`);
    
    return {
      statusCode: HttpStatus.OK,
      message: 'El estado del proyecto ha sido actualizado exitosamente.',
      data: updatedProject
    }
  }
}
