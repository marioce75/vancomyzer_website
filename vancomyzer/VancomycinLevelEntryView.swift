import SwiftUI

// MARK: - Vancomycin Level Entry View

struct VancomycinLevelEntryView: View {
    let onSave: (VancomycinLevel) -> Void
    let existingLevel: VancomycinLevel?
    
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = LevelEntryViewModel()
    
    @State private var showingDeleteAlert = false
    
    var isEditing: Bool {
        existingLevel != nil
    }
    
    var body: some View {
        NavigationView {
            ScrollView {
                LazyVStack(spacing: 20) {
                    // Level Information Section
                    LevelInformationSection(viewModel: viewModel)
                    
                    // Timing Section
                    TimingSection(viewModel: viewModel)
                    
                    // Dose Information Section
                    DoseInformationSection(viewModel: viewModel)
                    
                    // Notes Section
                    NotesSection(viewModel: viewModel)
                    
                    // Validation Warnings
                    if !viewModel.validationWarnings.isEmpty {
                        ValidationWarningsView(warnings: viewModel.validationWarnings)
                    }
                }
                .padding()
            }
            .navigationTitle(isEditing ? "Edit Level" : "Add Level")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    if isEditing {
                        Menu {
                            Button("Save Changes") {
                                saveLevel()
                            }
                            .disabled(!viewModel.isValid)
                            
                            Button("Delete Level", role: .destructive) {
                                showingDeleteAlert = true
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                        }
                    } else {
                        Button("Save") {
                            saveLevel()
                        }
                        .disabled(!viewModel.isValid)
                        .fontWeight(.semibold)
                    }
                }
            }
            .onAppear {
                if let existingLevel = existingLevel {
                    viewModel.loadExistingLevel(existingLevel)
                }
            }
            .alert("Delete Level", isPresented: $showingDeleteAlert) {
                Button("Delete", role: .destructive) {
                    dismiss()
                }
                Button("Cancel", role: .cancel) { }
            } message: {
                Text("Are you sure you want to delete this vancomycin level? This action cannot be undone.")
            }
        }
    }
    
    private func saveLevel() {
        do {
            let level = try viewModel.createVancomycinLevel()
            onSave(level)
            
            AnalyticsManager.shared.trackFeatureUsage("vancomycin_level_saved", parameters: [
                "level_type": level.type.rawValue,
                "is_editing": isEditing
            ])
            
            dismiss()
        } catch {
            // Handle validation errors
            print("Failed to save level: \(error)")
        }
    }
}

// MARK: - Level Information Section

struct LevelInformationSection: View {
    @ObservedObject var viewModel: LevelEntryViewModel
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Level Information")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                VStack(spacing: 12) {
                    // Level Type Selection
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Level Type")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        Picker("Level Type", selection: $viewModel.selectedLevelType) {
                            ForEach(VancomycinLevelType.allCases, id: \.self) { type in
                                HStack {
                                    Circle()
                                        .fill(type.color)
                                        .frame(width: 8, height: 8)
                                    Text(type.localizedName)
                                }
                                .tag(type)
                            }
                        }
                        .pickerStyle(SegmentedPickerStyle())
                    }
                    
                    // Concentration Input
                    HStack(spacing: 12) {
                        VancoTextField(
                            title: "Concentration",
                            text: $viewModel.concentrationText,
                            placeholder: "0.0",
                            keyboardType: .decimalPad,
                            validation: viewModel.concentrationValidation
                        )
                        .frame(maxWidth: .infinity)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Unit")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            Text("mg/L")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .frame(height: 36)
                                .frame(maxWidth: .infinity)
                                .background(Color(.systemGray6))
                                .cornerRadius(8)
                        }
                        .frame(width: 60)
                    }
                    
                    // Expected Range Display
                    if let expectedRange = viewModel.expectedRange {
                        HStack {
                            Text("Expected range:")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            Text(expectedRange)
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundColor(.vancoBlue)
                            
                            Spacer()
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Timing Section

struct TimingSection: View {
    @ObservedObject var viewModel: LevelEntryViewModel
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Timing Information")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                VStack(spacing: 12) {
                    // Draw Time
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Sample Draw Time")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        DatePicker(
                            "Draw Time",
                            selection: $viewModel.drawTime,
                            displayedComponents: [.date, .hourAndMinute]
                        )
                        .datePickerStyle(CompactDatePickerStyle())
                    }
                    
                    // Last Dose Time
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Last Dose Time")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        DatePicker(
                            "Last Dose Time",
                            selection: $viewModel.lastDoseTime,
                            displayedComponents: [.date, .hourAndMinute]
                        )
                        .datePickerStyle(CompactDatePickerStyle())
                    }
                    
                    // Time After Dose Display
                    HStack {
                        Text("Time after dose:")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Text(viewModel.timeAfterDoseDisplay)
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(.vancoBlue)
                        
                        Spacer()
                    }
                    .padding(.top, 4)
                }
            }
        }
    }
}

