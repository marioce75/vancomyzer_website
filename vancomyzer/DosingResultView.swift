import SwiftUI

struct DosingResultView: View {
    let result: DosingResult
    let patient: PatientInput
    @Environment(\.presentationMode) var presentationMode
    @State private var showingExportOptions = false
    @State private var showingDetailedView = false
    
    var body: some View {
        NavigationView {
            ScrollView {
                LazyVStack(spacing: 20) {
                    // Main Recommendation Card
                    MainRecommendationCard(result: result)
                    
                    // Pharmacokinetic Parameters
                    PharmacokineticParametersSection(result: result)
                    
                    // Clinical Guidance
                    ClinicalGuidanceSection(result: result, patient: patient)
                    
                    // Monitoring Recommendations
                    MonitoringRecommendationsSection(result: result, patient: patient)
                    
                    // Alternative Regimens
                    if !result.alternativeRegimens.isEmpty {
                        AlternativeRegimensSection(regimens: result.alternativeRegimens)
                    }
                    
                    // Warnings and Precautions
                    if !result.warnings.isEmpty {
                        WarningsSection(warnings: result.warnings)
                    }
                }
                .padding()
            }
            .navigationTitle("Dosing Recommendation")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                leading: Button("Done") {
                    presentationMode.wrappedValue.dismiss()
                },
                trailing: HStack {
                    Button(action: { showingDetailedView = true }) {
                        Image(systemName: "doc.text.magnifyingglass")
                    }
                    .accessibilityLabel("Detailed View")
                    
                    Button(action: { showingExportOptions = true }) {
                        Image(systemName: "square.and.arrow.up")
                    }
                    .accessibilityLabel("Export")
                }
            )
        }
        .sheet(isPresented: $showingExportOptions) {
            ExportOptionsView(result: result, patient: patient)
        }
        .sheet(isPresented: $showingDetailedView) {
            DetailedResultsView(result: result, patient: patient)
        }
        .onAppear {
            // Save to calculation history
            CalculationHistoryManager.shared.saveCalculation(result, for: patient)
            
            // Track analytics
            AnalyticsManager.shared.track(.resultViewed, parameters: [
                "population": patient.populationType.rawValue,
                "calculation_method": result.calculationMethod
            ])
        }
    }
}

// MARK: - Main Recommendation Card

struct MainRecommendationCard: View {
    let result: DosingResult
    
    var body: some View {
        VStack(spacing: 16) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Recommended Dosing")
                        .font(.headline)
                        .fontWeight(.semibold)
                    
                    Text(result.calculationMethod)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Image(systemName: "checkmark.seal.fill")
                    .font(.title2)
                    .foregroundColor(.green)
            }
            
            // Main dosing recommendation
            VStack(spacing: 8) {
                Text(result.dosingSummary)
                    .font(.title)
                    .fontWeight(.bold)
                    .foregroundColor(.vancoBlue)
                    .multilineTextAlignment(.center)
                
                if let loadingDose = result.loadingDose {
                    Text("Loading dose: \(String(format: "%.0f", loadingDose)) mg")
                        .font(.headline)
                        .foregroundColor(.vancoOrange)
                }
            }
            
            // Key metrics
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 12) {
                MetricCard(
                    title: "Predicted AUC₀₋₂₄",
                    value: String(format: "%.0f", result.predictedAUC),
                    unit: "mg·h/L",
                    color: getAUCColor(result.predictedAUC)
                )
                
                MetricCard(
                    title: "Predicted Trough",
                    value: String(format: "%.1f", result.predictedTrough),
                    unit: "mg/L",
                    color: getTroughColor(result.predictedTrough)
                )
                
                MetricCard(
                    title: "Predicted Peak",
                    value: String(format: "%.1f", result.predictedPeak),
                    unit: "mg/L",
                    color: .vancoBlue
                )
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }
    
    private func getAUCColor(_ auc: Double) -> Color {
        switch auc {
        case 400...600: return .green
        case 350...650: return .orange
        default: return .red
        }
    }
    
    private func getTroughColor(_ trough: Double) -> Color {
        switch trough {
        case 10...20: return .green
        case 5...25: return .orange
        default: return .red
        }
    }
}

