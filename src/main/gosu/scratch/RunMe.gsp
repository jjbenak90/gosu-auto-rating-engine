uses rateengine.model.RiskProfile
uses rateengine.AutoRatingEngine

// 1. Create a sample driver risk profile
// Parameters: age, vehicle value, safety rating, at-fault accidents
var sampleDriver = new RiskProfile(28, 35000.00, 85, 0)

// 2. Calculate the annualized auto insurance premium
var calculatedPremium = AutoRatingEngine.calculatePremium(sampleDriver)

// 3. Output results to the console
print("--- Auto Insurance Rating Engine Test ---")
print("Driver Age: " + sampleDriver.DriverAge)
print("Vehicle Value: $" + sampleDriver.VehicleValue)
print("At-Fault Accidents: " + sampleDriver.AtFaultAccidents)
print("-----------------------------------------")
print("Final Calculated Premium: $" + calculatedPremium)