// MARK: - Dose Information Section

struct DoseInformationSection: View {
    @ObservedObject var viewModel: LevelEntryViewModel
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Dose Information")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                VStack(spacing: 12) {
                    // Dose Amount
                    HStack(spacing: 12) {
                        VancoTextField(
                            title: "Dose Given",
                            text: $viewModel.doseAmountText,
                            placeholder: "1000",
                            keyboardType: .numberPad,
                            validation: viewModel.doseValidation
                        )
                        .frame(maxWidth: .infinity)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Unit")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            Text("mg")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .frame(height: 36)
                                .frame(maxWidth: .infinity)
                                .background(Color(.systemGray6))
                                .cornerRadius(8)
                        }
                        .frame(width: 60)
                    }
                    
                    // Infusion Duration
                    VancoTextField(
                        title: "Infusion Duration (optional)",
                        text: $viewModel.infusionDurationText,
                        placeholder: "1.0",
                        keyboardType: .decimalPad
                    )
                    
                    // Dose Number
                    VancoTextField(
                        title: "Dose Number (optional)",
                        text: $viewModel.doseNumberText,
                        placeholder: "4",
                        keyboardType: .numberPad
                    )
                }
            }
        }
    }
}

// MARK: - Notes Section

struct NotesSection: View {
    @ObservedObject var viewModel: LevelEntryViewModel
    
    var body: some View {
        VancoSectionCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Additional Notes")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                TextEditor(text: $viewModel.notes)
                    .frame(minHeight: 80)
                    .padding(8)
                    .background(Color(.systemBackground))
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color(.systemGray4), lineWidth: 1)
                    )
                
                Text("Include any relevant clinical information, such as dialysis timing, dose changes, or patient status.")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}

// MARK: - Validation Warnings View

struct ValidationWarningsView: View {
    let warnings: [String]
    
    var body: some View {
        VancoAlertView(
            type: .warning,
            title: "Clinical Warnings",
            message: warnings.joined(separator: "\n"),
            primaryAction: nil,
            secondaryAction: nil
        )
    }
}

// MARK: - Level Entry View Model

@MainActor
class LevelEntryViewModel: ObservableObject {
    // Level Information
    @Published var selectedLevelType: VancomycinLevelType = .trough
    @Published var concentrationText = ""
    
    // Timing
    @Published var drawTime = Date()
    @Published var lastDoseTime = Date().addingTimeInterval(-12 * 3600) // 12 hours ago
    
    // Dose Information
    @Published var doseAmountText = ""
    @Published var infusionDurationText = "1.0"
    @Published var doseNumberText = ""
    
    // Notes
    @Published var notes = ""
    
    // Validation
    @Published var validationWarnings: [String] = []
    
    var isValid: Bool {
        return concentrationValidation == .valid &&
               doseValidation == .valid &&
               drawTime > lastDoseTime
    }
    
