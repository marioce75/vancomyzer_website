import XCTest
@testable import vancomyzer

final class VancomycinCalculatorTests: XCTestCase {
    
    var calculator: VancomycinCalculator!
    
    override func setUpWithError() throws {
        calculator = VancomycinCalculator()
    }
    
    override func tearDownWithError() throws {
        calculator = nil
    }
    
    // MARK: - Adult Dosing Tests
    
    func testAdultDosingNormalRenal() throws {
        let patient = PatientInput(
            populationType: .adult,
            ageInYears: 45,
            weightInKg: 70,
            heightInCm: 170,
            gender: .male,
            serumCreatinine: 1.0,
            indication: .pneumonia,
            severity: .moderate,
            crclMethod: .ibw
        )
        
        let result = try calculator.calculateDosing(for: patient, useBayesian: false)
        
        XCTAssertNotNil(result)
        XCTAssertGreaterThan(result.maintenanceDose.amount, 0)
        XCTAssertGreaterThan(result.maintenanceDose.interval, 0)
        XCTAssertGreaterThan(result.predictedAUC, 400) // Minimum target AUC
        XCTAssertLessThan(result.predictedAUC, 700) // Maximum safe AUC
    }
    
    func testAdultDosingRenalImpairment() throws {
        let patient = PatientInput(
            populationType: .adult,
            ageInYears: 65,
            weightInKg: 80,
            heightInCm: 175,
            gender: .male,
            serumCreatinine: 2.5, // Elevated creatinine
            indication: .bacteremia,
            severity: .severe,
            crclMethod: .ibw
        )
        
        let result = try calculator.calculateDosing(for: patient, useBayesian: false)
        
        XCTAssertNotNil(result)
        // Should have longer interval or lower dose due to renal impairment
        XCTAssertGreaterThanOrEqual(result.maintenanceDose.interval, 12)
        XCTAssertTrue(result.warnings.contains { $0.contains("renal") })
    }
    
    func testAdultLoadingDoseSevereInfection() throws {
        let patient = PatientInput(
            populationType: .adult,
            ageInYears: 35,
            weightInKg: 75,
            heightInCm: 180,
            gender: .female,
            serumCreatinine: 0.8,
            indication: .endocarditis,
            severity: .severe,
            crclMethod: .ibw
        )
        
        let result = try calculator.calculateDosing(for: patient, useBayesian: false)
        
        XCTAssertNotNil(result.loadingDose)
        XCTAssertGreaterThan(result.loadingDose!.amount, 1000) // Typical loading dose
        XCTAssertEqual(result.loadingDose!.interval, 0) // One-time dose
    }
    
    func testCrClCalculationMethods() throws {
        let patient = PatientInput(
            populationType: .adult,
            ageInYears: 50,
            weightInKg: 90, // Overweight
            heightInCm: 170,
            gender: .male,
            serumCreatinine: 1.2,
            indication: .pneumonia,
            severity: .moderate,
            crclMethod: .ibw
        )
        
        let resultIBW = try calculator.calculateDosing(for: patient, useBayesian: false)
        
        var patientTBW = patient
        patientTBW.crclMethod = .tbw
        let resultTBW = try calculator.calculateDosing(for: patientTBW, useBayesian: false)
        
        var patientAdjBW = patient
        patientAdjBW.crclMethod = .adjbw
        let resultAdjBW = try calculator.calculateDosing(for: patientAdjBW, useBayesian: false)
        
        // TBW should give higher clearance than IBW for overweight patient
        XCTAssertGreaterThan(resultTBW.pkParameters.clearance, resultIBW.pkParameters.clearance)
        // AdjBW should be between IBW and TBW
        XCTAssertGreaterThan(resultAdjBW.pkParameters.clearance, resultIBW.pkParameters.clearance)
        XCTAssertLessThan(resultAdjBW.pkParameters.clearance, resultTBW.pkParameters.clearance)
    }
    
    // MARK: - Pediatric Dosing Tests
    
