package rateengine.model

uses java.math.BigDecimal
uses java.util.ArrayList
uses java.util.List

class RatingWorksheet {
  var _profile : PolicyRiskProfile as Profile
  var _steps : List<RatingStep> as Steps
  var _finalPremium : BigDecimal as FinalPremium

  construct(profile : PolicyRiskProfile) {
    _profile = profile
    _steps = new ArrayList<RatingStep>()
    _finalPremium = BigDecimal.ZERO
  }

  function recordStep(name : String, operand : BigDecimal, runningTotal : BigDecimal, notes : String) {
    var order = _steps.size() + 1
    _steps.add(new RatingStep(order, name, operand, runningTotal, notes))
  }

  function getStep(stepName : String) : RatingStep {
    return _steps.firstWhere(\ s -> s.StepName == stepName)
  }

  function printWorksheet() {
    print("=== RATING WORKSHEET [Territory: ${Profile.TerritoryCode}, Tier: ${Profile.UnderwritingTier}] ===")
    for (step in _steps) {
      print("  " + step.toString())
    }
    print("  FINAL ROUNDED PREMIUM: $${FinalPremium}")
  }
}