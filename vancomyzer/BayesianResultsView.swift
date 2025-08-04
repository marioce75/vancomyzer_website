import SwiftUI

// MARK: - Bayesian Results View

struct BayesianResultsView: View {
    let optimization: BayesianOptimizationResult
    let patient: PatientInput
    
    @Environment(\.dismiss) private var dismiss
    @State private var showingExportOptions = false
    @State private var showingDetailedAnalysis = false
    @State private var selectedTab = 0
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Tab Selection
                Picker("View", selection: $selectedTab) {
                    Text("Results").tag(0)
                    Text("Analysis").tag(1)
                    Text("Monitoring").tag(2)
                }
                .pickerStyle(SegmentedPickerStyle())
                .padding()
                
                // Content
                TabView(selection: $selectedTab) {
                    // Results Tab
                    ScrollView {
                        LazyVStack(spacing: 20) {
                            // Main Recommendation
                            BayesianRecommendationCard(optimization: optimization)
                            
                            // Patient-Specific Parameters
                            PatientSpecificParametersSection(optimization: optimization)
                            
                            // Confidence Intervals
                            ConfidenceIntervalsSection(optimization: optimization)
                            
                            // Alternative Regimens
                            if !optimization.alternativeRegimens.isEmpty {
                                AlternativeRegimensSection(regimens: optimization.alternativeRegimens)
                            }
                        }
                        .padding()
                    }
                    .tag(0)
                    
                    // Analysis Tab
                    ScrollView {
                        LazyVStack(spacing: 20) {
                            // Model Performance
                            ModelPerformanceSection(optimization: optimization)
                            
                            // Level Predictions
                            LevelPredictionsSection(optimization: optimization)
                            
                            // Parameter Evolution
                            ParameterEvolutionSection(optimization: optimization)
                        }
                        .padding()
                    }
                    .tag(1)
                    
                    // Monitoring Tab
                    ScrollView {
                        LazyVStack(spacing: 20) {
                            // Next Level Recommendations
                            NextLevelRecommendationsSection(optimization: optimization, patient: patient)
                            
                            // Clinical Monitoring
                            ClinicalMonitoringSection(optimization: optimization, patient: patient)
                            
                            // Safety Considerations
                            SafetyConsiderationsSection(optimization: optimization)
                        }
                        .padding()
                    }
                    .tag(2)
                }
                .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
            }
            .navigationTitle("Bayesian Results")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Done") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack {
                        Button(action: { showingDetailedAnalysis = true }) {
                            Image(systemName: "chart.bar.doc.horizontal")
                        }
                        .accessibilityLabel("Detailed Analysis")
                        
                        Button(action: { showingExportOptions = true }) {
                            Image(systemName: "square.and.arrow.up")
                        }
                        .accessibilityLabel("Export Results")
                    }
                }
            }
        }
        .sheet(isPresented: $showingExportOptions) {
            BayesianExportView(optimization: optimization, patient: patient)
        }
        .sheet(isPresented: $showingDetailedAnalysis) {
            DetailedBayesianAnalysisView(optimization: optimization, patient: patient)
        }
        .onAppear {
            AnalyticsManager.shared.trackFeatureUsage("bayesian_results_viewed", parameters: [
                "optimization_method": optimization.method,
                "number_of_levels": optimization.levelsUsed.count
            ])
        }
    }
}

// MARK: - Bayesian Recommendation Card

struct BayesianRecommendationCard: View {
    let optimization: BayesianOptimizationResult
    
