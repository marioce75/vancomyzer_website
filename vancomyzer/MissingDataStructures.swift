import Foundation
import SwiftUI

// MARK: - Missing Data Structures and Extensions

// MARK: - ConfidenceInterval

struct ConfidenceInterval: Codable, Equatable {
    let lower: Double
    let upper: Double
    let median: Double
    let confidence: Double
    
    var estimate: Double {
        return median
    }
    
    var width: Double {
        return upper - lower
    }
    
    init(lower: Double, upper: Double, median: Double, confidence: Double = 0.95) {
        self.lower = lower
        self.upper = upper
        self.median = median
        self.confidence = confidence
    }
    
    // Convenience initializer for symmetric intervals
    init(estimate: Double, width: Double, confidence: Double = 0.95) {
        let halfWidth = width / 2.0
        self.lower = estimate - halfWidth
        self.upper = estimate + halfWidth
        self.median = estimate
        self.confidence = confidence
    }
}

// MARK: - ValidationState

enum ValidationState: Equatable {
    case valid
    case invalid(String)
    
    var isValid: Bool {
        switch self {
        case .valid:
            return true
        case .invalid:
            return false
        }
    }
    
    var errorMessage: String? {
        switch self {
        case .valid:
            return nil
        case .invalid(let message):
            return message
        }
    }
}

// MARK: - Gender Extension

extension Gender {
    var localizedName: String {
        switch self {
        case .male:
            return NSLocalizedString("gender.male", comment: "Male")
        case .female:
            return NSLocalizedString("gender.female", comment: "Female")
        case .other:
            return NSLocalizedString("gender.other", comment: "Other")
        }
    }
}

// MARK: - PopulationType Extension

extension PopulationType {
    var localizedName: String {
        switch self {
        case .adult:
            return NSLocalizedString("population.adult", comment: "Adult")
        case .pediatric:
            return NSLocalizedString("population.pediatric", comment: "Pediatric")
        case .neonate:
            return NSLocalizedString("population.neonate", comment: "Neonate")
        }
    }
    
    var ageDescription: String {
        switch self {
        case .adult:
            return "≥18 years"
        case .pediatric:
            return "1 month - 17 years"
        case .neonate:
            return "≤1 month"
        }
    }
    
    var color: Color {
        switch self {
        case .adult:
            return .vancoBlue
        case .pediatric:
            return .vancoOrange
        case .neonate:
            return .vancoGreen
        }
    }
}

// MARK: - Indication Extension

extension Indication {
    var localizedName: String {
        switch self {
        case .pneumonia:
            return NSLocalizedString("indication.pneumonia", comment: "Pneumonia")
        case .skinSoftTissue:
            return NSLocalizedString("indication.skin_soft_tissue", comment: "Skin/Soft Tissue")
        case .bacteremia:
            return NSLocalizedString("indication.bacteremia", comment: "Bacteremia")
        case .endocarditis:
            return NSLocalizedString("indication.endocarditis", comment: "Endocarditis")
        case .meningitis:
            return NSLocalizedString("indication.meningitis", comment: "Meningitis")
        case .osteomyelitis:
            return NSLocalizedString("indication.osteomyelitis", comment: "Osteomyelitis")
        case .other:
            return NSLocalizedString("indication.other", comment: "Other")
        }
    }
    
    var targetAUC: ClosedRange<Double> {
        switch self {
        case .pneumonia, .bacteremia:
            return 400...600
        case .endocarditis, .meningitis, .osteomyelitis:
            return 450...600
        case .skinSoftTissue:
            return 400...550
        case .other:
            return 400...600
        }
    }
}

// MARK: - InfectionSeverity Extension (renamed from Severity to avoid conflicts)

extension InfectionSeverity {
    var localizedName: String {
        switch self {
        case .mild:
            return NSLocalizedString("severity.mild", comment: "Mild")
        case .moderate:
            return NSLocalizedString("severity.moderate", comment: "Moderate")
        case .severe:
            return NSLocalizedString("severity.severe", comment: "Severe")
        }
    }
    
    var targetAUCMultiplier: Double {
        switch self {
        case .mild:
            return 1.0
        case .moderate:
            return 1.1
        case .severe:
            return 1.2
        }
    }
}

// MARK: - CrClMethod Extension

extension CrClMethod {
    var localizedName: String {
        switch self {
        case .ibw:
            return NSLocalizedString("crcl_method.ibw", comment: "Ideal Body Weight")
        case .tbw:
            return NSLocalizedString("crcl_method.tbw", comment: "Total Body Weight")
        case .abw:
            return NSLocalizedString("crcl_method.abw", comment: "Adjusted Body Weight")
        case .custom:
            return NSLocalizedString("crcl_method.custom", comment: "Custom")
        }
    }
    
    var description: String {
        switch self {
        case .ibw:
            return "Cockcroft-Gault using Ideal Body Weight"
        case .tbw:
            return "Cockcroft-Gault using Total Body Weight"
        case .abw:
            return "Cockcroft-Gault using Adjusted Body Weight"
        case .custom:
            return "User-provided creatinine clearance"
        }
    }
}

// MARK: - BMI Extension for PatientInput

extension PatientInput {
    var bmi: Double? {
        guard let height = heightInCm, height > 0 else { return nil }
        let heightInMeters = height / 100.0
        return weightInKg / (heightInMeters * heightInMeters)
    }
    
