package rateengine.model

uses rateengine.db.DatabaseManager
uses java.math.BigDecimal

enhancement PolicyRiskProfileEnhancement : PolicyRiskProfile {

  property get TotalViolations() : int {
    return DatabaseManager.calculateTotalViolations(this)
  }

  property get IsHighRiskDriver() : boolean {
    return DatabaseManager.isHighRiskDriver(this)
  }

  property get UnderwritingTier() : String {
    return DatabaseManager.fetchUnderwritingTier(this)
  }

  function evaluateCustomModifier(modifierLogic : block(profile : PolicyRiskProfile) : BigDecimal) : BigDecimal {
    return DatabaseManager.evaluateDynamicModifier(this, modifierLogic)
  }

  property get ActuarialRiskScore() : double {
    return DatabaseManager.calculateActuarialRiskScore(this)
  }

  function validateProfileData() : boolean {
    return DatabaseManager.isValidProfile(this)
  }
}