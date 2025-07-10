import Foundation

// MARK: - Validation Engine

class ValidationEngine {
    
    // MARK: - Main Validation Entry Point
    
    static func validatePatientInput(_ patient: PatientInput) throws {
        try validateBasicFields(patient)
        try validatePopulationSpecificFields(patient)
        try validateClinicalRanges(patient)
        try validateLogicalConsistency(patient)
    }
    
    // MARK: - Basic Field Validation
    
    private static func validateBasicFields(_ patient: PatientInput) throws {
        // Weight validation
        if patient.weightInKg <= 0 {
            throw ValidationError.invalidWeight("Weight must be greater than 0 kg")
        }
        
        if patient.weightInKg > 300 {
            throw ValidationError.invalidWeight("Weight exceeds maximum allowed value (300 kg)")
        }
        
        // Serum creatinine validation
        if patient.serumCreatinine <= 0 {
            throw ValidationError.invalidCreatinine("Serum creatinine must be greater than 0 mg/dL")
        }
        
        if patient.serumCreatinine > 15 {
            throw ValidationError.invalidCreatinine("Serum creatinine exceeds maximum allowed value (15 mg/dL)")
        }
        
        // Custom CrCl validation
        if patient.crClMethod == .custom {
            guard let customCrCl = patient.customCrCl else {
                throw ValidationError.invalidCustomCrCl("Custom creatinine clearance value is required")
            }
            
            if customCrCl < AppConstants.minCrCl {
                throw ValidationError.invalidCustomCrCl("Custom CrCl below minimum value (\(AppConstants.minCrCl) mL/min)")
            }
            
            if customCrCl > AppConstants.maxCrCl {
                throw ValidationError.invalidCustomCrCl("Custom CrCl exceeds maximum value (\(AppConstants.maxCrCl) mL/min)")
            }
        }
    }
    
    // MARK: - Population-Specific Validation
    
    private static func validatePopulationSpecificFields(_ patient: PatientInput) throws {
        switch patient.populationType {
        case .adult:
            try validateAdultFields(patient)
        case .pediatric:
            try validatePediatricFields(patient)
        case .neonate:
            try validateNeonatalFields(patient)
        }
    }
    
    private static func validateAdultFields(_ patient: PatientInput) throws {
        // Age validation
        guard let age = patient.ageInYears else {
            throw ValidationError.missingRequiredField("Age is required for adult patients")
        }
        
        if age < 18 {
            throw ValidationError.invalidAge("Adult patients must be ≥18 years old")
        }
        
        if age > 120 {
            throw ValidationError.invalidAge("Age exceeds maximum allowed value (120 years)")
        }
        
        // Height validation
        guard let height = patient.heightInCm else {
            throw ValidationError.missingRequiredField("Height is required for adult patients")
        }
        
        if height < 100 {
            throw ValidationError.invalidHeight("Height must be ≥100 cm for adults")
        }
        
        if height > 250 {
            throw ValidationError.invalidHeight("Height exceeds maximum allowed value (250 cm)")
        }
    }
    
    private static func validatePediatricFields(_ patient: PatientInput) throws {
        // Age validation
        guard let age = patient.ageInYears else {
            throw ValidationError.missingRequiredField("Age is required for pediatric patients")
        }
        
        if age < 0.083 { // 1 month
            throw ValidationError.invalidAge("Pediatric patients must be ≥1 month old")
        }
        
        if age >= 18 {
            throw ValidationError.invalidAge("Pediatric patients must be <18 years old")
        }
        
        // Height validation
        guard let height = patient.heightInCm else {
            throw ValidationError.missingRequiredField("Height is required for pediatric patients")
        }
        
        if height < 45 {
            throw ValidationError.invalidHeight("Height must be ≥45 cm for pediatric patients")
        }
        
        if height > 200 {
            throw ValidationError.invalidHeight("Height exceeds maximum allowed value for pediatrics (200 cm)")
        }
        
        // Weight-for-age validation
        try validatePediatricWeightForAge(age: age, weight: patient.weightInKg)
    }
    
