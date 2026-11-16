uses rateengine.db.DatabaseManager
uses rateengine.model.PolicyRiskProfile

print("=== TESTING POSTGRESQL GOSU INTEGRATION ===")

// 1. Test fetching base loss costs live from PostgreSQL
var collRate = DatabaseManager.fetchBaseLossCost("68123", "COLLISION")
var liabRate = DatabaseManager.fetchBaseLossCost("68123", "LIABILITY")

print("Fetched Collision Base Rate for 68123: $" + collRate)
print("Fetched Liability Base Rate for 68123: $" + liabRate)

// 2. Test persisting a quote audit log
var testRisk = new PolicyRiskProfile()
testRisk.TerritoryCode = "68123"
testRisk.DriverAge = 35
testRisk.Gender = "M"
testRisk.CompletedDriverTraining = true
testRisk.VehicleSymbol = 7
testRisk.VehicleValue = 25000.0
testRisk.MajorViolations = 0
testRisk.MinorViolations = 0
testRisk.AtFaultAccidents = 0
testRisk.CoverageLimit = 100000

DatabaseManager.persistQuote(testRisk, 1250.50)

print("=== DATABASE TEST COMPLETE ===")