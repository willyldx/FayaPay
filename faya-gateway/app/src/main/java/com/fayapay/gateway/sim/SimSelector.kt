package com.fayapay.gateway.sim

import timber.log.Timber

/**
 * Selects the appropriate SIM for a given operator.
 *
 * PRD §5.8: "Choisir la bonne SIM selon l'opérateur de la transaction.
 * AIRTEL → SIM Airtel, MOOV → SIM Moov.
 * Si SIM absente → retourner erreur SIM_NOT_AVAILABLE"
 *
 * Implementation will be completed in Step 4.
 */
class SimSelector(private val simManager: SimManager) {

    /**
     * Returns the subscription ID for the given operator.
     * Throws [SimNotAvailableException] if the SIM is not present.
     */
    fun getSubscriptionId(operatorName: String): Int {
        val operatorType = when (operatorName.uppercase()) {
            "AIRTEL" -> SimManager.OperatorType.AIRTEL
            "MOOV" -> SimManager.OperatorType.MOOV
            else -> {
                Timber.e("SimSelector — Unknown operator: $operatorName")
                throw SimNotAvailableException("Unknown operator: $operatorName")
            }
        }

        val subscription = simManager.getSubscriptionForOperator(operatorType)
            ?: throw SimNotAvailableException("SIM not available for operator: $operatorName")

        Timber.d("SimSelector — Selected SIM subscriptionId=${subscription.subscriptionId} for $operatorName")
        return subscription.subscriptionId
    }

    class SimNotAvailableException(message: String) : Exception(message)
}
