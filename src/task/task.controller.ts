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
  UseGuards,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto, UpdateTaskDto, UpdateTaskStatusDto, AssignUserDto, ReorderTaskDto } from './dto';
import { TaskPermissionGuard, TaskOperation, TASK_OPERATION_KEY } from './guards';
import { UserTypes } from 'src/decorators/user-types.decorator';

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
   * Solo GERENTE, ADMINISTRADORA o usuarios asignados pueden actualizar
   */
  @Put(':taskId')
  @UseGuards(TaskPermissionGuard)
  @TaskOperation('update')
  update(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    return this.taskService.update(taskId, updateTaskDto);
  }

  /**
   * PATCH /task/:taskId/status
   * Cambiar el estado de una tarea (endpoint rápido)
   * Solo GERENTE, ADMINISTRADORA o usuarios asignados pueden cambiar el estado
   */
  @Patch(':taskId/status')
  @UseGuards(TaskPermissionGuard)
  @TaskOperation('update-status')
  updateStatus(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() updateTaskStatusDto: UpdateTaskStatusDto,
  ) {
    return this.taskService.updateStatus(taskId, updateTaskStatusDto.status);
  }

  /**
   * PATCH /task/reorder
   * Cambiar el orden de múltiples tareas
   * Solo GERENTE o ADMINISTRADORA pueden reordenar tareas
   */
  @Patch('reorder')
  @UserTypes('GERENTE', 'ADMINISTRADORA')
  reOrder(@Body() reorderTaskDto: ReorderTaskDto) {
    return this.taskService.reOrder(reorderTaskDto.updates);
  }

  /**
   * POST /task/:taskId/assign
   * Asignar un usuario a una tarea
   * Solo GERENTE o ADMINISTRADORA pueden asignar usuarios
   */
  @Post(':taskId/assign')
  @UserTypes('GERENTE', 'ADMINISTRADORA')
  assignUser(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() assignUserDto: AssignUserDto,
  ) {
    return this.taskService.assignUser(taskId, assignUserDto.userId);
  }

  /**
   * DELETE /task/:taskId/assign/:userId
   * Desasignar un usuario de una tarea
   * Solo GERENTE o ADMINISTRADORA pueden desasignar usuarios
   */
  @Delete(':taskId/assign/:userId')
  @UserTypes('GERENTE', 'ADMINISTRADORA')
  unassignUser(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.taskService.unassignUser(taskId, userId);
  }

  /**
   * DELETE /task/:taskId
   * Eliminar una tarea
   * Solo GERENTE o ADMINISTRADORA pueden eliminar tareas
   */
  @Delete(':taskId')
  @UserTypes('GERENTE', 'ADMINISTRADORA')
  remove(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.taskService.remove(taskId);
  }
}
