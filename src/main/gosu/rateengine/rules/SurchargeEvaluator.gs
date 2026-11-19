package rateengine.rules

uses rateengine.db.DatabaseManager
uses rateengine.model.PolicyRiskProfile
uses java.math.BigDecimal
uses java.math.RoundingMode
uses java.util.Date

class SurchargeEvaluator {

  public static function getDefaultSurchargeBlock() : block(profile : PolicyRiskProfile) : double {
    return getDefaultSurchargeBlock(new Date())
  }

  public static function getDefaultSurchargeBlock(ratingDate : Date) : block(profile : PolicyRiskProfile) : double {
    var effectiveDate = ratingDate != null ? ratingDate : new Date()
    var highRiskMultiplier = DatabaseManager.fetchSystemParameter("HIGH_RISK_SURCHARGE_MULTIPLIER", effectiveDate)
    var standardMultiplier = DatabaseManager.fetchSystemParameter("STANDARD_SURCHARGE_MULTIPLIER", effectiveDate)
    var preferredMultiplier = DatabaseManager.fetchSystemParameter("PREFERRED_SURCHARGE_MULTIPLIER", effectiveDate)

    return \ profile : PolicyRiskProfile -> {
      if (profile.UnderwritingTier == "TIER_3_HIGH_RISK") {
        return highRiskMultiplier
      } else if (profile.UnderwritingTier == "TIER_1_PREFERRED") {
        return preferredMultiplier
      } else {
        return standardMultiplier
      }
    }
  }

  public static function evaluateDynamicSurcharge(
      profile : PolicyRiskProfile,
      surchargeRule : block(profile : PolicyRiskProfile) : double
  ) : BigDecimal {
    if (surchargeRule == null) {
      return BigDecimal.ONE.setScale(4, RoundingMode.HALF_UP)
    }
    var rawFactor = surchargeRule(profile)
    return BigDecimal.valueOf(rawFactor).setScale(4, RoundingMode.HALF_UP)
  }
}