import SwiftUI
import UniformTypeIdentifiers

// MARK: - Bayesian Export View

struct BayesianExportView: View {
    let optimization: BayesianOptimizationResult
    let patient: PatientInput
    
    @Environment(\.dismiss) private var dismiss
    @StateObject private var exportManager = ExportManager()
    @State private var selectedFormat: ExportFormat = .pdf
    @State private var includeConfidenceIntervals = true
    @State private var includeDetailedAnalysis = false
    @State private var showingShareSheet = false
    @State private var exportedData: Data?
    
    enum ExportFormat: String, CaseIterable, Identifiable {
        case pdf = "pdf"
        case csv = "csv"
        case json = "json"
        case text = "text"
        
        var id: String { rawValue }
        
        var displayName: String {
            switch self {
            case .pdf: return "PDF Report"
            case .csv: return "CSV Data"
            case .json: return "JSON Data"
            case .text: return "Text Summary"
            }
        }
        
        var icon: String {
            switch self {
            case .pdf: return "doc.fill"
            case .csv: return "tablecells.fill"
            case .json: return "curlybraces"
            case .text: return "text.alignleft"
            }
        }
        
        var contentType: UTType {
            switch self {
            case .pdf: return .pdf
            case .csv: return .commaSeparatedText
            case .json: return .json
            case .text: return .plainText
            }
        }
    }
    
    var body: some View {
        NavigationView {
            ScrollView {
                LazyVStack(spacing: 20) {
                    // Format Selection
                    FormatSelectionSection(selectedFormat: $selectedFormat)
                    
                    // Export Options
                    ExportOptionsSection(
                        includeCI: $includeConfidenceIntervals,
                        includeAnalysis: $includeDetailedAnalysis
                    )
                    
                    // Preview Section
                    ExportPreviewSection(
                        format: selectedFormat,
                        optimization: optimization,
                        patient: patient
                    )
                    
                    // Export Button
                    Button(action: exportData) {
                        HStack {
                            Image(systemName: "square.and.arrow.up")
                            Text("Export \(selectedFormat.displayName)")
                        }
                    }
                    .buttonStyle(VancoPrimaryButtonStyle())
                    .disabled(exportManager.isExporting)
                }
                .padding()
            }
            .navigationTitle("Export Results")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    if exportManager.isExporting {
                        ProgressView()
                            .scaleEffect(0.8)
                    }
                }
            }
            .sheet(isPresented: $showingShareSheet) {
                if let data = exportedData {
                    ShareSheet(
                        items: [data],
                        contentType: selectedFormat.contentType,
                        filename: generateFilename()
                    )
                }
            }
            .alert("Export Error", isPresented: .constant(exportManager.exportError != nil)) {
                Button("OK") {
                    exportManager.exportError = nil
                }
            } message: {
                if let error = exportManager.exportError {
                    Text(error.localizedDescription)
                }
            }
        }
    }
    
    private func exportData() {
        Task {
            do {
                let data = try await exportManager.exportBayesianResults(
                    optimization: optimization,
                    patient: patient,
                    format: selectedFormat,
                    includeCI: includeConfidenceIntervals,
                    includeAnalysis: includeDetailedAnalysis
                )
                
                await MainActor.run {
                    exportedData = data
                    showingShareSheet = true
                    
                    AnalyticsManager.shared.trackFeatureUsage("bayesian_export", parameters: [
                        "format": selectedFormat.rawValue,
                        "include_ci": includeConfidenceIntervals,
                        "include_analysis": includeDetailedAnalysis
                    ])
                }
                
            } catch {
                await MainActor.run {
                    exportManager.exportError = error
                }
            }
        }
    }
    
    private func generateFilename() -> String {
        let timestamp = DateFormatter.exportTimestamp.string(from: Date())
        let population = patient.populationType.rawValue
        return "vancomyzer_bayesian_\(population)_\(timestamp).\(selectedFormat.rawValue)"
    }
}

// MARK: - Format Selection Section

struct FormatSelectionSection: View {
    @Binding var selectedFormat: BayesianExportView.ExportFormat
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Export Format")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                    ForEach(BayesianExportView.ExportFormat.allCases) { format in
                        FormatOptionCard(
                            format: format,
                            isSelected: selectedFormat == format,
                            action: { selectedFormat = format }
                        )
                    }
                }
            }
        }
    }
}

struct FormatOptionCard: View {
    let format: BayesianExportView.ExportFormat
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: format.icon)
                    .font(.title2)
                    .foregroundColor(isSelected ? .white : .vancoBlue)
                
                Text(format.displayName)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(isSelected ? .white : .primary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 80)
            .background(isSelected ? Color.vancoBlue : Color(.systemGray6))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color.clear : Color.vancoBlue, lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Export Options Section

