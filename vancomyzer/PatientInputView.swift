import SwiftUI

struct PatientInputView: View {
    @StateObject private var viewModel = PatientInputViewModel()
    @EnvironmentObject var userPreferences: UserPreferences
    @State private var showingResults = false
    @State private var showingValidationErrors = false
    
    var body: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                // Population Selection
                PopulationSelectionSection(selectedPopulation: $viewModel.selectedPopulation)
                
                // Demographics Section
                DemographicsSection(viewModel: viewModel)
                
                // Clinical Information Section
                ClinicalInformationSection(viewModel: viewModel)
                
                // Renal Function Section
                RenalFunctionSection(viewModel: viewModel)
                
                // Validation Warnings
                if !viewModel.validationWarnings.isEmpty {
                    ValidationWarningsSection(warnings: viewModel.validationWarnings)
                }
                
                // Calculate Button
                CalculateButton(
                    isEnabled: viewModel.isValid,
                    isCalculating: viewModel.isCalculating,
                    action: calculateDosing
                )
            }
            .padding()
        }
        .navigationBarItems(trailing: 
            Button("Clear") {
                viewModel.clearAll()
            }
            .foregroundColor(.vancoBlue)
        )
        .sheet(isPresented: $showingResults) {
            if let result = viewModel.calculationResult {
                DosingResultView(result: result, patient: viewModel.patientInput)
            }
        }
        .alert("Validation Errors", isPresented: $showingValidationErrors) {
            Button("OK") { }
        } message: {
            Text(viewModel.validationErrors.map { $0.localizedDescription }.joined(separator: "\n"))
        }
        .onChange(of: viewModel.selectedPopulation) { _ in
            viewModel.validateInput()
        }
    }
    
    private func calculateDosing() {
        Task {
            await viewModel.calculateDosing()
            if viewModel.calculationResult != nil {
                showingResults = true
            } else if !viewModel.validationErrors.isEmpty {
                showingValidationErrors = true
            }
        }
    }
}

// MARK: - Population Selection Section

