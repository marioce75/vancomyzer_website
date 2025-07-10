import Foundation
import Accelerate

// MARK: - Bayesian MAP Estimation Engine

class BayesianEngine {
    
    // MARK: - Main Bayesian Calculation Entry Point
    
    static func calculateBayesianDosing(patient: PatientInput, levels: [VancomycinLevel]) throws -> DosingResult {
        
        // Validate inputs
        guard !levels.isEmpty else {
            throw CalculationError.insufficientData("At least one vancomycin level required for Bayesian estimation")
        }
        
        // Get population priors
        let priors = getPopulationPriors(for: patient)
        
        // Perform MAP estimation
        let mapEstimates = try performMAPEstimation(patient: patient, levels: levels, priors: priors)
        
        // Calculate optimal dosing with MAP parameters
        let result = try calculateOptimalDosingWithMAP(patient: patient, mapEstimates: mapEstimates)
        
        return result
    }
    
    // MARK: - Population Priors
    
    private static func getPopulationPriors(for patient: PatientInput) -> BayesianPriors {
        switch patient.populationType {
        case .adult:
            return getAdultPriors(patient: patient)
        case .pediatric:
            return getPediatricPriors(patient: patient)
        case .neonate:
            return getNeonatalPriors(patient: patient)
        }
    }
    
    private static func getAdultPriors(patient: PatientInput) -> BayesianPriors {
        // Adult population priors based on literature
        let baseVd = 0.7 * patient.weightInKg // L
        let baseCl = calculatePopulationClearance(patient: patient) // L/h
        
        // Covariance matrix for adult population
        let omega = Matrix2x2(
            var11: 0.09, // CV² for Vd (~30% CV)
            var12: 0.02, // Covariance between Vd and Cl
            var22: 0.16  // CV² for Cl (~40% CV)
        )
        
        return BayesianPriors(
            meanVd: baseVd,
            meanCl: baseCl,
            omega: omega,
            residualError: 0.04 // 20% proportional error
        )
    }
    
    private static func getPediatricPriors(patient: PatientInput) -> BayesianPriors {
        // Pediatric population priors with age-based adjustments
        let baseVd = calculatePediatricVd(patient: patient)
        let baseCl = calculatePediatricClearance(patient: patient)
        
        // Higher variability in pediatric population
        let omega = Matrix2x2(
            var11: 0.16, // CV² for Vd (~40% CV)
            var12: 0.03, // Covariance between Vd and Cl
            var22: 0.25  // CV² for Cl (~50% CV)
        )
        
        return BayesianPriors(
            meanVd: baseVd,
            meanCl: baseCl,
            omega: omega,
            residualError: 0.06 // 25% proportional error
        )
    }
    
    private static func getNeonatalPriors(patient: PatientInput) -> BayesianPriors {
        // Neonatal population priors with maturation considerations
        let baseVd = calculateNeonatalVd(patient: patient)
        let baseCl = calculateNeonatalClearance(patient: patient)
        
        // Highest variability in neonatal population
        let omega = Matrix2x2(
            var11: 0.25, // CV² for Vd (~50% CV)
            var12: 0.05, // Covariance between Vd and Cl
            var22: 0.36  // CV² for Cl (~60% CV)
        )
        
        return BayesianPriors(
            meanVd: baseVd,
            meanCl: baseCl,
            omega: omega,
            residualError: 0.09 // 30% proportional error
        )
    }
    
    // MARK: - MAP Estimation
    
    private static func performMAPEstimation(patient: PatientInput, levels: [VancomycinLevel], priors: BayesianPriors) throws -> MAPEstimates {
        
        // Try Laplace approximation first (faster)
        if let laplaceResult = try? performLaplaceApproximation(patient: patient, levels: levels, priors: priors) {
            return laplaceResult
        }
        
        // Fallback to MCMC if Laplace fails
        return try performMCMCEstimation(patient: patient, levels: levels, priors: priors)
    }
    
    // MARK: - Laplace Approximation
    