    var concentrationValidation: ValidationState {
        guard !concentrationText.isEmpty else { return .invalid("Concentration is required") }
        guard let concentration = Double(concentrationText) else { return .invalid("Invalid concentration format") }
        
        if concentration <= 0 { return .invalid("Concentration must be greater than 0") }
        if concentration > 100 { return .invalid("Concentration exceeds maximum (100 mg/L)") }
        
        return .valid
    }
    
    var doseValidation: ValidationState {
        guard !doseAmountText.isEmpty else { return .invalid("Dose amount is required") }
        guard let dose = Double(doseAmountText) else { return .invalid("Invalid dose format") }
        
        if dose <= 0 { return .invalid("Dose must be greater than 0") }
        if dose > 4000 { return .invalid("Dose exceeds maximum (4000 mg)") }
        
        return .valid
    }
    
    var timeAfterDoseDisplay: String {
        let interval = drawTime.timeIntervalSince(lastDoseTime)
        let hours = interval / 3600
        
        if hours < 0 {
            return "Invalid (draw time before dose)"
        } else if hours < 1 {
            let minutes = Int(interval / 60)
            return "\(minutes) minutes"
        } else {
            return String(format: "%.1f hours", hours)
        }
    }
    
    var expectedRange: String? {
        switch selectedLevelType {
        case .trough:
            return "10-20 mg/L"
        case .peak:
            return "20-40 mg/L"
        case .random:
            return nil
        }
    }
    
    func loadExistingLevel(_ level: VancomycinLevel) {
        selectedLevelType = level.type
        concentrationText = String(format: "%.1f", level.concentration)
        drawTime = level.drawTime
        lastDoseTime = level.lastDoseTime ?? Date().addingTimeInterval(-12 * 3600)
        doseAmountText = String(format: "%.0f", level.doseGiven)
        notes = level.notes ?? ""
        
        if let infusionDuration = level.infusionDuration {
            infusionDurationText = String(format: "%.1f", infusionDuration)
        }
        
        if let doseNumber = level.doseNumber {
            doseNumberText = String(doseNumber)
        }
        
        validateInputs()
    }
    
    func createVancomycinLevel() throws -> VancomycinLevel {
        guard let concentration = Double(concentrationText) else {
            throw LevelEntryError.invalidConcentration
        }
        
        guard let doseAmount = Double(doseAmountText) else {
            throw LevelEntryError.invalidDose
        }
        
        guard drawTime > lastDoseTime else {
            throw LevelEntryError.invalidTiming
        }
        
        let timeAfterDose = drawTime.timeIntervalSince(lastDoseTime) / 3600 // Convert to hours
        
        return VancomycinLevel(
            concentration: concentration,
            timeAfterDose: timeAfterDose,
            doseGiven: doseAmount,
            drawTime: drawTime,
            lastDoseTime: lastDoseTime,
            type: selectedLevelType,
            infusionDuration: Double(infusionDurationText),
            doseNumber: Int(doseNumberText),
            notes: notes.isEmpty ? nil : notes
        )
    }
    
    private func validateInputs() {
        validationWarnings.removeAll()
        
        // Check concentration ranges
        if let concentration = Double(concentrationText) {
            switch selectedLevelType {
            case .trough:
                if concentration > 20 {
                    validationWarnings.append("Trough level >20 mg/L may indicate risk of nephrotoxicity")
                } else if concentration < 10 {
                    validationWarnings.append("Trough level <10 mg/L may be subtherapeutic")
                }
            case .peak:
                if concentration > 40 {
                    validationWarnings.append("Peak level >40 mg/L may indicate risk of nephrotoxicity")
                } else if concentration < 20 {
                    validationWarnings.append("Peak level <20 mg/L may be subtherapeutic")
                }
            case .random:
                break
            }
        }
        
        // Check timing
        let timeAfterDose = drawTime.timeIntervalSince(lastDoseTime) / 3600
        if timeAfterDose < 0.5 {
            validationWarnings.append("Very short time after dose - consider infusion duration")
        } else if timeAfterDose > 48 {
            validationWarnings.append("Long time after dose - verify timing accuracy")
        }
        
        // Check dose
        if let dose = Double(doseAmountText) {
            if dose < 500 {
                validationWarnings.append("Dose <500 mg is unusually low for adults")
            } else if dose > 2500 {
                validationWarnings.append("Dose >2500 mg is unusually high - verify accuracy")
            }
        }
    }
}

