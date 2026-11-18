package rateengine.db

uses java.sql.DriverManager
uses java.sql.Connection
uses java.sql.PreparedStatement
uses java.sql.ResultSet
uses rateengine.model.PolicyRiskProfile
uses java.math.BigDecimal

class DatabaseManager {

  private static final var DB_URL = "jdbc:postgresql://localhost:5432/auto_rating_db"
  private static final var DB_USER = "postgres"
  private static final var DB_PASSWORD = "enchanter90!"

  public static function getConnection() : Connection {
    Class.forName("org.postgresql.Driver")
    return DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD)
  }

  /**
   * Fetches configuration parameters dynamically from the system_parameters table (Zero Magic Numbers).
   */
  public static function fetchSystemParameter(paramKey : String) : double {
    var conn : Connection = null
    var stmt : PreparedStatement = null
    var rs : ResultSet = null
    var value = 0.0
    
    try {
      conn = getConnection()
      stmt = conn.prepareStatement("SELECT param_value FROM system_parameters WHERE param_key = ?")
      stmt.setString(1, paramKey)
      rs = stmt.executeQuery()
      if (rs.next()) {
        value = rs.getDouble("param_value")
      }
    } catch (e : Exception) {
      print("[DB ERROR] Failed to fetch system parameter ${paramKey}: " + e.getMessage())
    } finally {
      if (rs != null) try { rs.close() } catch (e : Exception) {}
      if (stmt != null) try { stmt.close() } catch (e : Exception) {}
      if (conn != null) try { conn.close() } catch (e : Exception) {}
    }
    
    return value
  }

  public static function fetchBaseLossCost(territoryCode : String, coverageType : String) : double {
    var conn : Connection = null
    var stmt : PreparedStatement = null
    var rs : ResultSet = null
    var rate = fetchSystemParameter("DEFAULT_BASE_RATE")
    
    try {
      conn = getConnection()
      stmt = conn.prepareStatement("SELECT base_loss_cost FROM territory_base_rates WHERE territory_code = ? AND coverage_type = ?")
      stmt.setString(1, territoryCode)
      stmt.setString(2, coverageType)
      
      rs = stmt.executeQuery()
      if (rs.next()) {
        rate = rs.getDouble("base_loss_cost")
      }
    } catch (e : Exception) {
      print("[DB ERROR] Failed to fetch base loss cost: " + e.getMessage())
    } finally {
      if (rs != null) try { rs.close() } catch (e : Exception) {}
      if (stmt != null) try { stmt.close() } catch (e : Exception) {}
      if (conn != null) try { conn.close() } catch (e : Exception) {}
    }
    
    return rate
  }

  public static function persistQuote(profile : PolicyRiskProfile, totalPremium : double) {
    var conn : Connection = null
    var stmt : PreparedStatement = null
    
    try {
      conn = getConnection()
      var sql = "INSERT INTO quote_history (territory_code, driver_age, gender, driver_training, vehicle_symbol, vehicle_value, major_violations, minor_violations, at_fault_accidents, coverage_limit, total_premium) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      stmt = conn.prepareStatement(sql)
      
      stmt.setString(1, profile.TerritoryCode)
      stmt.setInt(2, profile.DriverAge)
      stmt.setString(3, profile.Gender)
      stmt.setBoolean(4, profile.CompletedDriverTraining)
      stmt.setInt(5, profile.VehicleSymbol)
      stmt.setDouble(6, profile.VehicleValue)
      stmt.setInt(7, profile.MajorViolations)
      stmt.setInt(8, profile.MinorViolations)
      stmt.setInt(9, profile.AtFaultAccidents)
      stmt.setInt(10, profile.CoverageLimit)
      stmt.setDouble(11, totalPremium)
      
      stmt.executeUpdate()
      print("[DB] Quote successfully persisted to PostgreSQL audit log.")
    } catch (e : Exception) {
      print("[DB ERROR] Failed to persist quote audit: " + e.getMessage())
    } finally {
      if (stmt != null) try { stmt.close() } catch (e : Exception) {}
      if (conn != null) try { conn.close() } catch (e : Exception) {}
    }
  }

  public static function fetchAgeFactor(age : int) : double {
    var conn : Connection = null
    var stmt : PreparedStatement = null
    var rs : ResultSet = null
    var factor = fetchSystemParameter("DEFAULT_FACTOR")
    
    try {
      conn = getConnection()
      stmt = conn.prepareStatement("SELECT factor FROM age_factors WHERE ? BETWEEN min_age AND max_age")
      stmt.setInt(1, age)
      rs = stmt.executeQuery()
      if (rs.next()) {
        factor = rs.getDouble("factor")
      }
    } catch (e : Exception) {
      print("[DB ERROR] Failed to fetch age factor: " + e.getMessage())
    } finally {
      if (rs != null) try { rs.close() } catch (e : Exception) {}
      if (stmt != null) try { stmt.close() } catch (e : Exception) {}
      if (conn != null) try { conn.close() } catch (e : Exception) {}
    }
    
    return factor
  }

  public static function fetchViolationSurcharge(type : String) : double {
    var conn : Connection = null
    var stmt : PreparedStatement = null
    var rs : ResultSet = null
    var surcharge = fetchSystemParameter("DEFAULT_SURCHARGE")
    
    try {
      conn = getConnection()
      stmt = conn.prepareStatement("SELECT surcharge_amount FROM violation_factors WHERE violation_type = ?")
      stmt.setString(1, type)
      rs = stmt.executeQuery()
      if (rs.next()) {
        surcharge = rs.getDouble("surcharge_amount")
      }
    } catch (e : Exception) {
      print("[DB ERROR] Failed to fetch violation surcharge: " + e.getMessage())
    } finally {
      if (rs != null) try { rs.close() } catch (e : Exception) {}
      if (stmt != null) try { stmt.close() } catch (e : Exception) {}
      if (conn != null) try { conn.close() } catch (e : Exception) {}
    }
    
    return surcharge
  }

  public static function fetchVehicleSymbolFactor(symbol : int) : double {
    var conn : Connection = null
    var stmt : PreparedStatement = null
    var rs : ResultSet = null
    var factor = fetchSystemParameter("DEFAULT_FACTOR")
    
    try {
      conn = getConnection()
      stmt = conn.prepareStatement("SELECT factor FROM vehicle_symbol_factors WHERE symbol = ?")
      stmt.setInt(1, symbol)
      rs = stmt.executeQuery()
      if (rs.next()) {
        factor = rs.getDouble("factor")
      }
    } catch (e : Exception) {
      print("[DB ERROR] Failed to fetch vehicle symbol factor: " + e.getMessage())
    } finally {
      if (rs != null) try { rs.close() } catch (e : Exception) {}
      if (stmt != null) try { stmt.close() } catch (e : Exception) {}
      if (conn != null) try { conn.close() } catch (e : Exception) {}
    }
    
    return factor
  }

  public static function isValidAge(age : int) : boolean {
    var conn : Connection = null
    var stmt : PreparedStatement = null
    var rs : ResultSet = null
    var valid = false
    
    try {
      conn = getConnection()
      stmt = conn.prepareStatement("SELECT COUNT(*) FROM age_factors WHERE ? BETWEEN min_age AND max_age")
      stmt.setInt(1, age)
      rs = stmt.executeQuery()
      if (rs.next()) {
        valid = rs.getInt(1) > 0
      }
    } catch (e : Exception) {
      print("[DB ERROR] Failed to validate age range: " + e.getMessage())
    } finally {
      if (rs != null) try { rs.close() } catch (e : Exception) {}
      if (stmt != null) try { stmt.close() } catch (e : Exception) {}
      if (conn != null) try { conn.close() } catch (e : Exception) {}
    }
    
    return valid
  }

  // --- Dynamic Business Logic Powered by Database Parameters ---

  public static function calculateTotalViolations(profile : PolicyRiskProfile) : int {
    return profile.MajorViolations + profile.MinorViolations + profile.AtFaultAccidents
  }

  public static function isHighRiskDriver(profile : PolicyRiskProfile) : boolean {
    var ageFactor = fetchAgeFactor(profile.DriverAge)
    var highRiskThreshold = fetchSystemParameter("HIGH_RISK_VIOLATION_THRESHOLD") as int
    return ageFactor > fetchSystemParameter("DEFAULT_FACTOR") or profile.MajorViolations > 0 or calculateTotalViolations(profile) >= highRiskThreshold
  }

  public static function fetchUnderwritingTier(profile : PolicyRiskProfile) : String {
    var preferredAgeThreshold = fetchSystemParameter("PREFERRED_AGE_THRESHOLD") as int
    if (isHighRiskDriver(profile)) {
      return "TIER_3_HIGH_RISK"
    } else if (profile.DriverAge >= preferredAgeThreshold and calculateTotalViolations(profile) == 0) {
      return "TIER_1_PREFERRED"
    }
    return "TIER_2_STANDARD"
  }

  public static function calculateActuarialRiskScore(profile : PolicyRiskProfile) : double {
    var ageFactor = fetchAgeFactor(profile.DriverAge)
    var vehicleFactor = fetchVehicleSymbolFactor(profile.VehicleSymbol)
    var majorSurcharge = fetchViolationSurcharge("MAJOR")
    var minorSurcharge = fetchViolationSurcharge("MINOR")
    var normalizer = fetchSystemParameter("RISK_SCORE_NORMALIZER")
    
    var violationWeight = 1.0 + (profile.MajorViolations * (majorSurcharge / normalizer)) + (profile.MinorViolations * (minorSurcharge / normalizer))
    return ageFactor * violationWeight * vehicleFactor
  }

  public static function evaluateDynamicModifier(profile : PolicyRiskProfile, modifierLogic : block(p : PolicyRiskProfile) : BigDecimal) : BigDecimal {
    if (modifierLogic == null) {
      var defaultMod = fetchSystemParameter("DEFAULT_FACTOR")
      return new BigDecimal(defaultMod)
    }
    return modifierLogic(profile)
  }

  public static function isValidProfile(profile : PolicyRiskProfile) : boolean {
    if (profile.TerritoryCode == null or profile.TerritoryCode.trim().isEmpty()) {
      return false
    }
    return isValidAge(profile.DriverAge)
  }
}