package rateengine.db

uses rateengine.model.PolicyRiskProfile
uses java.math.BigDecimal
uses java.sql.Connection
uses java.sql.DriverManager
uses java.sql.PreparedStatement
uses java.sql.ResultSet
uses java.sql.SQLException
uses java.sql.Timestamp
uses java.util.Date
uses java.util.Properties

class DatabaseManager {

  private static final var DEFAULT_DB_URL : String = "jdbc:postgresql://localhost:5432/auto_rating_db"
  private static final var DEFAULT_DB_USER : String = "postgres"
  private static final var DEFAULT_DB_PASSWORD : String = "enchanter90!"

  private static final var PROP_DB_URL : String = "rating.db.url"
  private static final var PROP_DB_USER : String = "rating.db.user"
  private static final var PROP_DB_PASSWORD : String = "rating.db.password"

  private static final var ENV_DB_URL : String = "RATING_DB_URL"
  private static final var ENV_DB_USER : String = "RATING_DB_USER"
  private static final var ENV_DB_PASSWORD : String = "RATING_DB_PASSWORD"

  private static final var PARAM_DEFAULT_BASE_RATE : String = "DEFAULT_BASE_RATE"
  private static final var PARAM_DEFAULT_FACTOR : String = "DEFAULT_FACTOR"
  private static final var PARAM_DEFAULT_SURCHARGE : String = "DEFAULT_SURCHARGE"
  private static final var PARAM_HIGH_RISK_SURCHARGE_MULTIPLIER : String = "HIGH_RISK_SURCHARGE_MULTIPLIER"
  private static final var PARAM_STANDARD_SURCHARGE_MULTIPLIER : String = "STANDARD_SURCHARGE_MULTIPLIER"
  private static final var PARAM_PREFERRED_SURCHARGE_MULTIPLIER : String = "PREFERRED_SURCHARGE_MULTIPLIER"

  private static final var DEFAULT_FALLBACK_VALUE : double = 0.0
  private static final var DEFAULT_UNIT_FACTOR : double = 1.0
  private static final var MIN_ELIGIBLE_DRIVER_AGE : int = 16
  private static final var MAX_ELIGIBLE_DRIVER_AGE : int = 105
  private static final var PREFERRED_MIN_AGE : int = 25
  private static final var HIGH_RISK_UNDERAGE_THRESHOLD : int = 21
  private static final var HIGH_RISK_MAX_ACCIDENTS : int = 1
  private static final var HIGH_RISK_MAX_VIOLATIONS : int = 2
  private static final var MIN_INCIDENT_COUNT : int = 0
  private static final var MIN_VEHICLE_SYMBOL : int = 1
  private static final var INITIAL_RISK_SCORE : double = 0.0
  private static final var UNDERAGE_SCORE_THRESHOLD : int = 25
  private static final var UNDERAGE_SCORE_WEIGHT : double = 4.0
  private static final var MAJOR_VIOLATION_SCORE_WEIGHT : double = 25.0
  private static final var MINOR_VIOLATION_SCORE_WEIGHT : double = 10.0
  private static final var ACCIDENT_SCORE_WEIGHT : double = 20.0
  private static final var VEHICLE_SYMBOL_SCORE_WEIGHT : double = 1.5

  private static final var TIER_PREFERRED : String = "TIER_1_PREFERRED"
  private static final var TIER_STANDARD : String = "TIER_2_STANDARD"
  private static final var TIER_HIGH_RISK : String = "TIER_3_HIGH_RISK"

  private static final var SQL_PARAM_KEY_INDEX : int = 1
  private static final var SQL_PARAM_DATE_START_INDEX : int = 2
  private static final var SQL_PARAM_DATE_END_INDEX : int = 3

  private static final var SQL_TERRITORY_INDEX : int = 1
  private static final var SQL_COVERAGE_INDEX : int = 2
  private static final var SQL_BASE_RATE_DATE_START_INDEX : int = 3
  private static final var SQL_BASE_RATE_DATE_END_INDEX : int = 4

