import * as amqp from 'amqplib';

const MAIN_QUEUE = 'main.queue';
const DLX_EXCHANGE = 'dlx.exchange';
const DLQ_QUEUE = 'main.queue.dead';
export const DEAD_LETTER_RK = 'dead.letter';

export async function rmqSetup(url: string) {
  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();

  await channel.assertExchange(DLX_EXCHANGE, 'direct', { durable: true });

  await channel.assertQueue(DLQ_QUEUE, { durable: true });
  await channel.bindQueue(DLQ_QUEUE, DLX_EXCHANGE, DEAD_LETTER_RK);
  await channel.assertQueue(MAIN_QUEUE, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': DLX_EXCHANGE,
      'x-dead-letter-routing-key': DEAD_LETTER_RK,
      'x-message-ttl': 60000,
    },
  });

  await connection.close();
}

export const RmqOptParam = {
  queue: 'main.queue',
  queueOptions: {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': DLX_EXCHANGE,
      'x-dead-letter-routing-key': DEAD_LETTER_RK,
      'x-message-ttl': 60000,
    },
  },
  persistent: true,
};
