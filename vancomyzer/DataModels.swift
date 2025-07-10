import Foundation
import SwiftUI

// MARK: - Core Enums

enum Gender: String, CaseIterable, Identifiable {
    case male = "male"
    case female = "female"
    
    var id: String { rawValue }
    
    var localizedName: String {
        switch self {
        case .male: return NSLocalizedString("gender.male", comment: "Male")
        case .female: return NSLocalizedString("gender.female", comment: "Female")
        }
    }
}

enum PopulationType: String, CaseIterable, Identifiable {
    case adult = "adult"
    case pediatric = "pediatric"
    case neonate = "neonate"
    
    var id: String { rawValue }
    
    var localizedName: String {
        switch self {
        case .adult: return NSLocalizedString("population.adult", comment: "Adult")
        case .pediatric: return NSLocalizedString("population.pediatric", comment: "Pediatric")
        case .neonate: return NSLocalizedString("population.neonate", comment: "Neonate")
        }
    }
    
    var icon: String {
        switch self {
        case .adult: return "person.fill"
        case .pediatric: return "figure.child"
        case .neonate: return "figure.child.circle"
        }
    }
    
    var ageRange: String {
        switch self {
        case .adult: return NSLocalizedString("population.adult.age_range", comment: "≥18 years")
        case .pediatric: return NSLocalizedString("population.pediatric.age_range", comment: "1 month - 17 years")
        case .neonate: return NSLocalizedString("population.neonate.age_range", comment: "≤1 month")
        }
    }
}

enum CrClMethod: String, CaseIterable, Identifiable {
    case tbw = "tbw"
    case adjbw = "adjbw"
    case ibw = "ibw"
    case tbwRoundedScr = "tbw_rounded_scr"
    case custom = "custom"
    
    var id: String { rawValue }
    
    var localizedName: String {
        switch self {
        case .tbw: return NSLocalizedString("crcl.tbw", comment: "Total Body Weight")
        case .adjbw: return NSLocalizedString("crcl.adjbw", comment: "Adjusted Body Weight")
        case .ibw: return NSLocalizedString("crcl.ibw", comment: "Ideal Body Weight")
        case .tbwRoundedScr: return NSLocalizedString("crcl.tbw_rounded", comment: "TBW with SCr ≥1.0")
        case .custom: return NSLocalizedString("crcl.custom", comment: "Custom Value")
        }
    }
    
    var description: String {
        switch self {
        case .tbw: return NSLocalizedString("crcl.tbw.description", comment: "Cockcroft-Gault using total body weight")
        case .adjbw: return NSLocalizedString("crcl.adjbw.description", comment: "Cockcroft-Gault using adjusted body weight")
        case .ibw: return NSLocalizedString("crcl.ibw.description", comment: "Cockcroft-Gault using ideal body weight")
        case .tbwRoundedScr: return NSLocalizedString("crcl.tbw_rounded.description", comment: "Cockcroft-Gault using TBW with minimum SCr of 1.0")
        case .custom: return NSLocalizedString("crcl.custom.description", comment: "User-specified creatinine clearance")
        }
    }
}

enum InfectionSeverity: String, CaseIterable, Identifiable {
    case mild = "mild"
    case moderate = "moderate"
    case severe = "severe"
    
    var id: String { rawValue }
    
    var localizedName: String {
        switch self {
        case .mild: return NSLocalizedString("severity.mild", comment: "Mild")
        case .moderate: return NSLocalizedString("severity.moderate", comment: "Moderate")
        case .severe: return NSLocalizedString("severity.severe", comment: "Severe")
        }
    }
    
    var targetAUC: Double {
        switch self {
        case .mild: return 400.0
        case .moderate: return 450.0
        case .severe: return 500.0
        }
    }
    
    var color: Color {
        switch self {
        case .mild: return .green
        case .moderate: return .orange
        case .severe: return .red
        }
    }
}

enum Indication: String, CaseIterable, Identifiable {
    case pneumonia = "pneumonia"
    case skinSoftTissue = "skin_soft_tissue"
    case bacteremia = "bacteremia"
    case endocarditis = "endocarditis"
    case meningitis = "meningitis"
    case osteomyelitis = "osteomyelitis"
    case other = "other"
    
    var id: String { rawValue }
    