    private static func validateNeonatalFields(_ patient: PatientInput) throws {
        // Gestational age validation
        guard let gestationalAge = patient.gestationalAgeWeeks else {
            throw ValidationError.missingRequiredField("Gestational age is required for neonatal patients")
        }
        
        if gestationalAge < 22 {
            throw ValidationError.invalidGestationalAge("Gestational age must be ≥22 weeks")
        }
        
        if gestationalAge > 44 {
            throw ValidationError.invalidGestationalAge("Gestational age exceeds maximum value (44 weeks)")
        }
        
        // Postnatal age validation
        guard let postnatalAge = patient.postnatalAgeDays else {
            throw ValidationError.missingRequiredField("Postnatal age is required for neonatal patients")
        }
        
        if postnatalAge < 0 {
            throw ValidationError.invalidPostnatalAge("Postnatal age cannot be negative")
        }
        
        if postnatalAge > 30 {
            throw ValidationError.invalidPostnatalAge("Postnatal age exceeds neonatal period (30 days)")
        }
        
        // Weight validation for neonates
        try validateNeonatalWeight(gestationalAge: gestationalAge, weight: patient.weightInKg)
    }
    
    // MARK: - Clinical Range Validation
    
    private static func validateClinicalRanges(_ patient: PatientInput) throws {
        // BMI validation for adults and pediatrics
        if patient.populationType != .neonate {
            guard let bmi = patient.bmi else {
                throw ValidationError.invalidHeight("Cannot calculate BMI - check height value")
            }
            
            switch patient.populationType {
            case .adult:
                if bmi < 12 || bmi > 60 {
                    throw ValidationError.invalidWeight("BMI (\(String(format: "%.1f", bmi))) is outside clinical range (12-60)")
                }
            case .pediatric:
                if bmi < 10 || bmi > 40 {
                    throw ValidationError.invalidWeight("BMI (\(String(format: "%.1f", bmi))) is outside pediatric range (10-40)")
                }
            case .neonate:
                break
            }
        }
        
        // Creatinine validation by population
        switch patient.populationType {
        case .adult:
            if patient.serumCreatinine > 8.0 {
                // Warning for very high creatinine
                // Could add warning system here
            }
        case .pediatric:
            if patient.serumCreatinine > 5.0 {
                throw ValidationError.invalidCreatinine("Serum creatinine exceeds pediatric maximum (5.0 mg/dL)")
            }
        case .neonate:
            if patient.serumCreatinine > 3.0 {
                throw ValidationError.invalidCreatinine("Serum creatinine exceeds neonatal maximum (3.0 mg/dL)")
            }
        }
    }
    
    // MARK: - Logical Consistency Validation
    
    private static func validateLogicalConsistency(_ patient: PatientInput) throws {
        // Dialysis consistency
        if patient.isOnHemodialysis && patient.isOnCRRT {
            throw ValidationError.populationMismatch("Patient cannot be on both hemodialysis and CRRT simultaneously")
        }
        
        // Renal function stability
        if !patient.isRenalFunctionStable && patient.crClMethod == .custom {
            // Warning: custom CrCl with unstable renal function
        }
        
        // Population-specific consistency checks
        switch patient.populationType {
        case .adult:
            if let age = patient.ageInYears, age < 18 {
                throw ValidationError.populationMismatch("Age (\(age) years) inconsistent with adult population")
            }
        case .pediatric:
            if let age = patient.ageInYears, (age < 0.083 || age >= 18) {
                throw ValidationError.populationMismatch("Age (\(age) years) inconsistent with pediatric population")
            }
        case .neonate:
            if let pna = patient.postnatalAgeDays, pna > 30 {
                throw ValidationError.populationMismatch("Postnatal age (\(pna) days) exceeds neonatal period")
            }
        }
    }
    
    // MARK: - Specialized Validation Functions
    