  private static final var SQL_AGE_MIN_INDEX : int = 1
  private static final var SQL_AGE_MAX_INDEX : int = 2
  private static final var SQL_AGE_DATE_START_INDEX : int = 3
  private static final var SQL_AGE_DATE_END_INDEX : int = 4

  private static final var SQL_VIOLATION_TYPE_INDEX : int = 1
  private static final var SQL_VIOLATION_DATE_START_INDEX : int = 2
  private static final var SQL_VIOLATION_DATE_END_INDEX : int = 3

  private static final var SQL_SYMBOL_INDEX : int = 1
  private static final var SQL_SYMBOL_DATE_START_INDEX : int = 2
  private static final var SQL_SYMBOL_DATE_END_INDEX : int = 3

  private static final var AUDIT_TERRITORY_INDEX : int = 1
  private static final var AUDIT_AGE_INDEX : int = 2
  private static final var AUDIT_SYMBOL_INDEX : int = 3
  private static final var AUDIT_MAJOR_VIOLATIONS_INDEX : int = 4
  private static final var AUDIT_MINOR_VIOLATIONS_INDEX : int = 5
  private static final var AUDIT_TIER_INDEX : int = 6
  private static final var AUDIT_PREMIUM_INDEX : int = 7
  private static final var AUDIT_CREATED_AT_INDEX : int = 8

  private static final var CLEANUP_FALLBACK_TERRITORY : String = "99999"
  private static final var CLEANUP_TERRITORY_INDEX : int = 1
  private static final var CLEANUP_MIN_BOUND_INDEX : int = 2
  private static final var CLEANUP_MAX_BOUND_INDEX : int = 3
  private static final var CLEANUP_PREMIUM_START_INDEX : int = 4

  private static function resolveConfig(propKey : String, envKey : String, fallback : String) : String {
    var sysProp = System.getProperty(propKey)
    if (sysProp != null and sysProp.trim().length > 0) {
      return sysProp.trim()
    }
    var envVal = System.getenv(envKey)
    if (envVal != null and envVal.trim().length > 0) {
      return envVal.trim()
    }
    return fallback
  }

  public static function getConnection() : Connection {
    var url = resolveConfig(PROP_DB_URL, ENV_DB_URL, DEFAULT_DB_URL)
    var user = resolveConfig(PROP_DB_USER, ENV_DB_USER, DEFAULT_DB_USER)
    var password = resolveConfig(PROP_DB_PASSWORD, ENV_DB_PASSWORD, DEFAULT_DB_PASSWORD)

    try {
      Class.forName("org.postgresql.Driver")
      var props = new Properties()
      props.setProperty("user", user)
      props.setProperty("password", password)
      return DriverManager.getConnection(url, props)
    } catch (e : ClassNotFoundException) {
      throw new RuntimeException("PostgreSQL JDBC Driver not found on classpath", e)
    } catch (e : SQLException) {
      throw new RuntimeException("Failed to connect to PostgreSQL database at ${url}", e)
    }
  }

  public static function fetchSystemParameter(paramKey : String) : double {
    return fetchSystemParameter(paramKey, new Date())
  }

