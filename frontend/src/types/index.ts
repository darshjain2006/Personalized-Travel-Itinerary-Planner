export * from './database';

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
  environment: string;
  services: Record<string, string>;
}

export type TravelScenario = 'solo' | 'couple' | 'group';

export interface ScenarioMeta {
  id: TravelScenario;
  title: string;
  tagline: string;
  description: string;
  badge: string;
  iconName: string;
  highlights: string[];
}
