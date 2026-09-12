import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Logger,
  ParseIntPipe,
  Delete,
  UseGuards,
  Req,
  Res,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './jwt/public.decorator';
import { MailService } from 'src/mail/mail.service';
import { ResetPasswordDto } from './dto/resetPassword.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from './jwt/jwt.auth.guard';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from './jwt/jwt-strategy';

type AuthenticatedRequest = Request & { user: AuthenticatedUser };
import { RateLimit } from 'src/decorators/rate-limit.decorator';
import { RateLimitGuard } from 'src/guards/rate-limit.guard';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { TokenDto } from './dto/token.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { ACCESS_TOKEN_COOKIE, extractAccessToken } from './jwt/access-token';

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
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.logger.log(`Attempting login for user: ${loginDto.email}`);
    const result = await this.userService.login(loginDto);
    response.cookie(ACCESS_TOKEN_COOKIE, result.data.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3 * 60 * 60 * 1000,
      path: '/',
    });
    const { accessToken: _accessToken, ...safeData } = result.data;
    void _accessToken;
    return { ...result, data: safeData };
  }

  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.logger.log('Logging out token');
    const token = extractAccessToken(request);
    const result = await this.userService.logout(token);
    response.clearCookie(ACCESS_TOKEN_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
    return result;
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 20, windowMs: 60_000 })
  @Post('validateToken')
  async validateToken(@Body() body: TokenDto) {
    this.logger.log(`Validating token...`);
    return await this.userService.validateToken(body.accessToken);
  }

  @Get()
  async findAll() {
    this.logger.log('Fetching all users');
    return await this.userService.findAll();
  }

  @Get('paginated')
  async findPaginated(@Query() query: ListUsersQueryDto) {
    return await this.userService.findPaginated(query);
  }

  @Get('inactive')
  async findInactive() {
    this.logger.log('Fetching inactive users');
    return await this.userService.findInactive();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: AuthenticatedRequest) {
    // JwtStrategy.validate devuelve { userId, email }
    const { userId } = req.user;
    const res = await this.userService.findOne(Number(userId));
    return res;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(
    @Req() req: AuthenticatedRequest,
    @Body() updateUserDto: UpdateMeDto,
  ) {
    const { userId } = req.user;
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
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    this.logger.log('Processing forgot password request');
    const token = await this.userService.emailExists(body.email);
    if (token) {
      try {
        await this.mailService.sendPasswordResetEmail(body.email, token);
      } catch (error) {
        this.logger.error('No se pudo enviar el correo de recuperación', error);
      }
    }
    return {
      statusCode: 200,
      message:
        'Si el correo está registrado, recibirás instrucciones para restablecer la contraseña.',
    };
  }
}