    private static func validatePediatricWeightForAge(age: Double, weight: Double) throws {
        // Simplified weight-for-age validation
        let expectedWeight: Double
        
        if age < 1 {
            // Infants: approximate weight in kg = (age in months + 9) / 2
            let ageInMonths = age * 12
            expectedWeight = (ageInMonths + 9) / 2
        } else if age < 10 {
            // Children 1-10 years: weight in kg = 2 * age + 8
            expectedWeight = 2 * age + 8
        } else {
            // Adolescents: more variable, use broader range
            expectedWeight = 3 * age + 10
        }
        
        let lowerBound = expectedWeight * 0.5
        let upperBound = expectedWeight * 2.5
        
        if weight < lowerBound {
            throw ValidationError.invalidWeight("Weight (\(weight) kg) appears low for age (\(age) years)")
        }
        
        if weight > upperBound {
            throw ValidationError.invalidWeight("Weight (\(weight) kg) appears high for age (\(age) years)")
        }
    }
    
    private static func validateNeonatalWeight(gestationalAge: Double, weight: Double) throws {
        // Birth weight percentiles by gestational age
        let expectedWeight: Double
        
        if gestationalAge < 28 {
            expectedWeight = 1.0 // Very preterm
        } else if gestationalAge < 32 {
            expectedWeight = 1.5 // Preterm
        } else if gestationalAge < 37 {
            expectedWeight = 2.2 // Late preterm
        } else {
            expectedWeight = 3.3 // Term
        }
        
        let lowerBound = expectedWeight * 0.4 // 3rd percentile approximation
        let upperBound = expectedWeight * 1.8 // 97th percentile approximation
        
        if weight < lowerBound {
            throw ValidationError.invalidWeight("Weight (\(weight) kg) appears low for gestational age (\(gestationalAge) weeks)")
        }
        
        if weight > upperBound {
            throw ValidationError.invalidWeight("Weight (\(weight) kg) appears high for gestational age (\(gestationalAge) weeks)")
        }
    }
    
    // MARK: - Vancomycin Level Validation
    
    static func validateVancomycinLevel(_ level: VancomycinLevel) throws {
        // Concentration validation
        if level.concentration <= 0 {
            throw ValidationError.invalidWeight("Vancomycin concentration must be greater than 0 mg/L")
        }
        
        if level.concentration > 100 {
            throw ValidationError.invalidWeight("Vancomycin concentration exceeds maximum value (100 mg/L)")
        }
        
        // Time validation
        if level.timeAfterDose < 0 {
            throw ValidationError.invalidWeight("Time after dose cannot be negative")
        }
        
        if level.timeAfterDose > 72 {
            throw ValidationError.invalidWeight("Time after dose exceeds maximum value (72 hours)")
        }
        
        // Dose validation
        if level.doseGiven <= 0 {
            throw ValidationError.invalidWeight("Dose given must be greater than 0 mg")
        }
        
        if level.doseGiven > AppConstants.maxVancomycinDose {
            throw ValidationError.invalidWeight("Dose given exceeds maximum value (\(AppConstants.maxVancomycinDose) mg)")
        }
    }
    
    // MARK: - Multiple Level Validation
    
    static func validateVancomycinLevels(_ levels: [VancomycinLevel]) throws {
        guard !levels.isEmpty else {
            throw ValidationError.insufficientData("At least one vancomycin level is required")
        }
        
        // Validate each level
        for level in levels {
            try validateVancomycinLevel(level)
        }
        
        // Check for duplicate times
        let times = levels.map { $0.timeAfterDose }
        let uniqueTimes = Set(times)
        if times.count != uniqueTimes.count {
            throw ValidationError.invalidWeight("Duplicate sampling times detected")
        }
        
        // Validate temporal consistency
        let sortedLevels = levels.sorted { $0.timestamp < $1.timestamp }
        for i in 1..<sortedLevels.count {
            let timeDiff = sortedLevels[i].timestamp.timeIntervalSince(sortedLevels[i-1].timestamp)
            if timeDiff < 0 {
                throw ValidationError.invalidWeight("Inconsistent level timestamps")
            }
        }
        
        // Clinical plausibility checks
        try validateClinicalPlausibility(levels)
    }
    