    var body: some View {
        VancoCard {
            VStack(spacing: 16) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Bayesian-Optimized Dosing")
                            .font(.headline)
                            .fontWeight(.semibold)
                        
                        Text("Patient-specific parameters")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    
                    Image(systemName: "brain.head.profile")
                        .font(.title2)
                        .foregroundColor(.vancoBlue)
                }
                
                Divider()
                
                // Main Recommendation
                VStack(spacing: 12) {
                    Text(optimization.recommendedRegimen.dosingSummary)
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.vancoBlue)
                        .multilineTextAlignment(.center)
                    
                    // Key Metrics with Confidence Intervals
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                        BayesianMetricCard(
                            title: "Predicted AUC₀₋₂₄",
                            value: optimization.predictedAUC.estimate,
                            unit: "mg·h/L",
                            confidenceInterval: optimization.predictedAUC,
                            color: getAUCColor(optimization.predictedAUC.estimate)
                        )
                        
                        BayesianMetricCard(
                            title: "Predicted Trough",
                            value: optimization.predictedTrough.estimate,
                            unit: "mg/L",
                            confidenceInterval: optimization.predictedTrough,
                            color: getTroughColor(optimization.predictedTrough.estimate)
                        )
                    }
                }
                
                // Probability of Target Achievement
                if let targetProbability = optimization.targetAchievementProbability {
                    HStack {
                        Text("Probability of target achievement:")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Spacer()
                        
                        Text("\(Int(targetProbability * 100))%")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(probabilityColor(targetProbability))
                    }
                    .padding(.top, 8)
                }
            }
        }
    }
    
    private func getAUCColor(_ auc: Double) -> Color {
        switch auc {
        case 400...600: return .clinicalSafe
        case 350...650: return .clinicalCaution
        default: return .clinicalDanger
        }
    }
    
    private func getTroughColor(_ trough: Double) -> Color {
        switch trough {
        case 10...20: return .clinicalSafe
        case 5...25: return .clinicalCaution
        default: return .clinicalDanger
        }
    }
    
    private func probabilityColor(_ probability: Double) -> Color {
        switch probability {
        case 0.8...1.0: return .clinicalSafe
        case 0.6..<0.8: return .clinicalCaution
        default: return .clinicalDanger
        }
    }
}

// MARK: - Bayesian Metric Card

struct BayesianMetricCard: View {
    let title: String
    let value: Double
    let unit: String
    let confidenceInterval: ConfidenceInterval?
    let color: Color
    
    var body: some View {
        VStack(spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            
            Text(String(format: "%.1f", value))
                .font(.title3)
                .fontWeight(.bold)
                .foregroundColor(color)
            
            Text(unit)
                .font(.caption2)
                .foregroundColor(.secondary)
            
            if let ci = confidenceInterval {
                Text("95% CI: \(String(format: "%.1f", ci.lower))-\(String(format: "%.1f", ci.upper))")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
}

// MARK: - Patient-Specific Parameters Section

struct PatientSpecificParametersSection: View {
    let optimization: BayesianOptimizationResult
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Patient-Specific Parameters")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                    ParameterComparisonCard(
                        title: "Clearance",
                        populationValue: optimization.populationPriors.meanCl,
                        individualValue: optimization.individualParameters.clearance.estimate,
                        unit: "L/h",
                        confidenceInterval: optimization.individualParameters.clearance
                    )
                    
                    ParameterComparisonCard(
                        title: "Volume of Distribution",
                        populationValue: optimization.populationPriors.meanVd,
                        individualValue: optimization.individualParameters.volumeOfDistribution.estimate,
                        unit: "L",
                        confidenceInterval: optimization.individualParameters.volumeOfDistribution
                    )
                }
                
                // Half-life calculation
                let halfLife = 0.693 / (optimization.individualParameters.clearance.estimate / optimization.individualParameters.volumeOfDistribution.estimate)
                
                HStack {
                    Text("Half-life:")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    Spacer()
                    
                    Text(String(format: "%.1f hours", halfLife))
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
                .padding(.top, 8)
            }
        }
    }
}

// MARK: - Parameter Comparison Card

struct ParameterComparisonCard: View {
    let title: String
    let populationValue: Double
    let individualValue: Double
    let unit: String
    let confidenceInterval: ConfidenceInterval?
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption)
                .fontWeight(.medium)
            
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Individual:")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    
                    Spacer()
                    
                    Text(String(format: "%.2f", individualValue))
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.vancoBlue)
                }
                
                HStack {
                    Text("Population:")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    
                    Spacer()
                    
                    Text(String(format: "%.2f", populationValue))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            
            Text(unit)
                .font(.caption2)
                .foregroundColor(.secondary)
            
            if let ci = confidenceInterval {
                Text("CI: \(String(format: "%.2f", ci.lower))-\(String(format: "%.2f", ci.upper))")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(8)
        .background(Color(.systemBackground))
        .cornerRadius(6)
    }
}