struct ExportOptionsSection: View {
    @Binding var includeCI: Bool
    @Binding var includeAnalysis: Bool
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Export Options")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                VStack(spacing: 12) {
                    Toggle("Include Confidence Intervals", isOn: $includeCI)
                        .font(.subheadline)
                    
                    Toggle("Include Detailed Analysis", isOn: $includeAnalysis)
                        .font(.subheadline)
                }
                
                Text("Detailed analysis includes model performance metrics, level predictions, and parameter evolution data.")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}

// MARK: - Export Preview Section

struct ExportPreviewSection: View {
    let format: BayesianExportView.ExportFormat
    let optimization: BayesianOptimizationResult
    let patient: PatientInput
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Preview")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                ScrollView {
                    Text(previewContent)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(height: 150)
                .padding(8)
                .background(Color(.systemBackground))
                .cornerRadius(8)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color(.systemGray4), lineWidth: 1)
                )
            }
        }
    }
    
    private var previewContent: String {
        switch format {
        case .pdf:
            return """
            VANCOMYZER BAYESIAN ANALYSIS REPORT
            
            Patient Information:
            Population: \(patient.populationType.localizedName)
            Age: \(patient.ageDisplay)
            Weight: \(patient.weightDisplay)
            
            Recommended Dosing:
            \(optimization.recommendedRegimen.dosingSummary)
            
            Predicted AUC₀₋₂₄: \(String(format: "%.0f", optimization.predictedAUC.estimate)) mg·h/L
            [Additional sections follow...]
            """
            
        case .csv:
            return """
            Parameter,Value,Lower CI,Upper CI,Unit
            AUC,\(String(format: "%.1f", optimization.predictedAUC.estimate)),\(String(format: "%.1f", optimization.predictedAUC.lower)),\(String(format: "%.1f", optimization.predictedAUC.upper)),mg·h/L
            Trough,\(String(format: "%.1f", optimization.predictedTrough.estimate)),\(String(format: "%.1f", optimization.predictedTrough.lower)),\(String(format: "%.1f", optimization.predictedTrough.upper)),mg/L
            [Additional rows...]
            """
            
        case .json:
            return """
            {
              "patient": {
                "population": "\(patient.populationType.rawValue)",
                "age": "\(patient.ageDisplay)",
                "weight": \(patient.weightInKg)
              },
              "optimization": {
                "method": "\(optimization.method)",
                "converged": \(optimization.converged),
                "recommended_dose": \(optimization.recommendedRegimen.dose)
              }
            }
            """
            
        case .text:
            return """
            Vancomyzer Bayesian Analysis
            Date: \(Date().formatted())
            
            Patient: \(patient.clinicalSummary)
            Method: \(optimization.method)
            
            RECOMMENDED DOSING:
            \(optimization.recommendedRegimen.dosingSummary)
            
            PREDICTIONS:
            • AUC₀₋₂₄: \(String(format: "%.0f", optimization.predictedAUC.estimate)) mg·h/L
            • Trough: \(String(format: "%.1f", optimization.predictedTrough.estimate)) mg/L
            """
        }
    }
}

// MARK: - Export Manager

@MainActor
class ExportManager: ObservableObject {
    @Published var isExporting = false
    @Published var exportError: Error?
    
    func exportBayesianResults(
        optimization: BayesianOptimizationResult,
        patient: PatientInput,
        format: BayesianExportView.ExportFormat,
        includeCI: Bool,
        includeAnalysis: Bool
    ) async throws -> Data {
        
        isExporting = true
        defer { isExporting = false }
        
        // Simulate processing time for complex exports
        try await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
        
        switch format {
        case .pdf:
            return try generatePDFReport(optimization: optimization, patient: patient, includeCI: includeCI, includeAnalysis: includeAnalysis)
        case .csv:
            return generateCSVData(optimization: optimization, patient: patient, includeCI: includeCI)
        case .json:
            return try generateJSONData(optimization: optimization, patient: patient, includeCI: includeCI, includeAnalysis: includeAnalysis)
        case .text:
            return generateTextReport(optimization: optimization, patient: patient, includeCI: includeCI, includeAnalysis: includeAnalysis)
        }
    }
    
