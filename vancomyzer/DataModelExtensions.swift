import Foundation
import SwiftUI

// MARK: - PatientInput Extensions

extension PatientInput {
    var ageDisplay: String {
        switch populationType {
        case .adult, .pediatric:
            guard let age = ageInYears else { return "Unknown" }
            if age < 1 {
                let months = Int(age * 12)
                return "\(months) months"
            } else {
                return String(format: "%.1f years", age)
            }
        case .neonate:
            guard let ga = gestationalAgeWeeks, let pna = postnatalAgeDays else { return "Unknown" }
            return "\(String(format: "%.1f", ga)) weeks GA, \(Int(pna)) days"
        }
    }
    
    var weightDisplay: String {
        return String(format: "%.1f kg", weightInKg)
    }
    
    var heightDisplay: String? {
        guard let height = heightInCm else { return nil }
        return String(format: "%.0f cm", height)
    }
    
    var creatinineDisplay: String {
        return String(format: "%.2f mg/dL", serumCreatinine)
    }
    
    var bmiDisplay: String? {
        guard let bmi = bmi else { return nil }
        return String(format: "%.1f kg/m²", bmi)
    }
    
    // Clinical summary for display
    var clinicalSummary: String {
        var summary = "\(populationType.localizedName), \(ageDisplay), \(weightDisplay)"
        if let height = heightDisplay {
            summary += ", \(height)"
        }
        summary += ", SCr: \(creatinineDisplay)"
        return summary
    }
    
    // Sample data for previews and testing
    static let sampleAdult = PatientInput(
        populationType: .adult,
        ageInYears: 45,
        gender: .male,
        weightInKg: 70,
        heightInCm: 175,
        serumCreatinine: 1.0,
        gestationalAgeWeeks: nil,
        postnatalAgeDays: nil,
        indication: .pneumonia,
        severity: .moderate,
        isRenalFunctionStable: true,
        isOnHemodialysis: false,
        isOnCRRT: false,
        crClMethod: .ibw,
        customCrCl: nil
    )
    
    static let samplePediatric = PatientInput(
        populationType: .pediatric,
        ageInYears: 8,
        gender: .female,
        weightInKg: 25,
        heightInCm: 125,
        serumCreatinine: 0.6,
        gestationalAgeWeeks: nil,
        postnatalAgeDays: nil,
        indication: .skinSoftTissue,
        severity: .moderate,
        isRenalFunctionStable: true,
        isOnHemodialysis: false,
        isOnCRRT: false,
        crClMethod: .tbw,
        customCrCl: nil
    )
    
    static let sampleNeonate = PatientInput(
        populationType: .neonate,
        ageInYears: nil,
        gender: .male,
        weightInKg: 3.2,
        heightInCm: nil,
        serumCreatinine: 0.8,
        gestationalAgeWeeks: 34,
        postnatalAgeDays: 5,
        indication: .bacteremia,
        severity: .severe,
        isRenalFunctionStable: true,
        isOnHemodialysis: false,
        isOnCRRT: false,
        crClMethod: .tbw,
        customCrCl: nil
    )
    
    static let samplePatient = sampleAdult
}

// MARK: - DosingResult Extensions

extension DosingResult {
    var dosingSummaryFormatted: String {
        var summary = dosingSummary
        if let loading = loadingDose {
            summary = "Loading: \(loading) mg, then " + summary
        }
        return summary
    }
    
    var aucDisplay: String {
        return String(format: "%.0f mg·h/L", predictedAUC)
    }
    
    var troughDisplay: String {
        return String(format: "%.1f mg/L", predictedTrough)
    }
    
    var peakDisplay: String {
        return String(format: "%.1f mg/L", predictedPeak)
    }
    
    var clearanceDisplay: String {
        return String(format: "%.2f L/h", clearance)
    }
    
    var volumeDisplay: String {
        return String(format: "%.1f L", volumeDistribution)
    }
    
    var halfLifeDisplay: String {
        return String(format: "%.1f hours", halfLife)
    }
    
    var crclDisplay: String {
        return String(format: "%.0f mL/min", creatinineClearance)
    }
    
    // Risk assessment
    var riskLevel: RiskLevel {
        var risks: [RiskLevel] = []
        
        if predictedTrough > 20 || predictedPeak > 40 || predictedAUC > 600 {
            risks.append(.high)
        } else if predictedTrough > 15 || predictedPeak > 35 || predictedAUC > 550 {
            risks.append(.medium)
        } else {
            risks.append(.low)
        }
        
        return risks.max() ?? .low
    }
    
