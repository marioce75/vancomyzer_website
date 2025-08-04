import SwiftUI
import UniformTypeIdentifiers

// MARK: - Dosing Result Export View

struct DosingResultExportView: View {
    let result: DosingResult
    let patient: PatientInput
    
    @Environment(\.dismiss) private var dismiss
    @StateObject private var exportManager = DosingExportManager()
    @State private var selectedFormat: ExportFormat = .pdf
    @State private var includePatientInfo = true
    @State private var includeCalculationDetails = true
    @State private var includeMonitoring = true
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
                    DosingFormatSelectionSection(selectedFormat: $selectedFormat)
                    
                    // Export Options
                    DosingExportOptionsSection(
                        includePatient: $includePatientInfo,
                        includeDetails: $includeCalculationDetails,
                        includeMonitoring: $includeMonitoring
                    )
                    
                    // Preview Section
                    DosingExportPreviewSection(
                        format: selectedFormat,
                        result: result,
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
                let data = try await exportManager.exportDosingResult(
                    result: result,
                    patient: patient,
                    format: selectedFormat,
                    includePatient: includePatientInfo,
                    includeDetails: includeCalculationDetails,
                    includeMonitoring: includeMonitoring
                )
                
                await MainActor.run {
                    exportedData = data
                    showingShareSheet = true
                    
                    AnalyticsManager.shared.trackFeatureUsage("dosing_export", parameters: [
                        "format": selectedFormat.rawValue,
                        "population": patient.populationType.rawValue
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
        return "vancomyzer_dosing_\(population)_\(timestamp).\(selectedFormat.rawValue)"
    }
}

// MARK: - Dosing Format Selection Section

struct DosingFormatSelectionSection: View {
    @Binding var selectedFormat: DosingResultExportView.ExportFormat
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Export Format")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                    ForEach(DosingResultExportView.ExportFormat.allCases) { format in
                        DosingFormatOptionCard(
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

struct DosingFormatOptionCard: View {
    let format: DosingResultExportView.ExportFormat
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

// MARK: - Dosing Export Options Section

struct DosingExportOptionsSection: View {
    @Binding var includePatient: Bool
    @Binding var includeDetails: Bool
    @Binding var includeMonitoring: Bool
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Export Options")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                VStack(spacing: 12) {
                    Toggle("Include Patient Information", isOn: $includePatient)
                        .font(.subheadline)
                    
                    Toggle("Include Calculation Details", isOn: $includeDetails)
                        .font(.subheadline)
                    
                    Toggle("Include Monitoring Guidelines", isOn: $includeMonitoring)
                        .font(.subheadline)
                }
                
                Text("Calculation details include pharmacokinetic parameters and alternative regimens. Monitoring guidelines include level timing and safety recommendations.")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}

// MARK: - Dosing Export Preview Section

struct DosingExportPreviewSection: View {
    let format: DosingResultExportView.ExportFormat
    let result: DosingResult
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
            VANCOMYZER DOSING REPORT
            
            Patient: \(patient.clinicalSummary)
            Indication: \(patient.indication.localizedName)
            
            RECOMMENDED DOSING:
            \(result.dosingSummary)
            
            PREDICTED LEVELS:
            • AUC₀₋₂₄: \(result.aucDisplay)
            • Trough: \(result.troughDisplay)
            [Additional sections follow...]
            """
            
        case .csv:
            return """
            Parameter,Value,Unit
            Population,\(patient.populationType.rawValue),
            Dose,\(result.recommendedDose),mg
            Interval,\(result.interval),hours
            AUC,\(String(format: "%.1f", result.predictedAUC)),mg·h/L
            [Additional rows...]
            """
            
        case .json:
            return """
            {
              "patient": {
                "population": "\(patient.populationType.rawValue)",
                "indication": "\(patient.indication.rawValue)"
              },
              "dosing": {
                "dose": \(result.recommendedDose),
                "interval": \(result.interval),
                "summary": "\(result.dosingSummary)"
              }
            }
            """
            
        case .text:
            return """
            Vancomyzer Dosing Recommendation
            
            Patient: \(patient.clinicalSummary)
            
            RECOMMENDED DOSING:
            \(result.dosingSummary)
            
            PREDICTIONS:
            • AUC₀₋₂₄: \(result.aucDisplay)
            • Trough: \(result.troughDisplay)
            """
        }
    }
}

// MARK: - Dosing Export Manager

@MainActor
class DosingExportManager: ObservableObject {
    @Published var isExporting = false
    @Published var exportError: Error?
    
    func exportDosingResult(
        result: DosingResult,
        patient: PatientInput,
        format: DosingResultExportView.ExportFormat,
        includePatient: Bool,
        includeDetails: Bool,
        includeMonitoring: Bool
    ) async throws -> Data {
        
        isExporting = true
        defer { isExporting = false }
        
        // Simulate processing time
        try await Task.sleep(nanoseconds: 300_000_000) // 0.3 seconds
        
        switch format {
        case .pdf:
            return try generatePDFReport(
                result: result,
                patient: patient,
                includePatient: includePatient,
                includeDetails: includeDetails,
                includeMonitoring: includeMonitoring
            )
        case .csv:
            return generateCSVData(
                result: result,
                patient: patient,
                includePatient: includePatient,
                includeDetails: includeDetails
            )
        case .json:
            return try generateJSONData(
                result: result,
                patient: patient,
                includePatient: includePatient,
                includeDetails: includeDetails,
                includeMonitoring: includeMonitoring
            )
        case .text:
            return generateTextReport(
                result: result,
                patient: patient,
                includePatient: includePatient,
                includeDetails: includeDetails,
                includeMonitoring: includeMonitoring
            )
        }
    }
    
    private func generatePDFReport(
        result: DosingResult,
        patient: PatientInput,
        includePatient: Bool,
        includeDetails: Bool,
        includeMonitoring: Bool
    ) throws -> Data {
        let content = generateDetailedDosingReport(
            result: result,
            patient: patient,
            includePatient: includePatient,
            includeDetails: includeDetails,
            includeMonitoring: includeMonitoring
        )
        
        // In a real implementation, convert to PDF using PDFKit
        guard let data = content.data(using: .utf8) else {
            throw ExportError.dataConversionFailed
        }
        
        return data
    }
    
    private func generateCSVData(
        result: DosingResult,
        patient: PatientInput,
        includePatient: Bool,
        includeDetails: Bool
    ) -> Data {
        var csv = "Parameter,Value,Unit\n"
        
        if includePatient {
            csv += "Population,\(patient.populationType.rawValue),\n"
            csv += "Age,\(patient.ageDisplay),\n"
            csv += "Weight,\(patient.weightInKg),kg\n"
            csv += "Height,\(patient.heightInCm ?? 0),cm\n"
            csv += "Serum_Creatinine,\(patient.serumCreatinine),mg/dL\n"
            csv += "Indication,\(patient.indication.rawValue),\n"
            csv += "Severity,\(patient.severity.rawValue),\n"
        }
        
        // Dosing results
        csv += "Recommended_Dose,\(result.recommendedDose),mg\n"
        csv += "Interval,\(result.interval),hours\n"
        csv += "Daily_Dose,\(String(format: "%.1f", result.dailyDose)),mg\n"
        csv += "Mg_Per_Kg_Per_Day,\(String(format: "%.1f", result.mgPerKgPerDay)),mg/kg/day\n"
        
        if let loadingDose = result.loadingDose {
            csv += "Loading_Dose,\(loadingDose),mg\n"
        }
        
        // Predictions
        csv += "Predicted_AUC,\(String(format: "%.1f", result.predictedAUC)),mg·h/L\n"
        csv += "Predicted_Trough,\(String(format: "%.1f", result.predictedTrough)),mg/L\n"
        csv += "Predicted_Peak,\(String(format: "%.1f", result.predictedPeak)),mg/L\n"
        
        if includeDetails {
            csv += "Clearance,\(String(format: "%.2f", result.clearance)),L/h\n"
            csv += "Volume_Distribution,\(String(format: "%.1f", result.volumeDistribution)),L\n"
            csv += "Half_Life,\(String(format: "%.1f", result.halfLife)),hours\n"
            csv += "Elimination_Rate_Constant,\(String(format: "%.4f", result.eliminationRateConstant)),/h\n"
            csv += "Creatinine_Clearance,\(String(format: "%.0f", result.creatinineClearance)),mL/min\n"
            csv += "Method,\(result.calculationMethod),\n"
            csv += "Reference,\(result.guidelineReference),\n"
        }
        
        return csv.data(using: .utf8) ?? Data()
    }
    
    private func generateJSONData(
        result: DosingResult,
        patient: PatientInput,
        includePatient: Bool,
        includeDetails: Bool,
        includeMonitoring: Bool
    ) throws -> Data {
        var json: [String: Any] = [
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "app_version": Bundle.main.appVersion,
            "dosing_result": [
                "recommended_dose": result.recommendedDose,
                "interval": result.interval,
                "daily_dose": result.dailyDose,
                "mg_per_kg_per_day": result.mgPerKgPerDay,
                "dosing_summary": result.dosingSummary,
                "predictions": [
                    "auc_24h": result.predictedAUC,
                    "trough": result.predictedTrough,
                    "peak": result.predictedPeak
                ]
            ]
        ]
        
        if let loadingDose = result.loadingDose {
            if var dosing = json["dosing_result"] as? [String: Any] {
                dosing["loading_dose"] = loadingDose
                json["dosing_result"] = dosing
            }
        }
        
        if includePatient {
            json["patient"] = [
                "population": patient.populationType.rawValue,
                "age_display": patient.ageDisplay,
                "weight_kg": patient.weightInKg,
                "height_cm": patient.heightInCm as Any,
                "serum_creatinine": patient.serumCreatinine,
                "gender": patient.gender.rawValue,
                "indication": patient.indication.rawValue,
                "severity": patient.severity.rawValue,
                "stable_renal_function": patient.isRenalFunctionStable,
                "hemodialysis": patient.isOnHemodialysis,
                "crrt": patient.isOnCRRT
            ]
        }
        
        if includeDetails {
            if var dosing = json["dosing_result"] as? [String: Any] {
                dosing["pharmacokinetics"] = [
                    "clearance_l_per_h": result.clearance,
                    "volume_distribution_l": result.volumeDistribution,
                    "half_life_h": result.halfLife,
                    "elimination_rate_constant": result.eliminationRateConstant,
                    "creatinine_clearance_ml_per_min": result.creatinineClearance
                ]
                dosing["calculation_method"] = result.calculationMethod
                dosing["guideline_reference"] = result.guidelineReference
                dosing["clinical_notes"] = result.clinicalNotes
                dosing["alternative_regimens"] = result.alternativeRegimens.map { regimen in
                    [
                        "dose": regimen.dose,
                        "interval": regimen.interval,
                        "predicted_auc": regimen.predictedAUC,
                        "suitability": regimen.suitability
                    ]
                }
                json["dosing_result"] = dosing
            }
        }
        
        if includeMonitoring {
            json["monitoring"] = [
                "recommendations": result.monitoringRecommendations,
                "safety_warnings": result.safetyWarnings
            ]
        }
        
        return try JSONSerialization.data(withJSONObject: json, options: .prettyPrinted)
    }
    
    private func generateTextReport(
        result: DosingResult,
        patient: PatientInput,
        includePatient: Bool,
        includeDetails: Bool,
        includeMonitoring: Bool
    ) -> Data {
        let content = generateDetailedDosingReport(
            result: result,
            patient: patient,
            includePatient: includePatient,
            includeDetails: includeDetails,
            includeMonitoring: includeMonitoring
        )
        return content.data(using: .utf8) ?? Data()
    }
    
    private func generateDetailedDosingReport(
        result: DosingResult,
        patient: PatientInput,
        includePatient: Bool,
        includeDetails: Bool,
        includeMonitoring: Bool
    ) -> String {
        var report = """
        VANCOMYZER DOSING RECOMMENDATION
        Generated: \(DateFormatter.calculationTimestamp.string(from: Date()))
        
        """
        
        if includePatient {
            report += """
            =====================================
            PATIENT INFORMATION
            =====================================
            Population: \(patient.populationType.localizedName)
            Age: \(patient.ageDisplay)
            Gender: \(patient.gender.localizedName)
            Weight: \(patient.weightDisplay)
            """
            
            if let height = patient.heightDisplay {
                report += "\nHeight: \(height)"
            }
            
            if let bmi = patient.bmiDisplay {
                report += "\nBMI: \(bmi)"
            }
            
            report += """
            
            Serum Creatinine: \(patient.creatinineDisplay)
            Indication: \(patient.indication.localizedName)
            Infection Severity: \(patient.severity.localizedName)
            Renal Function: \(patient.isRenalFunctionStable ? "Stable" : "Unstable")
            Hemodialysis: \(patient.isOnHemodialysis ? "Yes" : "No")
            CRRT: \(patient.isOnCRRT ? "Yes" : "No")
            
            """
        }
        
        report += """
        =====================================
        RECOMMENDED DOSING
        =====================================
        \(result.dosingSummaryFormatted)
        
        Daily Dose: \(String(format: "%.1f", result.dailyDose)) mg (\(String(format: "%.1f", result.mgPerKgPerDay)) mg/kg/day)
        
        PREDICTED PHARMACOKINETIC PARAMETERS:
        • AUC₀₋₂₄: \(result.aucDisplay)
        • Trough Level: \(result.troughDisplay)
        • Peak Level: \(result.peakDisplay)
        
        """
        
        if includeDetails {
            report += """
            =====================================
            PHARMACOKINETIC DETAILS
            =====================================
            Clearance: \(result.clearanceDisplay)
            Volume of Distribution: \(result.volumeDisplay)
            Half-life: \(result.halfLifeDisplay)
            Elimination Rate Constant: \(String(format: "%.4f", result.eliminationRateConstant)) h⁻¹
            Creatinine Clearance: \(result.crclDisplay)
            
            Calculation Method: \(result.calculationMethod)
            Guideline Reference: \(result.guidelineReference)
            
            """
            
            if !result.clinicalNotes.isEmpty {
                report += """
                CLINICAL NOTES:
                """
                for note in result.clinicalNotes {
                    report += "\n• \(note)"
                }
                report += "\n\n"
            }
            
            if !result.alternativeRegimens.isEmpty {
                report += """
                ALTERNATIVE REGIMENS:
                """
                for regimen in result.alternativeRegimens {
                    report += "\n• \(String(format: "%.0f", regimen.dose)) mg every \(String(format: "%.0f", regimen.interval)) hours (AUC: \(String(format: "%.0f", regimen.predictedAUC)) mg·h/L) - \(regimen.suitability)"
                }
                report += "\n\n"
            }
        }
        
        if includeMonitoring && (!result.monitoringRecommendations.isEmpty || !result.safetyWarnings.isEmpty) {
            report += """
            =====================================
            MONITORING & SAFETY
            =====================================
            """
            
            if !result.monitoringRecommendations.isEmpty {
                report += "MONITORING RECOMMENDATIONS:\n"
                for recommendation in result.monitoringRecommendations {
                    report += "• \(recommendation)\n"
                }
                report += "\n"
            }
            
            if !result.safetyWarnings.isEmpty {
                report += "SAFETY WARNINGS:\n"
                for warning in result.safetyWarnings {
                    report += "⚠️ \(warning)\n"
                }
                report += "\n"
            }
        }
        
        report += """
        =====================================
        DISCLAIMER
        =====================================
        This dosing recommendation is generated by Vancomyzer based on 
        population pharmacokinetic models and clinical guidelines. All
        dosing should be reviewed by qualified healthcare professionals
        and adjusted based on patient-specific factors and clinical
        response. Monitor vancomycin levels and renal function as
        clinically indicated.
        
        Target Ranges:
        • AUC₀₋₂₄: 400-600 mg·h/L
        • Trough: 10-20 mg/L (avoid >20 mg/L)
        
        Reference: \(result.guidelineReference)
        Generated by Vancomyzer v\(Bundle.main.appVersion)
        """
        
        return report
    }
}

#Preview {
    DosingResultExportView(
        result: DosingResult.sampleResult,
        patient: PatientInput.sampleAdult
    )
}