    var localizedName: String {
        switch self {
        case .pneumonia: return NSLocalizedString("indication.pneumonia", comment: "Pneumonia")
        case .skinSoftTissue: return NSLocalizedString("indication.skin_soft_tissue", comment: "Skin/Soft Tissue")
        case .bacteremia: return NSLocalizedString("indication.bacteremia", comment: "Bacteremia")
        case .endocarditis: return NSLocalizedString("indication.endocarditis", comment: "Endocarditis")
        case .meningitis: return NSLocalizedString("indication.meningitis", comment: "Meningitis")
        case .osteomyelitis: return NSLocalizedString("indication.osteomyelitis", comment: "Osteomyelitis")
        case .other: return NSLocalizedString("indication.other", comment: "Other")
        }
    }
    
    var targetAUC: Double {
        switch self {
        case .pneumonia, .skinSoftTissue: return 400.0
        case .bacteremia, .osteomyelitis: return 450.0
        case .endocarditis, .meningitis: return 500.0
        case .other: return 400.0
        }
    }
    
    var requiresLoadingDose: Bool {
        switch self {
        case .endocarditis, .meningitis, .bacteremia: return true
        default: return false
        }
    }
}

// MARK: - Patient Input Structure

struct PatientInput: Codable, Equatable {
    let populationType: PopulationType
    let ageInYears: Double?
    let gender: Gender
    let weightInKg: Double
    let heightInCm: Double?
    let serumCreatinine: Double
    let gestationalAgeWeeks: Double?
    let postnatalAgeDays: Double?
    let indication: Indication
    let severity: InfectionSeverity
    let isRenalFunctionStable: Bool
    let isOnHemodialysis: Bool
    let isOnCRRT: Bool
    let crClMethod: CrClMethod
    let customCrCl: Double?
    
    // Computed properties for backward compatibility
    var age: Double { ageInYears ?? 0.0 }
    var height: Double { heightInCm ?? 0.0 }
    
    // Validation
    var isValid: Bool {
        switch populationType {
        case .adult:
            return ageInYears != nil && ageInYears! >= 18 &&
                   weightInKg > 0 && heightInCm != nil && heightInCm! > 0 &&
                   serumCreatinine > 0
        case .pediatric:
            return ageInYears != nil && ageInYears! >= 0.083 && ageInYears! < 18 &&
                   weightInKg > 0 && heightInCm != nil && heightInCm! > 0 &&
                   serumCreatinine > 0
        case .neonate:
            return gestationalAgeWeeks != nil && postnatalAgeDays != nil &&
                   weightInKg > 0 && serumCreatinine > 0
        }
    }
    
    // BMI calculation
    var bmi: Double? {
        guard let height = heightInCm, height > 0 else { return nil }
        let heightInMeters = height / 100.0
        return weightInKg / (heightInMeters * heightInMeters)
    }
    
    // Age in months for pediatric calculations
    var ageInMonths: Double? {
        guard let age = ageInYears else { return nil }
        return age * 12.0
    }
    
    // Postmenstrual age for neonates
    var postmenstrualAge: Double? {
        guard let ga = gestationalAgeWeeks, let pna = postnatalAgeDays else { return nil }
        return ga + (pna / 7.0)
    }
}

// MARK: - Dosing Result Structure

struct DosingResult: Codable, Equatable {
    let recommendedDose: Int // mg
    let interval: Int // hours
    let dailyDose: Double // mg/day
    let mgPerKgPerDay: Double
    let loadingDose: Int? // mg
    
    // Pharmacokinetic predictions
    let predictedPeak: Double // mg/L
    let predictedTrough: Double // mg/L
    let predictedAUC: Double // mg·h/L
    let halfLife: Double // hours
    let clearance: Double // L/h
    let volumeDistribution: Double // L
    let eliminationRateConstant: Double // 1/h
    let creatinineClearance: Double // mL/min
    
    // Confidence intervals (for Bayesian results)
    let peakCI: ConfidenceInterval?
    let troughCI: ConfidenceInterval?
    let aucCI: ConfidenceInterval?
    let clearanceCI: ConfidenceInterval?
    let volumeCI: ConfidenceInterval?
    
    // Clinical guidance
    let dosingSummary: String
    let clinicalNotes: [String]
    let safetyWarnings: [String]
    let monitoringRecommendations: [String]
    
    // Calculation metadata
    let calculationMethod: String
    let guidelineReference: String
    let timestamp: Date
    let isBayesianResult: Bool
    
