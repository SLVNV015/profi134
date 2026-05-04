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
      'x-message-ttl': 30000,
    },
  });
  await channel.bindQueue('main.queue', 'main.exchange', 'event.process');

  await channel.close();
  await connection.close();
}

export const RmqOptParam = {
  queue: 'main.queue',
  prefetchCount: 10,
  queueOptions: {
    durable: true,
    // arguments: {
    //   'x-dead-letter-exchange': 'dlx.exchange',
    //   'x-dead-letter-routing-key': 'dead.letter',
    //   'x-message-ttl': 30_000,
    // },
  },
};
