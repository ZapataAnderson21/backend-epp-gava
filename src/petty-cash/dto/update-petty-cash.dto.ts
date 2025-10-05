import { PartialType } from '@nestjs/swagger';
import { CreatePettyCashDto } from './create-petty-cash.dto';

export class UpdatePettyCashDto extends PartialType(CreatePettyCashDto) {}
