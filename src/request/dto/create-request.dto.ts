export class CreateRequestDto {
  registration_date: Date;
  status: string = 'pending';
  description: string;
  project_id: number;
  user_id: number;
}
