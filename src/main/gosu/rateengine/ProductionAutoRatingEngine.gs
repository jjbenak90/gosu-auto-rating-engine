package rateengine

uses rateengine.db.DatabaseManager
uses rateengine.model.PolicyRiskProfile
uses rateengine.model.RatingWorksheet
uses rateengine.rules.SurchargeEvaluator
uses java.math.BigDecimal
uses java.math.RoundingMode
uses java.text.SimpleDateFormat
uses java.util.ArrayList
uses java.util.Date
uses java.util.HashMap

class ProductionAutoRatingEngine {

  private static final var DEFAULT_TERRITORY : String = "68123"
  private static final var DEFAULT_DRIVER_AGE : int = 24
  private static final var DEFAULT_GENDER : String = "M"
  private static final var DEFAULT_DRIVER_TRAINING : boolean = true
  private static final var DEFAULT_VEHICLE_SYMBOL : int = 12
  private static final var DEFAULT_VEHICLE_VALUE : double = 32000.00
  private static final var DEFAULT_MAJOR_VIOLATIONS : int = 0
  private static final var DEFAULT_MINOR_VIOLATIONS : int = 1
  private static final var DEFAULT_AT_FAULT_ACCIDENTS : int = 0
  private static final var DEFAULT_COVERAGE_LIMIT : int = 100000

public static function main(args : String[]) {
    var namedArgs = new HashMap<String, String>()
    var positional = new ArrayList<String>()

    if (args != null) {
      for (arg in args) {
        if (arg == null) {
          continue
        }
        var trimmed = arg.trim()
        if (trimmed.startsWith("--") and trimmed.contains("=")) {
          var eqIdx = trimmed.indexOf("=")
          var key = trimmed.substring(2, eqIdx).trim().toLowerCase()
          var val = trimmed.substring(eqIdx + 1).trim()
          namedArgs.put(key, val)
        } else {
          positional.add(trimmed)
        }
      }
    }

    var profile = new PolicyRiskProfile()
    profile.TerritoryCode = namedArgs.get("territory") ?: (positional.size() > 0 ? positional.get(0) : DEFAULT_TERRITORY)
    profile.DriverAge = parseIntOrDefault(namedArgs.get("age") ?: (positional.size() > 1 ? positional.get(1) : null), DEFAULT_DRIVER_AGE)
    profile.VehicleSymbol = parseIntOrDefault(namedArgs.get("symbol") ?: (positional.size() > 2 ? positional.get(2) : null), DEFAULT_VEHICLE_SYMBOL)
    profile.MajorViolations = parseIntOrDefault(namedArgs.get("major") ?: (positional.size() > 3 ? positional.get(3) : null), DEFAULT_MAJOR_VIOLATIONS)
    profile.MinorViolations = parseIntOrDefault(namedArgs.get("minor") ?: (positional.size() > 4 ? positional.get(4) : null), DEFAULT_MINOR_VIOLATIONS)
    profile.AtFaultAccidents = parseIntOrDefault(namedArgs.get("accidents") ?: (positional.size() > 5 ? positional.get(5) : null), DEFAULT_AT_FAULT_ACCIDENTS)
    profile.Gender = namedArgs.get("gender") ?: DEFAULT_GENDER
    profile.CompletedDriverTraining = parseBoolOrDefault(namedArgs.get("training"), DEFAULT_DRIVER_TRAINING)
    profile.VehicleValue = parseDoubleOrDefault(namedArgs.get("value"), DEFAULT_VEHICLE_VALUE)
    profile.CoverageLimit = parseIntOrDefault(namedArgs.get("limit"), DEFAULT_COVERAGE_LIMIT)

    var dateStr = namedArgs.get("date") ?: (positional.size() > 6 ? positional.get(6) : null)
    var effectiveDate = parseRatingDate(dateStr)

    var worksheet = ratePolicy(profile, effectiveDate)
    worksheet.printWorksheet()
  }

  private static function parseIntOrDefault(raw : String, fallback : int) : int {
    if (raw == null or raw.length == 0) {
      return fallback
    }
    try {
      return Integer.parseInt(raw)
    } catch (e : NumberFormatException) {
      throw new IllegalArgumentException("Invalid integer argument: '${raw}'", e)
    }
  }

  private static function parseDoubleOrDefault(raw : String, fallback : double) : double {
    if (raw == null or raw.length == 0) {
      return fallback
    }
    try {
      return Double.parseDouble(raw)
    } catch (e : NumberFormatException) {
      throw new IllegalArgumentException("Invalid decimal argument: '${raw}'", e)
    }
  }

  private static function parseBoolOrDefault(raw : String, fallback : boolean) : boolean {
    if (raw == null or raw.length == 0) {
      return fallback
    }
    return Boolean.parseBoolean(raw)
  }