struct MetricCard: View {
    let title: String
    let value: String
    let unit: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            
            Text(value)
                .font(.headline)
                .fontWeight(.bold)
                .foregroundColor(color)
            
            Text(unit)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity)
        .background(Color.white)
        .cornerRadius(8)
    }
}

// MARK: - Pharmacokinetic Parameters Section

struct PharmacokineticParametersSection: View {
    let result: DosingResult
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Pharmacokinetic Parameters", icon: "function")
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                ParameterRow(title: "Clearance", value: result.clearance, unit: "L/h")
                ParameterRow(title: "Volume of Distribution", value: result.volumeOfDistribution, unit: "L")
                ParameterRow(title: "Half-life", value: result.halfLife, unit: "hours")
                ParameterRow(title: "Elimination Rate", value: result.eliminationRate, unit: "h⁻¹")
            }
            
            if let confidence = result.confidenceIntervals {
                VStack(alignment: .leading, spacing: 8) {
                    Text("95% Confidence Intervals")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .padding(.top, 8)
                    
                    VStack(spacing: 4) {
                        ConfidenceIntervalRow(
                            parameter: "Clearance",
                            interval: confidence.clearance,
                            unit: "L/h"
                        )
                        
                        ConfidenceIntervalRow(
                            parameter: "Volume",
                            interval: confidence.volumeOfDistribution,
                            unit: "L"
                        )
                        
                        ConfidenceIntervalRow(
                            parameter: "AUC₀₋₂₄",
                            interval: confidence.predictedAUC,
                            unit: "mg·h/L"
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

struct ParameterRow: View {
    let title: String
    let value: Double
    let unit: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            
            HStack(alignment: .bottom, spacing: 4) {
                Text(String(format: "%.2f", value))
                    .font(.subheadline)
                    .fontWeight(.semibold)
                
                Text(unit)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(8)
        .background(Color.white)
        .cornerRadius(6)
    }
}

struct ConfidenceIntervalRow: View {
    let parameter: String
    let interval: ConfidenceInterval
    let unit: String
    
    var body: some View {
        HStack {
            Text(parameter)
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 80, alignment: .leading)
            
            Text("\(String(format: "%.2f", interval.lower)) - \(String(format: "%.2f", interval.upper)) \(unit)")
                .font(.caption)
                .fontWeight(.medium)
            
            Spacer()
        }
    }
}

// MARK: - Clinical Guidance Section

struct ClinicalGuidanceSection: View {
    let result: DosingResult
    let patient: PatientInput
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Clinical Guidance", icon: "stethoscope")
            
            VStack(alignment: .leading, spacing: 8) {
                // Target achievement
                TargetAchievementCard(result: result, patient: patient)
                
                // Dosing rationale
                DosingRationaleCard(result: result, patient: patient)
                
                // Special considerations
                if !result.specialConsiderations.isEmpty {
                    SpecialConsiderationsCard(considerations: result.specialConsiderations)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct TargetAchievementCard: View {
    let result: DosingResult
    let patient: PatientInput
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Target Achievement")
                .font(.subheadline)
                .fontWeight(.medium)
            
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Target AUC₀₋₂₄")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Text("\(String(format: "%.0f", patient.indication.targetAUC)) mg·h/L")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Achievement")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    let achievement = (result.predictedAUC / patient.indication.targetAUC) * 100
                    Text("\(String(format: "%.0f", achievement))%")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(achievement >= 90 && achievement <= 110 ? .green : .orange)
                }
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(8)
    }
}

struct DosingRationaleCard: View {
    let result: DosingResult
    let patient: PatientInput
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Dosing Rationale")
                .font(.subheadline)
                .fontWeight(.medium)
            
            VStack(alignment: .leading, spacing: 4) {
                Text("• Population: \(patient.populationType.localizedName)")
                    .font(.caption)
                
                Text("• Indication: \(patient.indication.localizedName)")
                    .font(.caption)
                
                Text("• Severity: \(patient.severity.localizedName)")
                    .font(.caption)
                
                if patient.populationType == .adult {
                    Text("• CrCl method: \(patient.crClMethod.localizedName)")
                        .font(.caption)
                }
                
                Text("• Calculation: \(result.calculationMethod)")
                    .font(.caption)
            }
            .foregroundColor(.secondary)
        }
        .padding()
        .background(Color.white)
        .cornerRadius(8)
    }
}

struct SpecialConsiderationsCard: View {
    let considerations: [String]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Special Considerations")
                .font(.subheadline)
                .fontWeight(.medium)
            
            VStack(alignment: .leading, spacing: 4) {
                ForEach(considerations, id: \.self) { consideration in
                    HStack(alignment: .top, spacing: 8) {
                        Text("•")
                            .foregroundColor(.vancoOrange)
                        Text(consideration)
                            .font(.caption)
                        Spacer()
                    }
                }
            }
        }
        .padding()
        .background(Color.vancoOrange.opacity(0.1))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.vancoOrange, lineWidth: 1)
        )
        .cornerRadius(8)
    }
}

