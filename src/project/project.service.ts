import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Project } from 'generated/prisma';

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
      throw new ConflictException('Project with this code already exists');
    }

    const status = 'active';

    this.logger.log(`Creating project in database: ${JSON.stringify(createProjectDto)}`);
    const project = await this.prismaService.project.create({
      data: { ...createProjectDto, status }
    });

    if (!project) {
      this.logger.error(`Project creation failed: ${JSON.stringify(createProjectDto)}`);
      throw new BadRequestException('Project creation failed');
    }

    this.logger.log(`Project created successfully: ${JSON.stringify(project)}`);
    return project;
  }

  async findAll(): Promise<Project[]> {
    this.logger.log('Retrieving all projects');
    const foundProjects = await this.prismaService.project.findMany();

    if (!foundProjects || foundProjects.length === 0) {
      this.logger.warn('No projects found');
      return [];
    }

    this.logger.log(`Found ${foundProjects.length} projects`);
    return foundProjects;
  }

  async findOne(project_id: number) {
    
    this.logger.log('Retrieving project with ID', project_id);
    const foundProject = await this.prismaService.project.findUnique({
      where: { project_id },
      include: {
        requests: true
      }
    });

    this.logger.log(`Found project with ID ${project_id}`, foundProject);
    if (!foundProject) {
      throw new NotFoundException('Project not found');
    }

    this.logger.log(`Found project with ID ${project_id}`, foundProject);
    return foundProject;
  }

  async findByCode(code: string) {
    this.logger.log(`Retrieving project with code: ${code}`);
    const foundProject = await this.prismaService.project.findUnique({
      where: { code },
      include: {
        requests: true
      }
    });

    if (!foundProject) {
      this.logger.warn('Project not found');
      throw new NotFoundException('Project not found');
    }

    this.logger.log('Found project with code', foundProject);
    return foundProject;
  }

  async findByStatus(status: string): Promise<Project[]> {
    this.logger.log(`Retrieving projects with status: ${status}`);
    const foundProjects = await this.prismaService.project.findMany({
      where: { status }
    });

    if (!foundProjects || foundProjects.length === 0) {
      this.logger.warn(`No projects found with status: ${status}`);
      return [];
    }

    this.logger.log(`Found ${foundProjects.length} projects with status: ${status}`);
    return foundProjects;
  }

  async update(project_id: number, updateProjectDto: UpdateProjectDto): Promise<Project | null> {

    this.logger.log(`Updating project with ID: ${project_id}`);
    const updatedProject = await this.prismaService.project.update({
      where: { project_id },
      data: updateProjectDto
    });

    if (!updatedProject) {
      this.logger.warn(`Project with ID ${project_id} not found`);
      throw new NotFoundException('Project not found');
    }

    this.logger.log(`Project with ID ${project_id} updated successfully: ${JSON.stringify(updatedProject)}`);
    return updatedProject;
  }

  async updateStatus(project_id: number, status: string): Promise<Project | null> {
    this.logger.log(`Updating status for project with ID: ${project_id} to: ${status}`);
    const updatedProject = await this.prismaService.project.update({
      where: { project_id },
      data: { status }
    });

    if (!updatedProject) {
      this.logger.warn(`Project with ID ${project_id} not found`);
      throw new NotFoundException('Project not found');
    }

    this.logger.log(`Project with ID ${project_id} status updated successfully: ${JSON.stringify(updatedProject)}`);
    return updatedProject;
  }
}