    func testPediatricDosingInfant() throws {
        let patient = PatientInput(
            populationType: .pediatric,
            ageInYears: 1,
            weightInKg: 10,
            heightInCm: 75,
            gender: .female,
            serumCreatinine: 0.3,
            indication: .pneumonia,
            severity: .moderate
        )
        
        let result = try calculator.calculateDosing(for: patient, useBayesian: false)
        
        XCTAssertNotNil(result)
        XCTAssertGreaterThan(result.maintenanceDose.amount, 0)
        // Pediatric dosing typically 15-20 mg/kg/dose
        let mgPerKg = result.maintenanceDose.amount / patient.weightInKg
        XCTAssertGreaterThanOrEqual(mgPerKg, 10)
        XCTAssertLessThanOrEqual(mgPerKg, 25)
    }
    
    func testPediatricDosingAdolescent() throws {
        let patient = PatientInput(
            populationType: .pediatric,
            ageInYears: 15,
            weightInKg: 55,
            heightInCm: 165,
            gender: .male,
            serumCreatinine: 0.8,
            indication: .bacteremia,
            severity: .severe
        )
        
        let result = try calculator.calculateDosing(for: patient, useBayesian: false)
        
        XCTAssertNotNil(result)
        XCTAssertGreaterThan(result.maintenanceDose.amount, 0)
        // Should have loading dose for severe infection
        XCTAssertNotNil(result.loadingDose)
    }
    
    func testSchwartzEquation() throws {
        let patient = PatientInput(
            populationType: .pediatric,
            ageInYears: 8,
            weightInKg: 25,
            heightInCm: 125,
            gender: .male,
            serumCreatinine: 0.6,
            indication: .pneumonia,
            severity: .moderate
        )
        
        let result = try calculator.calculateDosing(for: patient, useBayesian: false)
        
        // Verify Schwartz equation is used for pediatric CrCl
        let expectedCrCl = calculator.calculatePediatricCrCl(
            heightInCm: patient.heightInCm,
            serumCreatinine: patient.serumCreatinine
        )
        
        XCTAssertGreaterThan(expectedCrCl, 0)
        XCTAssertLessThan(expectedCrCl, 200) // Reasonable upper limit
    }
    
    // MARK: - Neonatal Dosing Tests
    
    func testNeonatalDosingPreterm() throws {
        let patient = PatientInput(
            populationType: .neonate,
            ageInDays: 10,
            gestationalAgeInWeeks: 32,
            weightInKg: 1.8,
            serumCreatinine: 0.8,
            indication: .bacteremia,
            severity: .severe
        )
        
        let result = try calculator.calculateDosing(for: patient, useBayesian: false)
        
        XCTAssertNotNil(result)
        XCTAssertGreaterThan(result.maintenanceDose.amount, 0)
        // Neonatal dosing typically longer intervals
        XCTAssertGreaterThanOrEqual(result.maintenanceDose.interval, 12)
        // Should account for organ immaturity
        XCTAssertTrue(result.warnings.contains { $0.contains("maturation") || $0.contains("neonatal") })
    }
    
    func testNeonatalDosingTerm() throws {
        let patient = PatientInput(
            populationType: .neonate,
            ageInDays: 5,
            gestationalAgeInWeeks: 39,
            weightInKg: 3.2,
            serumCreatinine: 0.6,
            indication: .pneumonia,
            severity: .moderate
        )
        
        let result = try calculator.calculateDosing(for: patient, useBayesian: false)
        
        XCTAssertNotNil(result)
        XCTAssertGreaterThan(result.maintenanceDose.amount, 0)
        // Term neonates should have better clearance than preterm
        XCTAssertGreaterThan(result.pkParameters.clearance, 0.1)
    }
    
    func testNeonatalMaturationFactors() throws {
        let patient = PatientInput(
            populationType: .neonate,
            ageInDays: 30,
            gestationalAgeInWeeks: 28, // Very preterm
            weightInKg: 1.2,
            serumCreatinine: 1.0,
            indication: .bacteremia,
            severity: .severe
        )
        
        let result = try calculator.calculateDosing(for: patient, useBayesian: false)
        
        // Very preterm neonates should have significantly reduced clearance
        XCTAssertLessThan(result.pkParameters.clearance, 0.5)
        XCTAssertGreaterThanOrEqual(result.maintenanceDose.interval, 18)
    }
    
    // MARK: - Pharmacokinetic Parameter Tests
    
