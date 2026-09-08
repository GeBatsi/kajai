import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

type SupportedImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface UploadedFoodImageResult {
  key: string;
  url: string;
  contentType: string;
  size: number;
}

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly foodImagePrefix: string;
  private readonly maxFileSizeBytes: number;

  private readonly allowedMimeTypes = new Set<SupportedImageMimeType>([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.getRequiredEnv('S3_ENDPOINT');
    const region = this.configService.get<string>('S3_REGION') ?? 'auto';
    const accessKeyId = this.getRequiredEnv('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.getRequiredEnv('S3_SECRET_ACCESS_KEY');

    this.bucket = this.getRequiredEnv('S3_BUCKET');
    this.publicBaseUrl = this.getRequiredEnv('S3_PUBLIC_BASE_URL').replace(
      /\/$/,
      '',
    );

    this.foodImagePrefix =
      this.configService.get<string>('S3_FOOD_IMAGE_PREFIX') ?? 'foods/basic';

    this.maxFileSizeBytes = Number(
      this.configService.get<string>('S3_MAX_FILE_SIZE_BYTES') ?? 5 * 1024 * 1024,
    );

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async uploadFoodImage(
    file: Express.Multer.File,
    foodItemId: string,
  ): Promise<UploadedFoodImageResult> {
    this.validateImageFile(file);

    const key = this.generateFoodImageKey(file, foodItemId);

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );

      return {
        key,
        url: this.buildPublicUrl(key),
        contentType: file.mimetype,
        size: file.size,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Image upload failed. Please try again later.',
      );
    }
  }

  async deleteFileByUrl(imageUrl: string | null | undefined): Promise<void> {
    if (!imageUrl) {
      return;
    }

    const key = this.getKeyFromPublicUrl(imageUrl);

    if (!key) {
      return;
    }

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      throw new InternalServerErrorException(
        'Image delete failed. Please try again later.',
      );
    }
  }

  private validateImageFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('Image file is required.');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Uploaded image file is empty.');
    }

    if (!this.allowedMimeTypes.has(file.mimetype as SupportedImageMimeType)) {
      throw new BadRequestException(
        'Invalid image format. Allowed formats: jpg, png, webp.',
      );
    }

    if (file.size > this.maxFileSizeBytes) {
      throw new BadRequestException(
        `Image file is too large. Maximum size is ${Math.round(
          this.maxFileSizeBytes / 1024 / 1024,
        )}MB.`,
      );
    }
  }

  private generateFoodImageKey(
    file: Express.Multer.File,
    foodItemId: string,
  ): string {
    const extension = this.getExtensionFromMimeType(file.mimetype);
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, '');

    const uniquePart = randomUUID();

    return `${this.foodImagePrefix}/${foodItemId}/main-${timestamp}-${uniquePart}.${extension}`;
  }

  private getExtensionFromMimeType(mimeType: string): string {
    switch (mimeType) {
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      default:
        throw new BadRequestException(
          'Invalid image format. Allowed formats: jpg, png, webp.',
        );
    }
  }

  private buildPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  private getKeyFromPublicUrl(imageUrl: string): string | null {
    const normalizedBaseUrl = `${this.publicBaseUrl}/`;

    if (!imageUrl.startsWith(normalizedBaseUrl)) {
      return null;
    }

    return decodeURIComponent(imageUrl.slice(normalizedBaseUrl.length));
  }

  private getRequiredEnv(name: string): string {
    const value = this.configService.get<string>(name);

    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
  }
}