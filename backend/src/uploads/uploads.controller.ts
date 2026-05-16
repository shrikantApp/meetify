import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class GetPresignedUrlDto {
  fileName: string;
  mimeType: string;
}

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) { }

  @Post('presigned')
  async getPresignedUrl(@Body() body: GetPresignedUrlDto) {
    const { url, fileKey } = await this.uploadsService.generatePresignedUrl(body.fileName, body.mimeType);
    return {
      url,
      fileKey,
      publicUrl: this.uploadsService.getFileUrl(fileKey)
    };
  }
}