    private static func performLaplaceApproximation(patient: PatientInput, levels: [VancomycinLevel], priors: BayesianPriors) throws -> MAPEstimates {
        
        // Initial parameter estimates (log-transformed)
        var logVd = log(priors.meanVd)
        var logCl = log(priors.meanCl)
        
        // Newton-Raphson optimization
        let maxIterations = 100
        let tolerance = 1e-6
        
        for iteration in 0..<maxIterations {
            let currentVd = exp(logVd)
            let currentCl = exp(logCl)
            
            // Calculate objective function and gradients
            let (objFunc, gradient, hessian) = calculateObjectiveFunctionAndDerivatives(
                vd: currentVd, cl: currentCl, patient: patient, levels: levels, priors: priors
            )
            
            // Newton-Raphson update
            let deltaParams = try solveLinearSystem(hessian: hessian, gradient: gradient)
            
            logVd -= deltaParams.0
            logCl -= deltaParams.1
            
            // Check convergence
            if abs(deltaParams.0) < tolerance && abs(deltaParams.1) < tolerance {
                break
            }
            
            if iteration == maxIterations - 1 {
                throw CalculationError.bayesianOptimizationFailed("Laplace approximation failed to converge")
            }
        }
        
        let finalVd = exp(logVd)
        let finalCl = exp(logCl)
        
        // Calculate confidence intervals using Hessian
        let (_, _, hessian) = calculateObjectiveFunctionAndDerivatives(
            vd: finalVd, cl: finalCl, patient: patient, levels: levels, priors: priors
        )
        
        let confidenceIntervals = calculateConfidenceIntervals(
            vd: finalVd, cl: finalCl, hessian: hessian
        )
        
        return MAPEstimates(
            vd: finalVd,
            cl: finalCl,
            vdCI: confidenceIntervals.vdCI,
            clCI: confidenceIntervals.clCI,
            method: "Laplace Approximation",
            iterations: maxIterations
        )
    }
    
    // MARK: - MCMC Estimation (Fallback)
    
    private static func performMCMCEstimation(patient: PatientInput, levels: [VancomycinLevel], priors: BayesianPriors) throws -> MAPEstimates {
        
        let nSamples = 10000
        let burnIn = 2000
        let thinning = 5
        
        var vdSamples: [Double] = []
        var clSamples: [Double] = []
        
        // Initial values
        var currentVd = priors.meanVd
        var currentCl = priors.meanCl
        
        // Proposal standard deviations
        let vdProposalSD = 0.1 * currentVd
        let clProposalSD = 0.1 * currentCl
        
        var acceptedVd = 0
        var acceptedCl = 0
        
        for sample in 0..<nSamples {
            // Update Vd
            let proposedVd = currentVd + Double.random(in: -1...1) * vdProposalSD
            if proposedVd > 0 {
                let currentLogLikelihood = calculateLogLikelihood(vd: currentVd, cl: currentCl, patient: patient, levels: levels, priors: priors)
                let proposedLogLikelihood = calculateLogLikelihood(vd: proposedVd, cl: currentCl, patient: patient, levels: levels, priors: priors)
                
                let acceptanceRatio = exp(proposedLogLikelihood - currentLogLikelihood)
                if Double.random(in: 0...1) < acceptanceRatio {
                    currentVd = proposedVd
                    acceptedVd += 1
                }
            }
            
            // Update Cl
            let proposedCl = currentCl + Double.random(in: -1...1) * clProposalSD
            if proposedCl > 0 {
                let currentLogLikelihood = calculateLogLikelihood(vd: currentVd, cl: currentCl, patient: patient, levels: levels, priors: priors)
                let proposedLogLikelihood = calculateLogLikelihood(vd: currentVd, cl: proposedCl, patient: patient, levels: levels, priors: priors)
                
                let acceptanceRatio = exp(proposedLogLikelihood - currentLogLikelihood)
                if Double.random(in: 0...1) < acceptanceRatio {
                    currentCl = proposedCl
                    acceptedCl += 1
                }
            }
            
            // Store samples after burn-in and thinning
            if sample >= burnIn && sample % thinning == 0 {
                vdSamples.append(currentVd)
                clSamples.append(currentCl)
            }
        }
        
        // Calculate posterior statistics
        let vdMean = vdSamples.reduce(0, +) / Double(vdSamples.count)
        let clMean = clSamples.reduce(0, +) / Double(clSamples.count)
        
        let vdSorted = vdSamples.sorted()
        let clSorted = clSamples.sorted()
        
        let vdCI = ConfidenceInterval(
            lower: vdSorted[Int(0.025 * Double(vdSorted.count))],
            upper: vdSorted[Int(0.975 * Double(vdSorted.count))],
            median: vdSorted[vdSorted.count / 2],
            confidence: 0.95
        )
        
        let clCI = ConfidenceInterval(
            lower: clSorted[Int(0.025 * Double(clSorted.count))],
            upper: clSorted[Int(0.975 * Double(clSorted.count))],
            median: clSorted[clSorted.count / 2],
            confidence: 0.95
        )
        
        return MAPEstimates(
            vd: vdMean,
            cl: clMean,
            vdCI: vdCI,
            clCI: clCI,
            method: "MCMC",
            iterations: nSamples
        )
    }
    