struct PopulationSelectionSection: View {
    @Binding var selectedPopulation: PopulationType
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Patient Population", icon: "person.3.fill")
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 12) {
                ForEach(PopulationType.allCases) { population in
                    PopulationCard(
                        population: population,
                        isSelected: selectedPopulation == population,
                        action: { selectedPopulation = population }
                    )
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct PopulationCard: View {
    let population: PopulationType
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: population.icon)
                    .font(.title2)
                    .foregroundColor(isSelected ? .white : .vancoBlue)
                
                Text(population.localizedName)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(isSelected ? .white : .primary)
                
                Text(population.ageRange)
                    .font(.caption2)
                    .foregroundColor(isSelected ? .white.opacity(0.8) : .secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(isSelected ? Color.vancoBlue : Color.clear)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? Color.clear : Color.vancoBlue, lineWidth: 1)
            )
            .cornerRadius(8)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Demographics Section

struct DemographicsSection: View {
    @ObservedObject var viewModel: PatientInputViewModel
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionHeader(title: "Demographics", icon: "person.fill")
            
            VStack(spacing: 12) {
                if viewModel.selectedPopulation != .neonate {
                    // Age input for adult/pediatric
                    InputField(
                        title: "Age",
                        value: $viewModel.ageText,
                        placeholder: viewModel.selectedPopulation == .adult ? "18+ years" : "1 month - 17 years",
                        unit: "years",
                        keyboardType: .decimalPad,
                        validation: viewModel.ageValidation
                    )
                }
                
                if viewModel.selectedPopulation == .neonate {
                    // Gestational and postnatal age for neonates
                    HStack(spacing: 12) {
                        InputField(
                            title: "Gestational Age",
                            value: $viewModel.gestationalAgeText,
                            placeholder: "22-44",
                            unit: "weeks",
                            keyboardType: .decimalPad,
                            validation: viewModel.gestationalAgeValidation
                        )
                        
                        InputField(
                            title: "Postnatal Age",
                            value: $viewModel.postnatalAgeText,
                            placeholder: "0-30",
                            unit: "days",
                            keyboardType: .decimalPad,
                            validation: viewModel.postnatalAgeValidation
                        )
                    }
                }
                
                // Gender selection
                VStack(alignment: .leading, spacing: 8) {
                    Text("Gender")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Picker("Gender", selection: $viewModel.selectedGender) {
                        ForEach(Gender.allCases) { gender in
                            Text(gender.localizedName).tag(gender)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                }
                
                // Weight and height
                HStack(spacing: 12) {
                    InputField(
                        title: "Weight",
                        value: $viewModel.weightText,
                        placeholder: "kg",
                        unit: "kg",
                        keyboardType: .decimalPad,
                        validation: viewModel.weightValidation
                    )
                    
                    if viewModel.selectedPopulation != .neonate {
                        InputField(
                            title: "Height",
                            value: $viewModel.heightText,
                            placeholder: "cm",
                            unit: "cm",
                            keyboardType: .decimalPad,
                            validation: viewModel.heightValidation
                        )
                    }
                }
                
                // BMI display for adult/pediatric
                if viewModel.selectedPopulation != .neonate, let bmi = viewModel.calculatedBMI {
                    HStack {
                        Text("BMI:")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        
                        Text(String(format: "%.1f kg/m²", bmi))
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        Spacer()
                    }
                    .padding(.horizontal, 4)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

// MARK: - Clinical Information Section

struct ClinicalInformationSection: View {
    @ObservedObject var viewModel: PatientInputViewModel
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionHeader(title: "Clinical Information", icon: "stethoscope")
            
            VStack(spacing: 12) {
                // Indication
                VStack(alignment: .leading, spacing: 8) {
                    Text("Indication")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Picker("Indication", selection: $viewModel.selectedIndication) {
                        ForEach(Indication.allCases) { indication in
                            Text(indication.localizedName).tag(indication)
                        }
                    }
                    .pickerStyle(MenuPickerStyle())
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                
                // Infection severity
                VStack(alignment: .leading, spacing: 8) {
                    Text("Infection Severity")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Picker("Severity", selection: $viewModel.selectedSeverity) {
                        ForEach(InfectionSeverity.allCases) { severity in
                            HStack {
                                Circle()
                                    .fill(severity.color)
                                    .frame(width: 8, height: 8)
                                Text(severity.localizedName)
                            }.tag(severity)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                }
                
                // Target AUC display
                HStack {
                    Text("Target AUC₀₋₂₄:")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    Text("\(String(format: "%.0f", viewModel.targetAUC)) mg·h/L")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.vancoBlue)
                    
                    Spacer()
                }
                .padding(.horizontal, 4)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

// MARK: - Renal Function Section

struct RenalFunctionSection: View {
    @ObservedObject var viewModel: PatientInputViewModel
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionHeader(title: "Renal Function", icon: "drop.fill")
            
            VStack(spacing: 12) {
                // Serum creatinine
                InputField(
                    title: "Serum Creatinine",
                    value: $viewModel.serumCreatinineText,
                    placeholder: "mg/dL",
                    unit: "mg/dL",
                    keyboardType: .decimalPad,
                    validation: viewModel.creatinineValidation
                )
                
                // CrCl method for adults
                if viewModel.selectedPopulation == .adult {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Creatinine Clearance Method")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        Picker("CrCl Method", selection: $viewModel.selectedCrClMethod) {
                            ForEach(CrClMethod.allCases) { method in
                                VStack(alignment: .leading) {
                                    Text(method.localizedName)
                                    Text(method.description)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }.tag(method)
                            }
                        }
                        .pickerStyle(MenuPickerStyle())
                    }
                    
                    // Custom CrCl input
                    if viewModel.selectedCrClMethod == .custom {
                        InputField(
                            title: "Custom CrCl",
                            value: $viewModel.customCrClText,
                            placeholder: "mL/min",
                            unit: "mL/min",
                            keyboardType: .decimalPad,
                            validation: viewModel.customCrClValidation
                        )
                    }
                }
                
                // Calculated CrCl display
                if let crCl = viewModel.calculatedCrCl {
                    HStack {
                        Text("Calculated CrCl:")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        
                        Text("\(String(format: "%.0f", crCl)) mL/min")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(.vancoBlue)
                        
                        Spacer()
                    }
                    .padding(.horizontal, 4)
                }
                
                // Renal function status
                VStack(spacing: 8) {
                    Toggle("Renal function is stable", isOn: $viewModel.isRenalFunctionStable)
                        .font(.subheadline)
                    
                    Toggle("Patient on hemodialysis", isOn: $viewModel.isOnHemodialysis)
                        .font(.subheadline)
                    
                    Toggle("Patient on CRRT", isOn: $viewModel.isOnCRRT)
                        .font(.subheadline)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

// MARK: - Supporting Views

struct SectionHeader: View {
    let title: String
    let icon: String
    
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .foregroundColor(.vancoBlue)
            
            Text(title)
                .font(.headline)
                .fontWeight(.semibold)
            
            Spacer()
        }
    }
}

struct InputField: View {
    let title: String
    @Binding var value: String
    let placeholder: String
    let unit: String
    let keyboardType: UIKeyboardType
    let validation: ValidationState
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.subheadline)
                .fontWeight(.medium)
            
            HStack {
                TextField(placeholder, text: $value)
                    .keyboardType(keyboardType)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                
                Text(unit)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .frame(width: 40, alignment: .leading)
            }
            
            if case .invalid(let message) = validation {
                Text(message)
                    .font(.caption)
                    .foregroundColor(.red)
            }
        }
    }
}

struct ValidationWarningsSection: View {
    let warnings: [String]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(.orange)
                
                Text("Clinical Warnings")
                    .font(.headline)
                    .fontWeight(.semibold)
            }
            
            ForEach(warnings, id: \.self) { warning in
                HStack(alignment: .top, spacing: 8) {
                    Text("•")
                        .foregroundColor(.orange)
                    Text(warning)
                        .font(.subheadline)
                    Spacer()
                }
            }
        }
        .padding()
        .background(Color.orange.opacity(0.1))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.orange, lineWidth: 1)
        )
        .cornerRadius(12)
    }
}

struct CalculateButton: View {
    let isEnabled: Bool
    let isCalculating: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack {
                if isCalculating {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(0.8)
                }
                
                Text(isCalculating ? "Calculating..." : "Calculate Dosing")
                    .font(.headline)
                    .fontWeight(.semibold)
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding()
            .background(isEnabled ? Color.vancoBlue : Color.gray)
            .cornerRadius(12)
        }
        .disabled(!isEnabled || isCalculating)
    }
}