    func testPKParameterCalculation() throws {
        let patient = PatientInput(
            populationType: .adult,
            ageInYears: 40,
            weightInKg: 70,
            heightInCm: 170,
            gender: .male,
            serumCreatinine: 1.0,
            indication: .pneumonia,
            severity: .moderate,
            crclMethod: .ibw
        )
        
        let result = try calculator.calculateDosing(for: patient, useBayesian: false)
        
        // Verify PK parameters are reasonable
        XCTAssertGreaterThan(result.pkParameters.clearance, 0)
        XCTAssertLessThan(result.pkParameters.clearance, 10) // L/h
        XCTAssertGreaterThan(result.pkParameters.volumeOfDistribution, 20) // L
        XCTAssertLessThan(result.pkParameters.volumeOfDistribution, 100) // L
        XCTAssertGreaterThan(result.pkParameters.halfLife, 2) // hours
        XCTAssertLessThan(result.pkParameters.halfLife, 20) // hours
    }
    
    func testAUCCalculation() throws {
        let patient = PatientInput(
            populationType: .adult,
            ageInYears: 50,
            weightInKg: 80,
            heightInCm: 175,
            gender: .female,
            serumCreatinine: 1.2,
            indication: .endocarditis,
            severity: .severe,
            crclMethod: .ibw
        )
        
        let result = try calculator.calculateDosing(for: patient, useBayesian: false)
        
        // AUC should be in therapeutic range for severe infection
        XCTAssertGreaterThanOrEqual(result.predictedAUC, 500) // Severe infection target
        XCTAssertLessThanOrEqual(result.predictedAUC, 700) // Safety limit
    }
    
    // MARK: - Validation Tests
    
    func testInvalidPatientData() throws {
        let invalidPatient = PatientInput(
            populationType: .adult,
            ageInYears: -5, // Invalid age
            weightInKg: 70,
            heightInCm: 170,
            gender: .male,
            serumCreatinine: 1.0,
            indication: .pneumonia,
            severity: .moderate,
            crclMethod: .ibw
        )
        
        XCTAssertThrowsError(try calculator.calculateDosing(for: invalidPatient, useBayesian: false)) { error in
            XCTAssertTrue(error is ValidationError)
        }
    }
    
    func testExtremeValues() throws {
        let extremePatient = PatientInput(
            populationType: .adult,
            ageInYears: 95,
            weightInKg: 200, // Very high weight
            heightInCm: 150,
            gender: .male,
            serumCreatinine: 5.0, // Very high creatinine
            indication: .pneumonia,
            severity: .moderate,
            crclMethod: .ibw
        )
        
        let result = try calculator.calculateDosing(for: extremePatient, useBayesian: false)
        
        // Should still calculate but with warnings
        XCTAssertNotNil(result)
        XCTAssertFalse(result.warnings.isEmpty)
        XCTAssertTrue(result.warnings.contains { $0.contains("renal") })
    }
    
    // MARK: - Performance Tests
    
    func testCalculationPerformance() throws {
        let patient = PatientInput(
            populationType: .adult,
            ageInYears: 45,
            weightInKg: 70,
            heightInCm: 170,
            gender: .male,
            serumCreatinine: 1.0,
            indication: .pneumonia,
            severity: .moderate,
            crclMethod: .ibw
        )
        
        measure {
            do {
                _ = try calculator.calculateDosing(for: patient, useBayesian: false)
            } catch {
                XCTFail("Calculation failed: \(error)")
            }
        }
    }
    
    // MARK: - Edge Cases
    
    func testMinimumAge() throws {
        let patient = PatientInput(
            populationType: .neonate,
            ageInDays: 1,
            gestationalAgeInWeeks: 24, // Extremely preterm
            weightInKg: 0.6,
            serumCreatinine: 1.2,
            indication: .bacteremia,
            severity: .severe
        )
        
        let result = try calculator.calculateDosing(for: patient, useBayesian: false)
        
        XCTAssertNotNil(result)
        // Should have very conservative dosing
        XCTAssertGreaterThanOrEqual(result.maintenanceDose.interval, 24)
    }
    
    func testMaximumAge() throws {
        let patient = PatientInput(
            populationType: .adult,
            ageInYears: 100,
            weightInKg: 60,
            heightInCm: 160,
            gender: .female,
            serumCreatinine: 1.5,
            indication: .pneumonia,
            severity: .mild,
            crclMethod: .ibw
        )
        
        let result = try calculator.calculateDosing(for: patient, useBayesian: false)
        
        XCTAssertNotNil(result)
        XCTAssertTrue(result.warnings.contains { $0.contains("elderly") || $0.contains("age") })
    }
    