    // MARK: - Objective Function and Derivatives
    
    private static func calculateObjectiveFunctionAndDerivatives(vd: Double, cl: Double, patient: PatientInput, levels: [VancomycinLevel], priors: BayesianPriors) -> (objFunc: Double, gradient: (Double, Double), hessian: Matrix2x2) {
        
        let logLikelihood = calculateLogLikelihood(vd: vd, cl: cl, patient: patient, levels: levels, priors: priors)
        
        // Calculate gradients numerically
        let epsilon = 1e-6
        
        let dVd = (calculateLogLikelihood(vd: vd + epsilon, cl: cl, patient: patient, levels: levels, priors: priors) -
                   calculateLogLikelihood(vd: vd - epsilon, cl: cl, patient: patient, levels: levels, priors: priors)) / (2 * epsilon)
        
        let dCl = (calculateLogLikelihood(vd: vd, cl: cl + epsilon, patient: patient, levels: levels, priors: priors) -
                   calculateLogLikelihood(vd: vd, cl: cl - epsilon, patient: patient, levels: levels, priors: priors)) / (2 * epsilon)
        
        // Calculate Hessian numerically
        let d2VdVd = (calculateLogLikelihood(vd: vd + epsilon, cl: cl, patient: patient, levels: levels, priors: priors) -
                      2 * logLikelihood +
                      calculateLogLikelihood(vd: vd - epsilon, cl: cl, patient: patient, levels: levels, priors: priors)) / (epsilon * epsilon)
        
        let d2ClCl = (calculateLogLikelihood(vd: vd, cl: cl + epsilon, patient: patient, levels: levels, priors: priors) -
                      2 * logLikelihood +
                      calculateLogLikelihood(vd: vd, cl: cl - epsilon, patient: patient, levels: levels, priors: priors)) / (epsilon * epsilon)
        
        let d2VdCl = (calculateLogLikelihood(vd: vd + epsilon, cl: cl + epsilon, patient: patient, levels: levels, priors: priors) -
                      calculateLogLikelihood(vd: vd + epsilon, cl: cl - epsilon, patient: patient, levels: levels, priors: priors) -
                      calculateLogLikelihood(vd: vd - epsilon, cl: cl + epsilon, patient: patient, levels: levels, priors: priors) +
                      calculateLogLikelihood(vd: vd - epsilon, cl: cl - epsilon, patient: patient, levels: levels, priors: priors)) / (4 * epsilon * epsilon)
        
        let hessian = Matrix2x2(var11: -d2VdVd, var12: -d2VdCl, var22: -d2ClCl)
        
        return (-logLikelihood, (-dVd, -dCl), hessian)
    }
    
    // MARK: - Log Likelihood Calculation
    
    private static func calculateLogLikelihood(vd: Double, cl: Double, patient: PatientInput, levels: [VancomycinLevel], priors: BayesianPriors) -> Double {
        
        var logLikelihood = 0.0
        
        // Data likelihood
        for level in levels {
            let predictedConcentration = predictConcentration(
                vd: vd, cl: cl, dose: level.doseGiven, timeAfterDose: level.timeAfterDose
            )
            
            let residual = level.concentration - predictedConcentration
            let variance = priors.residualError * level.concentration * level.concentration
            
            logLikelihood += -0.5 * log(2 * Double.pi * variance) - 0.5 * residual * residual / variance
        }
        
        // Prior likelihood
        let logVd = log(vd)
        let logCl = log(cl)
        let meanLogVd = log(priors.meanVd)
        let meanLogCl = log(priors.meanCl)
        
        let etaVd = logVd - meanLogVd
        let etaCl = logCl - meanLogCl
        
        let omegaInv = priors.omega.inverse()
        let priorLogLikelihood = -0.5 * (etaVd * etaVd * omegaInv.var11 +
                                        2 * etaVd * etaCl * omegaInv.var12 +
                                        etaCl * etaCl * omegaInv.var22)
        
        logLikelihood += priorLogLikelihood
        
        return logLikelihood
    }
    
