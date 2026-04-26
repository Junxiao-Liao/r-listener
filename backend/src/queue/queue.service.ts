import type { QueueRepository } from './queue.repository';

export type QueueService = {
	readonly queueRepository: QueueRepository;
};

export function createQueueService(queueRepository: QueueRepository): QueueService {
	return { queueRepository };
}
