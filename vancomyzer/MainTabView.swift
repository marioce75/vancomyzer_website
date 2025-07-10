import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var userPreferences: UserPreferences
    @State private var selectedTab = 0
    @State private var showingSettings = false
    @State private var showingTutorial = false
    
    var body: some View {
        TabView(selection: $selectedTab) {
            // Initial Dosing Tab
            NavigationView {
                PatientInputView()
                    .navigationTitle("Initial Dosing")
                    .navigationBarTitleDisplayMode(.large)
                    .toolbar {
                        ToolbarItemGroup(placement: .navigationBarTrailing) {
                            Button(action: { showingTutorial = true }) {
                                Image(systemName: "questionmark.circle")
                            }
                            .accessibilityLabel("Help")
                            
                            Button(action: { showingSettings = true }) {
                                Image(systemName: "gearshape")
                            }
                            .accessibilityLabel("Settings")
                        }
                    }
            }
            .tabItem {
                Image(systemName: "calculator")
                Text("Initial Dosing")
            }
            .tag(0)
            
            // Bayesian Optimization Tab
            NavigationView {
                BayesianDosingView()
                    .navigationTitle("Bayesian Dosing")
                    .navigationBarTitleDisplayMode(.large)
                    .toolbar {
                        ToolbarItemGroup(placement: .navigationBarTrailing) {
                            Button(action: { showingTutorial = true }) {
                                Image(systemName: "questionmark.circle")
                            }
                            .accessibilityLabel("Help")
                            
                            Button(action: { showingSettings = true }) {
                                Image(systemName: "gearshape")
                            }
                            .accessibilityLabel("Settings")
                        }
                    }
            }
            .tabItem {
                Image(systemName: "brain.head.profile")
                Text("Bayesian")
            }
            .tag(1)
            
            // Guidelines Tab
            NavigationView {
                GuidelinesView()
                    .navigationTitle("Guidelines")
                    .navigationBarTitleDisplayMode(.large)
            }
            .tabItem {
                Image(systemName: "book.fill")
                Text("Guidelines")
            }
            .tag(2)
            
            // History Tab
            NavigationView {
                CalculationHistoryView()
                    .navigationTitle("History")
                    .navigationBarTitleDisplayMode(.large)
                    .toolbar {
                        ToolbarItem(placement: .navigationBarTrailing) {
                            Button(action: { showingSettings = true }) {
                                Image(systemName: "gearshape")
                            }
                            .accessibilityLabel("Settings")
                        }
                    }
            }
            .tabItem {
                Image(systemName: "clock.fill")
                Text("History")
            }
            .tag(3)
            
            // About Tab
            NavigationView {
                AboutView()
                    .navigationTitle("About")
                    .navigationBarTitleDisplayMode(.large)
                    .toolbar {
                        ToolbarItem(placement: .navigationBarTrailing) {
                            Button(action: { showingSettings = true }) {
                                Image(systemName: "gearshape")
                            }
                            .accessibilityLabel("Settings")
                        }
                    }
            }
            .tabItem {
                Image(systemName: "info.circle.fill")
                Text("About")
            }
            .tag(4)
        }
        .accentColor(.vancoBlue)
        .sheet(isPresented: $showingSettings) {
            SettingsView()
                .environmentObject(userPreferences)
        }
        .sheet(isPresented: $showingTutorial) {
            VancomycinTutorial()
        }
        .onChange(of: selectedTab) { newTab in
            // Track tab selection analytics
            let tabNames = ["initial_dosing", "bayesian", "guidelines", "history", "about"]
            if newTab < tabNames.count {
                AnalyticsManager.shared.track(.appLaunched, parameters: ["tab": tabNames[newTab]])
            }
        }
    }
}

// MARK: - Guidelines View

struct GuidelinesView: View {
    @State private var selectedGuideline = 0
    
