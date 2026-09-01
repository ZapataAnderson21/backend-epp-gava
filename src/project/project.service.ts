import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ProjectStatus,
  ProjectStatusLabelEs,
} from './enum/project-status.enum';
import { TaskService } from 'src/task/task.service';
import { NotificationService } from 'src/notification/notification.service';
import { InventoryService } from 'src/inventory/inventory.service';
import { buildPaginatedData, getPaginationArgs } from 'src/common/pagination';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger('ProjectService');

  constructor(
    private readonly prismaService: PrismaService,
    private readonly taskService: TaskService,
    private readonly notificationService: NotificationService,
    private readonly inventoryService: InventoryService,
  ) {}

  async create(createProjectDto: CreateProjectDto) {
    this.logger.log('Creating project', JSON.stringify(createProjectDto));

    this.logger.log(
      'Checking for existing project with code',
      createProjectDto.code,
    );
    const existingProject = await this.findByCode(createProjectDto.code);

    if (existingProject) {
      this.logger.error(
        'Project creation failed: Project with this code already exists',
        createProjectDto.code,
      );
      throw new ConflictException('Ya existe un proyecto con este codigo.');
    }

    const status = 'active';

    this.logger.log(
      `Creating project in database: ${JSON.stringify(createProjectDto)}`,
    );
    const project = await this.prismaService.project.create({
      data: { ...createProjectDto, status },
    });

    if (!project) {
      this.logger.error(
        `Project creation failed: ${JSON.stringify(createProjectDto)}`,
      );
      throw new BadRequestException('No se pudo crear el proyecto.');
    }

    await this.notificationService.notifyProjectCreated(
      project.projectId,
      project.name,
      project.code,
    );

    this.logger.log(`Project created successfully: ${JSON.stringify(project)}`);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Proyecto registrado exitosamente.',
      data: project,
    };
  }

  async findAll() {
    this.logger.log('Retrieving all projects');
    const foundProjects = (
      await this.prismaService.project.findMany({
        where: {
          deletedAt: null,
        },
      })
    ).sort((a, b) => b.projectId - a.projectId);

    if (!foundProjects || foundProjects.length === 0) {
      this.logger.warn('No projects found');
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se han encontrado proyectos.',
        data: [],
      };
    }

    const processedProjects = foundProjects.map((project) => ({
      ...project,
      status:
        ProjectStatusLabelEs[
          project.status as keyof typeof ProjectStatusLabelEs
        ] || project.status,
    }));

    this.logger.log(`Found ${foundProjects.length} projects`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Projects retrieved successfully',
      data: processedProjects,
    };
  }

  async findPaginated(query: ListProjectsQueryDto) {
    const search = query.search?.trim();
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { code: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } },
              { location: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const { skip, take } = getPaginationArgs(query);
    const [projects, totalItems] = await Promise.all([
      this.prismaService.project.findMany({
        where,
        orderBy: [{ projectId: query.order === 'asc' ? 'asc' : 'desc' }],
        skip,
        take,
      }),
      this.prismaService.project.count({ where }),
    ]);
    const items = projects.map((project) => ({
      ...project,
      status:
        ProjectStatusLabelEs[
          project.status as keyof typeof ProjectStatusLabelEs
        ] || project.status,
    }));

    return {
      statusCode: HttpStatus.OK,
      message: 'Proyectos obtenidos exitosamente.',
      data: buildPaginatedData(items, totalItems, query),
    };
  }

  async findOne(projectId: number) {
    if (!projectId) {
      this.logger.error('Project ID is required');
      throw new BadRequestException('No hemos encontrado el ID del proyecto.');
    }

    this.logger.log('Retrieving project with ID', projectId);
    const foundProject = await this.prismaService.project.findUnique({
      where: {
        projectId,
        deletedAt: null,
      },
      include: {
        requests: true,
        purchaseOrders: true,
        emergencies: true,
        serviceSales: true,
        pettyCashes: true,
      },
    });

    this.logger.log(`Found project with ID ${projectId}`);
    if (!foundProject) {
      throw new NotFoundException('No se ha encontrado el proyecto.');
    }

    const processedProject = {
      ...foundProject,
      status:
        ProjectStatusLabelEs[
          foundProject.status as keyof typeof ProjectStatusLabelEs
        ] || foundProject.status,
    };

    return {
      statusCode: HttpStatus.OK,
      message: 'Proyecto encontrado exitosamente.',
      data: processedProject,
    };
  }

  async findByCode(code: string) {
    this.logger.log(`Retrieving project with code: ${code}`);
    const foundProject = await this.prismaService.project.findUnique({
      where: {
        code,
        deletedAt: null,
      },
      include: {
        requests: true,
      },
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
        deletedAt: null,
      },
    });

    if (!foundProjects || foundProjects.length === 0) {
      this.logger.warn('No projects found');
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se han encontrado proyectos.',
        data: [],
      };
    }

    const processedProjects = foundProjects.map((project) => ({
      ...project,
      status:
        ProjectStatusLabelEs[
          project.status as keyof typeof ProjectStatusLabelEs
        ] || project.status,
    }));

    this.logger.log(
      `Found ${foundProjects.length} projects with status: ${status}`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Projects retrieved successfully',
      data: processedProjects,
    };
  }

  async update(projectId: number, updateProjectDto: UpdateProjectDto) {
    this.logger.log(`Updating project with ID: ${projectId}`);

    this.logger.log(`Verifying existence of project with ID: ${projectId}`);
    await this.findOne(projectId);

    if (updateProjectDto.code) {
      this.logger.log(
        `Checking for existing project with code: ${updateProjectDto.code}`,
      );
      const existingProject = await this.prismaService.project.findUnique({
        where: {
          code: updateProjectDto.code,
          deletedAt: null,
        },
      });

      if (existingProject && existingProject.projectId !== projectId) {
        this.logger.error(
          `Update failed: Project with code ${updateProjectDto.code} already exists`,
        );
        throw new ConflictException('Ya existe un proyecto con este codigo.');
      }
    }

    this.logger.log(
      `Updating project in db. Data: ${JSON.stringify(updateProjectDto)}`,
    );
    const updatedProject = await this.prismaService.project.update({
      where: { projectId },
      data: updateProjectDto,
    });

    if (!updatedProject) {
      this.logger.warn(`Project with ID ${projectId} cannot be updated.`);
      throw new BadRequestException('El proyecto no pudo ser actualizado.');
    }

    this.logger.log(
      `Project with ID ${projectId} updated successfully: ${JSON.stringify(updatedProject)}`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Proyecto actualizado exitosamente.',
      data: updatedProject,
    };
  }

  async updateStatus(projectId: number, status: ProjectStatus) {
    this.logger.log(
      `Updating status for project with ID: ${projectId} to: ${status}`,
    );

    if (status === ProjectStatus.Inactive) {
      const blockers =
        await this.inventoryService.getProjectInactivationBlockers(projectId);

      if (blockers.length > 0) {
        const details = blockers
          .map(
            (blocker) => {
              const codePart = blocker.elementCode ? ` [${blocker.elementCode}]` : '';
              const familyPart = blocker.familyLabel ? ` - ${blocker.familyLabel}` : '';
              return `${blocker.elementName}${codePart}${familyPart} (${blocker.quantityPending} ${blocker.unit}) - Responsable: ${blocker.responsibleUserName ?? 'Sin responsable'}`;
            },
          )
          .join('; ');

        throw new BadRequestException(
          `No se puede inactivar el proyecto porque aun tiene elementos pendientes de retorno en obra: ${details}.`,
        );
      }
    }

    if (status === ProjectStatus.Completed) {
      const taskStatus =
        await this.taskService.areAllTasksCompletedOrCancelled(projectId);

      if (!taskStatus.allCompleted) {
        const messages: string[] = [];
        if (taskStatus.pendingCount > 0) {
          messages.push(`${taskStatus.pendingCount} tarea(s) pendiente(s)`);
        }
        if (taskStatus.inProgressCount > 0) {
          messages.push(`${taskStatus.inProgressCount} tarea(s) en progreso`);
        }

        throw new BadRequestException(
          `No se puede completar el proyecto porque tiene ${messages.join(' y ')}. ` +
            'Todas las tareas deben estar completadas o canceladas.',
        );
      }
    }

    const updatedProject = await this.prismaService.project.update({
      where: { projectId },
      data: { status },
    });

    if (!updatedProject) {
      this.logger.warn(`Project with ID ${projectId} not found`);
      throw new NotFoundException('Project not found');
    }

    if (status === ProjectStatus.Completed) {
      await this.notificationService.notifyProjectCompleted(
        projectId,
        updatedProject.name,
      );
    } else if (status === ProjectStatus.Inactive) {
      await this.notificationService.notifyProjectInactivated(
        projectId,
        updatedProject.name,
      );
    }

    this.logger.log(
      `Project with ID ${projectId} status updated successfully: ${JSON.stringify(updatedProject)}`,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Estado actualizado exitosamente.',
      data: updatedProject,
    };
  }

  async remove(projectId: number) {
    this.logger.log(`Deleting project with ID: ${projectId}`);
    const deletedProject = await this.prismaService.project.update({
      where: { projectId },
      data: { deletedAt: new Date() },
    });

    if (!deletedProject) {
      this.logger.warn(`Project with ID ${projectId} not found`);
      throw new NotFoundException('No se ha encontrado el proyecto.');
    }

    this.logger.log(
      `Project with ID ${projectId} deleted successfully: ${JSON.stringify(deletedProject)}`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'El proyecto ha sido eliminado exitosamente.',
      data: deletedProject,
    };
  }
}
