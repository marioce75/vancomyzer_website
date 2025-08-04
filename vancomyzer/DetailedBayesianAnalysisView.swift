import SwiftUI
import Charts

// MARK: - Detailed Bayesian Analysis View

struct DetailedBayesianAnalysisView: View {
    let optimization: BayesianOptimizationResult
    let patient: PatientInput
    
    @Environment(\.dismiss) private var dismiss
    @State private var selectedSection = 0
    
    private let sections = ["Model", "Levels", "Parameters", "Diagnostics"]
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Section Picker
                Picker("Analysis Section", selection: $selectedSection) {
                    ForEach(sections.indices, id: \.self) { index in
                        Text(sections[index]).tag(index)
                    }
                }
                .pickerStyle(SegmentedPickerStyle())
                .padding()
                
                // Content
                TabView(selection: $selectedSection) {
                    // Model Performance
                    ScrollView {
                        LazyVStack(spacing: 20) {
                            ModelPerformanceDetailSection(optimization: optimization)
                            ConvergenceAnalysisSection(optimization: optimization)
                            GoodnessOfFitSection(optimization: optimization)
                        }
                        .padding()
                    }
                    .tag(0)
                    
                    // Level Analysis
                    ScrollView {
                        LazyVStack(spacing: 20) {
                            ObservedVsPredictedSection(optimization: optimization)
                            ResidualAnalysisSection(optimization: optimization)
                            LevelTimelineSection(optimization: optimization)
                        }
                        .padding()
                    }
                    .tag(1)
                    
                    // Parameter Analysis
                    ScrollView {
                        LazyVStack(spacing: 20) {
                            ParameterDistributionsSection(optimization: optimization)
                            PopulationComparisonSection(optimization: optimization, patient: patient)
                            ParameterCorrelationSection(optimization: optimization)
                        }
                        .padding()
                    }
                    .tag(2)
                    
                    // Diagnostics
                    ScrollView {
                        LazyVStack(spacing: 20) {
                            DiagnosticPlotsSection(optimization: optimization)
                            UncertaintyAnalysisSection(optimization: optimization)
                            SensitivityAnalysisSection(optimization: optimization)
                        }
                        .padding()
                    }
                    .tag(3)
                }
                .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
            }
            .navigationTitle("Detailed Analysis")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Done") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button("Export Analysis", action: exportAnalysis)
                        Button("Share Plots", action: sharePlots)
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
    }
    
    private func exportAnalysis() {
        // Implementation for exporting detailed analysis
        AnalyticsManager.shared.trackFeatureUsage("detailed_analysis_exported")
    }
    
    private func sharePlots() {
        // Implementation for sharing plots
        AnalyticsManager.shared.trackFeatureUsage("analysis_plots_shared")
    }
}

// MARK: - Model Performance Detail Section

