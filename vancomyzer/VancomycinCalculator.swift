import Foundation
import Accelerate

// MARK: - Main Vancomycin Calculator

class VancomycinCalculator {
    
    // MARK: - Main API Entry Point
    
    static func calculateDosing(patient: PatientInput, useBayesian: Bool = false, levels: [VancomycinLevel] = []) throws -> DosingResult {
        
        // Validate patient input
        try ValidationEngine.validatePatientInput(patient)
        
        // Perform calculation based on method
        if useBayesian && !levels.isEmpty {
            return try BayesianEngine.calculateBayesianDosing(patient: patient, levels: levels)
        } else {
            return try calculatePopulationDosing(patient: patient)
        }
    }
    
    // MARK: - Population-Based Dosing
    
    private static func calculatePopulationDosing(patient: PatientInput) throws -> DosingResult {
        switch patient.populationType {
        case .adult:
            return try calculateAdultDosing(patient: patient)
        case .pediatric:
            return try calculatePediatricDosing(patient: patient)
        case .neonate:
            return try calculateNeonatalDosing(patient: patient)
        }
    }
    
    // MARK: - Adult Dosing (ASHP/IDSA 2020)
    
    private static func calculateAdultDosing(patient: PatientInput) throws -> DosingResult {
        guard let age = patient.ageInYears, let height = patient.heightInCm else {
            throw CalculationError.invalidInput("Age and height required for adult dosing")
        }
        
        // Calculate body weights
        let ibw = calculateIdealBodyWeight(height: height, gender: patient.gender)
        let adjbw = calculateAdjustedBodyWeight(tbw: patient.weightInKg, ibw: ibw)
        
        // Calculate creatinine clearance
        let crCl = try calculateCreatinineClearance(patient: patient, ibw: ibw, adjbw: adjbw)
        
        // Calculate pharmacokinetic parameters
        let vd = calculateVolumeOfDistribution(weight: patient.weightInKg, population: .adult)
        let cl = calculateClearance(crCl: crCl, weight: patient.weightInKg, population: .adult)
        let ke = cl / vd
        let halfLife = 0.693 / ke
        
        // Determine target AUC
        let targetAUC = determineTargetAUC(indication: patient.indication, severity: patient.severity)
        
        // Calculate optimal dose and interval
        let (dose, interval) = calculateOptimalDoseAndInterval(
            targetAUC: targetAUC,
            clearance: cl,
            volumeOfDistribution: vd,
            halfLife: halfLife,
            population: .adult
        )
        
        // Calculate loading dose if needed
        let loadingDose = shouldUseLoadingDose(patient: patient) ? 
            calculateLoadingDose(vd: vd, targetLevel: 20.0) : nil
        
        // Calculate predicted concentrations
        let actualAUC = (Double(dose) * 24.0) / (cl * Double(interval))
        let peak = calculatePeakConcentration(dose: Double(dose), vd: vd)
        let trough = calculateTroughConcentration(dose: Double(dose), vd: vd, ke: ke, interval: Double(interval))
        
        // Generate clinical guidance
        let dosingSummary = generateDosingSummary(dose: dose, interval: interval, loadingDose: loadingDose)
        let clinicalNotes = generateAdultClinicalNotes(patient: patient, result: (dose, interval, actualAUC, peak, trough))
        let safetyWarnings = generateSafetyWarnings(patient: patient, peak: peak, trough: trough, auc: actualAUC)
        let monitoringRecommendations = generateMonitoringRecommendations(patient: patient)
        
        return DosingResult(
            recommendedDose: dose,
            interval: interval,
            dailyDose: (Double(dose) * 24.0) / Double(interval),
            mgPerKgPerDay: ((Double(dose) * 24.0) / Double(interval)) / patient.weightInKg,
            loadingDose: loadingDose,
            predictedPeak: peak,
            predictedTrough: trough,
            predictedAUC: actualAUC,
            halfLife: halfLife,
            clearance: cl,
            volumeDistribution: vd,
            eliminationRateConstant: ke,
            creatinineClearance: crCl,
            dosingSummary: dosingSummary,
            clinicalNotes: clinicalNotes,
            safetyWarnings: safetyWarnings,
            monitoringRecommendations: monitoringRecommendations,
            calculationMethod: "Population PK (Adult)",
            guidelineReference: "ASHP/IDSA 2020"
        )
    }
    
