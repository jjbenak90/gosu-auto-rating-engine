uses rateengine.model.PolicyRiskProfile
uses rateengine.ProductionAutoRatingEngine

var profile = new PolicyRiskProfile()
profile.TerritoryCode = "68123"
profile.DriverAge = 24
profile.Gender = "M"
profile.CompletedDriverTraining = true
profile.VehicleSymbol = 12
profile.VehicleValue = 32000.00
profile.MajorViolations = 0
profile.MinorViolations = 1
profile.AtFaultAccidents = 0
profile.CoverageLimit = 100000

var totalPremium = ProductionAutoRatingEngine.calculatePolicyPremium(profile)
print("Final Annual Policy Premium: \$${totalPremium}")