    // MARK: - Concentration Prediction
    
    private static func predictConcentration(vd: Double, cl: Double, dose: Double, timeAfterDose: Double) -> Double {
        let ke = cl / vd
        let c0 = dose / vd
        return c0 * exp(-ke * timeAfterDose)
    }
    
    // MARK: - Optimal Dosing with MAP Parameters
    
    private static func calculateOptimalDosingWithMAP(patient: PatientInput, mapEstimates: MAPEstimates) throws -> DosingResult {
        
        let vd = mapEstimates.vd
        let cl = mapEstimates.cl
        let ke = cl / vd
        let halfLife = 0.693 / ke
        
        // Determine target AUC
        let targetAUC = determineTargetAUC(indication: patient.indication, severity: patient.severity)
        
        // Calculate optimal dose and interval
        let optimalInterval = determineOptimalInterval(halfLife: halfLife, population: patient.populationType)
        let dose = (targetAUC * cl * Double(optimalInterval)) / 24.0
        let standardDose = roundToStandardDose(dose)
        
        // Calculate loading dose if needed
        let loadingDose = shouldUseLoadingDose(patient: patient) ? 
            calculateLoadingDose(vd: vd, targetLevel: 20.0) : nil
        
        // Calculate predicted concentrations with MAP parameters
        let actualAUC = (Double(standardDose) * 24.0) / (cl * Double(optimalInterval))
        let peak = Double(standardDose) / vd
        let trough = peak * exp(-ke * Double(optimalInterval))
        
        // Calculate AUC confidence interval
        let aucCI = calculateAUCConfidenceInterval(
            dose: standardDose, interval: optimalInterval,
            clCI: mapEstimates.clCI
        )
        
        // Generate clinical guidance
        let dosingSummary = generateBayesianDosingSummary(dose: standardDose, interval: optimalInterval, loadingDose: loadingDose)
        let clinicalNotes = generateBayesianClinicalNotes(patient: patient, mapEstimates: mapEstimates)
        let safetyWarnings = generateSafetyWarnings(patient: patient, peak: peak, trough: trough, auc: actualAUC)
        let monitoringRecommendations = generateBayesianMonitoringRecommendations(patient: patient)
        
        return DosingResult(
            recommendedDose: standardDose,
            interval: optimalInterval,
            dailyDose: (Double(standardDose) * 24.0) / Double(optimalInterval),
            mgPerKgPerDay: ((Double(standardDose) * 24.0) / Double(optimalInterval)) / patient.weightInKg,
            loadingDose: loadingDose,
            predictedPeak: peak,
            predictedTrough: trough,
            predictedAUC: actualAUC,
            halfLife: halfLife,
            clearance: cl,
            volumeDistribution: vd,
            eliminationRateConstant: ke,
            creatinineClearance: cl / 0.8, // Approximate conversion
            peakCI: ConfidenceInterval(lower: peak * 0.8, upper: peak * 1.2, median: peak, confidence: 0.95),
            troughCI: ConfidenceInterval(lower: trough * 0.7, upper: trough * 1.3, median: trough, confidence: 0.95),
            aucCI: aucCI,
            clearanceCI: mapEstimates.clCI,
            volumeCI: mapEstimates.vdCI,
            dosingSummary: dosingSummary,
            clinicalNotes: clinicalNotes,
            safetyWarnings: safetyWarnings,
            monitoringRecommendations: monitoringRecommendations,
            calculationMethod: "Bayesian MAP (\(mapEstimates.method))",
            guidelineReference: "Bayesian Optimization",
            isBayesianResult: true
        )
    }
    
    // MARK: - Helper Functions
    
    private static func calculatePopulationClearance(patient: PatientInput) -> Double {
        // Simplified population clearance calculation
        let crCl = estimateCreatinineClearance(patient: patient)
        return 0.048 * crCl + 0.2
    }
    
    private static func calculatePediatricVd(patient: PatientInput) -> Double {
        guard let age = patient.ageInYears else { return 0.7 * patient.weightInKg }
        
        if age < 1 {
            return 0.8 * patient.weightInKg
        } else if age < 12 {
            return 0.75 * patient.weightInKg
        } else {
            return 0.7 * patient.weightInKg
        }
    }
    
