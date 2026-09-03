// shared/contracts/types.ts
export type EmergencyTriggerType = 'VOICE' | 'BUTTON' | 'WIDGET' | 'NOTIFICATION';

export type EmergencyState = 
  | 'TRIGGERED'
  | 'SESSION_PERSISTED'
  | 'INCIDENT_CREATE_PENDING'
  | 'INCIDENT_CREATED'
  | 'SOS_SENT'
  | 'SOS_QUEUED'
  | 'LOCATION_RECEIVED'
  | 'URGENCY_CALCULATED'
  | 'DISPATCH_STARTED'
  | 'VOLUNTEER_BROADCAST'
  | 'VOLUNTEER_ACCEPTED'
  | 'EN_ROUTE'
  | 'CHECKED_IN'
  | 'RESCUE_COMPLETED'
  | 'PROOF_SUBMITTED'
  | 'VERIFIED'
  | 'RESOLVED';

export interface LocationSample {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  source: string;
  capturedAt: string; // ISO-8601
  ageMs?: number;
  confidence: number;
}

export interface CapabilitySnapshot {
  voice: boolean;
  screenOffVoice: boolean;
  wakeWordModel?: string;
  networkType?: string;
}

export interface EmergencyEventPayload {
  clientEventId: string;
  deviceId: string;
  triggerType: EmergencyTriggerType;
  triggeredAt: string; // ISO-8601
  sessionId?: string;
  coarseOrBestAvailableLocation?: LocationSample;
  locationConfidence?: number;
  clientCapabilitySnapshot: CapabilitySnapshot;
  emergencyCredentialProof: string;
}

export interface EmergencyFacts {
  emergencyType: string;
  severitySignals: string[];
  peopleCount?: number;
  injuredCount?: number;
  trapped?: boolean;
  fire?: boolean;
  flood?: boolean;
  structuralDamage?: boolean;
  hazards: string[];
  mobilityNeeds: string[];
  vulnerablePersonPresent?: boolean;
  landmarkText?: string;
  addressText?: string;
  language: string;
  confidenceByField: Record<string, number>;
  extractedAt: string;
}

export interface FactEnrichmentPayload {
  intent: string;
  facts: Partial<EmergencyFacts>;
  confidenceByField: Record<string, number>;
  modelVersion: string;
}