    init(recommendedDose: Int, interval: Int, dailyDose: Double, mgPerKgPerDay: Double,
         loadingDose: Int? = nil, predictedPeak: Double, predictedTrough: Double,
         predictedAUC: Double, halfLife: Double, clearance: Double,
         volumeDistribution: Double, eliminationRateConstant: Double,
         creatinineClearance: Double, peakCI: ConfidenceInterval? = nil,
         troughCI: ConfidenceInterval? = nil, aucCI: ConfidenceInterval? = nil,
         clearanceCI: ConfidenceInterval? = nil, volumeCI: ConfidenceInterval? = nil,
         dosingSummary: String, clinicalNotes: [String] = [],
         safetyWarnings: [String] = [], monitoringRecommendations: [String] = [],
         calculationMethod: String, guidelineReference: String,
         isBayesianResult: Bool = false) {
        
        self.recommendedDose = recommendedDose
        self.interval = interval
        self.dailyDose = dailyDose
        self.mgPerKgPerDay = mgPerKgPerDay
        self.loadingDose = loadingDose
        self.predictedPeak = predictedPeak
        self.predictedTrough = predictedTrough
        self.predictedAUC = predictedAUC
        self.halfLife = halfLife
        self.clearance = clearance
        self.volumeDistribution = volumeDistribution
        self.eliminationRateConstant = eliminationRateConstant
        self.creatinineClearance = creatinineClearance
        self.peakCI = peakCI
        self.troughCI = troughCI
        self.aucCI = aucCI
        self.clearanceCI = clearanceCI
        self.volumeCI = volumeCI
        self.dosingSummary = dosingSummary
        self.clinicalNotes = clinicalNotes
        self.safetyWarnings = safetyWarnings
        self.monitoringRecommendations = monitoringRecommendations
        self.calculationMethod = calculationMethod
        self.guidelineReference = guidelineReference
        self.timestamp = Date()
        self.isBayesianResult = isBayesianResult
    }
}

// MARK: - Confidence Interval Structure

struct ConfidenceInterval: Codable, Equatable {
    let lower: Double
    let upper: Double
    let median: Double
    let confidence: Double // e.g., 0.95 for 95% CI
    
    var range: String {
        return String(format: "%.1f - %.1f", lower, upper)
    }
    
    var width: Double {
        return upper - lower
    }
}

// MARK: - Vancomycin Level Structure

struct VancomycinLevel: Codable, Identifiable, Equatable {
    let id = UUID()
    let concentration: Double // mg/L
    let timeAfterDose: Double // hours
    let doseGiven: Double // mg
    let timestamp: Date
    let notes: String?
    
    init(concentration: Double, timeAfterDose: Double, doseGiven: Double, notes: String? = nil) {
        self.concentration = concentration
        self.timeAfterDose = timeAfterDose
        self.doseGiven = doseGiven
        self.timestamp = Date()
        self.notes = notes
    }
}

// MARK: - Validation Error Types

enum ValidationError: LocalizedError, Equatable {
    case invalidAge(String)
    case invalidWeight(String)
    case invalidHeight(String)
    case invalidCreatinine(String)
    case invalidGestationalAge(String)
    case invalidPostnatalAge(String)
    case invalidCustomCrCl(String)
    case missingRequiredField(String)
    case populationMismatch(String)
    
    var errorDescription: String? {
        switch self {
        case .invalidAge(let message): return message
        case .invalidWeight(let message): return message
        case .invalidHeight(let message): return message
        case .invalidCreatinine(let message): return message
        case .invalidGestationalAge(let message): return message
        case .invalidPostnatalAge(let message): return message
        case .invalidCustomCrCl(let message): return message
        case .missingRequiredField(let message): return message
        case .populationMismatch(let message): return message
        }
    }
}

// MARK: - Calculation Error Types

enum CalculationError: LocalizedError, Equatable {
    case invalidInput(String)
    case calculationFailed(String)
    case unsupportedPopulation(String)
    case bayesianOptimizationFailed(String)
    case insufficientData(String)
    
    var errorDescription: String? {
        switch self {
        case .invalidInput(let message): return message
        case .calculationFailed(let message): return message
        case .unsupportedPopulation(let message): return message
        case .bayesianOptimizationFailed(let message): return message
        case .insufficientData(let message): return message
        }
    }
}

// MARK: - Analytics Event Types

enum AnalyticsEvent: String, CaseIterable {
    case appLaunched = "app_launched"
    case eulaAccepted = "eula_accepted"
    case calculationPerformed = "calculation_performed"
    case bayesianOptimizationUsed = "bayesian_optimization_used"
    case tutorialStarted = "tutorial_started"
    case tutorialCompleted = "tutorial_completed"
    case settingsOpened = "settings_opened"
    case languageChanged = "language_changed"
    case themeChanged = "theme_changed"
    case errorOccurred = "error_occurred"
    case feedbackSubmitted = "feedback_submitted"
    
