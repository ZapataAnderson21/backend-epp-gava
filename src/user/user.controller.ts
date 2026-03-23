import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  NotFoundException,
  Logger,
  ParseIntPipe,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './jwt/public.decorator';
import { MailService } from 'src/mail/mail.service';
import { ResetPasswordDto } from './dto/resetPassword.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from './jwt/jwt.auth.guard';
import { Request } from 'express';
import { RateLimit } from 'src/decorators/rate-limit.decorator';
import { RateLimitGuard } from 'src/guards/rate-limit.guard';

@Controller('user')
export class UserController {
  private readonly logger = new Logger('UserController');

  constructor(
    private readonly userService: UserService,
    private readonly mailService: MailService,
  ) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    this.logger.log(`Creating user: ${createUserDto.name}`);
    return await this.userService.create(createUserDto);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, windowMs: 60_000 })
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    this.logger.log(`Attempting login for user: ${loginDto.email}`);
    return await this.userService.login(loginDto);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @Post('logout')
  async logout(@Body('accessToken') token: string) {
    this.logger.log('Logging out token');
    return await this.userService.logout(token);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @Post('validateToken')
  async validateToken(@Body('accessToken') token: string) {
    this.logger.log(`Validating token...`);
    return await this.userService.validateToken(token);
  }

  @Get()
  async findAll() {
    this.logger.log('Fetching all users');
    return await this.userService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    // JwtStrategy.validate devuelve { userId, email }
    const { userId } = req.user as any;
    const res = await this.userService.findOne(Number(userId));
    return res;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(@Req() req: Request, @Body() updateUserDto: UpdateUserDto) {
    const { userId } = req.user as any;
    this.logger.log(`Updating self user with ID: ${userId}`);
    return await this.userService.updateMe(Number(userId), updateUserDto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: string) {
    this.logger.log(`Fetching user with ID: ${id}`);
    return await this.userService.findOne(+id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    this.logger.log(`Updating user with ID: ${id}`);
    return await this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Deleting user with ID: ${id}`);
    return await this.userService.remove(id);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, windowMs: 10 * 60_000 })
  @Post('reset-password')
  async updatePassword(@Body() resetPasswordDto: ResetPasswordDto) {
    this.logger.log('Processing password reset');
    return await this.userService.updatePassword(resetPasswordDto);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 3, windowMs: 15 * 60_000 })
  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    this.logger.log('Processing forgot password request');
    const token = await this.userService.emailExists(email);

    if (!token) {
      this.logger.warn(`User with email ${email} not found`);
      throw new NotFoundException(
        'User with the provided email does not exist',
      );
    }

    return await this.mailService.sendPasswordResetEmail(email, token);
  }
}