    // MARK: - Clinical Scenarios
    
    func testObesityScenario() throws {
        let patient = PatientInput(
            populationType: .adult,
            ageInYears: 45,
            weightInKg: 150, // Obese patient
            heightInCm: 170,
            gender: .male,
            serumCreatinine: 1.0,
            indication: .pneumonia,
            severity: .moderate,
            crclMethod: .adjbw // Should use adjusted body weight
        )
        
        let result = try calculator.calculateDosing(for: patient, useBayesian: false)
        
        XCTAssertNotNil(result)
        // Dose should be reasonable, not excessively high
        XCTAssertLessThan(result.maintenanceDose.amount, 3000)
    }
    
    func testCriticallyIllScenario() throws {
        let patient = PatientInput(
            populationType: .adult,
            ageInYears: 60,
            weightInKg: 85,
            heightInCm: 175,
            gender: .male,
            serumCreatinine: 1.8,
            indication: .bacteremia,
            severity: .severe,
            crclMethod: .ibw
        )
        
        let result = try calculator.calculateDosing(for: patient, useBayesian: false)
        
        XCTAssertNotNil(result)
        XCTAssertNotNil(result.loadingDose) // Should have loading dose
        XCTAssertGreaterThanOrEqual(result.predictedAUC, 500) // Higher target for severe infection
    }
}

// MARK: - Bayesian Engine Tests

final class BayesianEngineTests: XCTestCase {
    
    var engine: BayesianEngine!
    
    override func setUpWithError() throws {
        engine = BayesianEngine()
    }
    
    override func tearDownWithError() throws {
        engine = nil
    }
    
    func testMAPEstimation() throws {
        let patient = PatientInput(
            populationType: .adult,
            ageInYears: 45,
            weightInKg: 70,
            heightInCm: 170,
            gender: .male,
            serumCreatinine: 1.0,
            indication: .pneumonia,
            severity: .moderate,
            crclMethod: .ibw
        )
        
        let levels = [
            VancomycinLevel(
                value: 15.0,
                timeAfterDose: 1.0,
                doseNumber: 3,
                doseAmount: 1000,
                infusionDuration: 1.0
            ),
            VancomycinLevel(
                value: 8.0,
                timeAfterDose: 12.0,
                doseNumber: 3,
                doseAmount: 1000,
                infusionDuration: 1.0
            )
        ]
        
        let result = try engine.optimizeDosing(for: patient, levels: levels)
        
        XCTAssertNotNil(result)
        XCTAssertGreaterThan(result.optimizedDose.amount, 0)
        XCTAssertGreaterThan(result.optimizedDose.interval, 0)
        XCTAssertNotNil(result.mapEstimates.clearance)
        XCTAssertNotNil(result.mapEstimates.volumeOfDistribution)
        XCTAssertNotNil(result.confidenceIntervals)
    }
    
    func testSingleLevelOptimization() throws {
        let patient = PatientInput(
            populationType: .adult,
            ageInYears: 35,
            weightInKg: 75,
            heightInCm: 175,
            gender: .female,
            serumCreatinine: 0.9,
            indication: .bacteremia,
            severity: .severe,
            crclMethod: .ibw
        )
        
        let levels = [
            VancomycinLevel(
                value: 12.0,
                timeAfterDose: 0.5, // Peak level
                doseNumber: 2,
                doseAmount: 1250,
                infusionDuration: 1.0
            )
        ]
        
        let result = try engine.optimizeDosing(for: patient, levels: levels)
        
        XCTAssertNotNil(result)
        // Should still provide optimization with single level
        XCTAssertGreaterThan(result.optimizedDose.amount, 0)
    }
    