struct ModelPerformanceDetailSection: View {
    let optimization: BayesianOptimizationResult
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Model Performance Metrics")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                    MetricCard(
                        title: "R² (Goodness of Fit)",
                        value: optimization.goodnessOfFit ?? 0.0,
                        format: "%.3f",
                        color: getR2Color(optimization.goodnessOfFit ?? 0.0)
                    )
                    
                    MetricCard(
                        title: "Bias",
                        value: optimization.bias ?? 0.0,
                        format: "%.2f mg/L",
                        color: getBiasColor(optimization.bias ?? 0.0)
                    )
                    
                    MetricCard(
                        title: "Precision (RMSE)",
                        value: optimization.precision ?? 0.0,
                        format: "%.2f mg/L",
                        color: getPrecisionColor(optimization.precision ?? 0.0)
                    )
                    
                    MetricCard(
                        title: "Levels Used",
                        value: Double(optimization.levelsUsed.count),
                        format: "%.0f",
                        color: .vancoBlue
                    )
                }
                
                // Performance interpretation
                if let r2 = optimization.goodnessOfFit {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Model Interpretation:")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        Text(getModelInterpretation(r2: r2))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.top, 8)
                }
            }
        }
    }
    
    private func getR2Color(_ r2: Double) -> Color {
        switch r2 {
        case 0.9...1.0: return .clinicalSafe
        case 0.7..<0.9: return .clinicalCaution
        default: return .clinicalDanger
        }
    }
    
    private func getBiasColor(_ bias: Double) -> Color {
        let absBias = abs(bias)
        switch absBias {
        case 0...1.0: return .clinicalSafe
        case 1.0...3.0: return .clinicalCaution
        default: return .clinicalDanger
        }
    }
    
    private func getPrecisionColor(_ precision: Double) -> Color {
        switch precision {
        case 0...2.0: return .clinicalSafe
        case 2.0...4.0: return .clinicalCaution
        default: return .clinicalDanger
        }
    }
    
    private func getModelInterpretation(r2: Double) -> String {
        switch r2 {
        case 0.9...1.0:
            return "Excellent model fit. Predictions are highly reliable."
        case 0.8..<0.9:
            return "Good model fit. Predictions are reliable for clinical use."
        case 0.7..<0.8:
            return "Fair model fit. Consider additional levels for better precision."
        case 0.5..<0.7:
            return "Modest model fit. Use predictions with caution."
        default:
            return "Poor model fit. Additional levels strongly recommended."
        }
    }
}

// MARK: - Metric Card

struct MetricCard: View {
    let title: String
    let value: Double
    let format: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            
            Text(String(format: format, value))
                .font(.title3)
                .fontWeight(.bold)
                .foregroundColor(color)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(8)
    }
}

// MARK: - Convergence Analysis Section

struct ConvergenceAnalysisSection: View {
    let optimization: BayesianOptimizationResult
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Convergence Analysis")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                HStack {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Status:")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        
                        HStack {
                            Image(systemName: optimization.converged ? "checkmark.circle.fill" : "xmark.circle.fill")
                                .foregroundColor(optimization.converged ? .clinicalSafe : .clinicalDanger)
                            
                            Text(optimization.converged ? "Converged" : "Not Converged")
                                .font(.subheadline)
                                .fontWeight(.medium)
                        }
                    }
                    
                    Spacer()
                    
                    VStack(alignment: .trailing, spacing: 8) {
                        Text("Iterations:")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        
                        Text("\(optimization.iterations)")
                            .font(.subheadline)
                            .fontWeight(.medium)
                    }
                }
                
                // Convergence interpretation
                VStack(alignment: .leading, spacing: 4) {
                    Text("Interpretation:")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Text(getConvergenceInterpretation())
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                // Method information
                VStack(alignment: .leading, spacing: 4) {
                    Text("Optimization Method:")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Text(optimization.method)
                        .font(.caption)
                        .foregroundColor(.vancoBlue)
                }
            }
        }
    }
    
    private func getConvergenceInterpretation() -> String {
        if optimization.converged {
            return "The optimization algorithm successfully converged to a stable solution. Parameter estimates are reliable."
        } else {
            return "The optimization did not fully converge. Results should be interpreted with caution. Consider providing additional vancomycin levels."
        }
    }
}

// MARK: - Goodness of Fit Section

struct GoodnessOfFitSection: View {
    let optimization: BayesianOptimizationResult
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Goodness of Fit Analysis")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                if let r2 = optimization.goodnessOfFit {
                    // R² visualization
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("R² = \(String(format: "%.3f", r2))")
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundColor(getR2Color(r2))
                            
                            Spacer()
                            