    var bmiCategory: BMICategory? {
        guard let bmi = bmi else { return nil }
        
        switch populationType {
        case .adult:
            switch bmi {
            case ..<18.5:
                return .underweight
            case 18.5..<25:
                return .normal
            case 25..<30:
                return .overweight
            default:
                return .obese
            }
        case .pediatric, .neonate:
            // Pediatric BMI interpretation is more complex and age-dependent
            return .normal // Simplified for this implementation
        }
    }
    
    var idealBodyWeight: Double {
        guard let height = heightInCm else { return weightInKg }
        
        switch gender {
        case .male:
            return 50 + 2.3 * ((height / 2.54) - 60)
        case .female:
            return 45.5 + 2.3 * ((height / 2.54) - 60)
        case .other:
            return (50 + 45.5) / 2 + 2.3 * ((height / 2.54) - 60)
        }
    }
    
    var adjustedBodyWeight: Double {
        let ibw = idealBodyWeight
        if weightInKg > ibw {
            return ibw + 0.4 * (weightInKg - ibw)
        }
        return weightInKg
    }
}

enum BMICategory {
    case underweight
    case normal
    case overweight
    case obese
    
    var displayName: String {
        switch self {
        case .underweight:
            return NSLocalizedString("bmi.underweight", comment: "Underweight")
        case .normal:
            return NSLocalizedString("bmi.normal", comment: "Normal")
        case .overweight:
            return NSLocalizedString("bmi.overweight", comment: "Overweight")
        case .obese:
            return NSLocalizedString("bmi.obese", comment: "Obese")
        }
    }
}

// MARK: - Tutorial State Management

@MainActor
class TutorialStateManager: ObservableObject {
    @Published var currentStep = 0
    @Published var isActive = false
    @Published var completedSteps: Set<Int> = []
    
    private let maxSteps = 7
    
    func startTutorial() {
        isActive = true
        currentStep = 0
        completedSteps.removeAll()
    }
    
    func nextStep() {
        completedSteps.insert(currentStep)
        
        if currentStep < maxSteps - 1 {
            currentStep += 1
        } else {
            completeTutorial()
        }
    }
    
    func previousStep() {
        if currentStep > 0 {
            currentStep -= 1
        }
    }
    
    func completeTutorial() {
        isActive = false
        TutorialManager.shared.hasCompletedTutorial = true
        
        AnalyticsManager.shared.trackFeatureUsage("tutorial_completed", parameters: [
            "steps_completed": completedSteps.count,
            "total_steps": maxSteps
        ])
    }
    
    func skipTutorial() {
        isActive = false
        
        AnalyticsManager.shared.trackFeatureUsage("tutorial_skipped", parameters: [
            "steps_completed": completedSteps.count,
            "current_step": currentStep
        ])
    }
}

// MARK: - User Preferences Helper

extension UserPreferences {
    // Language helpers
    var availableLanguages: [String] {
        return ["en", "es", "ar"]
    }
    
    var languageDisplayName: String {
        switch selectedLanguage {
        case "en":
            return "English"
        case "es":
            return "Español"
        case "ar":
            return "العربية"
        default:
            return "English"
        }
    }
    
    // Theme helpers
    var themeDisplayName: String {
        return isDarkMode ? "Dark" : "Light"
    }
    
    // Reset methods
    func resetToDefaults() {
        selectedLanguage = "en"
        isDarkMode = false
        defaultPopulation = PopulationType.adult.rawValue
        defaultCrClMethod = CrClMethod.ibw.rawValue
        showAdvancedOptions = false
        analyticsEnabled = true
        
        AnalyticsManager.shared.trackFeatureUsage("preferences_reset")
    }
    
    func exportPreferences() -> [String: Any] {
        return [
            "language": selectedLanguage,
            "dark_mode": isDarkMode,
            "default_population": defaultPopulation,
            "default_crcl_method": defaultCrClMethod,
            "advanced_options": showAdvancedOptions,
            "analytics_enabled": analyticsEnabled,
            "calculation_count": calculationCount,
            "last_calculation": ISO8601DateFormatter().string(from: lastCalculationDate)
        ]
    }
}

// MARK: - App State Management

@MainActor
class AppStateManager: ObservableObject {
    static let shared = AppStateManager()
    
    @Published var isFirstLaunch = true
    @Published var shouldShowTutorial = false
    @Published var currentCalculation: DosingResult?
    @Published var currentBayesianOptimization: BayesianOptimizationResult?
    
    private init() {
        checkFirstLaunch()
    }
    
    private func checkFirstLaunch() {
        isFirstLaunch = !UserDefaults.standard.bool(forKey: "has_launched_before")
        
        if isFirstLaunch {
            UserDefaults.standard.set(true, forKey: "has_launched_before")
            shouldShowTutorial = true
        }
    }
    
    func resetAppState() {
        UserDefaults.standard.removeObject(forKey: "has_launched_before")
        isFirstLaunch = true
        shouldShowTutorial = true
        currentCalculation = nil
        currentBayesianOptimization = nil
        
        AnalyticsManager.shared.trackFeatureUsage("app_state_reset")
    }
}

// MARK: - Missing type aliases to fix compilation

typealias Severity = InfectionSeverity

// MARK: - Additional convenience extensions

extension Bundle {
    var appName: String {
        return infoDictionary?["CFBundleDisplayName"] as? String ?? 
               infoDictionary?["CFBundleName"] as? String ?? 
               "Vancomyzer"
    }
}