  public static function fetchSystemParameter(paramKey : String, ratingDate : Date) : double {
    var effectiveDate = ratingDate != null ? ratingDate : new Date()
    var conn : Connection = null
    var stmt : PreparedStatement = null
    var rs : ResultSet = null
    var value = DEFAULT_FALLBACK_VALUE

    try {
      conn = getConnection()
      var sql = "SELECT param_value FROM system_parameters " +
          "WHERE param_key = ? " +
          "AND effective_date <= ? " +
          "AND (expiration_date IS NULL OR ? < expiration_date) " +
          "ORDER BY effective_date DESC LIMIT 1"
      stmt = conn.prepareStatement(sql)
      stmt.setString(SQL_PARAM_KEY_INDEX, paramKey)
      var sqlDate = new java.sql.Date(effectiveDate.Time)
      stmt.setDate(SQL_PARAM_DATE_START_INDEX, sqlDate)
      stmt.setDate(SQL_PARAM_DATE_END_INDEX, sqlDate)
      rs = stmt.executeQuery()
      if (rs.next()) {
        value = rs.getDouble("param_value")
      }
    } catch (e : Exception) {
      print("[DB ERROR] Failed to fetch system parameter ${paramKey} for date ${effectiveDate}: " + e.getMessage())
    } finally {
      closeQuietly(rs, stmt, conn)
    }

    return value
  }

  public static function fetchBaseLossCost(territoryCode : String, coverageType : String) : double {
    return fetchBaseLossCost(territoryCode, coverageType, new Date())
  }

  public static function fetchBaseLossCost(territoryCode : String, coverageType : String, ratingDate : Date) : double {
    var effectiveDate = ratingDate != null ? ratingDate : new Date()
    var conn : Connection = null
    var stmt : PreparedStatement = null
    var rs : ResultSet = null
    var rate = DEFAULT_FALLBACK_VALUE

    try {
      conn = getConnection()
      var sql = "SELECT base_loss_cost FROM territory_base_rates " +
          "WHERE territory_code = ? AND coverage_type = ? " +
          "AND effective_date <= ? " +
          "AND (expiration_date IS NULL OR ? < expiration_date) " +
          "ORDER BY effective_date DESC LIMIT 1"
      stmt = conn.prepareStatement(sql)
      stmt.setString(SQL_TERRITORY_INDEX, territoryCode)
      stmt.setString(SQL_COVERAGE_INDEX, coverageType)
      var sqlDate = new java.sql.Date(effectiveDate.Time)
      stmt.setDate(SQL_BASE_RATE_DATE_START_INDEX, sqlDate)
      stmt.setDate(SQL_BASE_RATE_DATE_END_INDEX, sqlDate)
      rs = stmt.executeQuery()
      if (rs.next()) {
        rate = rs.getDouble("base_loss_cost")
      } else {
        rate = fetchSystemParameter(PARAM_DEFAULT_BASE_RATE, effectiveDate)
      }
    } catch (e : Exception) {
      print("[DB ERROR] Failed to fetch base loss cost for ${territoryCode}/${coverageType} on ${effectiveDate}: " + e.getMessage())
    } finally {
      closeQuietly(rs, stmt, conn)
    }

    return rate
  }

  public static function fetchAgeFactor(age : int) : double {
    return fetchAgeFactor(age, new Date())
  }

  public static function fetchAgeFactor(age : int, ratingDate : Date) : double {
    var effectiveDate = ratingDate != null ? ratingDate : new Date()
    var conn : Connection = null
    var stmt : PreparedStatement = null
    var rs : ResultSet = null
    var factor = DEFAULT_UNIT_FACTOR

    try {
      conn = getConnection()
      var sql = "SELECT factor FROM age_factors " +
          "WHERE min_age <= ? AND max_age >= ? " +
          "AND effective_date <= ? " +
          "AND (expiration_date IS NULL OR ? < expiration_date) " +
          "ORDER BY effective_date DESC LIMIT 1"
      stmt = conn.prepareStatement(sql)
      stmt.setInt(SQL_AGE_MIN_INDEX, age)
      stmt.setInt(SQL_AGE_MAX_INDEX, age)
      var sqlDate = new java.sql.Date(effectiveDate.Time)
      stmt.setDate(SQL_AGE_DATE_START_INDEX, sqlDate)
      stmt.setDate(SQL_AGE_DATE_END_INDEX, sqlDate)
      rs = stmt.executeQuery()
      if (rs.next()) {
        factor = rs.getDouble("factor")
      } else {
        factor = fetchSystemParameter(PARAM_DEFAULT_FACTOR, effectiveDate)
      }
    } catch (e : Exception) {
      print("[DB ERROR] Failed to fetch age factor for age ${age} on ${effectiveDate}: " + e.getMessage())
    } finally {
      closeQuietly(rs, stmt, conn)
    }

    return factor
  }