    // MARK: - Pediatric Dosing (IDSA 2011)
    
    private static func calculatePediatricDosing(patient: PatientInput) throws -> DosingResult {
        guard let age = patient.ageInYears, let height = patient.heightInCm else {
            throw CalculationError.invalidInput("Age and height required for pediatric dosing")
        }
        
        // Calculate pediatric creatinine clearance (Schwartz equation)
        let crCl = calculatePediatricCreatinineClearance(patient: patient)
        
        // Calculate pediatric pharmacokinetic parameters
        let vd = calculateVolumeOfDistribution(weight: patient.weightInKg, population: .pediatric, age: age)
        let cl = calculateClearance(crCl: crCl, weight: patient.weightInKg, population: .pediatric, age: age)
        let ke = cl / vd
        let halfLife = 0.693 / ke
        
        // Pediatric target AUC (typically lower than adults)
        let baseTargetAUC = 400.0
        let targetAUC = baseTargetAUC * getSeverityMultiplier(patient.severity)
        
        // Calculate weight-based dosing
        let mgPerKgDose = calculatePediatricMgPerKg(age: age, targetAUC: targetAUC, clearance: cl, weight: patient.weightInKg)
        let totalDose = mgPerKgDose * patient.weightInKg
        
        // Determine interval based on age and renal function
        let interval = determinePediatricInterval(age: age, halfLife: halfLife, crCl: crCl)
        let standardDose = roundToStandardDose(totalDose)
        
        // Calculate loading dose for severe infections
        let loadingDose = shouldUseLoadingDose(patient: patient) ? 
            calculateLoadingDose(vd: vd, targetLevel: 15.0) : nil
        
        // Calculate predicted concentrations
        let actualAUC = (Double(standardDose) * 24.0) / (cl * Double(interval))
        let peak = calculatePeakConcentration(dose: Double(standardDose), vd: vd)
        let trough = calculateTroughConcentration(dose: Double(standardDose), vd: vd, ke: ke, interval: Double(interval))
        
        // Generate clinical guidance
        let dosingSummary = generateDosingSummary(dose: standardDose, interval: interval, loadingDose: loadingDose)
        let clinicalNotes = generatePediatricClinicalNotes(patient: patient, mgPerKg: mgPerKgDose)
        let safetyWarnings = generateSafetyWarnings(patient: patient, peak: peak, trough: trough, auc: actualAUC)
        let monitoringRecommendations = generateMonitoringRecommendations(patient: patient)
        
        return DosingResult(
            recommendedDose: standardDose,
            interval: interval,
            dailyDose: (Double(standardDose) * 24.0) / Double(interval),
            mgPerKgPerDay: ((Double(standardDose) * 24.0) / Double(interval)) / patient.weightInKg,
            loadingDose: loadingDose,
            predictedPeak: peak,
            predictedTrough: trough,
            predictedAUC: actualAUC,
            halfLife: halfLife,
            clearance: cl,
            volumeDistribution: vd,
            eliminationRateConstant: ke,
            creatinineClearance: crCl,
            dosingSummary: dosingSummary,
            clinicalNotes: clinicalNotes,
            safetyWarnings: safetyWarnings,
            monitoringRecommendations: monitoringRecommendations,
            calculationMethod: "Population PK (Pediatric)",
            guidelineReference: "IDSA 2011"
        )
    }
    
    // MARK: - Neonatal Dosing
    
