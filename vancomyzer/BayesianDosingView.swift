import SwiftUI

struct BayesianDosingView: View {
    @StateObject private var viewModel = BayesianDosingViewModel()
    @State private var showingLevelEntry = false
    @State private var showingResults = false
    
    var body: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                // Patient Information Section
                if viewModel.hasPatientData {
                    PatientSummarySection(patient: viewModel.patientInput)
                } else {
                    PatientDataPromptSection(action: viewModel.importPatientData)
                }
                
                // Vancomycin Levels Section
                VancomycinLevelsSection(
                    levels: viewModel.vancomycinLevels,
                    onAddLevel: { showingLevelEntry = true },
                    onDeleteLevel: viewModel.deleteLevel,
                    onEditLevel: viewModel.editLevel
                )
                
                // Current Dosing Regimen Section
                CurrentDosingSection(regimen: $viewModel.currentRegimen)
                
                // Bayesian Analysis Section
                if !viewModel.vancomycinLevels.isEmpty {
                    BayesianAnalysisSection(
                        analysis: viewModel.bayesianAnalysis,
                        isCalculating: viewModel.isCalculating,
                        onCalculate: viewModel.performBayesianAnalysis
                    )
                }
                
                // Optimization Results
                if let optimization = viewModel.optimizationResult {
                    OptimizationResultsSection(optimization: optimization)
                }
            }
            .padding()
        }
        .navigationBarItems(trailing: 
            Button("Clear") {
                viewModel.clearAll()
            }
            .foregroundColor(.vancoBlue)
        )
        .sheet(isPresented: $showingLevelEntry) {
            VancomycinLevelEntryView(
                onSave: viewModel.addVancomycinLevel,
                existingLevel: viewModel.levelBeingEdited
            )
        }
        .sheet(isPresented: $showingResults) {
            if let optimization = viewModel.optimizationResult {
                BayesianResultsView(optimization: optimization, patient: viewModel.patientInput)
            }
        }
        .onChange(of: viewModel.optimizationResult) { result in
            if result != nil {
                showingResults = true
            }
        }
    }
}

// MARK: - Patient Summary Section

struct PatientSummarySection: View {
    let patient: PatientInput
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Patient Information", icon: "person.fill")
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                InfoCard(title: "Population", value: patient.populationType.localizedName)
                InfoCard(title: "Age", value: patient.ageDisplay)
                InfoCard(title: "Weight", value: "\(String(format: "%.1f", patient.weightInKg)) kg")
                InfoCard(title: "SCr", value: "\(String(format: "%.2f", patient.serumCreatinine)) mg/dL")
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct PatientDataPromptSection: View {
    let action: () -> Void
    
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.badge.plus")
                .font(.system(size: 40))
                .foregroundColor(.vancoBlue)
            
            Text("Import Patient Data")
                .font(.headline)
                .fontWeight(.semibold)
            
            Text("Import patient information from the Initial Dosing tab to begin Bayesian analysis")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            
            Button("Import Patient Data", action: action)
                .buttonStyle(PrimaryButtonStyle())
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

// MARK: - Vancomycin Levels Section

struct VancomycinLevelsSection: View {
    let levels: [VancomycinLevel]
    let onAddLevel: () -> Void
    let onDeleteLevel: (VancomycinLevel) -> Void
    let onEditLevel: (VancomycinLevel) -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionHeader(title: "Vancomycin Levels", icon: "drop.fill")
                
                Spacer()
                
                Button(action: onAddLevel) {
                    Image(systemName: "plus.circle.fill")
                        .foregroundColor(.vancoBlue)
                        .font(.title2)
                }
                .accessibilityLabel("Add Level")
            }
            
            if levels.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "drop.badge.plus")
                        .font(.system(size: 30))
                        .foregroundColor(.secondary)
                    