    var body: some View {
        VStack(spacing: 0) {
            // Guideline selector
            Picker("Guidelines", selection: $selectedGuideline) {
                Text("ASHP/IDSA 2020").tag(0)
                Text("IDSA Pediatric").tag(1)
                Text("Neonatal").tag(2)
                Text("Bayesian").tag(3)
            }
            .pickerStyle(SegmentedPickerStyle())
            .padding()
            
            // Content
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 16) {
                    switch selectedGuideline {
                    case 0:
                        AdultGuidelinesContent()
                    case 1:
                        PediatricGuidelinesContent()
                    case 2:
                        NeonatalGuidelinesContent()
                    case 3:
                        BayesianGuidelinesContent()
                    default:
                        EmptyView()
                    }
                }
                .padding()
            }
        }
    }
}

struct AdultGuidelinesContent: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            GuidelineSection(
                title: "ASHP/IDSA 2020 Adult Guidelines",
                content: [
                    "Target AUC₀₋₂₄: 400-600 mg·h/L",
                    "Loading dose: 25-30 mg/kg for severe infections",
                    "Maintenance: 15-20 mg/kg every 8-12 hours",
                    "Monitor trough levels: 10-20 mg/L",
                    "AUC-guided dosing preferred when available"
                ]
            )
            
            GuidelineSection(
                title: "Creatinine Clearance Methods",
                content: [
                    "Cockcroft-Gault equation recommended",
                    "Use actual body weight if ≤20% above IBW",
                    "Use adjusted body weight if >20% above IBW",
                    "Consider rounding SCr to 1.0 mg/dL minimum"
                ]
            )
            
            GuidelineSection(
                title: "Monitoring",
                content: [
                    "Obtain levels before 4th dose (steady state)",
                    "Trough levels: draw within 30 min before dose",
                    "Peak levels: 1-2 hours after infusion end",
                    "Monitor SCr and BUN at least every 2-3 days",
                    "Assess hearing if therapy >7 days"
                ]
            )
        }
    }
}

struct PediatricGuidelinesContent: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            GuidelineSection(
                title: "IDSA 2011 Pediatric Guidelines",
                content: [
                    "Target trough: 10-15 mg/L for most infections",
                    "Target trough: 15-20 mg/L for severe infections",
                    "Dosing: 40-60 mg/kg/day divided every 6-8 hours",
                    "Loading dose: 20 mg/kg for severe infections"
                ]
            )
            
            GuidelineSection(
                title: "Age-Specific Considerations",
                content: [
                    "Neonates: Extended intervals due to immature clearance",
                    "Infants (1-12 months): Higher clearance, more frequent dosing",
                    "Children (1-12 years): Adult-like clearance per kg",
                    "Adolescents: Transition to adult dosing guidelines"
                ]
            )
            
            GuidelineSection(
                title: "Safety Monitoring",
                content: [
                    "More frequent monitoring in young children",
                    "Consider developmental pharmacokinetics",
                    "Monitor growth and development",
                    "Hearing assessment especially important"
                ]
            )
        }
    }
}

struct NeonatalGuidelinesContent: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            GuidelineSection(
                title: "Neonatal Dosing Guidelines",
                content: [
                    "Dosing based on gestational and postnatal age",
                    "Target trough: 5-15 mg/L",
                    "Extended dosing intervals (12-24 hours)",
                    "Maturation adjustment for clearance"
                ]
            )
            
            GuidelineSection(
                title: "Gestational Age Considerations",
                content: [
                    "<30 weeks: Very immature clearance",
                    "30-36 weeks: Moderate maturation",
                    "≥37 weeks: Near-term maturation",
                    "Postnatal age also affects clearance"
                ]
            )
            
            GuidelineSection(
                title: "Special Considerations",
                content: [
                    "Higher volume of distribution",
                    "Immature renal function",
                    "Rapid developmental changes",
                    "Close monitoring essential"
                ]
            )
        }
    }
}

