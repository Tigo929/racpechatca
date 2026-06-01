import { IsString, MinLength } from 'class-validator';

export class DtoLogin {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(4)
  password!: string;
}