                            Text("\(Int(r2 * 100))% of variance explained")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        // Visual progress bar
                        GeometryReader { geometry in
                            ZStack(alignment: .leading) {
                                Rectangle()
                                    .fill(Color(.systemGray5))
                                
                                Rectangle()
                                    .fill(getR2Color(r2))
                                    .frame(width: geometry.size.width * min(max(r2, 0), 1))
                                    .animation(.easeInOut(duration: 0.5), value: r2)
                            }
                        }
                        .frame(height: 8)
                        .cornerRadius(4)
                    }
                    
                    // Fit quality indicators
                    VStack(spacing: 8) {
                        FitQualityRow(
                            label: "Systematic Error (Bias)",
                            value: optimization.bias ?? 0.0,
                            unit: "mg/L",
                            isGood: abs(optimization.bias ?? 0.0) < 2.0
                        )
                        
                        FitQualityRow(
                            label: "Random Error (Precision)",
                            value: optimization.precision ?? 0.0,
                            unit: "mg/L",
                            isGood: (optimization.precision ?? 0.0) < 3.0
                        )
                        
                        FitQualityRow(
                            label: "Sample Size",
                            value: Double(optimization.levelsUsed.count),
                            unit: "levels",
                            isGood: optimization.levelsUsed.count >= 2
                        )
                    }
                    .padding(.top)
                    
                } else {
                    Text("Goodness of fit metrics not available")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }
        }
    }
    
    private func getR2Color(_ r2: Double) -> Color {
        switch r2 {
        case 0.9...1.0: return .clinicalSafe
        case 0.7..<0.9: return .clinicalCaution
        default: return .clinicalDanger
        }
    }
}

// MARK: - Fit Quality Row

struct FitQualityRow: View {
    let label: String
    let value: Double
    let unit: String
    let isGood: Bool
    
    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            
            Spacer()
            
            HStack(spacing: 4) {
                Text(String(format: "%.2f", value))
                    .font(.caption)
                    .fontWeight(.medium)
                
                Text(unit)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Image(systemName: isGood ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                    .font(.caption)
                    .foregroundColor(isGood ? .clinicalSafe : .clinicalCaution)
            }
        }
    }
}

// MARK: - Observed vs Predicted Section

struct ObservedVsPredictedSection: View {
    let optimization: BayesianOptimizationResult
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Observed vs Predicted Levels")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                if !optimization.levelPredictions.isEmpty {
                    // Plot would go here in a real implementation
                    VStack(spacing: 8) {
                        ForEach(optimization.levelPredictions.indices, id: \.self) { index in
                            let prediction = optimization.levelPredictions[index]
                            
                            LevelComparisonRow(prediction: prediction)
                        }
                    }
                    
                    // Summary statistics
                    let meanError = optimization.levelPredictions.map { abs($0.predicted - $0.observed) }.reduce(0, +) / Double(optimization.levelPredictions.count)
                    
                    HStack {
                        Text("Mean Absolute Error:")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Spacer()
                        
                        Text(String(format: "%.2f mg/L", meanError))
                            .font(.caption)
                            .fontWeight(.medium)
                    }
                    .padding(.top, 8)
                    
                } else {
                    Text("No level predictions available for comparison")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }
        }
    }
}

// MARK: - Level Comparison Row

struct LevelComparisonRow: View {
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
                        .foregroundColor(.vancoBlue)
                }
                
                let error = prediction.predicted - prediction.observed
                let errorPercentage = (abs(error) / prediction.observed) * 100
                
                Text("Error: \(String(format: "%+.1f", error)) mg/L (\(String(format: "%.0f", errorPercentage))%)")
                    .font(.caption2)
                    .foregroundColor(errorPercentage > 20 ? .clinicalDanger : (errorPercentage > 10 ? .clinicalCaution : .clinicalSafe))
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Residual Analysis Section

struct ResidualAnalysisSection: View {
    let optimization: BayesianOptimizationResult
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Residual Analysis")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                if !optimization.levelPredictions.isEmpty {
                    // Calculate residuals
                    let residuals = optimization.levelPredictions.map { $0.predicted - $0.observed }
                    let meanResidual = residuals.reduce(0, +) / Double(residuals.count)
                    let stdDevResidual = sqrt(residuals.map { pow($0 - meanResidual, 2) }.reduce(0, +) / Double(residuals.count - 1))
                    
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                        ResidualMetricCard(
                            title: "Mean Residual",
                            value: meanResidual,
                            unit: "mg/L",
                            color: abs(meanResidual) < 1.0 ? .clinicalSafe : .clinicalCaution
                        )
                        