  private static function parseRatingDate(raw : String) : Date {
    if (raw == null or raw.length == 0) {
      return new Date()
    }
    var fmt = new SimpleDateFormat("yyyy-MM-dd")
    fmt.setLenient(false)
    try {
      return fmt.parse(raw)
    } catch (e : Exception) {
      throw new IllegalArgumentException("Invalid date argument (expected yyyy-MM-dd): '${raw}'", e)
    }
  }

  public static function calculatePolicyPremium(profile : PolicyRiskProfile) : double {
    return calculatePolicyPremium(profile, new Date())
  }

  public static function calculatePolicyPremium(profile : PolicyRiskProfile, ratingDate : Date) : double {
    return ratePolicy(profile, ratingDate).FinalPremium.doubleValue()
  }

  public static function ratePolicy(profile : PolicyRiskProfile) : RatingWorksheet {
    return ratePolicy(profile, new Date())
  }

  public static function ratePolicy(profile : PolicyRiskProfile, ratingDate : Date) : RatingWorksheet {
    if (not profile.validateProfileData()) {
      throw new RuntimeException("Invalid policy risk profile for territory: ${profile.TerritoryCode}, age: ${profile.DriverAge}")
    }

    var effectiveRatingDate = ratingDate != null ? ratingDate : new Date()
    var worksheet = new RatingWorksheet(profile)

    var collBase = BigDecimal.valueOf(DatabaseManager.fetchBaseLossCost(profile.TerritoryCode, "COLLISION", effectiveRatingDate))
    worksheet.recordStep("COLLISION_BASE", collBase, collBase, "Territory ${profile.TerritoryCode} collision base loss cost (${effectiveRatingDate})")

    var liabBase = BigDecimal.valueOf(DatabaseManager.fetchBaseLossCost(profile.TerritoryCode, "LIABILITY", effectiveRatingDate))
    var combinedBase = collBase.add(liabBase)
    worksheet.recordStep("LIABILITY_BASE", liabBase, combinedBase, "Added liability base loss cost (${effectiveRatingDate})")

    var ageFactor = BigDecimal.valueOf(DatabaseManager.fetchAgeFactor(profile.DriverAge, effectiveRatingDate)).setScale(4, RoundingMode.HALF_UP)
    var afterAge = combinedBase.multiply(ageFactor)
    worksheet.recordStep("AGE_FACTOR", ageFactor, afterAge, "Driver age ${profile.DriverAge} factor (${effectiveRatingDate})")

    var vehicleFactor = BigDecimal.valueOf(DatabaseManager.fetchVehicleSymbolFactor(profile.VehicleSymbol, effectiveRatingDate)).setScale(4, RoundingMode.HALF_UP)
    var afterVehicle = afterAge.multiply(vehicleFactor)
    worksheet.recordStep("VEHICLE_SYMBOL_FACTOR", vehicleFactor, afterVehicle, "Vehicle symbol ${profile.VehicleSymbol} factor (${effectiveRatingDate})")

    var majorRate = BigDecimal.valueOf(DatabaseManager.fetchViolationSurcharge("MAJOR", effectiveRatingDate))
    var minorRate = BigDecimal.valueOf(DatabaseManager.fetchViolationSurcharge("MINOR", effectiveRatingDate))
    var majorSurcharge = majorRate.multiply(BigDecimal.valueOf(profile.MajorViolations))
    var minorSurcharge = minorRate.multiply(BigDecimal.valueOf(profile.MinorViolations))
    var totalViolationSurcharge = majorSurcharge.add(minorSurcharge)
    var basePremium = afterVehicle.add(totalViolationSurcharge)
    worksheet.recordStep("MVR_VIOLATION_SURCHARGES", totalViolationSurcharge, basePremium, "Major: ${profile.MajorViolations}, Minor: ${profile.MinorViolations}")

    var underwritingTier = DatabaseManager.fetchUnderwritingTier(profile)
    var dynamicRule = SurchargeEvaluator.getDefaultSurchargeBlock(effectiveRatingDate)
    var surchargeMultiplier = SurchargeEvaluator.evaluateDynamicSurcharge(profile, dynamicRule)
    var rawTotal = basePremium.multiply(surchargeMultiplier)
    var finalPremium = rawTotal.setScale(2, RoundingMode.HALF_UP)
    worksheet.recordStep("DYNAMIC_TIER_MULTIPLIER", surchargeMultiplier, finalPremium, "Tier ${underwritingTier} block multiplier (HALF_UP 2dp)")

    worksheet.FinalPremium = finalPremium
    DatabaseManager.persistQuote(profile, finalPremium)

    return worksheet
  }
}