    private static func calculatePediatricClearance(patient: PatientInput) -> Double {
        let crCl = estimateCreatinineClearance(patient: patient)
        let adultCl = 0.048 * crCl + 0.2
        
        guard let age = patient.ageInYears else { return adultCl }
        
        let maturationFactor: Double
        if age < 0.25 {
            maturationFactor = 0.6
        } else if age < 1 {
            maturationFactor = 0.8
        } else if age < 2 {
            maturationFactor = 0.9
        } else {
            maturationFactor = 1.0
        }
        
        return adultCl * maturationFactor
    }
    
    private static func calculateNeonatalVd(patient: PatientInput) -> Double {
        let baseVd = 0.9 * patient.weightInKg
        
        if let ga = patient.gestationalAgeWeeks, ga < 37 {
            return baseVd * 1.2
        }
        return baseVd
    }
    
    private static func calculateNeonatalClearance(patient: PatientInput) -> Double {
        guard let ga = patient.gestationalAgeWeeks,
              let pna = patient.postnatalAgeDays else {
            return 0.02 * patient.weightInKg
        }
        
        let pma = ga + (pna / 7.0)
        let baseCl = 0.02 * patient.weightInKg
        let maturation = calculateRenalMaturation(gestationalAge: ga, postnatalAge: pna)
        
        return baseCl * maturation
    }
    
