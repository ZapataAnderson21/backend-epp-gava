import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto, UpdateTaskDto, UpdateTaskStatusDto, AssignUserDto } from './dto';

@Controller('task')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  /**
   * POST /task
   * Crear una nueva tarea o subtarea
   */
  @Post()
  create(@Body() createTaskDto: CreateTaskDto) {
    return this.taskService.create(createTaskDto);
  }

  /**
   * GET /task/project/:projectId
   * Obtener todas las tareas de un proyecto
   */
  @Get('project/:projectId')
  findByProject(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.taskService.findByProject(projectId);
  }

  /**
   * GET /task/project/:projectId/progress
   * Obtener estadísticas de avance de un proyecto
   */
  @Get('project/:projectId/progress')
  getProjectProgress(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.taskService.getProjectProgress(projectId);
  }

  /**
   * GET /task/user/:userId
   * Obtener tareas asignadas a un usuario
   */
  @Get('user/:userId')
  findByUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.taskService.findByUser(userId);
  }

  /**
   * GET /task/:taskId
   * Obtener una tarea por ID
   */
  @Get(':taskId')
  findOne(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.taskService.findOne(taskId);
  }

  /**
   * PUT /task/:taskId
   * Actualizar una tarea completa
   */
  @Put(':taskId')
  update(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    return this.taskService.update(taskId, updateTaskDto);
  }

  /**
   * PATCH /task/:taskId/status
   * Cambiar el estado de una tarea (endpoint rápido)
   */
  @Patch(':taskId/status')
  updateStatus(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() updateTaskStatusDto: UpdateTaskStatusDto,
  ) {
    return this.taskService.updateStatus(taskId, updateTaskStatusDto.status);
  }

  /**
   * POST /task/:taskId/assign
   * Asignar un usuario a una tarea
   */
  @Post(':taskId/assign')
  assignUser(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() assignUserDto: AssignUserDto,
  ) {
    return this.taskService.assignUser(taskId, assignUserDto.userId);
  }

  /**
   * DELETE /task/:taskId/assign/:userId
   * Desasignar un usuario de una tarea
   */
  @Delete(':taskId/assign/:userId')
  unassignUser(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.taskService.unassignUser(taskId, userId);
  }

  /**
   * DELETE /task/:taskId
   * Eliminar una tarea
   */
  @Delete(':taskId')
  remove(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.taskService.remove(taskId);
  }
}