    private static func validateClinicalPlausibility(_ levels: [VancomycinLevel]) throws {
        // Check for extremely high or low concentrations
        for level in levels {
            if level.concentration > 80 {
                // Very high level - possible error
                throw ValidationError.invalidWeight("Vancomycin level (\(level.concentration) mg/L) is extremely high - please verify")
            }
            
            if level.concentration < 1 && level.timeAfterDose < 24 {
                // Very low level early after dose - possible error
                throw ValidationError.invalidWeight("Vancomycin level (\(level.concentration) mg/L) is very low for time after dose (\(level.timeAfterDose) hours)")
            }
        }
        
        // Check for reasonable decay pattern if multiple levels
        if levels.count >= 2 {
            let sortedByTime = levels.sorted { $0.timeAfterDose < $1.timeAfterDose }
            
            for i in 1..<sortedByTime.count {
                let earlier = sortedByTime[i-1]
                let later = sortedByTime[i]
                
                // Concentration should generally decrease over time
                if later.concentration > earlier.concentration * 1.5 {
                    // Significant increase - possible error or new dose
                    // This could be a warning rather than an error
                }
                
                // Check for reasonable half-life
                let timeDiff = later.timeAfterDose - earlier.timeAfterDose
                if timeDiff > 0 {
                    let ratio = later.concentration / earlier.concentration
                    let apparentHalfLife = -timeDiff * log(2) / log(ratio)
                    
                    if apparentHalfLife < 1 || apparentHalfLife > 100 {
                        // Unreasonable half-life - possible error
                        throw ValidationError.invalidWeight("Calculated half-life (\(String(format: "%.1f", apparentHalfLife)) hours) is outside reasonable range")
                    }
                }
            }
        }
    }
    
    // MARK: - Warning Generation
    
    static func generateValidationWarnings(_ patient: PatientInput) -> [String] {
        var warnings: [String] = []
        
        // Age-related warnings
        if let age = patient.ageInYears {
            if patient.populationType == .adult && age > 80 {
                warnings.append("Elderly patient (>80 years): increased risk of nephrotoxicity")
            }
            
            if patient.populationType == .pediatric && age < 0.25 {
                warnings.append("Very young infant: pharmacokinetics may be highly variable")
            }
        }
        
        // Weight-related warnings
        if let bmi = patient.bmi {
            if bmi > 30 {
                warnings.append("Obese patient (BMI \(String(format: "%.1f", bmi))): consider dose adjustment")
            }
            
            if bmi < 18.5 && patient.populationType == .adult {
                warnings.append("Underweight patient (BMI \(String(format: "%.1f", bmi))): monitor closely")
            }
        }
        
        // Renal function warnings
        if patient.serumCreatinine > 2.0 {
            warnings.append("Elevated creatinine (\(patient.serumCreatinine) mg/dL): monitor renal function closely")
        }
        
        if !patient.isRenalFunctionStable {
            warnings.append("Unstable renal function: frequent monitoring recommended")
        }
        
        // Dialysis warnings
        if patient.isOnHemodialysis {
            warnings.append("Hemodialysis patient: coordinate dosing with dialysis schedule")
        }
        
        if patient.isOnCRRT {
            warnings.append("CRRT patient: dose adjustment may be needed based on effluent rate")
        }
        
        // Severity warnings
        if patient.severity == .severe {
            warnings.append("Severe infection: consider loading dose and aggressive monitoring")
        }
        
        // Indication-specific warnings
        if patient.indication == .meningitis {
            warnings.append("CNS infection: higher target levels may be needed")
        }
        
        if patient.indication == .endocarditis {
            warnings.append("Endocarditis: prolonged therapy and close monitoring required")
        }
        
        return warnings
    }
}

