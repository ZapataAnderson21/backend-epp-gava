import { Project, User } from "generated/prisma";

export class Emergency {
  emergency_id: number;
  image: string; 
  title: string; 
  description: string;
  user_id: number;
  project_id: number;
  createdAt: string;
  status: string;
  user?: User;
  project?: Project;
}