    private static func calculateNeonatalDosing(patient: PatientInput) throws -> DosingResult {
        guard let gestationalAge = patient.gestationalAgeWeeks,
              let postnatalAge = patient.postnatalAgeDays else {
            throw CalculationError.invalidInput("Gestational age and postnatal age required for neonatal dosing")
        }
        
        // Calculate postmenstrual age
        let postmenstrualAge = gestationalAge + (postnatalAge / 7.0)
        
        // Calculate maturation factors
        let renalMaturation = calculateRenalMaturation(gestationalAge: gestationalAge, postnatalAge: postnatalAge)
        
        // Calculate neonatal pharmacokinetic parameters
        let vd = calculateVolumeOfDistribution(weight: patient.weightInKg, population: .neonate, gestationalAge: gestationalAge)
        let baseCl = calculateNeonatalBaseClearance(weight: patient.weightInKg, postmenstrualAge: postmenstrualAge)
        let cl = baseCl * renalMaturation
        let ke = cl / vd
        let halfLife = 0.693 / ke
        
        // Neonatal target AUC (more conservative)
        let targetAUC = 350.0 * getSeverityMultiplier(patient.severity)
        
        // Calculate dose based on maturation
        let interval = determineNeonatalInterval(gestationalAge: gestationalAge, postnatalAge: postnatalAge, halfLife: halfLife)
        let dose = (targetAUC * cl * Double(interval)) / 24.0
        let standardDose = roundToStandardDose(dose)
        
        // Loading dose for severe infections (conservative)
        let loadingDose = shouldUseLoadingDose(patient: patient) ? 
            calculateLoadingDose(vd: vd, targetLevel: 12.0) : nil
        
        // Calculate predicted concentrations
        let actualAUC = (Double(standardDose) * 24.0) / (cl * Double(interval))
        let peak = calculatePeakConcentration(dose: Double(standardDose), vd: vd)
        let trough = calculateTroughConcentration(dose: Double(standardDose), vd: vd, ke: ke, interval: Double(interval))
        
        // Generate clinical guidance
        let dosingSummary = generateDosingSummary(dose: standardDose, interval: interval, loadingDose: loadingDose)
        let clinicalNotes = generateNeonatalClinicalNotes(patient: patient, pma: postmenstrualAge, maturation: renalMaturation)
        let safetyWarnings = generateSafetyWarnings(patient: patient, peak: peak, trough: trough, auc: actualAUC)
        let monitoringRecommendations = generateMonitoringRecommendations(patient: patient)
        
        return DosingResult(
            recommendedDose: standardDose,
            interval: interval,
            dailyDose: (Double(standardDose) * 24.0) / Double(interval),
            mgPerKgPerDay: ((Double(standardDose) * 24.0) / Double(interval)) / patient.weightInKg,
            loadingDose: loadingDose,
            predictedPeak: peak,
            predictedTrough: trough,
            predictedAUC: actualAUC,
            halfLife: halfLife,
            clearance: cl,
            volumeDistribution: vd,
            eliminationRateConstant: ke,
            creatinineClearance: cl / 0.8, // Approximate conversion for neonates
            dosingSummary: dosingSummary,
            clinicalNotes: clinicalNotes,
            safetyWarnings: safetyWarnings,
            monitoringRecommendations: monitoringRecommendations,
            calculationMethod: "Population PK (Neonatal)",
            guidelineReference: "Neonatal Guidelines"
        )
    }
    
    // MARK: - Body Weight Calculations
    
    static func calculateIdealBodyWeight(height: Double, gender: Gender) -> Double {
        let heightInInches = height / 2.54
        let baseWeight = gender == .male ? 50.0 : 45.5
        let weightPerInch = 2.3
        let baseHeight = 60.0 // inches (5 feet)
        
        return max(baseWeight, baseWeight + weightPerInch * (heightInInches - baseHeight))
    }
    
    static func calculateAdjustedBodyWeight(tbw: Double, ibw: Double) -> Double {
        if tbw > (1.2 * ibw) {
            return ibw + 0.4 * (tbw - ibw)
        }
        return tbw
    }
    
    // MARK: - Creatinine Clearance Calculations
    
    private static func calculateCreatinineClearance(patient: PatientInput, ibw: Double, adjbw: Double) throws -> Double {
        guard let age = patient.ageInYears else {
            throw CalculationError.invalidInput("Age required for creatinine clearance calculation")
        }
        
        let weight: Double
        let scr: Double
        
        switch patient.crClMethod {
        case .tbw:
            weight = patient.weightInKg
            scr = patient.serumCreatinine
        case .adjbw:
            weight = adjbw
            scr = patient.serumCreatinine
        case .ibw:
            weight = ibw
            scr = patient.serumCreatinine
        case .tbwRoundedScr:
            weight = patient.weightInKg
            scr = max(patient.serumCreatinine, 1.0)
        case .custom:
            guard let customCrCl = patient.customCrCl else {
                throw CalculationError.invalidInput("Custom CrCl value required")
            }
            return min(max(customCrCl, AppConstants.minCrCl), AppConstants.maxCrCl)
        }
        
        // Cockcroft-Gault equation
        let genderFactor = patient.gender == .female ? 0.85 : 1.0
        let crCl = ((140 - age) * weight * genderFactor) / (72 * scr)
        
        // Cap at maximum value
        return min(crCl, AppConstants.maxCrCl)
    }
    