// MARK: - Confidence Intervals Section

struct ConfidenceIntervalsSection: View {
    let optimization: BayesianOptimizationResult
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Confidence Intervals (95%)")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                VStack(spacing: 12) {
                    ConfidenceIntervalRow(
                        parameter: "AUC₀₋₂₄",
                        interval: optimization.predictedAUC,
                        unit: "mg·h/L",
                        targetRange: 400...600
                    )
                    
                    ConfidenceIntervalRow(
                        parameter: "Trough Level",
                        interval: optimization.predictedTrough,
                        unit: "mg/L",
                        targetRange: 10...20
                    )
                    
                    ConfidenceIntervalRow(
                        parameter: "Peak Level",
                        interval: optimization.predictedPeak,
                        unit: "mg/L",
                        targetRange: 20...40
                    )
                }
                
                Text("Confidence intervals represent uncertainty in predictions based on available data. Narrower intervals indicate higher precision.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.top, 8)
            }
        }
    }
}

// MARK: - Confidence Interval Row

struct ConfidenceIntervalRow: View {
    let parameter: String
    let interval: ConfidenceInterval
    let unit: String
    let targetRange: ClosedRange<Double>
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(parameter)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Spacer()
                
                Text(String(format: "%.1f", interval.estimate))
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.vancoBlue)
            }
            
            HStack {
                Text("Range:")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text("\(String(format: "%.1f", interval.lower)) - \(String(format: "%.1f", interval.upper)) \(unit)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                // Target achievement indicator
                let overlapPercentage = calculateOverlap(interval: interval, targetRange: targetRange)
                Circle()
                    .fill(overlapColor(overlapPercentage))
                    .frame(width: 8, height: 8)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(8)
    }
    
    private func calculateOverlap(interval: ConfidenceInterval, targetRange: ClosedRange<Double>) -> Double {
        let overlapStart = max(interval.lower, targetRange.lowerBound)
        let overlapEnd = min(interval.upper, targetRange.upperBound)
        
        if overlapStart >= overlapEnd {
            return 0.0
        }
        
        let overlapLength = overlapEnd - overlapStart
        let intervalLength = interval.upper - interval.lower
        
        return overlapLength / intervalLength
    }
    
    private func overlapColor(_ percentage: Double) -> Color {
        switch percentage {
        case 0.8...1.0: return .clinicalSafe
        case 0.5..<0.8: return .clinicalCaution
        default: return .clinicalDanger
        }
    }
}

// MARK: - Model Performance Section

struct ModelPerformanceSection: View {
    let optimization: BayesianOptimizationResult
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Model Performance")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                VStack(spacing: 12) {
                    ModelMetricRow(
                        title: "Optimization Method",
                        value: optimization.method,
                        icon: "brain.head.profile"
                    )
                    
                    ModelMetricRow(
                        title: "Convergence Achieved",
                        value: optimization.converged ? "Yes" : "No",
                        icon: optimization.converged ? "checkmark.circle.fill" : "xmark.circle.fill",
                        valueColor: optimization.converged ? .clinicalSafe : .clinicalDanger
                    )
                    
                    ModelMetricRow(
                        title: "Iterations",
                        value: "\(optimization.iterations)",
                        icon: "arrow.clockwise"
                    )
                    