                        ResidualMetricCard(
                            title: "Std Deviation",
                            value: stdDevResidual,
                            unit: "mg/L",
                            color: stdDevResidual < 2.0 ? .clinicalSafe : .clinicalCaution
                        )
                    }
                    
                    // Residual plot representation (simplified)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Residual Distribution:")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        ForEach(residuals.indices, id: \.self) { index in
                            ResidualBar(residual: residuals[index], index: index + 1)
                        }
                    }
                    .padding(.top)
                    
                } else {
                    Text("No residual data available")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }
        }
    }
}

// MARK: - Residual Metric Card

struct ResidualMetricCard: View {
    let title: String
    let value: Double
    let unit: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            
            Text(String(format: "%.2f", value))
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundColor(color)
            
            Text(unit)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(6)
    }
}

// MARK: - Residual Bar

struct ResidualBar: View {
    let residual: Double
    let index: Int
    
    var body: some View {
        HStack {
            Text("L\(index)")
                .font(.caption2)
                .frame(width: 20)
            
            GeometryReader { geometry in
                let maxWidth = geometry.size.width - 40
                let barWidth = min(abs(residual) * 20, maxWidth) // Scale for visualization
                
                ZStack(alignment: residual >= 0 ? .leading : .trailing) {
                    Rectangle()
                        .fill(Color(.systemGray5))
                        .frame(height: 6)
                    
                    Rectangle()
                        .fill(residual >= 0 ? Color.vancoBlue : Color.vancoOrange)
                        .frame(width: barWidth, height: 6)
                }
                .cornerRadius(3)
            }
            .frame(height: 6)
            
            Text(String(format: "%+.1f", residual))
                .font(.caption2)
                .frame(width: 30)
        }
    }
}

// MARK: - Additional sections would continue here...

// For brevity, I'll implement the remaining sections as placeholder views

struct LevelTimelineSection: View {
    let optimization: BayesianOptimizationResult
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Level Timeline")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Text("Timeline visualization of vancomycin levels would be displayed here")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
    }
}

struct ParameterDistributionsSection: View {
    let optimization: BayesianOptimizationResult
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Parameter Distributions")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Text("Distribution plots for clearance and volume parameters would be displayed here")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
    }
}

struct PopulationComparisonSection: View {
    let optimization: BayesianOptimizationResult
    let patient: PatientInput
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Population vs Individual")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Text("Comparison of individual vs population parameters would be displayed here")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
    }
}

struct ParameterCorrelationSection: View {
    let optimization: BayesianOptimizationResult
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Parameter Correlations")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Text("Correlation analysis between clearance and volume parameters would be displayed here")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
    }
}

struct DiagnosticPlotsSection: View {
    let optimization: BayesianOptimizationResult
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Diagnostic Plots")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Text("Diagnostic plots for model validation would be displayed here")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
    }
}

struct UncertaintyAnalysisSection: View {
    let optimization: BayesianOptimizationResult
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Uncertainty Analysis")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Text("Uncertainty quantification and sensitivity analysis would be displayed here")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
    }
}

struct SensitivityAnalysisSection: View {
    let optimization: BayesianOptimizationResult
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Sensitivity Analysis")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Text("Parameter sensitivity analysis would be displayed here")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
    }
}

#Preview {
    DetailedBayesianAnalysisView(
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
            levelPredictions: [
                LevelPrediction(levelNumber: 1, timestamp: Date(), observed: 15.2, predicted: 14.8),
                LevelPrediction(levelNumber: 2, timestamp: Date(), observed: 28.5, predicted: 29.1)
            ],
            goodnessOfFit: 0.92,
            bias: 0.5,
            precision: 2.1,
            safetyWarnings: [],
            clinicalRecommendations: []
        ),
        patient: PatientInput.sampleAdult
    )
}