// MARK: - Monitoring Recommendations Section

struct MonitoringRecommendationsSection: View {
    let result: DosingResult
    let patient: PatientInput
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Monitoring Recommendations", icon: "chart.line.uptrend.xyaxis")
            
            VStack(spacing: 12) {
                // Level monitoring
                LevelMonitoringCard(result: result, patient: patient)
                
                // Safety monitoring
                SafetyMonitoringCard(patient: patient)
                
                // Follow-up recommendations
                FollowUpCard(result: result, patient: patient)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct LevelMonitoringCard: View {
    let result: DosingResult
    let patient: PatientInput
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Vancomycin Level Monitoring")
                .font(.subheadline)
                .fontWeight(.medium)
            
            VStack(alignment: .leading, spacing: 4) {
                Text("• Obtain levels before 4th dose (steady state)")
                    .font(.caption)
                
                Text("• Trough: draw within 30 minutes before next dose")
                    .font(.caption)
                
                Text("• Peak: 1-2 hours after end of infusion")
                    .font(.caption)
                
                Text("• Target trough: 10-20 mg/L")
                    .font(.caption)
                
                if patient.severity == .severe {
                    Text("• Consider more frequent monitoring for severe infections")
                        .font(.caption)
                        .foregroundColor(.vancoOrange)
                }
            }
            .foregroundColor(.secondary)
        }
        .padding()
        .background(Color.white)
        .cornerRadius(8)
    }
}

struct SafetyMonitoringCard: View {
    let patient: PatientInput
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Safety Monitoring")
                .font(.subheadline)
                .fontWeight(.medium)
            
            VStack(alignment: .leading, spacing: 4) {
                Text("• Monitor SCr and BUN every 2-3 days")
                    .font(.caption)
                
                Text("• Assess hearing if therapy >7 days")
                    .font(.caption)
                
                Text("• Watch for red man syndrome during infusion")
                    .font(.caption)
                
                if patient.populationType == .neonate {
                    Text("• Monitor growth and development")
                        .font(.caption)
                        .foregroundColor(.vancoOrange)
                }
            }
            .foregroundColor(.secondary)
        }
        .padding()
        .background(Color.white)
        .cornerRadius(8)
    }
}

struct FollowUpCard: View {
    let result: DosingResult
    let patient: PatientInput
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Follow-up Recommendations")
                .font(.subheadline)
                .fontWeight(.medium)
            
            VStack(alignment: .leading, spacing: 4) {
                Text("• Reassess dosing if renal function changes")
                    .font(.caption)
                
                Text("• Consider Bayesian optimization with levels")
                    .font(.caption)
                
                Text("• Evaluate clinical response daily")
                    .font(.caption)
                
                if result.predictedAUC < 400 || result.predictedAUC > 600 {
                    Text("• AUC outside target range - consider dose adjustment")
                        .font(.caption)
                        .foregroundColor(.red)
                }
            }
            .foregroundColor(.secondary)
        }
        .padding()
        .background(Color.white)
        .cornerRadius(8)
    }
}