  public static function fetchViolationSurcharge(violationType : String) : double {
    return fetchViolationSurcharge(violationType, new Date())
  }

  public static function fetchViolationSurcharge(violationType : String, ratingDate : Date) : double {
    var effectiveDate = ratingDate != null ? ratingDate : new Date()
    var conn : Connection = null
    var stmt : PreparedStatement = null
    var rs : ResultSet = null
    var surcharge = DEFAULT_FALLBACK_VALUE

    try {
      conn = getConnection()
      var sql = "SELECT surcharge_amount FROM violation_factors " +
          "WHERE violation_type = ? " +
          "AND effective_date <= ? " +
          "AND (expiration_date IS NULL OR ? < expiration_date) " +
          "ORDER BY effective_date DESC LIMIT 1"
      stmt = conn.prepareStatement(sql)
      stmt.setString(SQL_VIOLATION_TYPE_INDEX, violationType)
      var sqlDate = new java.sql.Date(effectiveDate.Time)
      stmt.setDate(SQL_VIOLATION_DATE_START_INDEX, sqlDate)
      stmt.setDate(SQL_VIOLATION_DATE_END_INDEX, sqlDate)
      rs = stmt.executeQuery()
      if (rs.next()) {
        surcharge = rs.getDouble("surcharge_amount")
      } else {
        surcharge = fetchSystemParameter(PARAM_DEFAULT_SURCHARGE, effectiveDate)
      }
    } catch (e : Exception) {
      print("[DB ERROR] Failed to fetch violation surcharge for ${violationType} on ${effectiveDate}: " + e.getMessage())
    } finally {
      closeQuietly(rs, stmt, conn)
    }

    return surcharge
  }

  public static function fetchVehicleSymbolFactor(symbol : int) : double {
    return fetchVehicleSymbolFactor(symbol, new Date())
  }

  public static function fetchVehicleSymbolFactor(symbol : int, ratingDate : Date) : double {
    var effectiveDate = ratingDate != null ? ratingDate : new Date()
    var conn : Connection = null
    var stmt : PreparedStatement = null
    var rs : ResultSet = null
    var factor = DEFAULT_UNIT_FACTOR

    try {
      conn = getConnection()
      var sql = "SELECT factor FROM vehicle_symbol_factors " +
          "WHERE symbol = ? " +
          "AND effective_date <= ? " +
          "AND (expiration_date IS NULL OR ? < expiration_date) " +
          "ORDER BY effective_date DESC LIMIT 1"
      stmt = conn.prepareStatement(sql)
      stmt.setInt(SQL_SYMBOL_INDEX, symbol)
      var sqlDate = new java.sql.Date(effectiveDate.Time)
      stmt.setDate(SQL_SYMBOL_DATE_START_INDEX, sqlDate)
      stmt.setDate(SQL_SYMBOL_DATE_END_INDEX, sqlDate)
      rs = stmt.executeQuery()
      if (rs.next()) {
        factor = rs.getDouble("factor")
      } else {
        factor = fetchSystemParameter(PARAM_DEFAULT_FACTOR, effectiveDate)
      }
    } catch (e : Exception) {
      print("[DB ERROR] Failed to fetch vehicle symbol factor for ${symbol} on ${effectiveDate}: " + e.getMessage())
    } finally {
      closeQuietly(rs, stmt, conn)
    }

    return factor
  }

  public static function calculateTotalViolations(profile : PolicyRiskProfile) : int {
    if (profile == null) {
      return MIN_INCIDENT_COUNT
    }
    return profile.MajorViolations + profile.MinorViolations
  }