// MARK: - Level Entry Errors

enum LevelEntryError: LocalizedError {
    case invalidConcentration
    case invalidDose
    case invalidTiming
    
    var errorDescription: String? {
        switch self {
        case .invalidConcentration:
            return "Invalid concentration value"
        case .invalidDose:
            return "Invalid dose value"
        case .invalidTiming:
            return "Draw time must be after dose time"
        }
    }
}

// MARK: - Vancomycin Level Type Extension

enum VancomycinLevelType: String, CaseIterable, Identifiable {
    case trough = "trough"
    case peak = "peak"
    case random = "random"
    
    var id: String { rawValue }
    
    var localizedName: String {
        switch self {
        case .trough: return NSLocalizedString("level.trough", comment: "Trough")
        case .peak: return NSLocalizedString("level.peak", comment: "Peak")
        case .random: return NSLocalizedString("level.random", comment: "Random")
        }
    }
    
    var color: Color {
        switch self {
        case .trough: return .vancoBlue
        case .peak: return .vancoOrange
        case .random: return .vancoGreen
        }
    }
}

// MARK: - Enhanced Vancomycin Level Model

extension VancomycinLevel {
    var type: VancomycinLevelType {
        get {
            if let typeString = notes?.components(separatedBy: "type:").last?.components(separatedBy: ",").first {
                return VancomycinLevelType(rawValue: typeString.trimmingCharacters(in: .whitespaces)) ?? .random
            }
            return .random
        }
        set {
            let typeInfo = "type:\(newValue.rawValue)"
            if let existingNotes = notes {
                // Update existing notes
                let components = existingNotes.components(separatedBy: ",")
                var newComponents = components.filter { !$0.contains("type:") }
                newComponents.append(typeInfo)
                notes = newComponents.joined(separator: ",")
            } else {
                notes = typeInfo
            }
        }
    }
    
    var drawTime: Date {
        return timestamp
    }
    
    var lastDoseTime: Date? {
        return timestamp.addingTimeInterval(-timeAfterDose * 3600)
    }
    
    var infusionDuration: Double? {
        return nil // Could be extracted from notes if needed
    }
    
    var doseNumber: Int? {
        return nil // Could be extracted from notes if needed
    }
    
    init(concentration: Double, timeAfterDose: Double, doseGiven: Double, drawTime: Date, lastDoseTime: Date?, type: VancomycinLevelType, infusionDuration: Double? = nil, doseNumber: Int? = nil, notes: String? = nil) {
        self.init(concentration: concentration, timeAfterDose: timeAfterDose, doseGiven: doseGiven, notes: notes)
        // Set type in notes
        var noteComponents: [String] = []
        if let notes = notes, !notes.isEmpty {
            noteComponents.append(notes)
        }
        noteComponents.append("type:\(type.rawValue)")
        
        if let infusionDuration = infusionDuration {
            noteComponents.append("infusion:\(infusionDuration)")
        }
        
        if let doseNumber = doseNumber {
            noteComponents.append("dose_number:\(doseNumber)")
        }
        
        self.notes = noteComponents.joined(separator: ",")
    }
}

#Preview {
    VancomycinLevelEntryView(
        onSave: { level in
            print("Saved level: \(level)")
        },
        existingLevel: nil
    )
}