    private func generatePDFReport(optimization: BayesianOptimizationResult, patient: PatientInput, includeCI: Bool, includeAnalysis: Bool) throws -> Data {
        // In a real implementation, this would use PDFKit or similar
        let content = generateDetailedReport(optimization: optimization, patient: patient, includeCI: includeCI, includeAnalysis: includeAnalysis)
        
        // For now, return as plain text (in real app, convert to PDF)
        guard let data = content.data(using: .utf8) else {
            throw ExportError.dataConversionFailed
        }
        
        return data
    }
    
    private func generateCSVData(optimization: BayesianOptimizationResult, patient: PatientInput, includeCI: Bool) -> Data {
        var csv = "Parameter,Value"
        
        if includeCI {
            csv += ",Lower CI,Upper CI"
        }
        csv += ",Unit\n"
        
        // Patient data
        csv += "Population,\(patient.populationType.rawValue),,,\n"
        csv += "Age,\(patient.ageDisplay),,,\n"
        csv += "Weight,\(patient.weightInKg),,,kg\n"
        
        // Results data
        csv += "Dose,\(optimization.recommendedRegimen.dose),,,mg\n"
        csv += "Interval,\(optimization.recommendedRegimen.interval),,,hours\n"
        
        if includeCI {
            csv += "AUC,\(optimization.predictedAUC.estimate),\(optimization.predictedAUC.lower),\(optimization.predictedAUC.upper),mg·h/L\n"
            csv += "Trough,\(optimization.predictedTrough.estimate),\(optimization.predictedTrough.lower),\(optimization.predictedTrough.upper),mg/L\n"
            csv += "Peak,\(optimization.predictedPeak.estimate),\(optimization.predictedPeak.lower),\(optimization.predictedPeak.upper),mg/L\n"
        } else {
            csv += "AUC,\(optimization.predictedAUC.estimate),,,mg·h/L\n"
            csv += "Trough,\(optimization.predictedTrough.estimate),,,mg/L\n"
            csv += "Peak,\(optimization.predictedPeak.estimate),,,mg/L\n"
        }
        
        return csv.data(using: .utf8) ?? Data()
    }
    
    private func generateJSONData(optimization: BayesianOptimizationResult, patient: PatientInput, includeCI: Bool, includeAnalysis: Bool) throws -> Data {
        var json: [String: Any] = [
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "patient": [
                "population": patient.populationType.rawValue,
                "age_display": patient.ageDisplay,
                "weight_kg": patient.weightInKg,
                "indication": patient.indication.rawValue,
                "severity": patient.severity.rawValue
            ],
            "optimization": [
                "method": optimization.method,
                "converged": optimization.converged,
                "iterations": optimization.iterations,
                "recommended_regimen": [
                    "dose_mg": optimization.recommendedRegimen.dose,
                    "interval_hours": optimization.recommendedRegimen.interval,
                    "summary": optimization.recommendedRegimen.dosingSummary
                ],
                "predictions": [
                    "auc_estimate": optimization.predictedAUC.estimate,
                    "trough_estimate": optimization.predictedTrough.estimate,
                    "peak_estimate": optimization.predictedPeak.estimate
                ]
            ]
        ]
        
        if includeCI {
            if var predictions = json["optimization"] as? [String: Any] {
                predictions["confidence_intervals"] = [
                    "auc": [
                        "lower": optimization.predictedAUC.lower,
                        "upper": optimization.predictedAUC.upper,
                        "confidence": optimization.predictedAUC.confidence
                    ],
                    "trough": [
                        "lower": optimization.predictedTrough.lower,
                        "upper": optimization.predictedTrough.upper,
                        "confidence": optimization.predictedTrough.confidence
                    ],
                    "peak": [
                        "lower": optimization.predictedPeak.lower,
                        "upper": optimization.predictedPeak.upper,
                        "confidence": optimization.predictedPeak.confidence
                    ]
                ]
                json["optimization"] = predictions
            }
        }
        
        if includeAnalysis {
            if var optimization_data = json["optimization"] as? [String: Any] {
                optimization_data["analysis"] = [
                    "goodness_of_fit": optimization.goodnessOfFit ?? NSNull(),
                    "bias": optimization.bias ?? NSNull(),
                    "precision": optimization.precision ?? NSNull(),
                    "level_count": optimization.levelsUsed.count
                ]
                json["optimization"] = optimization_data
            }
        }
        
        return try JSONSerialization.data(withJSONObject: json, options: .prettyPrinted)
    }
    
    private func generateTextReport(optimization: BayesianOptimizationResult, patient: PatientInput, includeCI: Bool, includeAnalysis: Bool) -> Data {
        let content = generateDetailedReport(optimization: optimization, patient: patient, includeCI: includeCI, includeAnalysis: includeAnalysis)
        return content.data(using: .utf8) ?? Data()
    }
    