struct BayesianGuidelinesContent: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            GuidelineSection(
                title: "Bayesian Optimization",
                content: [
                    "Uses patient-specific pharmacokinetic parameters",
                    "Requires at least one vancomycin level",
                    "More accurate than population-based dosing",
                    "Provides confidence intervals for predictions"
                ]
            )
            
            GuidelineSection(
                title: "Level Collection",
                content: [
                    "Steady state preferred (after 3-4 doses)",
                    "Random levels acceptable for Bayesian analysis",
                    "Document exact timing of dose and sample",
                    "Multiple levels improve precision"
                ]
            )
            
            GuidelineSection(
                title: "Clinical Application",
                content: [
                    "Especially useful for complex patients",
                    "Patients with changing renal function",
                    "Critically ill patients",
                    "When population dosing fails"
                ]
            )
        }
    }
}

struct GuidelineSection: View {
    let title: String
    let content: [String]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
                .foregroundColor(.vancoBlue)
            
            VStack(alignment: .leading, spacing: 4) {
                ForEach(content, id: \.self) { item in
                    HStack(alignment: .top, spacing: 8) {
                        Text("•")
                            .foregroundColor(.vancoBlue)
                        Text(item)
                            .font(.subheadline)
                        Spacer()
                    }
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

// MARK: - Calculation History View

struct CalculationHistoryView: View {
    @State private var calculations: [DosingResult] = []
    @State private var showingExportSheet = false
    
    var body: some View {
        Group {
            if calculations.isEmpty {
                VStack(spacing: 20) {
                    Image(systemName: "clock.badge.questionmark")
                        .font(.system(size: 60))
                        .foregroundColor(.secondary)
                    
                    Text("No Calculations Yet")
                        .font(.title2)
                        .fontWeight(.semibold)
                    
                    Text("Your calculation history will appear here")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding()
            } else {
                List {
                    ForEach(calculations.indices, id: \.self) { index in
                        CalculationHistoryRow(result: calculations[index])
                    }
                    .onDelete(perform: deleteCalculations)
                }
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Export") {
                            showingExportSheet = true
                        }
                        .disabled(calculations.isEmpty)
                    }
                }
            }
        }
        .onAppear {
            loadCalculationHistory()
        }
        .sheet(isPresented: $showingExportSheet) {
            ExportView(calculations: calculations)
        }
    }
    
    private func loadCalculationHistory() {
        // Load from UserDefaults or Core Data
        // Placeholder implementation
    }
    
    private func deleteCalculations(at offsets: IndexSet) {
        calculations.remove(atOffsets: offsets)
        // Save to persistent storage
    }
}

struct CalculationHistoryRow: View {
    let result: DosingResult
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(result.dosingSummary)
                    .font(.headline)
                
                Spacer()
                
                Text(result.timestamp, style: .date)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            HStack {
                Label("AUC: \(String(format: "%.0f", result.predictedAUC))", systemImage: "chart.line.uptrend.xyaxis")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                Text(result.calculationMethod)
                    .font(.caption)
                    .foregroundColor(.vancoBlue)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Export View

struct ExportView: View {
    let calculations: [DosingResult]
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Text("Export calculation history as CSV or PDF")
                    .multilineTextAlignment(.center)
                    .padding()
                
                VStack(spacing: 12) {
                    Button("Export as CSV") {
                        exportAsCSV()
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    
                    Button("Export as PDF") {
                        exportAsPDF()
                    }
                    .buttonStyle(SecondaryButtonStyle())
                }
                .padding()
                
                Spacer()
            }
            .navigationTitle("Export History")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                leading: Button("Cancel") {
                    presentationMode.wrappedValue.dismiss()
                }
            )
        }
    }
    
    private func exportAsCSV() {
        // Implementation for CSV export
        presentationMode.wrappedValue.dismiss()
    }
    
    private func exportAsPDF() {
        // Implementation for PDF export
        presentationMode.wrappedValue.dismiss()
    }
}

// MARK: - Button Styles

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(.white)
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color.vancoBlue)
            .cornerRadius(12)
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(.vancoBlue)
            .padding()
            .frame(maxWidth: .infinity)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.vancoBlue, lineWidth: 2)
            )
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
    }
}

#Preview {
    MainTabView()
        .environmentObject(UserPreferences())
}

