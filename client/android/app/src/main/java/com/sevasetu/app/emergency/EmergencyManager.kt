package com.sevasetu.app.emergency

import java.util.UUID

enum class EmergencyTriggerType {
    VOICE, BUTTON, WIDGET, NOTIFICATION
}

data class LocationSample(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Float? = null,
    val source: String,
    val confidence: Float
)

data class EmergencyEvent(
    val clientEventId: String = UUID.randomUUID().toString(),
    val triggerType: EmergencyTriggerType,
    val triggeredAt: Long = System.currentTimeMillis(),
    val location: LocationSample? = null,
    var status: String = "SESSION_PERSISTED"
)

/**
 * Phase 1: Kotlin Emergency Manager
 * Handles local Room database persistence and deterministic emergency creation.
 */
class EmergencyManager {
    
    fun triggerEmergency(type: EmergencyTriggerType): EmergencyEvent {
        val event = EmergencyEvent(triggerType = type)
        persistLocally(event)
        submitMinimumSOS(event)
        return event
    }

    private fun persistLocally(event: EmergencyEvent) {
        // TODO: Save to Room Database Journal
        println("Emergency saved locally: ${event.clientEventId}")
    }

    private fun submitMinimumSOS(event: EmergencyEvent) {
        // TODO: Enqueue into WorkManager for offline-capable HTTP POST
        println("Minimum SOS queued for: ${event.clientEventId}")
    }
}