                    Text("No vancomycin levels entered")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    Text("Add at least one level to perform Bayesian analysis")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color(.systemGray5))
                .cornerRadius(8)
            } else {
                LazyVStack(spacing: 8) {
                    ForEach(levels) { level in
                        VancomycinLevelRow(
                            level: level,
                            onEdit: { onEditLevel(level) },
                            onDelete: { onDeleteLevel(level) }
                        )
                    }
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct VancomycinLevelRow: View {
    let level: VancomycinLevel
    let onEdit: () -> Void
    let onDelete: () -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("\(String(format: "%.1f", level.concentration)) mg/L")
                        .font(.headline)
                        .fontWeight(.semibold)
                    
                    Spacer()
                    
                    Text(level.type.localizedName)
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(level.type.color.opacity(0.2))
                        .foregroundColor(level.type.color)
                        .cornerRadius(4)
                }
                
                HStack {
                    Text("Drawn: \(level.drawTime, formatter: DateFormatter.timeFormatter)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Spacer()
                    
                    if let lastDose = level.lastDoseTime {
                        Text("Last dose: \(lastDose, formatter: DateFormatter.timeFormatter)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            VStack(spacing: 8) {
                Button(action: onEdit) {
                    Image(systemName: "pencil")
                        .foregroundColor(.vancoBlue)
                }
                
                Button(action: onDelete) {
                    Image(systemName: "trash")
                        .foregroundColor(.red)
                }
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(8)
        .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
    }
}

// MARK: - Current Dosing Section

struct CurrentDosingSection: View {
    @Binding var regimen: DosingRegimen?
    @State private var showingRegimenEntry = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                SectionHeader(title: "Current Dosing Regimen", icon: "pills.fill")
                
                Spacer()
                
                Button(regimen == nil ? "Add" : "Edit") {
                    showingRegimenEntry = true
                }
                .foregroundColor(.vancoBlue)
            }
            
            if let regimen = regimen {
                DosingRegimenCard(regimen: regimen)
            } else {
                VStack(spacing: 8) {
                    Text("No current regimen specified")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    Text("Enter current dosing for accurate Bayesian analysis")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color(.systemGray5))
                .cornerRadius(8)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .sheet(isPresented: $showingRegimenEntry) {
            DosingRegimenEntryView(regimen: $regimen)
        }
    }
}

struct DosingRegimenCard: View {
    let regimen: DosingRegimen
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("\(String(format: "%.0f", regimen.dose)) mg")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Text("every \(String(format: "%.0f", regimen.interval)) hours")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                
                Spacer()
            }
            
            HStack {
                Text("Infusion time: \(String(format: "%.0f", regimen.infusionTime)) min")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                Text("Started: \(regimen.startDate, formatter: DateFormatter.dateFormatter)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(8)
    }
}

// MARK: - Bayesian Analysis Section

struct BayesianAnalysisSection: View {
    let analysis: BayesianAnalysis?
    let isCalculating: Bool
    let onCalculate: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Bayesian Analysis", icon: "brain.head.profile")
            
            if let analysis = analysis {
                BayesianAnalysisResults(analysis: analysis)
            } else {
                VStack(spacing: 12) {
                    Text("Ready to perform Bayesian analysis")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    Button(action: onCalculate) {
                        HStack {
                            if isCalculating {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .scaleEffect(0.8)
                            }
                            
                            Text(isCalculating ? "Analyzing..." : "Perform Analysis")
                                .fontWeight(.semibold)
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.vancoBlue)
                        .cornerRadius(8)
                    }
                    .disabled(isCalculating)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct BayesianAnalysisResults: View {
    let analysis: BayesianAnalysis
    
    var body: some View {
        VStack(spacing: 12) {
            // Parameter estimates
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                ParameterCard(
                    title: "Clearance",
                    value: analysis.clearance.estimate,
                    unit: "L/h",
                    confidence: analysis.clearance.confidenceInterval
                )
                
                ParameterCard(
                    title: "Volume",
                    value: analysis.volumeOfDistribution.estimate,
                    unit: "L",
                    confidence: analysis.volumeOfDistribution.confidenceInterval
                )
                
                ParameterCard(
                    title: "Half-life",
                    value: analysis.halfLife.estimate,
                    unit: "h",
                    confidence: analysis.halfLife.confidenceInterval
                )
                
                ParameterCard(
                    title: "AUC₀₋₂₄",
                    value: analysis.predictedAUC.estimate,
                    unit: "mg·h/L",
                    confidence: analysis.predictedAUC.confidenceInterval
                )
            }
            
            // Model fit information
            VStack(alignment: .leading, spacing: 4) {
                Text("Model Fit")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                HStack {
                    Text("R²:")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Text(String(format: "%.3f", analysis.modelFit.rSquared))
                        .font(.caption)
                        .fontWeight(.medium)
                    
                    Spacer()
                    
                    Text("RMSE:")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Text(String(format: "%.2f mg/L", analysis.modelFit.rmse))
                        .font(.caption)
                        .fontWeight(.medium)
                }
            }
            .padding(.top, 8)
        }
    }
}

struct ParameterCard: View {
    let title: String
    let value: Double
    let unit: String
    let confidence: ConfidenceInterval
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            
            Text("\(String(format: "%.2f", value)) \(unit)")
                .font(.subheadline)
                .fontWeight(.semibold)
            
            Text("95% CI: \(String(format: "%.2f", confidence.lower))-\(String(format: "%.2f", confidence.upper))")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(8)
        .background(Color.white)
        .cornerRadius(6)
    }
}

// MARK: - Optimization Results Section

struct OptimizationResultsSection: View {
    let optimization: BayesianOptimization
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Optimized Dosing", icon: "target")
            
            VStack(spacing: 12) {
                // Recommended dosing
                DosingRecommendationCard(
                    dose: optimization.recommendedDose,
                    interval: optimization.recommendedInterval,
                    predictedAUC: optimization.predictedAUC,
                    targetAUC: optimization.targetAUC
                )
                
                // Alternative regimens
                if !optimization.alternativeRegimens.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Alternative Regimens")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        ForEach(optimization.alternativeRegimens.indices, id: \.self) { index in
                            let regimen = optimization.alternativeRegimens[index]
                            AlternativeRegimenRow(regimen: regimen)
                        }
                    }
                }
                
                // Clinical recommendations
                if !optimization.clinicalRecommendations.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Clinical Recommendations")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        ForEach(optimization.clinicalRecommendations, id: \.self) { recommendation in
                            HStack(alignment: .top, spacing: 8) {
                                Text("•")
                                    .foregroundColor(.vancoBlue)
                                Text(recommendation)
                                    .font(.caption)
                                Spacer()
                            }
                        }
                    }
                    .padding()
                    .background(Color.vancoBlue.opacity(0.1))
                    .cornerRadius(8)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct DosingRecommendationCard: View {
    let dose: Double
    let interval: Double
    let predictedAUC: ConfidenceInterval
    let targetAUC: Double
    
    var body: some View {
        VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Recommended Dosing")
                        .font(.headline)
                        .fontWeight(.semibold)
                    
                    Text("\(String(format: "%.0f", dose)) mg every \(String(format: "%.0f", interval)) hours")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.vancoBlue)
                }
                
                Spacer()
            }
            
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Predicted AUC₀₋₂₄")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Text("\(String(format: "%.0f", predictedAUC.estimate)) mg·h/L")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    
                    Text("95% CI: \(String(format: "%.0f", predictedAUC.lower))-\(String(format: "%.0f", predictedAUC.upper))")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Target AUC₀₋₂₄")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Text("\(String(format: "%.0f", targetAUC)) mg·h/L")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    
                    let probability = calculateTargetProbability(predicted: predictedAUC, target: targetAUC)
                    Text("\(String(format: "%.0f", probability))% probability")
                        .font(.caption2)
                        .foregroundColor(probability >= 80 ? .green : probability >= 60 ? .orange : .red)
                }
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(8)
        .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
    }
    
    private func calculateTargetProbability(predicted: ConfidenceInterval, target: Double) -> Double {
        // Simplified probability calculation
        let range = predicted.upper - predicted.lower
        let distance = abs(predicted.estimate - target)
        return max(0, min(100, 100 * (1 - distance / range)))
    }
}