                    if let goodnessOfFit = optimization.goodnessOfFit {
                        ModelMetricRow(
                            title: "Model Fit (R²)",
                            value: String(format: "%.3f", goodnessOfFit),
                            icon: "chart.line.uptrend.xyaxis",
                            valueColor: goodnessOfFit > 0.8 ? .clinicalSafe : (goodnessOfFit > 0.6 ? .clinicalCaution : .clinicalDanger)
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Model Metric Row

struct ModelMetricRow: View {
    let title: String
    let value: String
    let icon: String
    let valueColor: Color?
    
    init(title: String, value: String, icon: String, valueColor: Color? = nil) {
        self.title = title
        self.value = value
        self.icon = icon
        self.valueColor = valueColor
    }
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(.vancoBlue)
                .frame(width: 20)
            
            Text(title)
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            Spacer()
            
            Text(value)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(valueColor ?? .primary)
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Level Predictions Section

struct LevelPredictionsSection: View {
    let optimization: BayesianOptimizationResult
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Level Predictions vs Observed")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                VStack(spacing: 8) {
                    ForEach(optimization.levelPredictions.indices, id: \.self) { index in
                        let prediction = optimization.levelPredictions[index]
                        
                        LevelPredictionRow(prediction: prediction)
                    }
                }
                
                if let bias = optimization.bias, let precision = optimization.precision {
                    HStack {
                        VStack(alignment: .leading) {
                            Text("Bias")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(String(format: "%.2f mg/L", bias))
                                .font(.caption)
                                .fontWeight(.medium)
                        }
                        
                        Spacer()
                        
                        VStack(alignment: .trailing) {
                            Text("Precision")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(String(format: "%.2f mg/L", precision))
                                .font(.caption)
                                .fontWeight(.medium)
                        }
                    }
                    .padding(.top, 8)
                }
            }
        }
    }
}

// MARK: - Level Prediction Row

struct LevelPredictionRow: View {
    let prediction: LevelPrediction
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Level \(prediction.levelNumber)")
                    .font(.caption)
                    .fontWeight(.medium)
                
                Text(prediction.timestamp, style: .time)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 2) {
                HStack(spacing: 8) {
                    Text("Obs: \(String(format: "%.1f", prediction.observed))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Text("Pred: \(String(format: "%.1f", prediction.predicted))")
                        .font(.caption)
                        .fontWeight(.medium)
                }
                
                let error = abs(prediction.predicted - prediction.observed)
                let errorPercentage = (error / prediction.observed) * 100
                
                Text("Error: \(String(format: "%.1f", error)) mg/L (\(String(format: "%.0f", errorPercentage))%)")
                    .font(.caption2)
                    .foregroundColor(errorPercentage > 20 ? .clinicalDanger : (errorPercentage > 10 ? .clinicalCaution : .clinicalSafe))
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Next Level Recommendations Section

struct NextLevelRecommendationsSection: View {
    let optimization: BayesianOptimizationResult
    let patient: PatientInput
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Next Level Recommendations")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                VStack(spacing: 12) {
                    NextLevelCard(
                        type: "Trough Level",
                        timing: "30 minutes before 4th dose",
                        expectedRange: "10-20 mg/L",
                        icon: "drop.triangle.fill",
                        color: .vancoBlue
                    )
                    
                    NextLevelCard(
                        type: "Peak Level",
                        timing: "1-2 hours after infusion end",
                        expectedRange: "20-40 mg/L",
                        icon: "drop.triangle.fill",
                        color: .vancoOrange
                    )
                }
                
                Text("Additional levels will further refine parameter estimates and improve dosing precision.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.top, 8)
            }
        }
    }
}

// MARK: - Next Level Card

struct NextLevelCard: View {
    let type: String
    let timing: String
    let expectedRange: String
    let icon: String
    let color: Color
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(color)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(type)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(timing)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text("Expected: \(expectedRange)")
                    .font(.caption)
                    .foregroundColor(.vancoBlue)
            }
            
            Spacer()
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(8)
    }
}

// MARK: - Clinical Monitoring Section

struct ClinicalMonitoringSection: View {
    let optimization: BayesianOptimizationResult
    let patient: PatientInput
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Clinical Monitoring")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                VStack(alignment: .leading, spacing: 8) {
                    MonitoringRecommendation(
                        icon: "drop.fill",
                        title: "Renal Function",
                        description: "Monitor SCr and BUN every 2-3 days",
                        frequency: "Every 2-3 days"
                    )
                    
                    MonitoringRecommendation(
                        icon: "ear.fill",
                        title: "Hearing Assessment",
                        description: "Baseline and weekly if therapy >7 days",
                        frequency: "Weekly if >7 days"
                    )
                    