// MARK: - Alternative Regimens Section

struct AlternativeRegimensSection: View {
    let regimens: [AlternativeRegimen]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Alternative Regimens", icon: "list.bullet")
            
            VStack(spacing: 8) {
                ForEach(regimens.indices, id: \.self) { index in
                    AlternativeRegimenCard(regimen: regimens[index], rank: index + 1)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct AlternativeRegimenCard: View {
    let regimen: AlternativeRegimen
    let rank: Int
    
    var body: some View {
        HStack(spacing: 12) {
            // Rank indicator
            Text("\(rank)")
                .font(.caption)
                .fontWeight(.bold)
                .foregroundColor(.white)
                .frame(width: 20, height: 20)
                .background(Color.vancoBlue)
                .clipShape(Circle())
            
            // Regimen details
            VStack(alignment: .leading, spacing: 4) {
                Text("\(String(format: "%.0f", regimen.dose)) mg every \(String(format: "%.0f", regimen.interval)) hours")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                
                HStack {
                    Text("AUC: \(String(format: "%.0f", regimen.predictedAUC)) mg·h/L")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Spacer()
                    
                    Text(regimen.suitabilityDescription)
                        .font(.caption)
                        .foregroundColor(regimen.suitabilityColor)
                }
            }
            
            Spacer()
        }
        .padding()
        .background(Color.white)
        .cornerRadius(8)
    }
}

// MARK: - Warnings Section

struct WarningsSection: View {
    let warnings: [String]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(.red)
                
                Text("Warnings and Precautions")
                    .font(.headline)
                    .fontWeight(.semibold)
            }
            
            VStack(alignment: .leading, spacing: 8) {
                ForEach(warnings, id: \.self) { warning in
                    HStack(alignment: .top, spacing: 8) {
                        Text("⚠️")
                        Text(warning)
                            .font(.subheadline)
                        Spacer()
                    }
                }
            }
        }
        .padding()
        .background(Color.red.opacity(0.1))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.red, lineWidth: 2)
        )
        .cornerRadius(12)
    }
}

// MARK: - Export Options View

struct ExportOptionsView: View {
    let result: DosingResult
    let patient: PatientInput
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Text("Export calculation results for documentation or sharing")
                    .multilineTextAlignment(.center)
                    .padding()
                
                VStack(spacing: 12) {
                    Button("Export as PDF") {
                        exportAsPDF()
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    
                    Button("Share Summary") {
                        shareSummary()
                    }
                    .buttonStyle(SecondaryButtonStyle())
                    
                    Button("Copy to Clipboard") {
                        copyToClipboard()
                    }
                    .buttonStyle(SecondaryButtonStyle())
                }
                .padding()
                
                Spacer()
            }
            .navigationTitle("Export Results")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                leading: Button("Cancel") {
                    presentationMode.wrappedValue.dismiss()
                }
            )
        }
    }
    
    private func exportAsPDF() {
        // Implementation for PDF export
        presentationMode.wrappedValue.dismiss()
    }
    
    private func shareSummary() {
        // Implementation for sharing
        presentationMode.wrappedValue.dismiss()
    }
    
    private func copyToClipboard() {
        let summary = generateTextSummary()
        UIPasteboard.general.string = summary
        presentationMode.wrappedValue.dismiss()
    }
    
    private func generateTextSummary() -> String {
        return """
        Vancomyzer Dosing Recommendation
        
        Patient: \(patient.populationType.localizedName), \(patient.ageDisplay)
        Weight: \(String(format: "%.1f", patient.weightInKg)) kg
        Indication: \(patient.indication.localizedName)
        
        Recommended Dosing: \(result.dosingSummary)
        Predicted AUC₀₋₂₄: \(String(format: "%.0f", result.predictedAUC)) mg·h/L
        Predicted Trough: \(String(format: "%.1f", result.predictedTrough)) mg/L
        
        Method: \(result.calculationMethod)
        Generated: \(Date())
        """
    }
}

