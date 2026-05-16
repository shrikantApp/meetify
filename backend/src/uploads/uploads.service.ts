import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class UploadsService implements OnModuleInit {
  private minioClient: Minio.Client;
  private bucketName: string;
  private readonly logger = new Logger(UploadsService.name);

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.get<string>('MINIO_BUCKET', 'meetify-chat');
    
    // Default config assuming local docker
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(this.configService.get<string>('MINIO_PORT', '9000'), 10),
      useSSL: this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        // Set public read policy for the bucket
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucketName}/*`]
            }
          ]
        };
        await this.minioClient.setBucketPolicy(this.bucketName, JSON.stringify(policy));
        this.logger.log(`Created bucket ${this.bucketName} with public read policy.`);
      }
    } catch (err) {
      this.logger.error(`Error initializing MinIO bucket: ${err.message}`);
    }
  }

  async generatePresignedUrl(fileName: string, mimeType: string): Promise<{ url: string; fileKey: string }> {
    try {
      const ext = fileName.split('.').pop();
      const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      
      const url = await this.minioClient.presignedPutObject(this.bucketName, uniqueName, 60 * 5); // 5 mins expiry
      return { url, fileKey: uniqueName };
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL: ${error.message}`);
      throw new InternalServerErrorException('Could not generate upload URL');
    }
  }

  getFileUrl(fileKey: string): string {
    const protocol = this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true' ? 'https' : 'http';
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = this.configService.get<string>('MINIO_PORT', '9000');
    
    // In production (e.g., behind NGINX) port might be 80 or 443 and omitted
    const portStr = (port === '80' || port === '443') ? '' : `:${port}`;
    return `${protocol}://${endpoint}${portStr}/${this.bucketName}/${fileKey}`;
  }
}
