import { ApiProperty } from '@nestjs/swagger';

export class SendMessageResponseDto {
  @ApiProperty()
  correlationId: string;
  @ApiProperty()
  eventId: string;
  @ApiProperty()
  isChached: boolean;
}
