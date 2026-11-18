package rateengine.rules

uses rateengine.db.DatabaseManager
uses rateengine.model.PolicyRiskProfile
uses java.math.BigDecimal

class SurchargeEvaluator {

  public static function evaluateDynamicSurcharge(profile : PolicyRiskProfile, surchargeRule : block(p : PolicyRiskProfile) : BigDecimal) : double {
    // Delegates directly to the enhancement's evaluateCustomModifier method
    return profile.evaluateCustomModifier(surchargeRule).doubleValue()
  }

  public static function getDefaultSurchargeBlock() : block(p : PolicyRiskProfile) : BigDecimal {
    return \ p -> {
      var seniorAgeThreshold = DatabaseManager.fetchSystemParameter("SENIOR_AGE_THRESHOLD") as int
      if (p.IsHighRiskDriver) {
        return BigDecimal.valueOf(DatabaseManager.fetchSystemParameter("HIGH_RISK_SURCHARGE_MULTIPLIER"))
      } else if (p.DriverAge >= seniorAgeThreshold) {
        return BigDecimal.valueOf(DatabaseManager.fetchSystemParameter("SENIOR_SURCHARGE_MULTIPLIER"))
      }
      return BigDecimal.valueOf(DatabaseManager.fetchSystemParameter("DEFAULT_FACTOR"))
    }
  }
}