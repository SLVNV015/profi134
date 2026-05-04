import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SendMessageDto } from './dto/send-message.dto';
import { randomUUID } from 'node:crypto';
import { SendMessageResponseDto } from './dto/send-messge.response.dto';

@ApiTags('messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @HttpCode(202)
  @ApiOperation({ summary: 'Publish message to RabbitMq' })
  @ApiResponse({
    status: 202,
    description: 'Accepted',
    type: SendMessageResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Conflict' })
  @ApiHeader({
    name: 'x-correlation-id',
    required: false,
    example: '123e4567-e89b-12d3-a456-426655440000',
    description: 'Correlation id',
  })
  @Post('/send')
  async send(
    @Body() dto: SendMessageDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return await this.messagesService.send(
      dto,
      correlationId || randomUUID().toString(),
    );
  }
}