// MARK: - Patient Input View Model

@MainActor
class PatientInputViewModel: ObservableObject {
    // Population
    @Published var selectedPopulation: PopulationType = .adult
    
    // Demographics
    @Published var ageText = ""
    @Published var gestationalAgeText = ""
    @Published var postnatalAgeText = ""
    @Published var selectedGender: Gender = .male
    @Published var weightText = ""
    @Published var heightText = ""
    
    // Clinical
    @Published var selectedIndication: Indication = .pneumonia
    @Published var selectedSeverity: InfectionSeverity = .moderate
    
    // Renal function
    @Published var serumCreatinineText = ""
    @Published var selectedCrClMethod: CrClMethod = .ibw
    @Published var customCrClText = ""
    @Published var isRenalFunctionStable = true
    @Published var isOnHemodialysis = false
    @Published var isOnCRRT = false
    
    // Validation and results
    @Published var validationErrors: [ValidationError] = []
    @Published var validationWarnings: [String] = []
    @Published var calculationResult: DosingResult?
    @Published var isCalculating = false
    
    // Computed properties
    var isValid: Bool {
        validationErrors.isEmpty && !weightText.isEmpty && !serumCreatinineText.isEmpty
    }
    
    var calculatedBMI: Double? {
        guard let weight = Double(weightText),
              let height = Double(heightText),
              height > 0 else { return nil }
        
        let heightInMeters = height / 100.0
        return weight / (heightInMeters * heightInMeters)
    }
    
    var calculatedCrCl: Double? {
        // Simplified calculation for display
        guard let weight = Double(weightText),
              let scr = Double(serumCreatinineText) else { return nil }
        
        switch selectedPopulation {
        case .adult:
            guard let age = Double(ageText), let height = Double(heightText) else { return nil }
            let ibw = VancomycinCalculator.calculateIdealBodyWeight(height: height, gender: selectedGender)
            let genderFactor = selectedGender == .female ? 0.85 : 1.0
            return ((140 - age) * ibw * genderFactor) / (72 * scr)
        case .pediatric:
            guard let height = Double(heightText) else { return nil }
            let k = (Double(ageText) ?? 1) < 1 ? 0.33 : 0.55
            return (k * height) / scr
        case .neonate:
            return 20.0 // Placeholder
        }
    }
    
    var targetAUC: Double {
        selectedIndication.targetAUC * getSeverityMultiplier(selectedSeverity)
    }
    
    var patientInput: PatientInput {
        PatientInput(
            populationType: selectedPopulation,
            ageInYears: Double(ageText),
            gender: selectedGender,
            weightInKg: Double(weightText) ?? 0,
            heightInCm: Double(heightText),
            serumCreatinine: Double(serumCreatinineText) ?? 0,
            gestationalAgeWeeks: Double(gestationalAgeText),
            postnatalAgeDays: Double(postnatalAgeText),
            indication: selectedIndication,
            severity: selectedSeverity,
            isRenalFunctionStable: isRenalFunctionStable,
            isOnHemodialysis: isOnHemodialysis,
            isOnCRRT: isOnCRRT,
            crClMethod: selectedCrClMethod,
            customCrCl: Double(customCrClText)
        )
    }
    
