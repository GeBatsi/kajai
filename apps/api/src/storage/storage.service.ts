import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import sharp from 'sharp'

type SupportedImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp'

export interface UploadedFoodImageResult {
  key: string
  url: string
  contentType: string
  size: number
  width?: number
  height?: number
}

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client
  private readonly bucket: string
  private readonly publicBaseUrl: string
  private readonly foodImagePrefix: string
  private readonly maxFileSizeBytes: number

  private readonly minImageWidth: number
  private readonly minImageHeight: number
  private readonly maxImageWidth: number
  private readonly maxImageHeight: number

  private readonly allowedMimeTypes = new Set<SupportedImageMimeType>([
    'image/jpeg',
    'image/png',
    'image/webp',
  ])

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.getRequiredEnv('S3_ENDPOINT')
    const region = this.configService.get<string>('S3_REGION') ?? 'auto'
    const accessKeyId = this.getRequiredEnv('S3_ACCESS_KEY_ID')
    const secretAccessKey = this.getRequiredEnv('S3_SECRET_ACCESS_KEY')

    this.bucket = this.getRequiredEnv('S3_BUCKET')
    this.publicBaseUrl = this.getRequiredEnv('S3_PUBLIC_BASE_URL').replace(/\/$/, '')

    this.foodImagePrefix = this.configService.get<string>('S3_FOOD_IMAGE_PREFIX') ?? 'foods/basic'

    this.maxFileSizeBytes = Number(
      this.configService.get<string>('S3_MAX_FILE_SIZE_BYTES') ?? 5 * 1024 * 1024,
    )
    this.minImageWidth = Number(this.configService.get<string>('FOOD_IMAGE_MIN_WIDTH') ?? 300)

    this.minImageHeight = Number(this.configService.get<string>('FOOD_IMAGE_MIN_HEIGHT') ?? 300)

    this.maxImageWidth = Number(this.configService.get<string>('FOOD_IMAGE_MAX_WIDTH') ?? 4000)

    this.maxImageHeight = Number(this.configService.get<string>('FOOD_IMAGE_MAX_HEIGHT') ?? 4000)

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })
  }

  async uploadFoodImage(
    file: Express.Multer.File,
    foodItemId: string,
  ): Promise<UploadedFoodImageResult> {
    const imageMetadata = await this.validateImageFile(file)

    const key = this.generateFoodImageKey(file, foodItemId)

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      )

      return {
        key,
        url: this.buildPublicUrl(key),
        contentType: file.mimetype,
        size: file.size,
        width: imageMetadata.width,
        height: imageMetadata.height,
      }
    } catch (error) {
      throw new InternalServerErrorException('Image upload failed. Please try again later.')
    }
  }

  async deleteFileByUrl(imageUrl: string | null | undefined): Promise<void> {
    if (!imageUrl) {
      return
    }

    const key = this.getKeyFromPublicUrl(imageUrl)

    if (!key) {
      return
    }

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      )
    } catch (error) {
      throw new InternalServerErrorException('Image delete failed. Please try again later.')
    }
  }

  private async validateImageFile(
    file: Express.Multer.File,
  ): Promise<{ width?: number; height?: number }> {
    if (!file) {
      throw new BadRequestException('Kép feltöltése kötelező.')
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('A feltöltött képfájl üres.')
    }

    if (!this.allowedMimeTypes.has(file.mimetype as SupportedImageMimeType)) {
      throw new BadRequestException(
        'Érvénytelen képformátum. Engedélyezett formátumok: jpg, png, webp.',
      )
    }

    if (file.size > this.maxFileSizeBytes) {
      throw new BadRequestException(
        `A képfájl túl nagy. Maximális méret: ${Math.round(
          this.maxFileSizeBytes / 1024 / 1024,
        )} MB.`,
      )
    }

    let metadata: { width?: number; height?: number }

    try {
      metadata = await sharp(file.buffer).metadata()
    } catch {
      throw new BadRequestException('A feltöltött fájl nem olvasható képként.')
    }

    const width = metadata.width
    const height = metadata.height

    if (!width || !height) {
      throw new BadRequestException('A kép mérete nem állapítható meg.')
    }

    if (width < this.minImageWidth || height < this.minImageHeight) {
      throw new BadRequestException(
        `A kép túl kicsi. Minimum méret: ${this.minImageWidth}x${this.minImageHeight}px.`,
      )
    }

    if (width > this.maxImageWidth || height > this.maxImageHeight) {
      throw new BadRequestException(
        `A kép túl nagy felbontású. Maximális méret: ${this.maxImageWidth}x${this.maxImageHeight}px.`,
      )
    }

    return { width, height }
  }

  private generateFoodImageKey(file: Express.Multer.File, foodItemId: string): string {
    const extension = this.getExtensionFromMimeType(file.mimetype)
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, '')

    const uniquePart = randomUUID()

    return `${this.foodImagePrefix}/${foodItemId}/main-${timestamp}-${uniquePart}.${extension}`
  }

  private getExtensionFromMimeType(mimeType: string): string {
    switch (mimeType) {
      case 'image/jpeg':
        return 'jpg'
      case 'image/png':
        return 'png'
      case 'image/webp':
        return 'webp'
      default:
        throw new BadRequestException('Invalid image format. Allowed formats: jpg, png, webp.')
    }
  }

  private buildPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`
  }

  private getKeyFromPublicUrl(imageUrl: string): string | null {
    const normalizedBaseUrl = `${this.publicBaseUrl}/`

    if (!imageUrl.startsWith(normalizedBaseUrl)) {
      return null
    }

    return decodeURIComponent(imageUrl.slice(normalizedBaseUrl.length))
  }

  private getRequiredEnv(name: string): string {
    const value = this.configService.get<string>(name)

    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`)
    }

    return value
  }
}