    private func generateDetailedReport(optimization: BayesianOptimizationResult, patient: PatientInput, includeCI: Bool, includeAnalysis: Bool) -> String {
        var report = """
        VANCOMYZER BAYESIAN ANALYSIS REPORT
        Generated: \(DateFormatter.calculationTimestamp.string(from: Date()))
        
        =====================================
        PATIENT INFORMATION
        =====================================
        Population: \(patient.populationType.localizedName)
        Age: \(patient.ageDisplay)
        Weight: \(patient.weightDisplay)
        Gender: \(patient.gender.localizedName)
        Indication: \(patient.indication.localizedName)
        Severity: \(patient.severity.localizedName)
        Serum Creatinine: \(patient.creatinineDisplay)
        
        =====================================
        OPTIMIZATION RESULTS
        =====================================
        Method: \(optimization.method)
        Convergence: \(optimization.converged ? "Achieved" : "Not achieved")
        Iterations: \(optimization.iterations)
        
        RECOMMENDED DOSING:
        \(optimization.recommendedRegimen.dosingSummary)
        
        PREDICTED PARAMETERS:
        • AUC₀₋₂₄: \(String(format: "%.1f", optimization.predictedAUC.estimate)) mg·h/L
        • Trough Level: \(String(format: "%.1f", optimization.predictedTrough.estimate)) mg/L
        • Peak Level: \(String(format: "%.1f", optimization.predictedPeak.estimate)) mg/L
        
        """
        
        if includeCI {
            report += """
            
            =====================================
            CONFIDENCE INTERVALS (95%)
            =====================================
            AUC₀₋₂₄: \(optimization.predictedAUC.displayRange) mg·h/L
            Trough: \(optimization.predictedTrough.displayRange) mg/L
            Peak: \(optimization.predictedPeak.displayRange) mg/L
            Clearance: \(optimization.individualParameters.clearance.displayRange) L/h
            Volume: \(optimization.individualParameters.volumeOfDistribution.displayRange) L
            
            """
        }
        
        if includeAnalysis {
            report += """
            
            =====================================
            MODEL PERFORMANCE
            =====================================
            """
            
            if let goodnessOfFit = optimization.goodnessOfFit {
                report += "Goodness of Fit (R²): \(String(format: "%.3f", goodnessOfFit))\n"
            }
            
            if let bias = optimization.bias {
                report += "Bias: \(String(format: "%.2f", bias)) mg/L\n"
            }
            
            if let precision = optimization.precision {
                report += "Precision: \(String(format: "%.2f", precision)) mg/L\n"
            }
            
            report += "Levels Used: \(optimization.levelsUsed.count)\n"
        }
        
        report += """
        
        =====================================
        CLINICAL RECOMMENDATIONS
        =====================================
        """
        
        for recommendation in optimization.clinicalRecommendations {
            report += "• \(recommendation)\n"
        }
        
        if !optimization.safetyWarnings.isEmpty {
            report += """
            
            =====================================
            SAFETY WARNINGS
            =====================================
            """
            
            for warning in optimization.safetyWarnings {
                report += "⚠️ \(warning)\n"
            }
        }
        
        report += """
        
        =====================================
        DISCLAIMER
        =====================================
        This report is generated by Vancomyzer for clinical decision support.
        All dosing recommendations should be reviewed by qualified healthcare
        professionals before implementation. Patient-specific factors not
        captured in this analysis may affect optimal dosing.
        
        Reference: ASHP/IDSA 2020 Vancomycin Guidelines
        """
        
        return report
    }
}

// MARK: - Export Errors

enum ExportError: LocalizedError {
    case dataConversionFailed
    case unsupportedFormat
    case processingFailed(String)
    
    var errorDescription: String? {
        switch self {
        case .dataConversionFailed:
            return "Failed to convert data to the selected format"
        case .unsupportedFormat:
            return "The selected export format is not supported"
        case .processingFailed(let message):
            return "Export processing failed: \(message)"
        }
    }
}

// MARK: - Share Sheet

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    let contentType: UTType
    let filename: String
    
    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        
        // Set subject for email sharing
        if contentType == .pdf || contentType == .plainText {
            controller.setValue("Vancomyzer Bayesian Analysis - \(filename)", forKey: "subject")
        }
        
        return controller
    }
    
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {
        // No updates needed
    }
}

#Preview {
    BayesianExportView(
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
            clinicalRecommendations: [
                "Monitor renal function closely",
                "Obtain next level before 4th dose"
            ]
        ),
        patient: PatientInput.sampleAdult
    )
}