                    MonitoringRecommendation(
                        icon: "heart.text.square.fill",
                        title: "Clinical Response",
                        description: "Evaluate infection response daily",
                        frequency: "Daily"
                    )
                    
                    if patient.populationType == .neonate {
                        MonitoringRecommendation(
                            icon: "figure.child.circle",
                            title: "Growth & Development",
                            description: "Monitor developmental milestones",
                            frequency: "Weekly"
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Monitoring Recommendation

struct MonitoringRecommendation: View {
    let icon: String
    let title: String
    let description: String
    let frequency: String
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.vancoBlue)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Text(frequency)
                .font(.caption)
                .foregroundColor(.vancoBlue)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.vancoBlue.opacity(0.1))
                .cornerRadius(4)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Safety Considerations Section

struct SafetyConsiderationsSection: View {
    let optimization: BayesianOptimizationResult
    
    var body: some View {
        if !optimization.safetyWarnings.isEmpty {
            VancoAlertView(
                type: .warning,
                title: "Safety Considerations",
                message: optimization.safetyWarnings.joined(separator: "\n"),
                primaryAction: nil,
                secondaryAction: nil
            )
        }
    }
}

// MARK: - Stub Data Types

// These would be defined in DataModels.swift or a separate file
struct BayesianOptimizationResult {
    let method: String
    let converged: Bool
    let iterations: Int
    let recommendedRegimen: DosingRegimen
    let predictedAUC: ConfidenceInterval
    let predictedTrough: ConfidenceInterval
    let predictedPeak: ConfidenceInterval
    let individualParameters: IndividualParameters
    let populationPriors: PopulationPriors
    let targetAchievementProbability: Double?
    let alternativeRegimens: [AlternativeRegimen]
    let levelsUsed: [VancomycinLevel]
    let levelPredictions: [LevelPrediction]
    let goodnessOfFit: Double?
    let bias: Double?
    let precision: Double?
    let safetyWarnings: [String]
    let clinicalRecommendations: [String]
}

struct DosingRegimen {
    let dose: Double
    let interval: Double
    let loadingDose: Double?
    
    var dosingSummary: String {
        var summary = "\(Int(dose)) mg every \(Int(interval)) hours"
        if let loading = loadingDose {
            summary = "Loading dose: \(Int(loading)) mg, then " + summary
        }
        return summary
    }
}

struct IndividualParameters {
    let clearance: ConfidenceInterval
    let volumeOfDistribution: ConfidenceInterval
}

struct PopulationPriors {
    let meanCl: Double
    let meanVd: Double
}

struct AlternativeRegimen {
    let dose: Double
    let interval: Double
    let predictedAUC: Double
    let suitability: String
}

struct LevelPrediction {
    let levelNumber: Int
    let timestamp: Date
    let observed: Double
    let predicted: Double
}

#Preview {
    BayesianResultsView(
        optimization: BayesianOptimizationResult(
            method: "Laplace Approximation",
            converged: true,
            iterations: 15,
            recommendedRegimen: DosingRegimen(dose: 1250, interval: 12, loadingDose: nil),
            predictedAUC: ConfidenceInterval(lower: 420, upper: 580, median: 500, confidence: 0.95),
            predictedTrough: ConfidenceInterval(lower: 12, upper: 18, median: 15, confidence: 0.95),
            predictedPeak: ConfidenceInterval(lower: 25, upper: 35, median: 30, confidence: 0.95),
            individualParameters: IndividualParameters(
                clearance: ConfidenceInterval(lower: 2.1, upper: 2.9, median: 2.5, confidence: 0.95),
                volumeOfDistribution: ConfidenceInterval(lower: 45, upper: 55, median: 50, confidence: 0.95)
            ),
            populationPriors: PopulationPriors(meanCl: 2.2, meanVd: 49),
            targetAchievementProbability: 0.85,
            alternativeRegimens: [],
            levelsUsed: [],
            levelPredictions: [],
            goodnessOfFit: 0.92,
            bias: 0.5,
            precision: 2.1,
            safetyWarnings: [],
            clinicalRecommendations: []
        ),
        patient: PatientInput(
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
    )
}