    var description: String {
        switch self {
        case .appLaunched: return "App launched"
        case .eulaAccepted: return "EULA accepted"
        case .calculationPerformed: return "Dosing calculation performed"
        case .bayesianOptimizationUsed: return "Bayesian optimization used"
        case .tutorialStarted: return "Tutorial started"
        case .tutorialCompleted: return "Tutorial completed"
        case .settingsOpened: return "Settings opened"
        case .languageChanged: return "Language changed"
        case .themeChanged: return "Theme changed"
        case .errorOccurred: return "Error occurred"
        case .feedbackSubmitted: return "Feedback submitted"
        }
    }
}

// MARK: - Feature Flag Types

enum FeatureFlag: String, CaseIterable {
    case advancedBayesian = "advanced_bayesian"
    case exportResults = "export_results"
    case cloudSync = "cloud_sync"
    case premiumFeatures = "premium_features"
    case betaCalculations = "beta_calculations"
    
    var defaultValue: Bool {
        switch self {
        case .advancedBayesian: return true
        case .exportResults: return true
        case .cloudSync: return false
        case .premiumFeatures: return false
        case .betaCalculations: return false
        }
    }
}

// MARK: - App Constants

struct AppConstants {
    static let appName = "Vancomyzer"
    static let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    static let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    static let supportEmail = "support@vancomyzer.com"
    static let privacyPolicyURL = "https://vancomyzer.com/privacy"
    static let termsOfServiceURL = "https://vancomyzer.com/terms"
    static let websiteURL = "https://vancomyzer.com"
    
    // Clinical constants
    static let maxCrCl: Double = 150.0 // mL/min
    static let minCrCl: Double = 5.0 // mL/min
    static let maxVancomycinDose: Int = 4000 // mg
    static let minVancomycinDose: Int = 250 // mg
    static let standardDoses = [250, 500, 750, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 3000, 3500, 4000]
    static let standardIntervals = [6, 8, 12, 18, 24, 36, 48, 72]
    
    // Target ranges
    static let targetTroughRange = 10.0...20.0 // mg/L
    static let targetPeakRange = 20.0...40.0 // mg/L
    static let targetAUCRange = 400.0...600.0 // mg·h/L
}

// MARK: - User Preferences

class UserPreferences: ObservableObject {
    @AppStorage("selectedLanguage") var selectedLanguage: String = "en"
    @AppStorage("isDarkMode") var isDarkMode: Bool = false
    @AppStorage("analyticsEnabled") var analyticsEnabled: Bool = false
    @AppStorage("crashReportingEnabled") var crashReportingEnabled: Bool = true
    @AppStorage("defaultPopulation") var defaultPopulation: String = PopulationType.adult.rawValue
    @AppStorage("defaultCrClMethod") var defaultCrClMethod: String = CrClMethod.ibw.rawValue
    @AppStorage("showAdvancedOptions") var showAdvancedOptions: Bool = false
    @AppStorage("tutorialCompleted") var tutorialCompleted: Bool = false
    @AppStorage("lastCalculationDate") var lastCalculationDate: Date = Date()
    @AppStorage("calculationCount") var calculationCount: Int = 0
    
    // Feature flags
    @AppStorage("featureFlag_advancedBayesian") var advancedBayesianEnabled: Bool = FeatureFlag.advancedBayesian.defaultValue
    @AppStorage("featureFlag_exportResults") var exportResultsEnabled: Bool = FeatureFlag.exportResults.defaultValue
    @AppStorage("featureFlag_cloudSync") var cloudSyncEnabled: Bool = FeatureFlag.cloudSync.defaultValue
    @AppStorage("featureFlag_premiumFeatures") var premiumFeaturesEnabled: Bool = FeatureFlag.premiumFeatures.defaultValue
    @AppStorage("featureFlag_betaCalculations") var betaCalculationsEnabled: Bool = FeatureFlag.betaCalculations.defaultValue
    
    func isFeatureEnabled(_ feature: FeatureFlag) -> Bool {
        switch feature {
        case .advancedBayesian: return advancedBayesianEnabled
        case .exportResults: return exportResultsEnabled
        case .cloudSync: return cloudSyncEnabled
        case .premiumFeatures: return premiumFeaturesEnabled
        case .betaCalculations: return betaCalculationsEnabled
        }
    }
    
    func setFeature(_ feature: FeatureFlag, enabled: Bool) {
        switch feature {
        case .advancedBayesian: advancedBayesianEnabled = enabled
        case .exportResults: exportResultsEnabled = enabled
        case .cloudSync: cloudSyncEnabled = enabled
        case .premiumFeatures: premiumFeaturesEnabled = enabled
        case .betaCalculations: betaCalculationsEnabled = enabled
        }
    }
}

