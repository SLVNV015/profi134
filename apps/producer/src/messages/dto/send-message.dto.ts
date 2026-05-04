import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'order.created' })
  type: string;

  @ApiProperty({
    example: {
      orderId: 1,
      userId: 1,
    },
  })
  @IsObject()
  payload: Record<string, unknown>;
}