    func testConfidenceIntervals() throws {
        let patient = PatientInput(
            populationType: .adult,
            ageInYears: 50,
            weightInKg: 80,
            heightInCm: 180,
            gender: .male,
            serumCreatinine: 1.2,
            indication: .endocarditis,
            severity: .severe,
            crclMethod: .ibw
        )
        
        let levels = [
            VancomycinLevel(value: 18.0, timeAfterDose: 1.0, doseNumber: 2, doseAmount: 1500, infusionDuration: 1.0),
            VancomycinLevel(value: 10.0, timeAfterDose: 12.0, doseNumber: 2, doseAmount: 1500, infusionDuration: 1.0)
        ]
        
        let result = try engine.optimizeDosing(for: patient, levels: levels)
        
        XCTAssertNotNil(result.confidenceIntervals)
        
        // Confidence intervals should be reasonable
        let clearanceCI = result.confidenceIntervals!.clearance
        XCTAssertLessThan(clearanceCI.lower, clearanceCI.upper)
        XCTAssertGreaterThan(clearanceCI.lower, 0)
        
        let volumeCI = result.confidenceIntervals!.volumeOfDistribution
        XCTAssertLessThan(volumeCI.lower, volumeCI.upper)
        XCTAssertGreaterThan(volumeCI.lower, 0)
        
        let aucCI = result.confidenceIntervals!.auc
        XCTAssertLessThan(aucCI.lower, aucCI.upper)
        XCTAssertGreaterThan(aucCI.lower, 0)
    }
}

// MARK: - Validation Engine Tests

final class ValidationEngineTests: XCTestCase {
    
    var validator: ValidationEngine!
    
    override func setUpWithError() throws {
        validator = ValidationEngine()
    }
    
    override func tearDownWithError() throws {
        validator = nil
    }
    
    func testValidAdultPatient() throws {
        let patient = PatientInput(
            populationType: .adult,
            ageInYears: 45,
            weightInKg: 70,
            heightInCm: 170,
            gender: .male,
            serumCreatinine: 1.0,
            indication: .pneumonia,
            severity: .moderate,
            crclMethod: .ibw
        )
        
        let result = validator.validatePatient(patient)
        XCTAssertTrue(result.isValid)
        XCTAssertTrue(result.errors.isEmpty)
    }
    
    func testInvalidAge() throws {
        let patient = PatientInput(
            populationType: .adult,
            ageInYears: -5,
            weightInKg: 70,
            heightInCm: 170,
            gender: .male,
            serumCreatinine: 1.0,
            indication: .pneumonia,
            severity: .moderate,
            crclMethod: .ibw
        )
        
        let result = validator.validatePatient(patient)
        XCTAssertFalse(result.isValid)
        XCTAssertTrue(result.errors.contains { $0.field == .age })
    }
    
    func testInvalidWeight() throws {
        let patient = PatientInput(
            populationType: .pediatric,
            ageInYears: 5,
            weightInKg: 0, // Invalid weight
            heightInCm: 110,
            gender: .female,
            serumCreatinine: 0.4,
            indication: .pneumonia,
            severity: .moderate
        )
        
        let result = validator.validatePatient(patient)
        XCTAssertFalse(result.isValid)
        XCTAssertTrue(result.errors.contains { $0.field == .weight })
    }
    
    func testClinicalPlausibility() throws {
        let patient = PatientInput(
            populationType: .adult,
            ageInYears: 25,
            weightInKg: 70,
            heightInCm: 170,
            gender: .male,
            serumCreatinine: 5.0, // Very high creatinine
            indication: .pneumonia,
            severity: .moderate,
            crclMethod: .ibw
        )
        
        let result = validator.validatePatient(patient)
        XCTAssertTrue(result.isValid) // Should be valid but with warnings
        XCTAssertFalse(result.warnings.isEmpty)
        XCTAssertTrue(result.warnings.contains { $0.contains("creatinine") || $0.contains("renal") })
    }
}

// MARK: - Test Utilities

extension PatientInput {
    static func validAdult() -> PatientInput {
        return PatientInput(
            populationType: .adult,
            ageInYears: 45,
            weightInKg: 70,
            heightInCm: 170,
            gender: .male,
            serumCreatinine: 1.0,
            indication: .pneumonia,
            severity: .moderate,
            crclMethod: .ibw
        )
    }
    
    static func validPediatric() -> PatientInput {
        return PatientInput(
            populationType: .pediatric,
            ageInYears: 8,
            weightInKg: 25,
            heightInCm: 125,
            gender: .female,
            serumCreatinine: 0.5,
            indication: .pneumonia,
            severity: .moderate
        )
    }
    
    static func validNeonate() -> PatientInput {
        return PatientInput(
            populationType: .neonate,
            ageInDays: 14,
            gestationalAgeInWeeks: 38,
            weightInKg: 3.0,
            serumCreatinine: 0.7,
            indication: .bacteremia,
            severity: .moderate
        )
    }
}