  public static function isHighRiskDriver(profile : PolicyRiskProfile) : boolean {
    if (profile == null) {
      return false
    }
    var hasMajorViolation = profile.MajorViolations > MIN_INCIDENT_COUNT
    var hasExcessAccidents = profile.AtFaultAccidents > HIGH_RISK_MAX_ACCIDENTS
    var hasExcessViolations = calculateTotalViolations(profile) > HIGH_RISK_MAX_VIOLATIONS
    var isUnderage = profile.DriverAge < HIGH_RISK_UNDERAGE_THRESHOLD
    return hasMajorViolation or hasExcessAccidents or hasExcessViolations or isUnderage
  }

  public static function fetchUnderwritingTier(profile : PolicyRiskProfile) : String {
    if (profile == null) {
      return TIER_STANDARD
    }
    if (isHighRiskDriver(profile)) {
      return TIER_HIGH_RISK
    }
    var isCleanRecord = calculateTotalViolations(profile) == MIN_INCIDENT_COUNT
        and profile.AtFaultAccidents == MIN_INCIDENT_COUNT
    if (isCleanRecord and profile.DriverAge >= PREFERRED_MIN_AGE) {
      return TIER_PREFERRED
    }
    return TIER_STANDARD
  }

  public static function evaluateDynamicModifier(profile : PolicyRiskProfile) : double {
    var tier = fetchUnderwritingTier(profile)
    if (tier == TIER_HIGH_RISK) {
      return fetchSystemParameter(PARAM_HIGH_RISK_SURCHARGE_MULTIPLIER)
    } else if (tier == TIER_PREFERRED) {
      return fetchSystemParameter(PARAM_PREFERRED_SURCHARGE_MULTIPLIER)
    }
    return fetchSystemParameter(PARAM_STANDARD_SURCHARGE_MULTIPLIER)
  }

  public static function evaluateDynamicModifier(
      profile : PolicyRiskProfile,
      modifierLogic : block(profile : PolicyRiskProfile) : BigDecimal
  ) : BigDecimal {
    if (modifierLogic != null) {
      return modifierLogic(profile)
    }
    return BigDecimal.valueOf(evaluateDynamicModifier(profile))
  }

  public static function calculateActuarialRiskScore(profile : PolicyRiskProfile) : double {
    if (profile == null) {
      return INITIAL_RISK_SCORE
    }
    var ageComponent = profile.DriverAge < UNDERAGE_SCORE_THRESHOLD
        ? (UNDERAGE_SCORE_THRESHOLD - profile.DriverAge) * UNDERAGE_SCORE_WEIGHT
        : INITIAL_RISK_SCORE
    var violationComponent = (profile.MajorViolations * MAJOR_VIOLATION_SCORE_WEIGHT)
        + (profile.MinorViolations * MINOR_VIOLATION_SCORE_WEIGHT)
    var accidentComponent = profile.AtFaultAccidents * ACCIDENT_SCORE_WEIGHT
    var symbolComponent = profile.VehicleSymbol * VEHICLE_SYMBOL_SCORE_WEIGHT
    return ageComponent + violationComponent + accidentComponent + symbolComponent
  }

  public static function isValidProfile(profile : PolicyRiskProfile) : boolean {
    if (profile == null) {
      return false
    }
    var hasTerritory = profile.TerritoryCode != null and profile.TerritoryCode.trim().length > MIN_INCIDENT_COUNT
    var hasValidAge = profile.DriverAge >= MIN_ELIGIBLE_DRIVER_AGE and profile.DriverAge <= MAX_ELIGIBLE_DRIVER_AGE
    var hasValidSymbol = profile.VehicleSymbol >= MIN_VEHICLE_SYMBOL
    var hasNonNegativeIncidents = profile.MajorViolations >= MIN_INCIDENT_COUNT
        and profile.MinorViolations >= MIN_INCIDENT_COUNT
        and profile.AtFaultAccidents >= MIN_INCIDENT_COUNT
    return hasTerritory and hasValidAge and hasValidSymbol and hasNonNegativeIncidents
  }