    // Target achievement status
    var targetAchievement: TargetAchievement {
        let aucInRange = (400...600).contains(predictedAUC)
        let troughInRange = (10...20).contains(predictedTrough)
        
        if aucInRange && troughInRange {
            return .optimal
        } else if aucInRange || troughInRange {
            return .acceptable
        } else {
            return .suboptimal
        }
    }
    
    // Sample data for previews
    static let sampleResult = DosingResult(
        recommendedDose: 1000,
        interval: 12,
        dailyDose: 2000,
        mgPerKgPerDay: 28.6,
        loadingDose: nil,
        predictedPeak: 25.5,
        predictedTrough: 12.8,
        predictedAUC: 450,
        halfLife: 6.2,
        clearance: 2.1,
        volumeDistribution: 49.0,
        eliminationRateConstant: 0.043,
        creatinineClearance: 85,
        dosingSummary: "1000 mg every 12 hours",
        clinicalNotes: [
            "Dosing based on ASHP/IDSA 2020 guidelines",
            "Target AUC₀₋₂₄: 450 mg·h/L achieved"
        ],
        safetyWarnings: [],
        monitoringRecommendations: [
            "Obtain levels before 4th dose",
            "Monitor renal function every 2-3 days"
        ],
        calculationMethod: "Population PK (Adult)",
        guidelineReference: "ASHP/IDSA 2020"
    )
    
    // Alternative regimens
    var alternativeRegimens: [AlternativeRegimen] {
        let baseAUC = predictedAUC
        var alternatives: [AlternativeRegimen] = []
        
        // Generate alternatives based on different intervals
        let intervals = [8, 12, 24]
        let baseDose = Double(recommendedDose)
        
        for intervalOption in intervals {
            if intervalOption != interval {
                let adjustedDose = (baseDose * Double(interval)) / Double(intervalOption)
                let roundedDose = round(adjustedDose / 250) * 250 // Round to nearest 250mg
                let predictedAUC = (roundedDose * 24.0) / (clearance * Double(intervalOption))
                
                alternatives.append(AlternativeRegimen(
                    dose: roundedDose,
                    interval: Double(intervalOption),
                    predictedAUC: predictedAUC,
                    suitability: getSuitability(auc: predictedAUC)
                ))
            }
        }
        
        return alternatives.sorted { $0.predictedAUC > $1.predictedAUC }
    }
    
    private func getSuitability(auc: Double) -> String {
        switch auc {
        case 400...600: return "Optimal"
        case 350...650: return "Acceptable"
        default: return "Suboptimal"
        }
    }
}

// MARK: - Supporting Enums

enum RiskLevel: Int, CaseIterable, Comparable {
    case low = 0
    case medium = 1
    case high = 2
    
    static func < (lhs: RiskLevel, rhs: RiskLevel) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
    
    var displayName: String {
        switch self {
        case .low: return "Low Risk"
        case .medium: return "Medium Risk"
        case .high: return "High Risk"
        }
    }
    
    var color: Color {
        switch self {
        case .low: return .clinicalSafe
        case .medium: return .clinicalCaution
        case .high: return .clinicalDanger
        }
    }
}

enum TargetAchievement: CaseIterable {
    case optimal
    case acceptable
    case suboptimal
    
    var displayName: String {
        switch self {
        case .optimal: return "Optimal"
        case .acceptable: return "Acceptable"
        case .suboptimal: return "Suboptimal"
        }
    }
    
    var color: Color {
        switch self {
        case .optimal: return .clinicalSafe
        case .acceptable: return .clinicalCaution
        case .suboptimal: return .clinicalDanger
        }
    }
}

// MARK: - VancomycinLevel Extensions

extension VancomycinLevel {
    var concentrationDisplay: String {
        return String(format: "%.1f mg/L", concentration)
    }
    
    var timeDisplay: String {
        if timeAfterDose < 1 {
            let minutes = Int(timeAfterDose * 60)
            return "\(minutes) min"
        } else {
            return String(format: "%.1f h", timeAfterDose)
        }
    }
    
    var doseDisplay: String {
        return String(format: "%.0f mg", doseGiven)
    }
    
