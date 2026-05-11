import * as amqp from 'amqplib';

export async function rmqSetup(url: string) {
  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();

  await channel.assertExchange('dlx.exchange', 'direct', { durable: true });
  await channel.assertQueue('dead.letter.queue', { durable: true });
  await channel.bindQueue('dead.letter.queue', 'dlx.exchange', 'dead.letter');

  await channel.assertExchange('main.exchange', 'direct', { durable: true });
  await channel.assertQueue('main.queue', {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'dlx.exchange',
      'x-dead-letter-routing-key': 'dead.letter',
    },
  });
  await channel.bindQueue('main.queue', 'main.exchange', 'event.process');

  console.log('✓ RabbitMQ setup completed:');
  console.log('  - dlx.exchange -> dead.letter.queue');
  console.log('  - main.exchange -> main.queue (with DLX)');

  await channel.close();
  await connection.close();
}

export const RmqOptParam = {
  queue: 'main.queue',
  queueOptions: {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'dlx.exchange',
      'x-dead-letter-routing-key': 'dead.letter',
      'x-message-ttl': 60_000,
    },
  },
  persistent: true,
};
