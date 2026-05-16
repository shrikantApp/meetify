import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateMeetingDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsOptional()
    @IsString()
    meetingCode?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    lobbyEnabled?: boolean;
}