    private static func calculatePediatricCreatinineClearance(patient: PatientInput) -> Double {
        guard let height = patient.heightInCm, let age = patient.ageInYears else {
            return 50.0 // Default fallback
        }
        
        // Schwartz equation for pediatric patients
        let k: Double
        if age < 1 {
            k = 0.33 // Infants
        } else if age < 13 {
            k = 0.55 // Children
        } else {
            k = 0.70 // Adolescents
        }
        
        let crCl = (k * height) / patient.serumCreatinine
        return min(crCl, AppConstants.maxCrCl)
    }
    
    // MARK: - Pharmacokinetic Parameter Calculations
    
    private static func calculateVolumeOfDistribution(weight: Double, population: PopulationType, age: Double? = nil, gestationalAge: Double? = nil) -> Double {
        switch population {
        case .adult:
            // Adult Vd = 0.7 L/kg (range 0.4-1.0)
            return 0.7 * weight
        case .pediatric:
            guard let age = age else { return 0.7 * weight }
            // Pediatric Vd varies with age
            if age < 1 {
                return 0.8 * weight // Higher Vd in infants
            } else if age < 12 {
                return 0.75 * weight
            } else {
                return 0.7 * weight // Approaching adult values
            }
        case .neonate:
            // Neonatal Vd is higher due to increased total body water
            let baseVd = 0.9 * weight
            if let ga = gestationalAge, ga < 37 {
                return baseVd * 1.2 // Preterm infants have higher Vd
            }
            return baseVd
        }
    }
    
    private static func calculateClearance(crCl: Double, weight: Double, population: PopulationType, age: Double? = nil) -> Double {
        switch population {
        case .adult:
            // Adult clearance correlation with creatinine clearance
            // Cl (L/h) = 0.048 * CrCl + 0.2
            let baseCl = 0.048 * crCl + 0.2
            
            // Adjust for elderly patients
            if let age = age, age > 65 {
                return baseCl * 0.9
            }
            return baseCl
            
        case .pediatric:
            guard let age = age else { return 0.048 * crCl + 0.2 }
            
            // Pediatric clearance with maturation
            let adultCl = 0.048 * crCl + 0.2
            
            // Maturation factor based on age
            let maturationFactor: Double
            if age < 0.25 { // < 3 months
                maturationFactor = 0.6
            } else if age < 1 { // 3-12 months
                maturationFactor = 0.8
            } else if age < 2 { // 1-2 years
                maturationFactor = 0.9
            } else {
                maturationFactor = 1.0
            }
            
            return adultCl * maturationFactor
            
        case .neonate:
            // Base clearance for neonates (before maturation adjustment)
            return 0.02 * weight // L/h/kg
        }
    }
    
    private static func calculateNeonatalBaseClearance(weight: Double, postmenstrualAge: Double) -> Double {
        // Base clearance increases with postmenstrual age
        let baseCl = 0.02 * weight // L/h/kg
        let ageFactor = min(postmenstrualAge / 40.0, 1.5) // Mature at ~40 weeks PMA
        return baseCl * ageFactor
    }
    
    private static func calculateRenalMaturation(gestationalAge: Double, postnatalAge: Double) -> Double {
        // Renal maturation function based on gestational and postnatal age
        let pma = gestationalAge + (postnatalAge / 7.0) // Postmenstrual age
        
        if pma < 30 {
            return 0.3
        } else if pma < 37 {
            return 0.3 + 0.4 * (pma - 30) / 7
        } else if pma < 44 {
            return 0.7 + 0.25 * (pma - 37) / 7
        } else {
            return 0.95 + 0.05 * min((pma - 44) / 8, 1.0)
        }
    }
    
    // MARK: - Dose and Interval Optimization
    