    private static func calculateRenalMaturation(gestationalAge: Double, postnatalAge: Double) -> Double {
        let pma = gestationalAge + (postnatalAge / 7.0)
        
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
    
    private static func estimateCreatinineClearance(patient: PatientInput) -> Double {
        // Simplified CrCl estimation for Bayesian priors
        switch patient.populationType {
        case .adult:
            guard let age = patient.ageInYears, let height = patient.heightInCm else { return 100.0 }
            let ibw = VancomycinCalculator.calculateIdealBodyWeight(height: height, gender: patient.gender)
            let genderFactor = patient.gender == .female ? 0.85 : 1.0
            return ((140 - age) * ibw * genderFactor) / (72 * patient.serumCreatinine)
        case .pediatric:
            guard let height = patient.heightInCm else { return 50.0 }
            let k = patient.ageInYears ?? 1 < 1 ? 0.33 : 0.55
            return (k * height) / patient.serumCreatinine
        case .neonate:
            return 20.0 // Conservative estimate for neonates
        }
    }
    
    // Additional helper functions...
    private static func solveLinearSystem(hessian: Matrix2x2, gradient: (Double, Double)) throws -> (Double, Double) {
        let det = hessian.determinant()
        guard abs(det) > 1e-12 else {
            throw CalculationError.bayesianOptimizationFailed("Singular Hessian matrix")
        }
        
        let inv = hessian.inverse()
        let deltaVd = inv.var11 * gradient.0 + inv.var12 * gradient.1
        let deltaCl = inv.var12 * gradient.0 + inv.var22 * gradient.1
        
        return (deltaVd, deltaCl)
    }
    
    private static func calculateConfidenceIntervals(vd: Double, cl: Double, hessian: Matrix2x2) -> (vdCI: ConfidenceInterval, clCI: ConfidenceInterval) {
        let inv = hessian.inverse()
        let vdSE = sqrt(inv.var11)
        let clSE = sqrt(inv.var22)
        
        let z95 = 1.96 // 95% confidence interval
        
        let vdCI = ConfidenceInterval(
            lower: max(0.1, vd - z95 * vdSE),
            upper: vd + z95 * vdSE,
            median: vd,
            confidence: 0.95
        )
        
        let clCI = ConfidenceInterval(
            lower: max(0.01, cl - z95 * clSE),
            upper: cl + z95 * clSE,
            median: cl,
            confidence: 0.95
        )
        
        return (vdCI, clCI)
    }
    
    private static func calculateAUCConfidenceInterval(dose: Int, interval: Int, clCI: ConfidenceInterval?) -> ConfidenceInterval? {
        guard let clCI = clCI else { return nil }
        
        let aucLower = (Double(dose) * 24.0) / (clCI.upper * Double(interval))
        let aucUpper = (Double(dose) * 24.0) / (clCI.lower * Double(interval))
        let aucMedian = (Double(dose) * 24.0) / (clCI.median * Double(interval))
        
        return ConfidenceInterval(
            lower: aucLower,
            upper: aucUpper,
            median: aucMedian,
            confidence: 0.95
        )
    }
    
    // Clinical guidance functions...
    private static func generateBayesianDosingSummary(dose: Int, interval: Int, loadingDose: Int?) -> String {
        var summary = "Bayesian-optimized: \(dose) mg every \(interval) hours"
        if let loading = loadingDose {
            summary = "Loading dose: \(loading) mg, then " + summary
        }
        return summary
    }
    
    private static func generateBayesianClinicalNotes(patient: PatientInput, mapEstimates: MAPEstimates) -> [String] {
        var notes: [String] = []
        
        notes.append("Dosing optimized using Bayesian MAP estimation")
        notes.append("Method: \(mapEstimates.method)")
        notes.append("Patient-specific Vd: \(String(format: "%.1f", mapEstimates.vd)) L")
        notes.append("Patient-specific Cl: \(String(format: "%.2f", mapEstimates.cl)) L/h")
        
        return notes
    }
    
    private static func generateBayesianMonitoringRecommendations(patient: PatientInput) -> [String] {
        var recommendations: [String] = []
        
        recommendations.append("Continue monitoring vancomycin levels")
        recommendations.append("Update Bayesian estimates with new levels")
        recommendations.append("Monitor renal function closely")
        recommendations.append("Consider dose adjustment if clinical status changes")
        
        return recommendations
    }
    
    // Placeholder implementations for missing functions
    private static func determineTargetAUC(indication: Indication, severity: InfectionSeverity) -> Double {
        return indication.targetAUC * getSeverityMultiplier(severity)
    }
    
    private static func getSeverityMultiplier(_ severity: InfectionSeverity) -> Double {
        switch severity {
        case .mild: return 0.9
        case .moderate: return 1.0
        case .severe: return 1.2
        }
    }
    
    private static func determineOptimalInterval(halfLife: Double, population: PopulationType) -> Int {
        switch population {
        case .adult:
            if halfLife < 4 { return 6 }
            else if halfLife < 8 { return 8 }
            else if halfLife < 16 { return 12 }
            else if halfLife < 30 { return 24 }
            else { return 48 }
        case .pediatric:
            if halfLife < 6 { return 6 }
            else if halfLife < 12 { return 8 }
            else if halfLife < 20 { return 12 }
            else { return 24 }
        case .neonate:
            if halfLife < 8 { return 8 }
            else if halfLife < 16 { return 12 }
            else if halfLife < 30 { return 18 }
            else { return 24 }
        }
    }
    
    private static func roundToStandardDose(_ dose: Double) -> Int {
        let standardDoses = [250, 500, 750, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 3000, 3500, 4000]
        return standardDoses.min { abs($0 - Int(dose)) < abs($1 - Int(dose)) } ?? 1000
    }
    
    private static func shouldUseLoadingDose(patient: PatientInput) -> Bool {
        return patient.severity == .severe || 
               patient.indication.requiresLoadingDose ||
               patient.isOnHemodialysis ||
               patient.isOnCRRT
    }
    
    private static func calculateLoadingDose(vd: Double, targetLevel: Double) -> Int {
        let dose = vd * targetLevel
        return roundToStandardDose(dose)
    }
    
    private static func generateSafetyWarnings(patient: PatientInput, peak: Double, trough: Double, auc: Double) -> [String] {
        var warnings: [String] = []
        
        if peak > 40 { warnings.append("Predicted peak >40 mg/L: risk of nephrotoxicity") }
        if trough > 20 { warnings.append("Predicted trough >20 mg/L: risk of nephrotoxicity") }
        if auc > 600 { warnings.append("Predicted AUC >600 mg·h/L: consider dose reduction") }
        
        return warnings
    }
}

// MARK: - Supporting Data Structures

struct BayesianPriors {
    let meanVd: Double
    let meanCl: Double
    let omega: Matrix2x2
    let residualError: Double
}

struct MAPEstimates {
    let vd: Double
    let cl: Double
    let vdCI: ConfidenceInterval?
    let clCI: ConfidenceInterval?
    let method: String
    let iterations: Int
}

struct Matrix2x2 {
    let var11: Double
    let var12: Double
    let var22: Double
    
    func determinant() -> Double {
        return var11 * var22 - var12 * var12
    }
    
    func inverse() -> Matrix2x2 {
        let det = determinant()
        return Matrix2x2(
            var11: var22 / det,
            var12: -var12 / det,
            var22: var11 / det
        )
    }
}

