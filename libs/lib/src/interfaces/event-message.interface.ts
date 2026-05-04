export interface EventMessage<T = unknown> {
  id: string;
  correlationId: string;
  timestamp: number;
  type: string;
  payload: T;
}