    var timestampDisplay: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: timestamp)
    }
    
    // Level interpretation
    var interpretation: LevelInterpretation {
        switch type {
        case .trough:
            if concentration < 10 {
                return .belowTarget
            } else if concentration > 20 {
                return .aboveTarget
            } else {
                return .withinTarget
            }
        case .peak:
            if concentration < 20 {
                return .belowTarget
            } else if concentration > 40 {
                return .aboveTarget
            } else {
                return .withinTarget
            }
        case .random:
            return .unknown
        }
    }
    
    // Sample data
    static let sampleTrough = VancomycinLevel(
        concentration: 15.2,
        timeAfterDose: 12.0,
        doseGiven: 1000,
        notes: "type:trough,dose_number:4"
    )
    
    static let samplePeak = VancomycinLevel(
        concentration: 28.5,
        timeAfterDose: 1.0,
        doseGiven: 1000,
        notes: "type:peak,dose_number:4"
    )
}

enum LevelInterpretation {
    case belowTarget
    case withinTarget
    case aboveTarget
    case unknown
    
    var displayName: String {
        switch self {
        case .belowTarget: return "Below Target"
        case .withinTarget: return "Within Target"
        case .aboveTarget: return "Above Target"
        case .unknown: return "Unknown"
        }
    }
    
    var color: Color {
        switch self {
        case .belowTarget: return .clinicalCaution
        case .withinTarget: return .clinicalSafe
        case .aboveTarget: return .clinicalDanger
        case .unknown: return .secondary
        }
    }
}

// MARK: - ConfidenceInterval Extensions

extension ConfidenceInterval {
    var displayRange: String {
        return "\(String(format: "%.1f", lower))-\(String(format: "%.1f", upper))"
    }
    
    var displayWithUnit: (unit: String) -> String {
        return { unit in
            "\(self.displayRange) \(unit)"
        }
    }
    
    var widthPercentage: Double {
        return (width / median) * 100
    }
}

// MARK: - UserPreferences Extensions

extension UserPreferences {
    var selectedPopulationType: PopulationType {
        get {
            PopulationType(rawValue: defaultPopulation) ?? .adult
        }
        set {
            defaultPopulation = newValue.rawValue
        }
    }
    
    var selectedCrClMethod: CrClMethod {
        get {
            CrClMethod(rawValue: defaultCrClMethod) ?? .ibw
        }
        set {
            defaultCrClMethod = newValue.rawValue
        }
    }
    
    // Usage statistics
    var averageCalculationsPerDay: Double {
        let daysSinceFirst = max(1, Date().timeIntervalSince(lastCalculationDate) / (24 * 3600))
        return Double(calculationCount) / daysSinceFirst
    }
    
    // Settings summary
    var settingsSummary: [String: String] {
        return [
            "Language": selectedLanguage,
            "Theme": isDarkMode ? "Dark" : "Light",
            "Default Population": selectedPopulationType.localizedName,
            "Default CrCl Method": selectedCrClMethod.localizedName,
            "Analytics": analyticsEnabled ? "Enabled" : "Disabled",
            "Advanced Options": showAdvancedOptions ? "Shown" : "Hidden"
        ]
    }
}

// MARK: - AnalyticsEvent Extensions

extension AnalyticsEvent {
    // Common event creation helpers
    static func calculationPerformed(
        population: PopulationType,
        indication: Indication,
        severity: InfectionSeverity,
        method: String
    ) -> AnalyticsEvent {
        return AnalyticsEvent(
            name: "calculation_performed",
            parameters: [
                "population": population.rawValue,
                "indication": indication.rawValue,
                "severity": severity.rawValue,
                "method": method
            ]
        )
    }
    
    static func bayesianOptimizationUsed(
        levels: Int,
        convergence: Bool,
        method: String
    ) -> AnalyticsEvent {
        return AnalyticsEvent(
            name: "bayesian_optimization",
            parameters: [
                "level_count": levels,
                "converged": convergence,
                "method": method
            ]
        )
    }
    
    static func featureUsed(_ feature: String, context: [String: Any] = [:]) -> AnalyticsEvent {
        return AnalyticsEvent(
            name: "feature_usage",
            parameters: context.merging(["feature": feature]) { _, new in new }
        )
    }
}

// MARK: - Formatting Extensions

extension DateFormatter {
    static let calculationTimestamp: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()
    
    static let levelTimestamp: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter
    }()
    
    static let exportTimestamp: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd_HH-mm-ss"
        return formatter
    }()
}

extension NumberFormatter {
    static let concentration: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 1
        formatter.maximumFractionDigits = 1
        return formatter
    }()
    
    static let dose: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 0
        return formatter
    }()
    
    static let pharmacokinetic: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 3
        return formatter
    }()
}