    private static func calculateOptimalDoseAndInterval(targetAUC: Double, clearance: Double, volumeOfDistribution: Double, halfLife: Double, population: PopulationType) -> (dose: Int, interval: Int) {
        
        // Determine optimal interval based on half-life
        let optimalInterval = determineOptimalInterval(halfLife: halfLife, population: population)
        
        // Calculate dose for target AUC
        let dose = (targetAUC * clearance * Double(optimalInterval)) / 24.0
        let standardDose = roundToStandardDose(dose)
        
        return (standardDose, optimalInterval)
    }
    
    private static func determineOptimalInterval(halfLife: Double, population: PopulationType) -> Int {
        switch population {
        case .adult:
            if halfLife < 4 {
                return 6
            } else if halfLife < 8 {
                return 8
            } else if halfLife < 16 {
                return 12
            } else if halfLife < 30 {
                return 24
            } else {
                return 48
            }
        case .pediatric:
            // Pediatric patients typically need more frequent dosing
            if halfLife < 6 {
                return 6
            } else if halfLife < 12 {
                return 8
            } else if halfLife < 20 {
                return 12
            } else {
                return 24
            }
        case .neonate:
            // Neonates have longer intervals due to immature clearance
            if halfLife < 8 {
                return 8
            } else if halfLife < 16 {
                return 12
            } else if halfLife < 30 {
                return 18
            } else {
                return 24
            }
        }
    }
    
    private static func determinePediatricInterval(age: Double, halfLife: Double, crCl: Double) -> Int {
        // Age-specific interval determination for pediatrics
        if age < 1 {
            // Infants typically need more frequent dosing
            return halfLife < 6 ? 6 : 8
        } else if age < 12 {
            return halfLife < 8 ? 8 : 12
        } else {
            return determineOptimalInterval(halfLife: halfLife, population: .pediatric)
        }
    }
    
    private static func determineNeonatalInterval(gestationalAge: Double, postnatalAge: Double, halfLife: Double) -> Int {
        let pma = gestationalAge + (postnatalAge / 7.0)
        
        if pma < 30 {
            return 24 // Very premature infants
        } else if pma < 37 {
            return 18 // Premature infants
        } else if postnatalAge < 7 {
            return 12 // Term neonates < 1 week
        } else {
            return halfLife < 8 ? 8 : 12
        }
    }
    
    private static func calculatePediatricMgPerKg(age: Double, targetAUC: Double, clearance: Double, weight: Double) -> Double {
        // Calculate mg/kg dose for pediatric patients
        let dailyDose = targetAUC * clearance / 24.0
        let mgPerKg = dailyDose / weight
        
        // Age-based limits
        if age < 1 {
            return min(mgPerKg, 60.0) // Max 60 mg/kg/day for infants
        } else if age < 12 {
            return min(mgPerKg, 50.0) // Max 50 mg/kg/day for children
        } else {
            return min(mgPerKg, 40.0) // Max 40 mg/kg/day for adolescents
        }
    }
    
    // MARK: - Concentration Predictions
    
    private static func calculatePeakConcentration(dose: Double, vd: Double) -> Double {
        // Peak concentration after IV infusion (assuming 1-hour infusion)
        return dose / vd
    }
    
    private static func calculateTroughConcentration(dose: Double, vd: Double, ke: Double, interval: Double) -> Double {
        // Trough concentration at end of dosing interval
        let peak = dose / vd
        return peak * exp(-ke * interval)
    }
    
    // MARK: - Helper Functions
    
    private static func determineTargetAUC(indication: Indication, severity: InfectionSeverity) -> Double {
        let baseAUC = indication.targetAUC
        let severityMultiplier = getSeverityMultiplier(severity)
        return baseAUC * severityMultiplier
    }
    
    private static func getSeverityMultiplier(_ severity: InfectionSeverity) -> Double {
        switch severity {
        case .mild: return 0.9
        case .moderate: return 1.0
        case .severe: return 1.2
        }
    }
    
    private static func shouldUseLoadingDose(patient: PatientInput) -> Bool {
        return patient.severity == .severe || 
               patient.indication.requiresLoadingDose ||
               patient.isOnHemodialysis ||
               patient.isOnCRRT
    }
    
    private static func calculateLoadingDose(vd: Double, targetLevel: Double) -> Int {
        // Loading dose = Vd * target concentration
        let dose = vd * targetLevel
        return roundToStandardDose(dose)
    }
    