// MARK: - Detailed Results View

struct DetailedResultsView: View {
    let result: DosingResult
    let patient: PatientInput
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        NavigationView {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 16) {
                    // Calculation details
                    CalculationDetailsSection(result: result, patient: patient)
                    
                    // Pharmacokinetic model
                    PharmacokineticModelSection(result: result)
                    
                    // References
                    ReferencesSection()
                }
                .padding()
            }
            .navigationTitle("Detailed Results")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                leading: Button("Done") {
                    presentationMode.wrappedValue.dismiss()
                }
            )
        }
    }
}

struct CalculationDetailsSection: View {
    let result: DosingResult
    let patient: PatientInput
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Calculation Details")
                .font(.headline)
                .fontWeight(.semibold)
            
            VStack(alignment: .leading, spacing: 8) {
                DetailRow(label: "Population", value: patient.populationType.localizedName)
                DetailRow(label: "Method", value: result.calculationMethod)
                DetailRow(label: "Timestamp", value: DateFormatter.detailedFormatter.string(from: result.timestamp))
                
                if patient.populationType == .adult {
                    DetailRow(label: "CrCl Method", value: patient.crClMethod.localizedName)
                    DetailRow(label: "Calculated CrCl", value: "\(String(format: "%.1f", result.creatinineClearance ?? 0)) mL/min")
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct PharmacokineticModelSection: View {
    let result: DosingResult
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Pharmacokinetic Model")
                .font(.headline)
                .fontWeight(.semibold)
            
            VStack(alignment: .leading, spacing: 8) {
                Text("One-compartment model with first-order elimination")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                
                DetailRow(label: "Clearance", value: "\(String(format: "%.3f", result.clearance)) L/h")
                DetailRow(label: "Volume", value: "\(String(format: "%.2f", result.volumeOfDistribution)) L")
                DetailRow(label: "Half-life", value: "\(String(format: "%.2f", result.halfLife)) hours")
                DetailRow(label: "Ke", value: "\(String(format: "%.4f", result.eliminationRate)) h⁻¹")
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct ReferencesSection: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("References")
                .font(.headline)
                .fontWeight(.semibold)
            
            VStack(alignment: .leading, spacing: 8) {
                Text("1. Rybak MJ, et al. Therapeutic monitoring of vancomycin for serious methicillin-resistant Staphylococcus aureus infections: A revised consensus guideline and review by the American Society of Health-System Pharmacists, the Infectious Diseases Society of America, the Pediatric Infectious Diseases Society, and the Society of Infectious Diseases Pharmacists. Am J Health Syst Pharm. 2020;77(11):835-864.")
                    .font(.caption)
                
                Text("2. Le J, et al. Consensus Guidelines for Dosing of Vancomycin in Children. Pediatr Infect Dis J. 2013;32(12):e479-e483.")
                    .font(.caption)
                
                Text("3. Frymoyer A, et al. Association between vancomycin trough concentration and area under the concentration-time curve in neonates. Antimicrob Agents Chemother. 2013;57(9):4304-4309.")
                    .font(.caption)
            }
            .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct DetailRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .frame(width: 120, alignment: .leading)
            
            Text(value)
                .font(.subheadline)
                .fontWeight(.medium)
            
            Spacer()
        }
    }
}

extension DateFormatter {
    static let detailedFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .medium
        return formatter
    }()
}

extension AlternativeRegimen {
    var suitabilityDescription: String {
        let targetRange = 400...600
        if targetRange.contains(Int(predictedAUC)) {
            return "Optimal"
        } else if (350...650).contains(Int(predictedAUC)) {
            return "Acceptable"
        } else {
            return "Suboptimal"
        }
    }
}

#Preview {
    DosingResultView(
        result: DosingResult.sampleResult,
        patient: PatientInput.samplePatient
    )
}