    // Validation states
    var ageValidation: ValidationState {
        guard !ageText.isEmpty else { return .empty }
        guard let age = Double(ageText) else { return .invalid("Invalid age format") }
        
        switch selectedPopulation {
        case .adult:
            return age >= 18 ? .valid : .invalid("Adult patients must be ≥18 years")
        case .pediatric:
            return (age >= 0.083 && age < 18) ? .valid : .invalid("Pediatric patients: 1 month - 17 years")
        case .neonate:
            return .valid
        }
    }
    
    var gestationalAgeValidation: ValidationState {
        guard !gestationalAgeText.isEmpty else { return .empty }
        guard let ga = Double(gestationalAgeText) else { return .invalid("Invalid format") }
        return (ga >= 22 && ga <= 44) ? .valid : .invalid("Range: 22-44 weeks")
    }
    
    var postnatalAgeValidation: ValidationState {
        guard !postnatalAgeText.isEmpty else { return .empty }
        guard let pna = Double(postnatalAgeText) else { return .invalid("Invalid format") }
        return (pna >= 0 && pna <= 30) ? .valid : .invalid("Range: 0-30 days")
    }
    
    var weightValidation: ValidationState {
        guard !weightText.isEmpty else { return .empty }
        guard let weight = Double(weightText) else { return .invalid("Invalid weight format") }
        return (weight > 0 && weight <= 300) ? .valid : .invalid("Range: 0-300 kg")
    }
    
    var heightValidation: ValidationState {
        guard !heightText.isEmpty else { return .empty }
        guard let height = Double(heightText) else { return .invalid("Invalid height format") }
        
        switch selectedPopulation {
        case .adult:
            return (height >= 100 && height <= 250) ? .valid : .invalid("Range: 100-250 cm")
        case .pediatric:
            return (height >= 45 && height <= 200) ? .valid : .invalid("Range: 45-200 cm")
        case .neonate:
            return .valid
        }
    }
    
    var creatinineValidation: ValidationState {
        guard !serumCreatinineText.isEmpty else { return .empty }
        guard let scr = Double(serumCreatinineText) else { return .invalid("Invalid format") }
        return (scr > 0 && scr <= 15) ? .valid : .invalid("Range: 0-15 mg/dL")
    }
    
    var customCrClValidation: ValidationState {
        guard selectedCrClMethod == .custom else { return .valid }
        guard !customCrClText.isEmpty else { return .empty }
        guard let crCl = Double(customCrClText) else { return .invalid("Invalid format") }
        return (crCl >= 5 && crCl <= 150) ? .valid : .invalid("Range: 5-150 mL/min")
    }
    
    func validateInput() {
        validationErrors.removeAll()
        validationWarnings.removeAll()
        
        // Perform validation
        do {
            try ValidationEngine.validatePatientInput(patientInput)
            validationWarnings = ValidationEngine.generateValidationWarnings(patientInput)
        } catch {
            if let validationError = error as? ValidationError {
                validationErrors.append(validationError)
            }
        }
    }
    
    func calculateDosing() async {
        isCalculating = true
        defer { isCalculating = false }
        
        do {
            let result = try VancomycinCalculator.calculateDosing(patient: patientInput)
            calculationResult = result
            
            // Track analytics
            AnalyticsManager.shared.track(.calculationPerformed, parameters: [
                "population": selectedPopulation.rawValue,
                "indication": selectedIndication.rawValue,
                "severity": selectedSeverity.rawValue
            ])
            
        } catch {
            if let validationError = error as? ValidationError {
                validationErrors = [validationError]
            } else if let calculationError = error as? CalculationError {
                validationErrors = [ValidationError.invalidWeight(calculationError.localizedDescription)]
            }
        }
    }
    
    func clearAll() {
        ageText = ""
        gestationalAgeText = ""
        postnatalAgeText = ""
        weightText = ""
        heightText = ""
        serumCreatinineText = ""
        customCrClText = ""
        selectedGender = .male
        selectedIndication = .pneumonia
        selectedSeverity = .moderate
        selectedCrClMethod = .ibw
        isRenalFunctionStable = true
        isOnHemodialysis = false
        isOnCRRT = false
        validationErrors.removeAll()
        validationWarnings.removeAll()
        calculationResult = nil
    }
    
    private func getSeverityMultiplier(_ severity: InfectionSeverity) -> Double {
        switch severity {
        case .mild: return 0.9
        case .moderate: return 1.0
        case .severe: return 1.2
        }
    }
}

enum ValidationState {
    case empty
    case valid
    case invalid(String)
}

#Preview {
    NavigationView {
        PatientInputView()
            .environmentObject(UserPreferences())
    }
}