    private static func roundToStandardDose(_ dose: Double) -> Int {
        // Find the closest standard dose
        let closest = AppConstants.standardDoses.min { abs($0 - Int(dose)) < abs($1 - Int(dose)) } ?? 1000
        return closest
    }
    
    // MARK: - Clinical Guidance Generation
    
    private static func generateDosingSummary(dose: Int, interval: Int, loadingDose: Int?) -> String {
        var summary = "\(dose) mg every \(interval) hours"
        if let loading = loadingDose {
            summary = "Loading dose: \(loading) mg, then " + summary
        }
        return summary
    }
    
    private static func generateAdultClinicalNotes(patient: PatientInput, result: (dose: Int, interval: Int, auc: Double, peak: Double, trough: Double)) -> [String] {
        var notes: [String] = []
        
        notes.append("Dosing based on ASHP/IDSA 2020 guidelines")
        notes.append("Target AUC₀₋₂₄: \(String(format: "%.0f", determineTargetAUC(indication: patient.indication, severity: patient.severity))) mg·h/L")
        
        if patient.weightInKg > 100 {
            notes.append("Consider dose capping for obesity (consult clinical pharmacist)")
        }
        
        if let age = patient.ageInYears, age > 65 {
            notes.append("Elderly patient: monitor closely for nephrotoxicity")
        }
        
        return notes
    }
    
    private static func generatePediatricClinicalNotes(patient: PatientInput, mgPerKg: Double) -> [String] {
        var notes: [String] = []
        
        notes.append("Dosing based on IDSA 2011 pediatric guidelines")
        notes.append("Dose: \(String(format: "%.1f", mgPerKg)) mg/kg/day")
        
        if let age = patient.ageInYears {
            if age < 1 {
                notes.append("Infant dosing: monitor closely for developmental changes")
            } else if age < 2 {
                notes.append("Toddler dosing: rapid clearance changes expected")
            }
        }
        
        return notes
    }
    
    private static func generateNeonatalClinicalNotes(patient: PatientInput, pma: Double, maturation: Double) -> [String] {
        var notes: [String] = []
        
        notes.append("Neonatal dosing with maturation adjustment")
        notes.append("Postmenstrual age: \(String(format: "%.1f", pma)) weeks")
        notes.append("Renal maturation factor: \(String(format: "%.2f", maturation))")
        
        if let ga = patient.gestationalAgeWeeks, ga < 37 {
            notes.append("Preterm infant: extended monitoring required")
        }
        
        return notes
    }
    
    private static func generateSafetyWarnings(patient: PatientInput, peak: Double, trough: Double, auc: Double) -> [String] {
        var warnings: [String] = []
        
        if peak > 40 {
            warnings.append("Predicted peak >40 mg/L: risk of nephrotoxicity")
        }
        
        if trough > 20 {
            warnings.append("Predicted trough >20 mg/L: risk of nephrotoxicity")
        }
        
        if auc > 600 {
            warnings.append("Predicted AUC >600 mg·h/L: consider dose reduction")
        }
        
        if patient.serumCreatinine > 2.0 {
            warnings.append("Elevated creatinine: monitor renal function closely")
        }
        
        if patient.isOnHemodialysis {
            warnings.append("Hemodialysis patient: coordinate dosing with dialysis schedule")
        }
        
        if patient.isOnCRRT {
            warnings.append("CRRT patient: may require dose adjustment based on effluent rate")
        }
        
        return warnings
    }
    
    private static func generateMonitoringRecommendations(patient: PatientInput) -> [String] {
        var recommendations: [String] = []
        
        recommendations.append("Obtain vancomycin levels before 4th dose (steady state)")
        recommendations.append("Monitor serum creatinine and BUN")
        recommendations.append("Assess hearing function if prolonged therapy")
        
        switch patient.populationType {
        case .adult:
            recommendations.append("Target trough: 10-20 mg/L")
            recommendations.append("Consider AUC monitoring if available")
        case .pediatric:
            recommendations.append("Target trough: 10-15 mg/L")
            recommendations.append("Monitor growth and development")
        case .neonate:
            recommendations.append("Target trough: 5-15 mg/L")
            recommendations.append("Monitor for developmental changes")
        }
        
        return recommendations
    }
}