  public static function persistQuote(profile : PolicyRiskProfile, finalPremium : BigDecimal) {
    var conn : Connection = null
    var stmt : PreparedStatement = null
    var effectivePremium = finalPremium != null ? finalPremium : BigDecimal.ZERO

    try {
      conn = getConnection()
      var sql = "INSERT INTO quote_audit_log (" +
          "territory_code, driver_age, vehicle_symbol, major_violations, minor_violations, " +
          "underwriting_tier, final_premium, created_at" +
          ") VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      stmt = conn.prepareStatement(sql)
      stmt.setString(AUDIT_TERRITORY_INDEX, profile.TerritoryCode)
      stmt.setInt(AUDIT_AGE_INDEX, profile.DriverAge)
      stmt.setInt(AUDIT_SYMBOL_INDEX, profile.VehicleSymbol)
      stmt.setInt(AUDIT_MAJOR_VIOLATIONS_INDEX, profile.MajorViolations)
      stmt.setInt(AUDIT_MINOR_VIOLATIONS_INDEX, profile.MinorViolations)
      stmt.setString(AUDIT_TIER_INDEX, profile.UnderwritingTier)
      stmt.setBigDecimal(AUDIT_PREMIUM_INDEX, effectivePremium)
      stmt.setTimestamp(AUDIT_CREATED_AT_INDEX, new Timestamp(System.currentTimeMillis()))
      stmt.executeUpdate()
      print("[DB] Quote persisted to PostgreSQL audit log.")
    } catch (e : Exception) {
      print("[DB ERROR] Failed to persist quote: " + e.getMessage())
    } finally {
      closeQuietly(null, stmt, conn)
    }
  }

  public static function cleanupQuoteAuditLog(
      testRunStart : Timestamp,
      testRunEnd : Timestamp,
      testPremiums : BigDecimal[]
  ) {
    var conn : Connection = null
    var stmt : PreparedStatement = null

    try {
      conn = getConnection()
      var hasPremiums = testPremiums != null and testPremiums.length > 0
      var sql = "DELETE FROM quote_audit_log WHERE territory_code = ?"
      if (hasPremiums) {
        var placeholders = new java.util.ArrayList<String>()
        for (i in 0..|testPremiums.length) {
          placeholders.add("?")
        }
        sql = sql + " OR (created_at >= ? AND created_at <= ? AND final_premium IN (${placeholders.join(", ")}))"
      }

      stmt = conn.prepareStatement(sql)
      stmt.setString(CLEANUP_TERRITORY_INDEX, CLEANUP_FALLBACK_TERRITORY)

      if (hasPremiums) {
        stmt.setTimestamp(CLEANUP_MIN_BOUND_INDEX, testRunStart)
        stmt.setTimestamp(CLEANUP_MAX_BOUND_INDEX, testRunEnd)
        for (i in 0..|testPremiums.length) {
          stmt.setBigDecimal(CLEANUP_PREMIUM_START_INDEX + i, testPremiums[i])
        }
      }

      var deletedCount = stmt.executeUpdate()
      print("[DB] Cleaned up ${deletedCount} test row(s) from quote_audit_log.")
    } catch (e : Exception) {
      print("[DB ERROR] Failed to clean up quote_audit_log: " + e.getMessage())
    } finally {
      closeQuietly(null, stmt, conn)
    }
  }

  private static function closeQuietly(rs : ResultSet, stmt : PreparedStatement, conn : Connection) {
    if (rs != null) {
      try { rs.close() } catch (e : Exception) {}
    }
    if (stmt != null) {
      try { stmt.close() } catch (e : Exception) {}
    }
    if (conn != null) {
      try { conn.close() } catch (e : Exception) {}
    }
  }
}