struct AlternativeRegimenRow: View {
    let regimen: AlternativeRegimen
    
    var body: some View {
        HStack {
            Text("\(String(format: "%.0f", regimen.dose)) mg q\(String(format: "%.0f", regimen.interval))h")
                .font(.subheadline)
                .fontWeight(.medium)
            
            Spacer()
            
            Text("AUC: \(String(format: "%.0f", regimen.predictedAUC))")
                .font(.caption)
                .foregroundColor(.secondary)
            
            Circle()
                .fill(regimen.suitabilityColor)
                .frame(width: 8, height: 8)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Supporting Views and Extensions

struct InfoCard: View {
    let title: String
    let value: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            
            Text(value)
                .font(.subheadline)
                .fontWeight(.medium)
        }
        .padding(8)
        .background(Color.white)
        .cornerRadius(6)
    }
}

extension DateFormatter {
    static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter
    }()
    
    static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        return formatter
    }()
}

extension VancomycinLevelType {
    var color: Color {
        switch self {
        case .trough: return .blue
        case .peak: return .red
        case .random: return .orange
        }
    }
}

extension AlternativeRegimen {
    var suitabilityColor: Color {
        let targetRange = 400...600
        if targetRange.contains(Int(predictedAUC)) {
            return .green
        } else if (350...650).contains(Int(predictedAUC)) {
            return .orange
        } else {
            return .red
        }
    }
}

#Preview {
    NavigationView {
        BayesianDosingView()
    }
}

